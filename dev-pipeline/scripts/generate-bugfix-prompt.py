#!/usr/bin/env python3
"""Generate a session-specific bug fix bootstrap prompt from template and bug-fix-list.json.

Reads the bugfix-bootstrap-prompt.md template and a bug-fix-list.json, resolves all
{{PLACEHOLDER}} variables, handles conditional blocks, and writes the rendered
prompt to the specified output path.

Usage:
    python3 generate-bugfix-prompt.py \
        --bug-list <path> --bug-id <id> \
        --session-id <id> --run-id <id> \
        --retry-count <n> --resume-phase <n|null> \
        --state-dir <path> --output <path>
"""

import argparse
import json
import os
import re
import sys

from utils import load_json_file, setup_logging


DEFAULT_MAX_RETRIES = 3

LOGGER = setup_logging("generate-bugfix-prompt")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a session-specific bug fix bootstrap prompt from a template "
            "and bug-fix-list.json."
        )
    )
    parser.add_argument("--bug-list", required=True, help="Path to bug-fix-list.json")
    parser.add_argument("--bug-id", required=True, help="Bug ID to generate prompt for (e.g. B-001)")
    parser.add_argument("--session-id", required=True, help="Session ID for this pipeline session")
    parser.add_argument("--run-id", required=True, help="Pipeline run ID")
    parser.add_argument("--retry-count", required=True, help="Current retry count")
    parser.add_argument("--resume-phase", required=True, help='Phase to resume from, or "null" for fresh start')
    parser.add_argument("--state-dir", default=None, help="State directory path for reading previous session info")
    parser.add_argument("--output", required=True, help="Output path for the rendered prompt")
    parser.add_argument("--template", default=None, help="Custom template path. Defaults to {script_dir}/../templates/bugfix-bootstrap-prompt.md")
    return parser.parse_args()


def read_text_file(path):
    """Read and return the text content of a file."""
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, "File not found: {}".format(abs_path)
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            return f.read(), None
    except IOError as e:
        return None, "Cannot read file: {}".format(str(e))


def find_bug(bugs, bug_id):
    """Find and return the bug dict matching the given ID."""
    for bug in bugs:
        if isinstance(bug, dict) and bug.get("id") == bug_id:
            return bug
    return None


def format_acceptance_criteria(criteria):
    """Format acceptance criteria as a markdown bullet list."""
    if not criteria:
        return "- (none specified)"
    lines = []
    for item in criteria:
        lines.append("- {}".format(item))
    return "\n".join(lines)


def format_global_context(global_context):
    """Format global_context dict as a key-value list."""
    if not global_context:
        return "- (none specified)"
    lines = []
    for key, value in sorted(global_context.items()):
        lines.append("- **{}**: {}".format(key, value))
    return "\n".join(lines)


def format_error_source_details(error_source):
    """Format error_source fields into markdown detail lines."""
    if not error_source or not isinstance(error_source, dict):
        return "- (no error source details)"
    lines = []
    etype = error_source.get("type", "unknown")

    if etype == "stack_trace" and error_source.get("stack_trace"):
        lines.append("- **Stack Trace**:")
        lines.append("```")
        lines.append(error_source["stack_trace"])
        lines.append("```")
    if error_source.get("error_message"):
        lines.append("- **Error Message**: {}".format(error_source["error_message"]))
    if etype == "log_pattern" and error_source.get("log_snippet"):
        lines.append("- **Log Snippet**:")
        lines.append("```")
        lines.append(error_source["log_snippet"])
        lines.append("```")
    if etype == "failed_test" and error_source.get("failed_test_path"):
        lines.append("- **Failed Test**: `{}`".format(error_source["failed_test_path"]))
    if etype == "user_report" and error_source.get("reproduction_steps"):
        lines.append("- **Reproduction Steps**:")
        for i, step in enumerate(error_source["reproduction_steps"], 1):
            lines.append("  {}. {}".format(i, step))

    if not lines:
        lines.append("- (no additional details)")
    return "\n".join(lines)


