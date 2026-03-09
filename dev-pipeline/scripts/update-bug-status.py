#!/usr/bin/env python3
"""Core state machine for updating bug status in the bug-fix pipeline.

Handles six actions:
  - get_next: Find the next bug to process based on priority and severity
  - update: Update a bug's status based on session outcome
  - status: Print a formatted overview of all bugs
  - pause: Save pipeline state for graceful shutdown
  - reset: Reset a bug to pending (status + retry count)
  - clean: Reset + delete session history + delete bugfix artifacts

Usage:
    python3 update-bug-status.py \
        --bug-list <path> --state-dir <path> \
        --action <get_next|update|status|pause|reset|clean> \
        [--bug-id <id>] [--session-status <status>] \
        [--session-id <id>] [--max-retries <n>]
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone

from path_policy import resolve_bug_paths


SESSION_STATUS_VALUES = [
    "success",
    "partial_resumable",
    "partial_not_resumable",
    "failed",
    "crashed",
    "timed_out",
]

TERMINAL_STATUSES = {"completed", "failed", "skipped", "needs_info"}

# 严重度优先级（数值越小越优先）
SEVERITY_PRIORITY = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Core state machine for bug-fix pipeline bug status management."
    )
    parser.add_argument("--bug-list", required=True, help="Path to the bug-fix-list.json file")
    parser.add_argument("--state-dir", required=True, help="Path to the bugfix-state/ directory")
    parser.add_argument(
        "--action", required=True,
        choices=["get_next", "update", "status", "pause", "reset", "clean"],
        help="Action to perform",
    )
    parser.add_argument("--bug-id", default=None, help="Bug ID (required for 'update'/'reset'/'clean' actions)")
    parser.add_argument(
        "--session-status", default=None, choices=SESSION_STATUS_VALUES,
        help="Session outcome status (required for 'update' action)",
    )
    parser.add_argument("--session-id", default=None, help="Session ID (optional, for 'update' action)")
    parser.add_argument("--max-retries", type=int, default=3, help="Maximum retry count (default: 3)")
    parser.add_argument("--project-root", default=None, help="Project root directory. Required for 'clean' action.")
    return parser.parse_args()


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json_file(path):
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, "File not found: {}".format(abs_path)
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return None, "Invalid JSON: {}".format(str(e))
    except IOError as e:
        return None, "Cannot read file: {}".format(str(e))
    return data, None


def write_json_file(path, data):
    abs_path = os.path.abspath(path)
    parent = os.path.dirname(abs_path)
    if parent and not os.path.isdir(parent):
        try:
            os.makedirs(parent, exist_ok=True)
        except OSError as e:
            return "Cannot create directory: {}".format(str(e))
    try:
        with open(abs_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except IOError as e:
        return "Cannot write file: {}".format(str(e))
    return None


def load_bug_status(state_dir, bug_id):
    status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    if not os.path.isfile(status_path):
        now = now_iso()
        return {
            "bug_id": bug_id,
            "status": "pending",
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
    data, err = load_json_file(status_path)
    if err:
        now = now_iso()
        return {
            "bug_id": bug_id,
            "status": "pending",
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
    return data


def save_bug_status(state_dir, bug_id, status_data):
    status_path = os.path.join(state_dir, "bugs", bug_id, "status.json")
    return write_json_file(status_path, status_data)


def update_bug_in_list(bug_list_path, bug_id, new_status):
    data, err = load_json_file(bug_list_path)
    if err:
        return err
    bugs = data.get("bugs", [])
    found = False
    for bug in bugs:
        if isinstance(bug, dict) and bug.get("id") == bug_id:
            bug["status"] = new_status
            found = True
            break
    if not found:
        return "Bug '{}' not found in bug-fix-list.json".format(bug_id)
    return write_json_file(bug_list_path, data)


# ---------------------------------------------------------------------------
# Action: get_next
# ---------------------------------------------------------------------------

def action_get_next(bug_list_data, state_dir):
    """Find the next bug to process.

    Priority logic:
    1. Skip terminal statuses (completed, failed, skipped, needs_info)
    2. Prefer in_progress bugs (interrupted session resume) over pending
    3. Sort by: severity (critical > high > medium > low), then by priority field
    """
    bugs = bug_list_data.get("bugs", [])
    if not bugs:
        print("PIPELINE_COMPLETE")
        return

    # Build status map
    status_map = {}
    status_data_map = {}
    for bug in bugs:
        if not isinstance(bug, dict):
            continue
        bid = bug.get("id")
        if not bid:
            continue
        bs = load_bug_status(state_dir, bid)
        status_map[bid] = bs.get("status", "pending")
        status_data_map[bid] = bs

    # Check if all bugs are terminal
    non_terminal = [
        b for b in bugs
        if isinstance(b, dict) and b.get("id")
        and status_map.get(b["id"], "pending") not in TERMINAL_STATUSES
    ]
    if not non_terminal:
        print("PIPELINE_COMPLETE")
        return

    # Separate in_progress from pending
    in_progress_bugs = []
    pending_bugs = []
    for bug in non_terminal:
        bid = bug.get("id")
        bstatus = status_map.get(bid, "pending")
        if bstatus == "in_progress":
            in_progress_bugs.append(bug)
        elif bstatus == "pending":
            pending_bugs.append(bug)

    def sort_key(b):
        severity = b.get("severity", "medium")
        sev_order = SEVERITY_PRIORITY.get(severity, 2)
        priority = b.get("priority", 999)
        return (sev_order, priority)

    if in_progress_bugs:
        candidates = sorted(in_progress_bugs, key=sort_key)
    elif pending_bugs:
        candidates = sorted(pending_bugs, key=sort_key)
    else:
        # 所有剩余的 bug 都处于非终端但也非 pending/in_progress 状态
        print("PIPELINE_BLOCKED")
        return

    chosen = candidates[0]
    chosen_id = chosen["id"]
    chosen_status_data = status_data_map.get(chosen_id, {})

    result = {
        "bug_id": chosen_id,
        "title": chosen.get("title", ""),
        "severity": chosen.get("severity", "medium"),
        "retry_count": chosen_status_data.get("retry_count", 0),
        "resume_from_phase": chosen_status_data.get("resume_from_phase", None),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: update
# ---------------------------------------------------------------------------

def action_update(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    session_status = args.session_status
    session_id = args.session_id
    max_retries = args.max_retries

    if not bug_id:
        error_out("--bug-id is required for 'update' action")
        return
    if not session_status:
        error_out("--session-status is required for 'update' action")
        return

    bs = load_bug_status(state_dir, bug_id)

    if session_status == "success":
        bs["status"] = "completed"
        bs["resume_from_phase"] = None
        err = update_bug_in_list(bug_list_path, bug_id, "completed")
        if err:
            error_out("Failed to update bug-fix-list.json: {}".format(err))
            return
    else:
        bs["retry_count"] = bs.get("retry_count", 0) + 1

        cleaned = cleanup_bug_artifacts(
            state_dir=state_dir,
            bug_id=bug_id,
            project_root=args.project_root,
        )

        if bs["retry_count"] >= max_retries:
            bs["status"] = "failed"
            target_status = "failed"
        else:
            bs["status"] = "pending"
            target_status = "pending"

        bs["resume_from_phase"] = None
        bs["sessions"] = []
        bs["last_session_id"] = None

        err = update_bug_in_list(bug_list_path, bug_id, target_status)
        if err:
            error_out("Failed to update bug-fix-list.json: {}".format(err))
            return

    if session_status == "success" and session_id:
        sessions = bs.get("sessions", [])
        if session_id not in sessions:
            sessions.append(session_id)
        bs["sessions"] = sessions
        bs["last_session_id"] = session_id

    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    summary = {
        "action": "update",
        "bug_id": bug_id,
        "session_status": session_status,
        "new_status": bs["status"],
        "retry_count": bs["retry_count"],
        "resume_from_phase": bs.get("resume_from_phase"),
        "updated_at": bs["updated_at"],
    }
    if session_status != "success":
        summary["restart_policy"] = "full_restart"
        summary["cleanup_performed"] = cleaned

    print(json.dumps(summary, indent=2, ensure_ascii=False))


def _default_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def cleanup_bug_artifacts(state_dir, bug_id, project_root=None):
    """Delete intermediate artifacts for a failed bug run."""
    if not project_root:
        project_root = _default_project_root()

    cleaned = []

    # 1) Remove all session history
    sessions_dir = os.path.dirname(
        resolve_bug_paths(project_root, bug_id, "SESSION_PLACEHOLDER")["sessionDir"]
    )
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2) Remove transient files under bug dir (keep status.json)
    bug_dir = os.path.join(state_dir, "bugs", bug_id)
    if os.path.isdir(bug_dir):
        for entry in os.listdir(bug_dir):
            if entry == "status.json" or entry == "sessions":
                continue
            entry_path = os.path.join(bug_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                cleaned.append("Deleted directory {}".format(entry_path))
            elif os.path.isfile(entry_path):
                os.remove(entry_path)
                cleaned.append("Deleted file {}".format(entry_path))

    # 3) Remove bugfix artifacts
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id)
    if os.path.isdir(bugfix_dir):
        file_count = sum(len(files) for _, _, files in os.walk(bugfix_dir))
        shutil.rmtree(bugfix_dir)
        cleaned.append("Deleted {} ({} files)".format(bugfix_dir, file_count))

    # 4) Remove shared dev-team workspace
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 5) Clear current-session pointer if it points to this bug
    current_session_path = os.path.join(state_dir, "current-session.json")
    if os.path.isfile(current_session_path):
        current_session, _ = load_json_file(current_session_path)
        if current_session and current_session.get("bug_id") == bug_id:
            os.remove(current_session_path)
            cleaned.append("Deleted {}".format(current_session_path))

    return cleaned


def load_session_status(state_dir, bug_id, session_id):
    project_root = os.path.abspath(os.path.join(state_dir, "..", ".."))
    session_status_path = resolve_bug_paths(
        project_root,
        bug_id,
        session_id,
    )["sessionStatus"]
    data, err = load_json_file(session_status_path)
    if err:
        return None, err
    return data, None


# ---------------------------------------------------------------------------
# Action: status
# ---------------------------------------------------------------------------

COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_GRAY = "\033[90m"
COLOR_MAGENTA = "\033[95m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

BOX_WIDTH = 68


def pad_right(text, width):
    visible = text
    i = 0
    visible_len = 0
    while i < len(text):
        if text[i] == "\033":
            while i < len(text) and text[i] != "m":
                i += 1
            i += 1
        else:
            visible_len += 1
            i += 1
    padding = width - visible_len
    if padding > 0:
        return text + " " * padding
    return text


def _build_progress_bar(percent, width=20):
    filled = int(width * percent / 100)
    empty = width - filled
    bar = "█" * filled + "░" * empty
    return "{} {:>3}%".format(bar, int(percent))


SEVERITY_ICONS = {
    "critical": COLOR_RED + "🔴" + COLOR_RESET,
    "high": COLOR_MAGENTA + "🟠" + COLOR_RESET,
    "medium": COLOR_YELLOW + "🟡" + COLOR_RESET,
    "low": COLOR_GRAY + "🟢" + COLOR_RESET,
}


def action_status(bug_list_data, state_dir):
    bugs = bug_list_data.get("bugs", [])
    project_name = bug_list_data.get("project_name", "Unknown")

    counts = {"completed": 0, "in_progress": 0, "failed": 0, "pending": 0, "needs_info": 0, "skipped": 0}
    bug_lines = []

    for bug in bugs:
        if not isinstance(bug, dict):
            continue
        bid = bug.get("id")
        title = bug.get("title", "Untitled")
        severity = bug.get("severity", "medium")
        if not bid:
            continue

        bs = load_bug_status(state_dir, bid)
        bstatus = bs.get("status", "pending")
        retry_count = bs.get("retry_count", 0)
        max_retries_val = bs.get("max_retries", 3)
        resume_phase = bs.get("resume_from_phase")

        if bstatus in counts:
            counts[bstatus] += 1
        else:
            counts["pending"] += 1

        # Status icon
        if bstatus == "completed":
            icon = COLOR_GREEN + "[✓]" + COLOR_RESET
        elif bstatus == "in_progress":
            icon = COLOR_YELLOW + "[→]" + COLOR_RESET
        elif bstatus == "failed":
            icon = COLOR_RED + "[✗]" + COLOR_RESET
        elif bstatus == "needs_info":
            icon = COLOR_MAGENTA + "[?]" + COLOR_RESET
        elif bstatus == "skipped":
            icon = COLOR_GRAY + "[—]" + COLOR_RESET
        else:
            icon = COLOR_GRAY + "[ ]" + COLOR_RESET

        # Severity badge
        sev_badge = "[{}]".format(severity[:4].upper())

        # Detail
        detail = ""
        if bstatus == "in_progress":
            parts = []
            if retry_count > 0:
                parts.append("retry {}/{}".format(retry_count, max_retries_val))
            if resume_phase is not None:
                parts.append("CP-BF-{}".format(resume_phase))
            if parts:
                detail = " ({})".format(", ".join(parts))
        elif bstatus == "failed":
            detail = " (failed after {} retries)".format(retry_count)
        elif bstatus == "needs_info":
            detail = " (needs more info)"

        # Colorize
        if bstatus == "completed":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_GREEN + title + COLOR_RESET, "", detail
            )
        elif bstatus == "in_progress":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_YELLOW + title + COLOR_RESET, "", detail
            )
        elif bstatus == "failed":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_RED + title + COLOR_RESET, "", detail
            )
        elif bstatus == "needs_info":
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_MAGENTA + title + COLOR_RESET, "", detail
            )
        else:
            line_content = "{} {} {} {} {}{}".format(
                bid, icon, sev_badge, COLOR_GRAY + title + COLOR_RESET, "", detail
            )

        bug_lines.append(line_content)

    total = len(bugs)
    completed = counts["completed"]
    percent = round(completed / total * 100, 1) if total > 0 else 0.0
    progress_bar = _build_progress_bar(percent, width=24)

    summary_line = "Total: {} bugs | Completed: {} | In Progress: {}".format(
        total, completed, counts["in_progress"]
    )
    summary_line2 = "Failed: {} | Pending: {} | Needs Info: {} | Skipped: {}".format(
        counts["failed"], counts["pending"], counts["needs_info"], counts["skipped"]
    )

    inner = BOX_WIDTH - 2
    print("╔" + "═" * BOX_WIDTH + "╗")
    print("║" + pad_right(COLOR_BOLD + "  Bug-Fix Pipeline Status" + COLOR_RESET, inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Project: {}".format(project_name), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line2), inner) + " ║")
    print("╠" + "─" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Progress: {}".format(progress_bar), inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    for line in bug_lines:
        print("║" + pad_right("  {}".format(line), inner) + " ║")
    print("╚" + "═" * BOX_WIDTH + "╝")


# ---------------------------------------------------------------------------
# Action: reset
# ---------------------------------------------------------------------------

def action_reset(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    if not bug_id:
        error_out("--bug-id is required for 'reset' action")
        return

    bs = load_bug_status(state_dir, bug_id)
    old_status = bs.get("status", "unknown")
    old_retry = bs.get("retry_count", 0)

    bs["status"] = "pending"
    bs["retry_count"] = 0
    bs["sessions"] = []
    bs["last_session_id"] = None
    bs["resume_from_phase"] = None
    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    err = update_bug_in_list(bug_list_path, bug_id, "pending")
    if err:
        error_out("Failed to update bug-fix-list.json: {}".format(err))
        return

    result = {
        "action": "reset",
        "bug_id": bug_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: clean
# ---------------------------------------------------------------------------

def action_clean(args, bug_list_path, state_dir):
    bug_id = args.bug_id
    project_root = args.project_root

    if not bug_id:
        error_out("--bug-id is required for 'clean' action")
        return
    if not project_root:
        error_out("--project-root is required for 'clean' action")
        return

    cleaned = []

    # 1. Delete session history
    sessions_dir = os.path.join(state_dir, "bugs", bug_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2. Delete bugfix artifacts for this bug
    bugfix_dir = os.path.join(project_root, ".prizmkit", "bugfix", bug_id)
    if os.path.isdir(bugfix_dir):
        file_count = sum(len(files) for _, _, files in os.walk(bugfix_dir))
        shutil.rmtree(bugfix_dir)
        cleaned.append("Deleted {} ({} files)".format(bugfix_dir, file_count))

    # 3. Delete shared dev-team workspace
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 4. Delete current-session pointer if it points to this bug
    current_session_path = os.path.join(state_dir, "current-session.json")
    if os.path.isfile(current_session_path):
        current_session, _ = load_json_file(current_session_path)
        if current_session and current_session.get("bug_id") == bug_id:
            os.remove(current_session_path)
            cleaned.append("Deleted {}".format(current_session_path))

    # 5. Reset status
    bs = load_bug_status(state_dir, bug_id)
    old_status = bs.get("status", "unknown")
    old_retry = bs.get("retry_count", 0)

    bs["status"] = "pending"
    bs["retry_count"] = 0
    bs["sessions"] = []
    bs["last_session_id"] = None
    bs["resume_from_phase"] = None
    bs["updated_at"] = now_iso()

    err = save_bug_status(state_dir, bug_id, bs)
    if err:
        error_out("Failed to save bug status: {}".format(err))
        return

    err = update_bug_in_list(bug_list_path, bug_id, "pending")
    if err:
        error_out("Failed to update bug-fix-list.json: {}".format(err))
        return

    result = {
        "action": "clean",
        "bug_id": bug_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
        "sessions_deleted": sessions_deleted,
        "cleaned": cleaned,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: pause
# ---------------------------------------------------------------------------

def action_pause(state_dir):
    pipeline_path = os.path.join(state_dir, "pipeline.json")
    data, err = load_json_file(pipeline_path)
    if err:
        data = {"status": "paused", "paused_at": now_iso()}
    else:
        data["status"] = "paused"
        data["paused_at"] = now_iso()

    err = write_json_file(pipeline_path, data)
    if err:
        error_out("Failed to write pipeline.json: {}".format(err))
        return

    result = {
        "action": "pause",
        "status": "paused",
        "paused_at": data["paused_at"],
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def error_out(message):
    output = {"error": message}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    if args.action == "update":
        if not args.bug_id:
            error_out("--bug-id is required for 'update' action")
        if not args.session_status:
            error_out("--session-status is required for 'update' action")
    if args.action in ("reset", "clean"):
        if not args.bug_id:
            error_out("--bug-id is required for '{}' action".format(args.action))
    if args.action == "clean":
        if not args.project_root:
            error_out("--project-root is required for 'clean' action")

    bug_list_data, err = load_json_file(args.bug_list)
    if err:
        error_out("Cannot load bug fix list: {}".format(err))

    if args.action == "get_next":
        action_get_next(bug_list_data, args.state_dir)
    elif args.action == "update":
        action_update(args, args.bug_list, args.state_dir)
    elif args.action == "status":
        action_status(bug_list_data, args.state_dir)
    elif args.action == "reset":
        action_reset(args, args.bug_list, args.state_dir)
    elif args.action == "clean":
        action_clean(args, args.bug_list, args.state_dir)
    elif args.action == "pause":
        action_pause(args.state_dir)


if __name__ == "__main__":
    main()
