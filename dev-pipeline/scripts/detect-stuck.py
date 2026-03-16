#!/usr/bin/env python3
"""Detect stuck features in the dev-pipeline.

Checks each feature for conditions that indicate it is stuck:
  1. Max retries exceeded
  2. Same checkpoint for consecutive sessions
  3. Stale or missing heartbeat (for in_progress features)
  4. Dependency deadlock (depends on a failed feature)

Outputs a JSON report to stdout and exits with code 1 if any stuck
features are found, 0 otherwise.

Usage:
    python3 detect-stuck.py --state-dir <path> [--feature-id <id>]
                            [--max-retries <n>] [--stale-threshold <seconds>]
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from utils import error_out, setup_logging


LOGGER = setup_logging("detect-stuck")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Detect stuck features in the dev-pipeline."
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state/ directory",
    )
    parser.add_argument(
        "--feature-id",
        default=None,
        help="Check a specific feature ID, or check all if omitted",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Maximum allowed retries before a feature is considered stuck (default: 3)",
    )
    parser.add_argument(
        "--stale-threshold",
        type=int,
        default=600,
        help="Heartbeat staleness threshold in seconds (default: 600)",
    )
    return parser.parse_args()


def load_json(path):
    """Load and return parsed JSON from a file. Returns None on any error."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (IOError, OSError, json.JSONDecodeError, ValueError):
        return None


def discover_feature_ids(state_dir):
    """Return a sorted list of feature IDs found in state/features/."""
    features_dir = os.path.join(state_dir, "features")
    if not os.path.isdir(features_dir):
        return []
    ids = []
    for name in os.listdir(features_dir):
        feature_path = os.path.join(features_dir, name)
        if os.path.isdir(feature_path):
            ids.append(name)
    return sorted(ids)


def get_session_statuses(feature_dir):
    """Return session-status.json data for all sessions of a feature, sorted by session ID.

    Returns a list of (session_id, data) tuples.
    """
    sessions_dir = os.path.join(feature_dir, "sessions")
    if not os.path.isdir(sessions_dir):
        return []
    results = []
    for session_name in sorted(os.listdir(sessions_dir)):
        session_path = os.path.join(sessions_dir, session_name)
        if not os.path.isdir(session_path):
            continue
        status_path = os.path.join(session_path, "session-status.json")
        data = load_json(status_path)
        if data is not None:
            results.append((session_name, data))
    return results


def parse_iso_timestamp(ts_str):
    """Parse an ISO 8601 timestamp string to a datetime object.

    Handles formats with and without timezone info. Returns None on failure.
    """
    if not isinstance(ts_str, str):
        return None
    # Try parsing with timezone (Z suffix or +HH:MM offset)
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S+00:00",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f+00:00",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    # Fallback: try stripping and replacing
    try:
        clean = ts_str.replace("Z", "+00:00")
        # Python 3.7+ fromisoformat
        if hasattr(datetime, "fromisoformat"):
            dt = datetime.fromisoformat(clean)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
    except (ValueError, AttributeError):
        pass
    return None


def check_max_retries(feature_status, max_retries):
    """Check 1: Has the feature exceeded the maximum retry count?

    Returns a stuck-report dict or None.
    """
    retry_count = feature_status.get("retry_count", 0)
    if not isinstance(retry_count, int):
        return None
    if retry_count >= max_retries:
        return {
            "reason": "max_retries_exceeded",
            "details": "Retry count {} has reached or exceeded max retries {}".format(
                retry_count, max_retries
            ),
            "suggestion": "Investigate recurring failures and consider resetting the feature or adjusting the approach",
        }
    return None


def check_stuck_checkpoint(feature_dir):
    """Check 2: Is the feature stuck at the same checkpoint for 3 consecutive sessions?

    Returns a stuck-report dict or None.
    """
    session_statuses = get_session_statuses(feature_dir)
    if len(session_statuses) < 3:
        return None

    # Take the last 3 sessions
    last_three = session_statuses[-3:]
    checkpoints = []
    for _sid, data in last_three:
        cp = data.get("checkpoint_reached")
        checkpoints.append(cp)

    # All three must be non-None and identical
    if checkpoints[0] is not None and all(cp == checkpoints[0] for cp in checkpoints):
        return {
            "reason": "stuck_at_checkpoint",
            "details": "Stuck at {} for 3 consecutive sessions".format(checkpoints[0]),
            "suggestion": "Review plan.md generation - checkpoint {} validation is repeatedly failing".format(
                checkpoints[0]
            ),
        }
    return None


