#!/usr/bin/env python3
"""Generate a session-specific bootstrap prompt from template and feature list.

Reads a bootstrap-prompt.md template and a feature-list.json, resolves all
{{PLACEHOLDER}} variables, handles conditional blocks, and writes the rendered
prompt to the specified output path.

Usage:
    python3 generate-bootstrap-prompt.py \
        --feature-list <path> --feature-id <id> \
        --session-id <id> --run-id <id> \
        --retry-count <n> --resume-phase <n|null> \
        --output <path>
"""

import argparse
import json
import os
import re
import sys

from utils import load_json_file, setup_logging


DEFAULT_MAX_RETRIES = 3

LOGGER = setup_logging("generate-bootstrap-prompt")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate a session-specific bootstrap prompt from a template "
            "and feature-list.json."
        )
    )
    parser.add_argument(
        "--feature-list",
        required=True,
        help="Path to feature-list.json",
    )
    parser.add_argument(
        "--feature-id",
        required=True,
        help="Feature ID to generate prompt for (e.g. F-001)",
    )
    parser.add_argument(
        "--session-id",
        required=True,
        help="Session ID for this pipeline session",
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Pipeline run ID",
    )
    parser.add_argument(
        "--retry-count",
        required=True,
        help="Current retry count",
    )
    parser.add_argument(
        "--resume-phase",
        required=True,
        help='Phase to resume from, or "null" for fresh start',
    )
    parser.add_argument(
        "--state-dir",
        default=None,
        help="State directory path for reading previous session info",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for the rendered prompt",
    )
    parser.add_argument(
        "--template",
        default=None,
        help=(
            "Custom template path. Defaults to "
            "{script_dir}/../templates/bootstrap-prompt.md"
        ),
    )
    parser.add_argument(
        "--mode",
        choices=["lite", "standard", "full"],
        default=None,
        help="Override pipeline mode (default: auto-detect from complexity)",
    )
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


def find_feature(features, feature_id):
    """Find and return the feature dict matching the given ID."""
    for feature in features:
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            return feature
    return None


def compute_feature_slug(feature_id, title):
    """Compute the prizmkit feature slug: ###-kebab-case-name.

    e.g. F-001 + "Project Infrastructure Setup" -> "001-project-infrastructure-setup"
    The prizmkit skills use this slug to create per-feature directories.
    """
    # Extract numeric part from feature_id (e.g., "F-001" -> "001")
    numeric = feature_id.replace("F-", "").replace("f-", "")
    # Pad to 3 digits
    numeric = numeric.zfill(3)

    # Convert title to kebab-case
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)  # remove non-alphanumeric
    slug = re.sub(r"[\s]+", "-", slug.strip())  # spaces to hyphens
    slug = re.sub(r"-+", "-", slug)  # collapse multiple hyphens
    slug = slug.strip("-")

    return "{}-{}".format(numeric, slug)


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


def get_completed_dependencies(features, feature):
    """Look up dependency features and list those with status=completed."""
    deps = feature.get("dependencies", [])
    if not deps:
        return "- (no dependencies)"

    # Build a lookup map
    feature_map = {}
    for f in features:
        if isinstance(f, dict) and "id" in f:
            feature_map[f["id"]] = f

    completed = []
    for dep_id in deps:
        dep = feature_map.get(dep_id)
        if dep and dep.get("status") == "completed":
            completed.append("- {} - {} (completed)".format(
                dep_id, dep.get("title", "Untitled")
            ))

    if not completed:
        return "- (no completed dependencies yet)"
    return "\n".join(completed)


