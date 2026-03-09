#!/usr/bin/env python3
"""Core state machine for updating feature status in the dev-pipeline.

Handles seven actions:
  - get_next: Find the next feature to process based on priority and dependencies
  - update: Update a feature's status based on session outcome
  - status: Print a formatted overview of all features
  - pause: Save pipeline state for graceful shutdown
  - reset: Reset a feature to pending (status + retry count)
  - clean: Reset + delete session history + delete prizmkit artifacts
  - complete: Shortcut for manually marking a feature as completed

Usage:
    python3 update-feature-status.py \
        --feature-list <path> --state-dir <path> \
        --action <get_next|update|status|pause|reset|clean|complete> \
        [--feature-id <id>] [--session-status <status>] \
        [--session-id <id>] [--max-retries <n>]
"""

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone


SESSION_STATUS_VALUES = [
    "success",
    "partial_resumable",
    "partial_not_resumable",
    "failed",
    "crashed",
    "timed_out",
]

TERMINAL_STATUSES = {"completed", "failed", "skipped"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Core state machine for dev-pipeline feature status management."
    )
    parser.add_argument(
        "--feature-list",
        required=True,
        help="Path to the feature-list.json file",
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state/ directory",
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=["get_next", "update", "status", "pause", "reset", "clean", "complete"],
        help="Action to perform",
    )
    parser.add_argument(
        "--feature-id",
        default=None,
        help="Feature ID (required for 'update' action)",
    )
    parser.add_argument(
        "--session-status",
        default=None,
        choices=SESSION_STATUS_VALUES,
        help="Session outcome status (required for 'update' action)",
    )
    parser.add_argument(
        "--session-id",
        default=None,
        help="Session ID (optional, for 'update' action)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Maximum retry count before marking as failed (default: 3)",
    )
    parser.add_argument(
        "--feature-slug",
        default=None,
        help="Feature slug (e.g. 007-import-export-desktop). Required for 'clean' action.",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Project root directory. Required for 'clean' action.",
    )
    return parser.parse_args()