def check_stale_heartbeat(feature_id, feature_status, state_dir, stale_threshold):
    """Check 3: Is the heartbeat stale or missing for an in_progress feature?

    Only applies to features whose status is 'in_progress' and whose session
    matches the current session.

    Returns a stuck-report dict or None.
    """
    status = feature_status.get("status")
    if status != "in_progress":
        return None

    # Read current-session.json to find the active session
    current_session_path = os.path.join(state_dir, "current-session.json")
    current_session = load_json(current_session_path)
    if current_session is None:
        return None

    # Check if the current session is for this feature
    session_feature = current_session.get("feature_id")
    if session_feature != feature_id:
        return None

    session_id = current_session.get("session_id")
    if not session_id:
        return None

    # Check heartbeat file
    heartbeat_path = os.path.join(
        state_dir, "features", feature_id, "sessions", session_id, "heartbeat.json"
    )
    heartbeat = load_json(heartbeat_path)

    if heartbeat is None:
        return {
            "reason": "no_heartbeat",
            "details": "Feature is in_progress but no heartbeat.json found for session {}".format(
                session_id
            ),
            "suggestion": "The agent session may have crashed without writing a heartbeat - check session logs",
        }

    # Parse heartbeat timestamp and check staleness
    ts_str = heartbeat.get("timestamp")
    heartbeat_time = parse_iso_timestamp(ts_str)
    if heartbeat_time is None:
        return {
            "reason": "stale_heartbeat",
            "details": "Heartbeat has invalid or unparseable timestamp: {}".format(ts_str),
            "suggestion": "Check the agent session - heartbeat timestamp is malformed",
        }

    now = datetime.now(timezone.utc)
    age_seconds = (now - heartbeat_time).total_seconds()
    if age_seconds > stale_threshold:
        return {
            "reason": "stale_heartbeat",
            "details": "Heartbeat is {:.0f}s old (threshold: {}s) for session {}".format(
                age_seconds, stale_threshold, session_id
            ),
            "suggestion": "The agent may be hung or crashed - consider terminating and retrying the session",
        }

    return None


def check_dependency_deadlock(feature_id, feature_list_data, state_dir):
    """Check 4: Does this feature depend on a failed feature?

    Returns a stuck-report dict or None.
    """
    if feature_list_data is None:
        return None

    features = feature_list_data.get("features", [])
    if not isinstance(features, list):
        return None

    # Find this feature in the feature list to get its dependencies
    deps = None
    for f in features:
        if not isinstance(f, dict):
            continue
        if f.get("id") == feature_id:
            deps = f.get("dependencies", [])
            break

    if not deps or not isinstance(deps, list):
        return None

    # Check each dependency's status in state
    for dep_id in deps:
        dep_status_path = os.path.join(
            state_dir, "features", dep_id, "status.json"
        )
        dep_status = load_json(dep_status_path)
        if dep_status is None:
            continue
        dep_state = dep_status.get("status")
        if dep_state == "failed":
            return {
                "reason": "dependency_failed",
                "details": "Depends on {} which has status 'failed'".format(dep_id),
                "suggestion": "Fix or skip {} to unblock {}".format(dep_id, feature_id),
            }

    return None


def find_feature_list(state_dir):
    """Attempt to locate and load feature-list.json via pipeline.json reference."""
    pipeline_path = os.path.join(state_dir, "pipeline.json")
    pipeline = load_json(pipeline_path)
    if pipeline is None:
        return None

    fl_path = pipeline.get("feature_list_path")
    if fl_path and os.path.isfile(fl_path):
        return load_json(fl_path)

    return None


def check_feature(feature_id, state_dir, feature_list_data, max_retries, stale_threshold):
    """Run all stuck-detection checks on a single feature.

    Returns a list of stuck-report dicts (may be empty if feature is not stuck).
    """
    feature_dir = os.path.join(state_dir, "features", feature_id)
    status_path = os.path.join(feature_dir, "status.json")
    feature_status = load_json(status_path)

    if feature_status is None:
        # Cannot read status — skip silently
        return []

    reports = []

    # Check 1: Max retries exceeded
    result = check_max_retries(feature_status, max_retries)
    if result is not None:
        reports.append(result)

    # Check 2: Stuck at same checkpoint
    result = check_stuck_checkpoint(feature_dir)
    if result is not None:
        reports.append(result)

    # Check 3: Stale heartbeat
    result = check_stale_heartbeat(feature_id, feature_status, state_dir, stale_threshold)
    if result is not None:
        reports.append(result)

    # Check 4: Dependency deadlock
    result = check_dependency_deadlock(feature_id, feature_list_data, state_dir)
    if result is not None:
        reports.append(result)

    return reports


def main():
    args = parse_args()
    state_dir = os.path.abspath(args.state_dir)

    if not os.path.isdir(state_dir):
        error_out("State directory not found: {}".format(state_dir), code=2)

    # Determine which features to check
    if args.feature_id:
        feature_ids = [args.feature_id]
    else:
        feature_ids = discover_feature_ids(state_dir)

    # Load feature list for dependency checks
    feature_list_data = find_feature_list(state_dir)

    stuck_features = []
    for fid in feature_ids:
        reports = check_feature(
            fid, state_dir, feature_list_data, args.max_retries, args.stale_threshold
        )
        for report in reports:
            stuck_features.append(
                {
                    "feature_id": fid,
                    "reason": report["reason"],
                    "details": report["details"],
                    "suggestion": report["suggestion"],
                }
            )

    output = {
        "stuck_features": stuck_features,
        "total_checked": len(feature_ids),
        "stuck_count": len(stuck_features),
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

    if stuck_features:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        error_out("detect-stuck interrupted", code=130)
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in detect-stuck")
        error_out("detect-stuck failed: {}".format(str(exc)), code=1)