def get_prev_session_status(state_dir, feature_id):
    """Read previous session status from state dir if available."""
    if not state_dir:
        return "N/A (first run)"

    # Try to read the feature status file to find the last session
    feature_status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    if not os.path.isfile(feature_status_path):
        return "N/A (first run)"

    try:
        with open(feature_status_path, "r", encoding="utf-8") as f:
            feature_status = json.load(f)
    except (json.JSONDecodeError, IOError):
        return "N/A (could not read feature status)"

    last_session_id = feature_status.get("last_session_id")
    if not last_session_id:
        return "N/A (first run)"

    # Try to read the last session's session-status.json
    session_status_path = os.path.join(
        state_dir, "features", feature_id, "sessions",
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
    """Resolve project root as the parent directory of dev-pipeline/.

    The script lives at dev-pipeline/scripts/, so project root is two
    levels up from the script directory.
    """
    # script_dir = .../dev-pipeline/scripts
    # dev_pipeline_dir = .../dev-pipeline
    # project_root = .../
    dev_pipeline_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(dev_pipeline_dir)
    return os.path.abspath(project_root)


def process_conditional_blocks(content, resume_phase):
    """Handle conditional blocks based on resume_phase and pipeline mode.

    Supports:
    - {{IF_FRESH_START}} / {{END_IF_FRESH_START}}
    - {{IF_RESUME}} / {{END_IF_RESUME}}
    - {{IF_INIT_NEEDED}} / {{END_IF_INIT_NEEDED}}
    - {{IF_INIT_DONE}} / {{END_IF_INIT_DONE}}
    - {{IF_MODE_LITE}} / {{END_IF_MODE_LITE}}
    - {{IF_MODE_STANDARD}} / {{END_IF_MODE_STANDARD}}
    - {{IF_MODE_FULL}} / {{END_IF_MODE_FULL}}
    """
    is_resume = resume_phase != "null"

    if is_resume:
        content = re.sub(r"\{\{IF_RESUME\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_RESUME\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_FRESH_START\}\}.*?\{\{END_IF_FRESH_START\}\}\n?",
            "", content, flags=re.DOTALL,
        )
    else:
        content = re.sub(r"\{\{IF_FRESH_START\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_FRESH_START\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_RESUME\}\}.*?\{\{END_IF_RESUME\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    return content


def process_mode_blocks(content, pipeline_mode, init_done):
    """Process pipeline mode and init conditional blocks.

    Keeps the block matching the current mode, removes the others.
    """
    modes = ["lite", "standard", "full"]

    for mode in modes:
        tag_open = "{{{{IF_MODE_{}}}}}".format(mode.upper())
        tag_close = "{{{{END_IF_MODE_{}}}}}".format(mode.upper())

        if mode == pipeline_mode:
            # Keep content, remove tags
            content = content.replace(tag_open + "\n", "")
            content = content.replace(tag_open, "")
            content = content.replace(tag_close + "\n", "")
            content = content.replace(tag_close, "")
        else:
            # Remove entire block
            pattern = re.escape(tag_open) + r".*?" + re.escape(tag_close) + r"\n?"
            content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Init blocks
    if init_done:
        content = re.sub(r"\{\{IF_INIT_DONE\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_INIT_DONE\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_INIT_NEEDED\}\}.*?\{\{END_IF_INIT_NEEDED\}\}\n?",
            "", content, flags=re.DOTALL,
        )
    else:
        content = re.sub(r"\{\{IF_INIT_NEEDED\}\}\n?", "", content)
        content = re.sub(r"\{\{END_IF_INIT_NEEDED\}\}\n?", "", content)
        content = re.sub(
            r"\{\{IF_INIT_DONE\}\}.*?\{\{END_IF_INIT_DONE\}\}\n?",
            "", content, flags=re.DOTALL,
        )

    return content


def detect_init_status(project_root):
    """Check if PrizmKit init has already been done."""
    prizm_docs = os.path.join(project_root, ".prizm-docs", "root.prizm")
    prizmkit_config = os.path.join(project_root, ".prizmkit", "config.json")
    return os.path.isfile(prizm_docs) and os.path.isfile(prizmkit_config)


def detect_existing_artifacts(project_root, feature_slug):
    """Check which planning artifacts already exist for this feature.

    Returns a dict with keys: has_spec, has_plan, has_tasks, all_complete.
    """
    specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
    result = {
        "has_spec": os.path.isfile(os.path.join(specs_dir, "spec.md")),
        "has_plan": os.path.isfile(os.path.join(specs_dir, "plan.md")),
        "has_tasks": os.path.isfile(os.path.join(specs_dir, "tasks.md")),
    }
    result["all_complete"] = all([
        result["has_spec"], result["has_plan"], result["has_tasks"]
    ])
    return result


def determine_pipeline_mode(complexity):
    """Map estimated_complexity to pipeline mode.

    Returns: 'lite', 'standard', or 'full'
    """
    mapping = {
        "low": "lite",
        "medium": "standard",
        "high": "full",
        "critical": "full",
    }
    return mapping.get(complexity, "standard")


def build_replacements(args, feature, features, global_context, script_dir):
    """Build the full dict of placeholder -> replacement value."""
    project_root = resolve_project_root(script_dir)

    # Resolve paths - platform-aware agent/team resolution
    platform = os.environ.get("PRIZMKIT_PLATFORM", "")
    home_dir = os.path.expanduser("~")

    # Auto-detect platform if not set
    if not platform:
        has_claude = os.path.isdir(os.path.join(project_root, ".claude", "agents"))
        has_codebuddy = os.path.isdir(os.path.join(project_root, ".codebuddy", "agents"))
        if has_claude:
            platform = "claude"
        elif has_codebuddy:
            platform = "codebuddy"
        else:
            raise RuntimeError(
                "PrizmKit agents not found. Neither .claude/agents/ nor .codebuddy/agents/ exists. "
                "Run `npx prizmkit install` first, or set PRIZMKIT_PLATFORM=claude|codebuddy explicitly."
            )

    if platform == "claude":
        # Claude Code: agents in .claude/agents/, no native team config
        agents_dir = os.path.join(project_root, ".claude", "agents")
        team_config_path = os.path.join(
            project_root, ".claude", "team-info.json",
        )
    else:
        # CodeBuddy: agents in .codebuddy/agents/, team in ~/.codebuddy/teams/
        agents_dir = os.path.join(project_root, ".codebuddy", "agents")
        team_config_path = os.path.join(
            home_dir, ".codebuddy", "teams", "prizm-dev-team", "config.json",
        )

    # Agent definitions are .md files in the platform-specific agents dir
    coordinator_subagent = os.path.join(
        agents_dir, "prizm-dev-team-coordinator.md",
    )
    pm_subagent = os.path.join(
        agents_dir, "prizm-dev-team-pm.md",
    )
    dev_subagent = os.path.join(
        agents_dir, "prizm-dev-team-dev.md",
    )
    reviewer_subagent = os.path.join(
        agents_dir, "prizm-dev-team-reviewer.md",
    )
    # Validator scripts - check if they exist in .codebuddy/scripts/, otherwise use dev-pipeline/scripts/
    validator_scripts_dir = os.path.join(project_root, "dev-pipeline", "scripts")
    init_script_path = os.path.join(validator_scripts_dir, "init-dev-team.py")

    # Session status path (relative to dev-pipeline/)
    session_status_path = os.path.join(
        "dev-pipeline", "state", "features", args.feature_id,
        "sessions", args.session_id, "session-status.json",
    )
    # Make it relative from project root
    session_status_abs = os.path.join(project_root, session_status_path)

    prev_status = get_prev_session_status(args.state_dir, args.feature_id)

    # Compute feature slug for per-feature directory naming
    feature_slug = compute_feature_slug(
        args.feature_id, feature.get("title", "")
    )

    # Detect project state
    init_done = detect_init_status(project_root)
    artifacts = detect_existing_artifacts(project_root, feature_slug)
    complexity = feature.get("estimated_complexity", "medium")
    if args.mode:
        pipeline_mode = args.mode
    else:
        pipeline_mode = determine_pipeline_mode(complexity)

    # Auto-detect resume: if all planning artifacts exist and resume_phase
    # is "null" (fresh start), skip to Phase 6
    effective_resume = args.resume_phase
    if effective_resume == "null" and artifacts["all_complete"]:
        effective_resume = "6"

    replacements = {
        "{{RUN_ID}}": args.run_id,
        "{{SESSION_ID}}": args.session_id,
        "{{FEATURE_ID}}": args.feature_id,
        "{{FEATURE_LIST_PATH}}": os.path.abspath(args.feature_list),
        "{{FEATURE_TITLE}}": feature.get("title", ""),
        "{{RETRY_COUNT}}": str(args.retry_count),
        "{{MAX_RETRIES}}": str(DEFAULT_MAX_RETRIES),
        "{{PREV_SESSION_STATUS}}": prev_status,
        "{{RESUME_PHASE}}": args.resume_phase,
        "{{FEATURE_DESCRIPTION}}": feature.get("description", ""),
        "{{ACCEPTANCE_CRITERIA}}": format_acceptance_criteria(
            feature.get("acceptance_criteria", [])
        ),
        "{{COMPLETED_DEPENDENCIES}}": get_completed_dependencies(
            features, feature
        ),
        "{{GLOBAL_CONTEXT}}": format_global_context(global_context),
        "{{TEAM_CONFIG_PATH}}": team_config_path,
        "{{COORDINATOR_SUBAGENT_PATH}}": coordinator_subagent,
        "{{PM_SUBAGENT_PATH}}": pm_subagent,
        "{{DEV_SUBAGENT_PATH}}": dev_subagent,
        "{{REVIEWER_SUBAGENT_PATH}}": reviewer_subagent,
        "{{VALIDATOR_SCRIPTS_DIR}}": validator_scripts_dir,
        "{{INIT_SCRIPT_PATH}}": init_script_path,
        "{{SESSION_STATUS_PATH}}": session_status_abs,
        "{{PROJECT_ROOT}}": project_root,
        "{{FEATURE_SLUG}}": feature_slug,
        "{{PIPELINE_MODE}}": pipeline_mode,
        "{{COMPLEXITY}}": complexity,
        "{{INIT_DONE}}": "true" if init_done else "false",
        "{{HAS_SPEC}}": "true" if artifacts["has_spec"] else "false",
        "{{HAS_PLAN}}": "true" if artifacts["has_plan"] else "false",
        "{{HAS_TASKS}}": "true" if artifacts["has_tasks"] else "false",
        "{{ARTIFACTS_COMPLETE}}": "true" if artifacts["all_complete"] else "false",
    }

    return replacements, effective_resume


def render_template(template_content, replacements, resume_phase):
    """Render the template by processing conditionals and replacing placeholders."""
    # Step 1: Process fresh_start/resume conditional blocks
    content = process_conditional_blocks(template_content, resume_phase)

    # Step 2: Process mode and init conditional blocks
    pipeline_mode = replacements.get("{{PIPELINE_MODE}}", "standard")
    init_done = replacements.get("{{INIT_DONE}}", "false") == "true"
    content = process_mode_blocks(content, pipeline_mode, init_done)

    # Step 3: Replace all {{PLACEHOLDER}} variables
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
        # Determine pipeline mode to select the right tier template
        _complexity = None
        try:
            _fl, _ = load_json_file(args.feature_list)
            if _fl:
                for _f in _fl.get("features", []):
                    if isinstance(_f, dict) and _f.get("id") == args.feature_id:
                        _complexity = _f.get("estimated_complexity", "medium")
                        break
        except Exception:
            pass
        _mode = args.mode or determine_pipeline_mode(_complexity or "medium")
        _tier_file_map = {
            "lite": "bootstrap-tier1.md",
            "standard": "bootstrap-tier2.md",
            "full": "bootstrap-tier3.md",
        }
        _tier_file = _tier_file_map.get(_mode, "bootstrap-tier2.md")
        _tier_path = os.path.join(script_dir, "..", "templates", _tier_file)
        # Fall back to legacy monolithic template if tier file doesn't exist
        if os.path.isfile(_tier_path):
            template_path = _tier_path
        else:
            template_path = os.path.join(
                script_dir, "..", "templates", "bootstrap-prompt.md"
            )

    # Load template
    template_content, err = read_text_file(template_path)
    if err:
        emit_failure("Template error: {}".format(err))

    # Load feature list
    feature_list_data, err = load_json_file(args.feature_list)
    if err:
        emit_failure("Feature list error: {}".format(err))

    # Extract features array
    features = feature_list_data.get("features")
    if not isinstance(features, list):
        emit_failure("Feature list does not contain a 'features' array")

    # Find the target feature
    feature = find_feature(features, args.feature_id)
    if feature is None:
        emit_failure("Feature '{}' not found in feature list".format(args.feature_id))

    # Extract global context
    global_context = feature_list_data.get("global_context", {})
    if not isinstance(global_context, dict):
        global_context = {}

    # Build replacements
    replacements, effective_resume = build_replacements(
        args, feature, features, global_context, script_dir
    )

    # Update RESUME_PHASE in replacements to reflect auto-detection
    replacements["{{RESUME_PHASE}}"] = effective_resume

    # Render the template
    rendered = render_template(
        template_content, replacements, effective_resume
    )

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
        emit_failure("generate-bootstrap-prompt interrupted")
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in generate-bootstrap-prompt")
        emit_failure("Unexpected error: {}".format(str(exc)))