def now_iso():
    """Return the current UTC time in ISO8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json_file(path):
    """Load and return parsed JSON from a file.

    Returns (data, error_string). On success error_string is None.
    """
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
    """Write data as JSON to a file. Creates parent directories if needed.

    Returns an error string on failure, None on success.
    """
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


def load_feature_status(state_dir, feature_id):
    """Load the status.json for a feature.

    If the file does not exist, return a default pending status.
    """
    status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    if not os.path.isfile(status_path):
        now = now_iso()
        return {
            "feature_id": feature_id,
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
        # If we can't read it, treat as pending
        now = now_iso()
        return {
            "feature_id": feature_id,
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


def save_feature_status(state_dir, feature_id, status_data):
    """Write the status.json for a feature."""
    status_path = os.path.join(
        state_dir, "features", feature_id, "status.json"
    )
    return write_json_file(status_path, status_data)


def update_feature_in_list(feature_list_path, feature_id, new_status):
    """Update a feature's status field in feature-list.json.

    Reads the whole file, modifies the target feature's status, writes back.
    Returns an error string on failure, None on success.
    """
    data, err = load_json_file(feature_list_path)
    if err:
        return err
    features = data.get("features", [])
    found = False
    for feature in features:
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            feature["status"] = new_status
            found = True
            break
    if not found:
        return "Feature '{}' not found in feature-list.json".format(feature_id)
    return write_json_file(feature_list_path, data)


def _default_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _build_feature_slug(feature_id, title):
    numeric = feature_id.replace("F-", "").replace("f-", "").zfill(3)
    cleaned = re.sub(r"[^a-z0-9\s-]", "", (title or "").lower())
    cleaned = re.sub(r"[\s]+", "-", cleaned.strip())
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    if not cleaned:
        cleaned = "feature"
    return "{}-{}".format(numeric, cleaned)


def _get_feature_slug(feature_list_path, feature_id):
    data, err = load_json_file(feature_list_path)
    if err:
        return None
    for feature in data.get("features", []):
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            return _build_feature_slug(feature_id, feature.get("title", ""))
    return None


def cleanup_feature_artifacts(feature_list_path, state_dir, feature_id, project_root=None):
    """Delete intermediate artifacts for a failed feature run.

    Cleans session history, per-feature transient state, generated specs,
    current-session pointer, and .dev-team workspace to avoid context pollution.
    """
    if not project_root:
        project_root = _default_project_root()

    cleaned = []

    # 1) Remove all session history
    sessions_dir = os.path.join(state_dir, "features", feature_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(sessions_deleted, sessions_dir))

    # 2) Remove transient files under feature state dir (keep status.json)
    feature_dir = os.path.join(state_dir, "features", feature_id)
    if os.path.isdir(feature_dir):
        for entry in os.listdir(feature_dir):
            if entry == "status.json" or entry == "sessions":
                continue
            entry_path = os.path.join(feature_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                cleaned.append("Deleted directory {}".format(entry_path))
            elif os.path.isfile(entry_path):
                os.remove(entry_path)
                cleaned.append("Deleted file {}".format(entry_path))

    # 3) Remove generated prizm specs for this feature
    feature_slug = _get_feature_slug(feature_list_path, feature_id)
    if feature_slug:
        specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
        if os.path.isdir(specs_dir):
            file_count = sum(len(files) for _, _, files in os.walk(specs_dir))
            shutil.rmtree(specs_dir)
            cleaned.append("Deleted {} ({} files)".format(specs_dir, file_count))

    # 4) Remove global dev-team workspace to avoid stale context contamination
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 5) Clear current-session pointer if it points to this feature
    current_session_path = os.path.join(state_dir, "current-session.json")
    if os.path.isfile(current_session_path):
        current_session, _ = load_json_file(current_session_path)
        if current_session and current_session.get("feature_id") == feature_id:
            os.remove(current_session_path)
            cleaned.append("Deleted {}".format(current_session_path))

    return cleaned


def load_session_status(state_dir, feature_id, session_id):
    """Load a session's session-status.json file."""
    session_status_path = os.path.join(
        state_dir, "features", feature_id, "sessions",
        session_id, "session-status.json"
    )
    data, err = load_json_file(session_status_path)
    if err:
        return None, err
    return data, None


# ---------------------------------------------------------------------------
# Action: get_next
# ---------------------------------------------------------------------------

