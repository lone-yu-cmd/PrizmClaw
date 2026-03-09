#!/usr/bin/env python3
"""Parse a session-status.json file and output a simple status string for the shell runner.

Reads the session status written by an agent at session end, validates required
fields, and prints a single-line result to stdout. Detailed JSON is written to
stderr for logging.

Usage:
    python3 check-session-status.py --status-file <path>
"""

import argparse
import json
import sys


REQUIRED_FIELDS = ["session_id", "feature_id", "status", "timestamp"]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Parse session-status.json and output a status string for the shell runner."
    )
    parser.add_argument(
        "--status-file",
        required=True,
        help="Path to the session-status.json file",
    )
    return parser.parse_args()


def load_status_file(path):
    """Load and parse the session status JSON file.

    Returns (data, error_message). On success error_message is None.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (IOError, OSError) as e:
        return None, "Cannot read status file: {}".format(str(e))
    except (json.JSONDecodeError, ValueError) as e:
        return None, "Malformed JSON in status file: {}".format(str(e))
    return data, None


def validate_required_fields(data):
    """Check that all required fields are present and non-empty.

    Returns a list of missing/invalid field names.
    """
    missing = []
    for field in REQUIRED_FIELDS:
        if field not in data:
            missing.append(field)
        elif not isinstance(data[field], str) or not data[field].strip():
            missing.append(field)
    return missing


def determine_status(data):
    """Determine the single-line status string from the parsed data.

    Returns one of: success, partial_resumable, partial_not_resumable, failed.
    """
    status = data.get("status", "")

    if status == "success":
        return "success"
    elif status == "partial":
        can_resume = data.get("can_resume", False)
        if can_resume:
            return "partial_resumable"
        else:
            return "partial_not_resumable"
    elif status == "failed":
        return "failed"
    else:
        # Unknown status value — treat as crashed
        return "crashed"


def build_detail_report(data, resolved_status):
    """Build the detailed JSON report for stderr logging."""
    errors = data.get("errors", [])
    error_count = len(errors) if isinstance(errors, list) else 0

    return {
        "status": resolved_status,
        "feature_id": data.get("feature_id"),
        "completed_phases": data.get("completed_phases", []),
        "checkpoint_reached": data.get("checkpoint_reached"),
        "tasks_completed": data.get("tasks_completed", 0),
        "tasks_total": data.get("tasks_total", 0),
        "error_count": error_count,
        "can_resume": data.get("can_resume", False),
        "resume_from_phase": data.get("resume_from_phase"),
    }


def main():
    args = parse_args()

    # Load the status file
    data, load_error = load_status_file(args.status_file)
    if load_error is not None:
        # File missing or malformed JSON
        detail = {
            "status": "crashed",
            "feature_id": None,
            "completed_phases": [],
            "checkpoint_reached": None,
            "tasks_completed": 0,
            "tasks_total": 0,
            "error_count": 1,
            "can_resume": False,
            "resume_from_phase": None,
            "load_error": load_error,
        }
        sys.stderr.write(json.dumps(detail, indent=2, ensure_ascii=False) + "\n")
        print("crashed")
        sys.exit(0)

    # Validate required fields
    missing = validate_required_fields(data)
    if missing:
        detail = {
            "status": "crashed",
            "feature_id": data.get("feature_id"),
            "completed_phases": data.get("completed_phases", []),
            "checkpoint_reached": data.get("checkpoint_reached"),
            "tasks_completed": data.get("tasks_completed", 0),
            "tasks_total": data.get("tasks_total", 0),
            "error_count": 1,
            "can_resume": False,
            "resume_from_phase": None,
            "validation_error": "Missing or invalid required fields: {}".format(
                ", ".join(missing)
            ),
        }
        sys.stderr.write(json.dumps(detail, indent=2, ensure_ascii=False) + "\n")
        print("crashed")
        sys.exit(0)

    # Determine status
    resolved_status = determine_status(data)

    # Build and emit detail report to stderr
    detail = build_detail_report(data, resolved_status)
    sys.stderr.write(json.dumps(detail, indent=2, ensure_ascii=False) + "\n")

    # Emit single-line status to stdout
    print(resolved_status)
    sys.exit(0)


if __name__ == "__main__":
    main()