def format_environment(env):
    """Format environment dict as a key-value list."""
    if not env or not isinstance(env, dict):
        return "- (not specified)"
    lines = []
    for key, value in sorted(env.items()):
        if value:
            lines.append("- **{}**: {}".format(key, value))
    if not lines:
        return "- (not specified)"
    return "\n".join(lines)


def get_prev_session_status(state_dir, bug_id):
    """Read previous session status from state dir if available."""
    if not state_dir:
        return "N/A (first run)"

    bug_status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    if not os.path.isfile(bug_status_path):
        return "N/A (first run)"

    try:
        with open(bug_status_path, "r", encoding="utf-8") as f:
            bug_status = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read bug status)"

    last_session_id = bug_status.get("last_session_id")
    if not last_session_id:
        return "N/A (first run)"

    session_status_path = os.path.join(
        state_dir, "bugs", bug_id, "sessions",
        last_session_id, "session-status.json"
    )
    if not os.path.isfile(session_status_path):
        return "N/A (previous session status file not found)"

    try:
        with open(session_status_path, "r", encoding="utf-8") as f:
            session_data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read previous session status)"

    status = session_data.get("status", "unknown")
    checkpoint = session_data.get("checkpoint_reached", "none")
    current_phase = session_data.get("current_phase", "unknown")
    errors = session_data.get("errors", [])

    result = "{} (checkpoint: {}, last phase: {})".format(
        status, checkpoint, current_phase
    )
    if errors:
        result += " — errors: {}".format("; ".join(str(e) for e in errors))
    return result


def resolve_project_root(script_dir):
    """Resolve project root as the parent of dev-pipeline/."""
    dev_pipeline_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(dev_pipeline_dir)
    return os.path.abspath(project_root)


def build_replacements(args, bug, global_context, script_dir):
    """Build the full dict of placeholder -> replacement value."""
    project_root = resolve_project_root(script_dir)

    # Platform-aware agent/team path resolution
    platform = os.environ.get("PRIZMKIT_PLATFORM", "")
    home_dir = os.path.expanduser("~")

    if not platform:
        if os.path.isdir(os.path.join(project_root, ".claude", "agents")):
            platform = "claude"
        else:
            platform = "codebuddy"

    if platform == "claude":
        agents_dir = os.path.join(project_root, ".claude", "agents")
        team_config_path = os.path.join(project_root, ".claude", "team-info.json")
    else:
        agents_dir = os.path.join(project_root, ".codebuddy", "agents")
        team_config_path = os.path.join(
            home_dir, ".codebuddy", "teams", "prizm-dev-team", "config.json"
        )

    dev_subagent = os.path.join(agents_dir, "prizm-dev-team-dev.md")
    reviewer_subagent = os.path.join(agents_dir, "prizm-dev-team-reviewer.md")

    # Session status path
    session_status_path = os.path.join(
        project_root, "dev-pipeline", "bugfix-state", "bugs", args.bug_id,
        "sessions", args.session_id, "session-status.json"
    )

    prev_status = get_prev_session_status(args.state_dir, args.bug_id)

    # Error source
    error_source = bug.get("error_source", {})
    error_type = error_source.get("type", "unknown") if isinstance(error_source, dict) else "unknown"

    # Determine fix scope from affected_modules or title
    affected_modules = bug.get("affected_modules", [])
    if affected_modules:
        fix_scope = affected_modules[0]
    else:
        fix_scope = bug.get("title", "unknown").split()[0].lower() if bug.get("title") else "unknown"

    # Determine verification type
    vtype = bug.get("verification_type", "automated")

    replacements = {
        "{{RUN_ID}}": args.run_id,
        "{{SESSION_ID}}": args.session_id,
        "{{BUG_ID}}": args.bug_id,
        "{{BUG_TITLE}}": bug.get("title", ""),
        "{{SEVERITY}}": bug.get("severity", "medium"),
        "{{VERIFICATION_TYPE}}": vtype,
        "{{RETRY_COUNT}}": str(args.retry_count),
        "{{MAX_RETRIES}}": str(DEFAULT_MAX_RETRIES),
        "{{PREV_SESSION_STATUS}}": prev_status,
        "{{RESUME_PHASE}}": args.resume_phase,
        "{{BUG_DESCRIPTION}}": bug.get("description", ""),
        "{{ERROR_SOURCE_TYPE}}": error_type,
        "{{ERROR_SOURCE_DETAILS}}": format_error_source_details(error_source),
        "{{ACCEPTANCE_CRITERIA}}": format_acceptance_criteria(
            bug.get("acceptance_criteria", [])
        ),
        "{{AFFECTED_FEATURE}}": bug.get("affected_feature", "N/A"),
        "{{ENVIRONMENT}}": format_environment(bug.get("environment")),
        "{{GLOBAL_CONTEXT}}": format_global_context(global_context),
        "{{TEAM_CONFIG_PATH}}": team_config_path,
        "{{DEV_SUBAGENT_PATH}}": dev_subagent,
        "{{REVIEWER_SUBAGENT_PATH}}": reviewer_subagent,
        "{{SESSION_STATUS_PATH}}": session_status_path,
        "{{PROJECT_ROOT}}": project_root,
        "{{FIX_SCOPE}}": fix_scope,
        "{{TIMESTAMP}}": "",  # 占位符，agent 自行填写时间戳
    }

    return replacements