def action_get_next(feature_list_data, state_dir):
    """Find the next feature to process.

    Priority logic:
    1. Skip terminal statuses (completed, failed, skipped)
    2. Check that all dependencies are completed
    3. Prefer in_progress features over pending ones (interrupted session resume)
    4. Among eligible features, pick lowest priority number (highest priority)
    """
    features = feature_list_data.get("features", [])
    if not features:
        print("PIPELINE_COMPLETE")
        return

    # Build a map of feature statuses from state dir
    status_map = {}  # feature_id -> status string
    status_data_map = {}  # feature_id -> full status data
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fs = load_feature_status(state_dir, fid)
        status_map[fid] = fs.get("status", "pending")
        status_data_map[fid] = fs

    # Check if all features are in terminal state
    non_terminal = [
        f for f in features
        if isinstance(f, dict) and f.get("id")
        and status_map.get(f["id"], "pending") not in TERMINAL_STATUSES
    ]
    if not non_terminal:
        print("PIPELINE_COMPLETE")
        return

    # Find eligible features (dependencies all completed)
    eligible = []
    has_remaining = False
    for feature in non_terminal:
        fid = feature.get("id")
        if not fid:
            continue
        has_remaining = True
        deps = feature.get("dependencies", [])
        all_deps_completed = True
        for dep_id in deps:
            if status_map.get(dep_id, "pending") != "completed":
                all_deps_completed = False
                break
        if all_deps_completed:
            eligible.append(feature)

    if not eligible:
        if has_remaining:
            print("PIPELINE_BLOCKED")
        else:
            print("PIPELINE_COMPLETE")
        return

    # Separate in_progress from pending
    in_progress_features = []
    pending_features = []
    for feature in eligible:
        fid = feature.get("id")
        fstatus = status_map.get(fid, "pending")
        if fstatus == "in_progress":
            in_progress_features.append(feature)
        else:
            pending_features.append(feature)

    # Prefer in_progress features, then pending; sort by priority (lowest number = highest priority)
    if in_progress_features:
        candidates = sorted(
            in_progress_features,
            key=lambda f: f.get("priority", 999)
        )
    else:
        candidates = sorted(
            pending_features,
            key=lambda f: f.get("priority", 999)
        )

    chosen = candidates[0]
    chosen_id = chosen["id"]
    chosen_status_data = status_data_map.get(chosen_id, {})

    result = {
        "feature_id": chosen_id,
        "title": chosen.get("title", ""),
        "retry_count": chosen_status_data.get("retry_count", 0),
        "resume_from_phase": chosen_status_data.get("resume_from_phase", None),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: update
# ---------------------------------------------------------------------------

def action_update(args, feature_list_path, state_dir):
    """Update a feature's status based on session outcome.

    Failure policy:
    - Never continue from partial/failed session context
    - Always clean intermediate artifacts and restart from scratch
    """
    feature_id = args.feature_id
    session_status = args.session_status
    session_id = args.session_id
    max_retries = args.max_retries

    if not feature_id:
        error_out("--feature-id is required for 'update' action")
        return
    if not session_status:
        error_out("--session-status is required for 'update' action")
        return

    fs = load_feature_status(state_dir, feature_id)

    if session_status == "success":
        fs["status"] = "completed"
        fs["resume_from_phase"] = None
        err = update_feature_in_list(feature_list_path, feature_id, "completed")
        if err:
            error_out("Failed to update feature-list.json: {}".format(err))
            return
    else:
        fs["retry_count"] = fs.get("retry_count", 0) + 1

        cleaned = cleanup_feature_artifacts(
            feature_list_path=feature_list_path,
            state_dir=state_dir,
            feature_id=feature_id,
            project_root=args.project_root,
        )

        if fs["retry_count"] >= max_retries:
            fs["status"] = "failed"
            target_status = "failed"
        else:
            fs["status"] = "pending"
            target_status = "pending"

        fs["resume_from_phase"] = None
        fs["sessions"] = []
        fs["last_session_id"] = None

        err = update_feature_in_list(feature_list_path, feature_id, target_status)
        if err:
            error_out("Failed to update feature-list.json: {}".format(err))
            return

    if session_status == "success" and session_id:
        sessions = fs.get("sessions", [])
        if session_id not in sessions:
            sessions.append(session_id)
        fs["sessions"] = sessions
        fs["last_session_id"] = session_id

    fs["updated_at"] = now_iso()

    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    summary = {
        "action": "update",
        "feature_id": feature_id,
        "session_status": session_status,
        "new_status": fs["status"],
        "retry_count": fs["retry_count"],
        "resume_from_phase": fs.get("resume_from_phase"),
        "updated_at": fs["updated_at"],
    }
    if session_status != "success":
        summary["restart_policy"] = "full_restart"
        summary["cleanup_performed"] = cleaned

    print(json.dumps(summary, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: status
# ---------------------------------------------------------------------------

# ANSI color codes
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_RED = "\033[91m"
COLOR_GRAY = "\033[90m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

BOX_WIDTH = 68


def pad_right(text, width):
    """Pad text with spaces to fill width, accounting for ANSI escape codes."""
    # Strip ANSI codes to calculate visible length
    visible = text
    i = 0
    visible_len = 0
    while i < len(text):
        if text[i] == "\033":
            # Skip until 'm'
            while i < len(text) and text[i] != "m":
                i += 1
            i += 1  # skip the 'm'
        else:
            visible_len += 1
            i += 1
    padding = width - visible_len
    if padding > 0:
        return text + " " * padding
    return text


def _calc_feature_duration(state_dir, feature_id):
    """计算已完成 Feature 的耗时（秒）。

    通过 status.json 的 created_at 和 updated_at 来计算。
    如果有 session 记录，尝试用第一个 session 的 started_at 到最后更新时间来计算。
    返回 None 如果无法计算。
    """
    fs_path = os.path.join(state_dir, "features", feature_id, "status.json")
    if not os.path.isfile(fs_path):
        return None
    data, err = load_json_file(fs_path)
    if err or not data:
        return None

    created_at = data.get("created_at")
    updated_at = data.get("updated_at")
    if not created_at or not updated_at:
        return None

    try:
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        t_start = datetime.strptime(created_at, fmt)
        t_end = datetime.strptime(updated_at, fmt)
        delta = (t_end - t_start).total_seconds()
        # 过滤异常值：少于 10 秒或超过 24 小时的忽略
        if delta < 10 or delta > 86400:
            return None
        return delta
    except (ValueError, TypeError):
        return None


def _format_duration(seconds):
    """将秒数格式化为人类可读的时间字符串。"""
    if seconds is None:
        return "N/A"
    seconds = int(seconds)
    if seconds < 60:
        return "{}s".format(seconds)
    elif seconds < 3600:
        m = seconds // 60
        s = seconds % 60
        return "{}m{}s".format(m, s)
    else:
        h = seconds // 3600
        m = (seconds % 3600) // 60
        return "{}h{}m".format(h, m)


def _build_progress_bar(percent, width=20):
    """生成文本进度条。

    例如: ████████░░░░░░░░░░░░ 40%
    """
    filled = int(width * percent / 100)
    empty = width - filled
    bar = "█" * filled + "░" * empty
    return "{} {:>3}%".format(bar, int(percent))


def _estimate_remaining_time(features, state_dir, counts):
    """基于已完成 Feature 的历史耗时，按 complexity 加权预估剩余时间。

    策略:
    1. 收集所有已完成 Feature 的耗时，按 complexity 分组
    2. 对剩余的 pending/in_progress Feature，用对应 complexity 的平均耗时估算
    3. 如果某个 complexity 没有历史数据，用全局平均值兜底

    返回 (estimated_seconds, confidence) 元组。
    confidence: "high" (>=50% 已完成), "medium" (>=25%), "low" (<25%)
    """
    # complexity 权重（用于没有历史数据时的估算）
    COMPLEXITY_WEIGHT = {"low": 1.0, "medium": 2.0, "high": 4.0}

    # 按 complexity 分组收集已完成 Feature 的耗时
    duration_by_complexity = {}  # complexity -> [duration_seconds]
    feature_complexity_map = {}  # feature_id -> complexity

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        complexity = feature.get("estimated_complexity", "medium")
        feature_complexity_map[fid] = complexity

    all_durations = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fs = load_feature_status(state_dir, fid)
        if fs.get("status") != "completed":
            continue
        duration = _calc_feature_duration(state_dir, fid)
        if duration is None:
            continue
        complexity = feature_complexity_map.get(fid, "medium")
        if complexity not in duration_by_complexity:
            duration_by_complexity[complexity] = []
        duration_by_complexity[complexity].append(duration)
        all_durations.append(duration)

    if not all_durations:
        return None, "low"

    # 计算各 complexity 的平均耗时
    avg_by_complexity = {}
    for c, durations in duration_by_complexity.items():
        avg_by_complexity[c] = sum(durations) / len(durations)
    global_avg = sum(all_durations) / len(all_durations)

    # 估算剩余 Feature 的耗时
    remaining_seconds = 0.0
    remaining_count = 0
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fs = load_feature_status(state_dir, fid)
        fstatus = fs.get("status", "pending")
        if fstatus in TERMINAL_STATUSES:
            continue
        remaining_count += 1
        complexity = feature_complexity_map.get(fid, "medium")
        if complexity in avg_by_complexity:
            remaining_seconds += avg_by_complexity[complexity]
        else:
            # 没有该 complexity 的历史数据，用全局均值 × 权重比例估算
            weight = COMPLEXITY_WEIGHT.get(complexity, 2.0)
            base_weight = COMPLEXITY_WEIGHT.get("medium", 2.0)
            remaining_seconds += global_avg * (weight / base_weight)

    # 计算置信度
    total = len([f for f in features if isinstance(f, dict) and f.get("id")])
    completed = counts.get("completed", 0)
    if total > 0:
        ratio = completed / total
        if ratio >= 0.5:
            confidence = "high"
        elif ratio >= 0.25:
            confidence = "medium"
        else:
            confidence = "low"
    else:
        confidence = "low"

    return remaining_seconds, confidence


def action_status(feature_list_data, state_dir):
    """Print a formatted overview of all features and their status."""
    features = feature_list_data.get("features", [])
    app_name = feature_list_data.get("app_name", "Unknown")

    # Gather status info
    counts = {"completed": 0, "in_progress": 0, "failed": 0, "pending": 0, "skipped": 0}
    feature_lines = []

    # Build dependency info: feature_id -> list of dep_ids that are not completed
    status_map = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if not fid:
            continue
        fs = load_feature_status(state_dir, fid)
        status_map[fid] = fs.get("status", "pending")

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        title = feature.get("title", "Untitled")
        if not fid:
            continue

        fs = load_feature_status(state_dir, fid)
        fstatus = fs.get("status", "pending")
        retry_count = fs.get("retry_count", 0)
        max_retries_val = fs.get("max_retries", 3)
        resume_phase = fs.get("resume_from_phase")

        # Count statuses
        if fstatus in counts:
            counts[fstatus] += 1
        else:
            counts["pending"] += 1

        # Build status indicator and color
        if fstatus == "completed":
            icon = COLOR_GREEN + "[✓]" + COLOR_RESET
        elif fstatus == "in_progress":
            icon = COLOR_YELLOW + "[→]" + COLOR_RESET
        elif fstatus == "failed":
            icon = COLOR_RED + "[✗]" + COLOR_RESET
        elif fstatus == "skipped":
            icon = COLOR_GRAY + "[—]" + COLOR_RESET
        else:
            icon = COLOR_GRAY + "[ ]" + COLOR_RESET

        # Build detail suffix
        detail = ""
        if fstatus == "in_progress":
            parts = []
            if retry_count > 0:
                parts.append("retry {}/{}".format(retry_count, max_retries_val))
            if resume_phase is not None:
                parts.append("CP-{}".format(resume_phase))
            if parts:
                detail = " ({})".format(", ".join(parts))
        elif fstatus == "failed":
            detail = " (failed after {} retries)".format(retry_count)
        elif fstatus == "pending":
            # Check if blocked by dependencies
            deps = feature.get("dependencies", [])
            blocking = [
                d for d in deps
                if status_map.get(d, "pending") != "completed"
            ]
            if blocking:
                detail = " (blocked by {})".format(", ".join(blocking))

        # Apply color to the whole line content
        if fstatus == "completed":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_GREEN + title + COLOR_RESET, detail
            )
        elif fstatus == "in_progress":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_YELLOW + title + COLOR_RESET, detail
            )
        elif fstatus == "failed":
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_RED + title + COLOR_RESET, detail
            )
        else:
            line_content = "{} {} {}{}".format(
                fid, icon, COLOR_GRAY + title + COLOR_RESET, detail
            )

        feature_lines.append(line_content)

    total = len(features)
    completed = counts["completed"]

    # 计算百分比
    if total > 0:
        percent = round(completed / total * 100, 1)
    else:
        percent = 0.0

    # 生成进度条
    progress_bar = _build_progress_bar(percent, width=24)

    # 预估剩余时间
    est_remaining, confidence = _estimate_remaining_time(
        features, state_dir, counts
    )

    summary_line = "Total: {} features | Completed: {} | In Progress: {}".format(
        total, completed, counts["in_progress"]
    )
    summary_line2 = "Failed: {} | Pending: {} | Skipped: {}".format(
        counts["failed"], counts["pending"], counts["skipped"]
    )

    # 构建预估剩余时间行
    CONFIDENCE_ICONS = {"high": "●", "medium": "◐", "low": "○"}
    if est_remaining is not None:
        eta_str = _format_duration(est_remaining)
        conf_icon = CONFIDENCE_ICONS.get(confidence, "○")
        eta_line = "ETA: ~{}  (confidence: {} {})".format(
            eta_str, conf_icon, confidence
        )
    else:
        eta_line = "ETA: calculating... (need >=1 completed feature)"

    # Print the box
    inner = BOX_WIDTH - 2  # space inside the vertical bars
    print("╔" + "═" * BOX_WIDTH + "╗")
    print("║" + pad_right(COLOR_BOLD + "  Dev-Pipeline Status" + COLOR_RESET, inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    print("║" + pad_right("  App: {}".format(app_name), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line), inner) + " ║")
    print("║" + pad_right("  {}".format(summary_line2), inner) + " ║")
    print("╠" + "─" * BOX_WIDTH + "╣")
    print("║" + pad_right("  Progress: {}".format(progress_bar), inner) + " ║")
    print("║" + pad_right("  {}".format(eta_line), inner) + " ║")
    print("╠" + "═" * BOX_WIDTH + "╣")
    for line in feature_lines:
        print("║" + pad_right("  {}".format(line), inner) + " ║")
    print("╚" + "═" * BOX_WIDTH + "╝")


# ---------------------------------------------------------------------------
# Action: reset
# ---------------------------------------------------------------------------

def action_reset(args, feature_list_path, state_dir):
    """Reset a feature to pending state.

    Resets status.json (status -> pending, retry_count -> 0, clear sessions,
    clear resume_from_phase) and updates feature-list.json status to pending.
    Does NOT delete any files on disk.
    """
    feature_id = args.feature_id
    if not feature_id:
        error_out("--feature-id is required for 'reset' action")
        return

    # Load current status to preserve created_at
    fs = load_feature_status(state_dir, feature_id)
    old_status = fs.get("status", "unknown")
    old_retry = fs.get("retry_count", 0)

    # Reset fields
    fs["status"] = "pending"
    fs["retry_count"] = 0
    fs["sessions"] = []
    fs["last_session_id"] = None
    fs["resume_from_phase"] = None
    fs["updated_at"] = now_iso()

    # Write back status.json
    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    # Update feature-list.json
    err = update_feature_in_list(feature_list_path, feature_id, "pending")
    if err:
        error_out("Failed to update feature-list.json: {}".format(err))
        return

    result = {
        "action": "reset",
        "feature_id": feature_id,
        "old_status": old_status,
        "old_retry_count": old_retry,
        "new_status": "pending",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Action: clean
# ---------------------------------------------------------------------------

def action_clean(args, feature_list_path, state_dir):
    """Reset a feature AND delete all associated artifacts.

    Deletes:
    - state/features/F-XXX/sessions/ (all session history)
    - .prizmkit/specs/{slug}/ (spec, plan, tasks, contracts)

    Then performs a full reset (same as action_reset).
    """
    feature_id = args.feature_id
    feature_slug = args.feature_slug
    project_root = args.project_root

    if not feature_id:
        error_out("--feature-id is required for 'clean' action")
        return
    if not feature_slug:
        error_out("--feature-slug is required for 'clean' action")
        return
    if not project_root:
        error_out("--project-root is required for 'clean' action")
        return

    cleaned = []

    # 1. Delete session history
    sessions_dir = os.path.join(state_dir, "features", feature_id, "sessions")
    sessions_deleted = 0
    if os.path.isdir(sessions_dir):
        for entry in os.listdir(sessions_dir):
            entry_path = os.path.join(sessions_dir, entry)
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path)
                sessions_deleted += 1
        cleaned.append("Deleted {} session(s) from {}".format(
            sessions_deleted, sessions_dir
        ))

    # 2. Delete prizmkit specs for this feature
    specs_dir = os.path.join(project_root, ".prizmkit", "specs", feature_slug)
    if os.path.isdir(specs_dir):
        file_count = sum(
            len(files) for _, _, files in os.walk(specs_dir)
        )
        shutil.rmtree(specs_dir)
        cleaned.append("Deleted {} ({} files)".format(specs_dir, file_count))

    # 3. Delete global dev-team workspace (shared AI transient context)
    dev_team_dir = os.path.join(project_root, ".dev-team")
    if os.path.isdir(dev_team_dir):
        file_count = sum(len(files) for _, _, files in os.walk(dev_team_dir))
        shutil.rmtree(dev_team_dir)
        cleaned.append("Deleted {} ({} files)".format(dev_team_dir, file_count))

    # 4. Delete current-session pointer if it points to this feature
    current_session_path = os.path.join(state_dir, "current-session.json")
    if os.path.isfile(current_session_path):
        current_session, _ = load_json_file(current_session_path)
        if current_session and current_session.get("feature_id") == feature_id:
            os.remove(current_session_path)
            cleaned.append("Deleted {}".format(current_session_path))

    # 5. Reset status (reuse reset logic)
    fs = load_feature_status(state_dir, feature_id)
    old_status = fs.get("status", "unknown")
    old_retry = fs.get("retry_count", 0)

    fs["status"] = "pending"
    fs["retry_count"] = 0
    fs["sessions"] = []
    fs["last_session_id"] = None
    fs["resume_from_phase"] = None
    fs["updated_at"] = now_iso()

    err = save_feature_status(state_dir, feature_id, fs)
    if err:
        error_out("Failed to save feature status: {}".format(err))
        return

    err = update_feature_in_list(feature_list_path, feature_id, "pending")
    if err:
        error_out("Failed to update feature-list.json: {}".format(err))
        return

    result = {
        "action": "clean",
        "feature_id": feature_id,
        "feature_slug": feature_slug,
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
    """Save current pipeline state for graceful shutdown."""
    pipeline_path = os.path.join(state_dir, "pipeline.json")

    data, err = load_json_file(pipeline_path)
    if err:
        # If pipeline.json doesn't exist, create a minimal one
        data = {
            "status": "paused",
            "paused_at": now_iso(),
        }
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
    """Print an error JSON and exit with code 1."""
    output = {"error": message}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    # Validate action-specific requirements
    if args.action == "update":
        if not args.feature_id:
            error_out("--feature-id is required for 'update' action")
        if not args.session_status:
            error_out("--session-status is required for 'update' action")
    if args.action in ("reset", "clean", "complete"):
        if not args.feature_id:
            error_out("--feature-id is required for '{}' action".format(args.action))
    if args.action == "clean":
        if not args.feature_slug:
            error_out("--feature-slug is required for 'clean' action")
        if not args.project_root:
            error_out("--project-root is required for 'clean' action")

    # Load feature list
    feature_list_data, err = load_json_file(args.feature_list)
    if err:
        error_out("Cannot load feature list: {}".format(err))

    # Dispatch action
    if args.action == "get_next":
        action_get_next(feature_list_data, args.state_dir)
    elif args.action == "update":
        action_update(args, args.feature_list, args.state_dir)
    elif args.action == "status":
        action_status(feature_list_data, args.state_dir)
    elif args.action == "reset":
        action_reset(args, args.feature_list, args.state_dir)
    elif args.action == "clean":
        action_clean(args, args.feature_list, args.state_dir)
    elif args.action == "complete":
        # Shortcut: 'complete' is equivalent to 'update --session-status success'
        args.session_status = "success"
        action_update(args, args.feature_list, args.state_dir)
    elif args.action == "pause":
        action_pause(args.state_dir)


if __name__ == "__main__":
    main()