def process_conditional_blocks(content, bug):
    """Handle conditional blocks based on verification_type."""
    vtype = bug.get("verification_type", "automated")
    is_manual_or_hybrid = vtype in ("manual", "hybrid")

    if is_manual_or_hybrid:
        content = content.replace("{{IF_VERIFICATION_MANUAL_OR_HYBRID}}\n", "")
        content = content.replace("{{IF_VERIFICATION_MANUAL_OR_HYBRID}}", "")
        content = content.replace("{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}\n", "")
        content = content.replace("{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}", "")
    else:
        # 删除整个条件块
        content = re.sub(
            r"\{\{IF_VERIFICATION_MANUAL_OR_HYBRID\}\}.*?\{\{END_IF_VERIFICATION_MANUAL_OR_HYBRID\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    return content


def render_template(template_content, replacements, bug):
    """Render the template by processing conditionals and replacing placeholders."""
    # Step 1: Process conditional blocks
    content = process_conditional_blocks(template_content, bug)

    # Step 2: Replace all {{PLACEHOLDER}} variables
    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)

    return content


def write_output(output_path, content):
    """Write the rendered content to the output file."""
    abs_path = os.path.abspath(output_path)
    output_dir = os.path.dirname(abs_path)
    if output_dir and not os.path.isdir(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
        except OSError as e:
            return "Cannot create output directory: {}".format(str(e))
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)
    except IOError as e:
        return "Cannot write output file: {}".format(str(e))
    return None


def emit_failure(message):
    """Emit standardized failure JSON and exit."""
    print(json.dumps({"success": False, "error": message}, indent=2, ensure_ascii=False))
    sys.exit(1)


def main():
    args = parse_args()

    # Resolve script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Resolve template path
    if args.template:
        template_path = args.template
    else:
        template_path = os.path.join(
            script_dir, "..", "templates", "bugfix-bootstrap-prompt.md"
        )

    # Load template
    template_content, err = read_text_file(template_path)
    if err:
        emit_failure("Template error: {}".format(err))

    # Load bug fix list
    bug_list_data, err = load_json_file(args.bug_list)
    if err:
        emit_failure("Bug list error: {}".format(err))

    # Extract bugs array
    bugs = bug_list_data.get("bugs")
    if not isinstance(bugs, list):
        emit_failure("Bug fix list does not contain a 'bugs' array")

    # Find the target bug
    bug = find_bug(bugs, args.bug_id)
    if bug is None:
        emit_failure("Bug '{}' not found in bug fix list".format(args.bug_id))

    # Extract global context
    global_context = bug_list_data.get("global_context", {})
    if not isinstance(global_context, dict):
        global_context = {}

    # Build replacements
    replacements = build_replacements(args, bug, global_context, script_dir)

    # Render the template
    rendered = render_template(template_content, replacements, bug)

    # Write the output
    err = write_output(args.output, rendered)
    if err:
        emit_failure(err)

    # Success
    output = {
        "success": True,
        "output_path": os.path.abspath(args.output),
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        emit_failure("generate-bugfix-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-bugfix-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
