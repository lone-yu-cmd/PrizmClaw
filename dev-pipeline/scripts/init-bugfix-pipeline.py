#!/usr/bin/env python3
"""Initialize the bug-fix pipeline state directory from a bug-fix-list.json file.

Validates the bug fix list schema, sorts by priority/severity, and creates
the state directory structure with pipeline and per-bug status files.

Usage:
    python3 init-bugfix-pipeline.py --bug-list <path> --state-dir <path>
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone


EXPECTED_SCHEMA = "dev-pipeline-bug-fix-list-v1"
BUG_ID_PATTERN = re.compile(r"^B-\d{3}$")

REQUIRED_BUG_FIELDS = [
    "id",
    "title",
    "description",
    "severity",
    "error_source",
    "verification_type",
    "acceptance_criteria",
    "status",
]

VALID_SEVERITIES = ["critical", "high", "medium", "low"]
VALID_VERIFICATION_TYPES = ["automated", "manual", "hybrid"]
VALID_STATUSES = [
    "pending", "triaging", "reproducing", "fixing",
    "verifying", "completed", "failed", "needs_info", "skipped",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Initialize bug-fix pipeline state from a bug-fix-list.json file."
    )
    parser.add_argument(
        "--bug-list",
        required=True,
        help="Path to the bug-fix-list.json file",
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state directory to create/initialize",
    )
    return parser.parse_args()


def load_bug_list(path):
    """Load and return the parsed JSON from the bug fix list file."""
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, ["Bug fix list file not found: {}".format(abs_path)]
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return None, ["Invalid JSON in bug fix list: {}".format(str(e))]
    except IOError as e:
        return None, ["Cannot read bug fix list file: {}".format(str(e))]
    return data, []


def validate_schema(data):
    """Validate the top-level schema and structure of the bug fix list."""
    errors = []

    # Check $schema
    schema = data.get("$schema")
    if schema != EXPECTED_SCHEMA:
        errors.append(
            "Invalid $schema: expected '{}', got '{}'".format(EXPECTED_SCHEMA, schema)
        )

    # Check project_name
    if "project_name" not in data:
        errors.append("Missing required field: project_name")
    elif not isinstance(data["project_name"], str) or not data["project_name"].strip():
        errors.append("project_name must be a non-empty string")

    # Check bugs array
    if "bugs" not in data:
        errors.append("Missing required field: bugs")
    elif not isinstance(data["bugs"], list):
        errors.append("bugs must be an array")
    elif len(data["bugs"]) == 0:
        errors.append("bugs array must contain at least one bug")

    return errors


def validate_bugs(bugs):
    """Validate each bug object in the list."""
    errors = []
    seen_ids = set()

    for i, bug in enumerate(bugs):
        if not isinstance(bug, dict):
            errors.append("Bug at index {} is not an object".format(i))
            continue

        # Check required fields
        for field in REQUIRED_BUG_FIELDS:
            if field not in bug:
                errors.append(
                    "Bug at index {} missing required field: {}".format(i, field)
                )

        # Validate bug ID format
        bid = bug.get("id")
        if bid is not None:
            if not isinstance(bid, str) or not BUG_ID_PATTERN.match(bid):
                errors.append(
                    "Bug at index {} has invalid id '{}' "
                    "(must match B-NNN pattern)".format(i, bid)
                )
            elif bid in seen_ids:
                errors.append("Duplicate bug id: {}".format(bid))
            else:
                seen_ids.add(bid)

        # Validate severity
        severity = bug.get("severity")
        if severity is not None and severity not in VALID_SEVERITIES:
            errors.append(
                "Bug '{}' has invalid severity '{}' "
                "(must be one of {})".format(
                    bid or "index {}".format(i), severity, VALID_SEVERITIES
                )
            )

        # Validate verification_type
        vtype = bug.get("verification_type")
        if vtype is not None and vtype not in VALID_VERIFICATION_TYPES:
            errors.append(
                "Bug '{}' has invalid verification_type '{}' "
                "(must be one of {})".format(
                    bid or "index {}".format(i), vtype, VALID_VERIFICATION_TYPES
                )
            )

        # Validate status
        status = bug.get("status")
        if status is not None and status not in VALID_STATUSES:
            errors.append(
                "Bug '{}' has invalid status '{}' "
                "(must be one of {})".format(
                    bid or "index {}".format(i), status, VALID_STATUSES
                )
            )

        # Validate error_source has type field
        error_source = bug.get("error_source")
        if error_source is not None:
            if not isinstance(error_source, dict):
                errors.append(
                    "Bug '{}' error_source must be an object".format(
                        bid or "index {}".format(i)
                    )
                )
            elif "type" not in error_source:
                errors.append(
                    "Bug '{}' error_source missing required field: type".format(
                        bid or "index {}".format(i)
                    )
                )

        # Validate acceptance_criteria is a list
        ac = bug.get("acceptance_criteria")
        if ac is not None and not isinstance(ac, list):
            errors.append(
                "Bug '{}' acceptance_criteria must be an array".format(
                    bid or "index {}".format(i)
                )
            )

    return errors, seen_ids


def create_state_directory(state_dir, bug_list_path, bugs):
    """Create the state directory structure with pipeline.json and per-bug status files."""
    abs_state_dir = os.path.abspath(state_dir)
    abs_bug_list_path = os.path.abspath(bug_list_path)
    bugs_dir = os.path.join(abs_state_dir, "bugs")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run_id = "bugfix-run-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    # Create top-level state directory
    os.makedirs(abs_state_dir, exist_ok=True)
    os.makedirs(bugs_dir, exist_ok=True)

    # Write pipeline.json
    pipeline_state = {
        "run_id": run_id,
        "pipeline_type": "bugfix",
        "status": "initialized",
        "bug_list_path": abs_bug_list_path,
        "created_at": now,
        "total_bugs": len(bugs),
        "completed_bugs": 0,
    }
    pipeline_path = os.path.join(abs_state_dir, "pipeline.json")
    with open(pipeline_path, "w", encoding="utf-8") as f:
        json.dump(pipeline_state, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Write per-bug status.json and create sessions directory
    for bug in bugs:
        if not isinstance(bug, dict):
            continue
        bid = bug.get("id")
        if bid is None:
            continue

        bug_dir = os.path.join(bugs_dir, bid)
        sessions_dir = os.path.join(bug_dir, "sessions")
        os.makedirs(sessions_dir, exist_ok=True)

        bug_status = {
            "bug_id": bid,
            "status": "pending",
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
        status_path = os.path.join(bug_dir, "status.json")
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(bug_status, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return abs_state_dir


def main():
    args = parse_args()

    # Load bug fix list
    data, load_errors = load_bug_list(args.bug_list)
    if load_errors:
        output = {"valid": False, "errors": load_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Validate schema
    schema_errors = validate_schema(data)
    if schema_errors:
        output = {"valid": False, "errors": schema_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Validate bugs
    bugs = data["bugs"]
    bug_errors, bug_ids = validate_bugs(bugs)
    if bug_errors:
        output = {"valid": False, "errors": bug_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Create state directory
    try:
        abs_state_dir = create_state_directory(
            args.state_dir, args.bug_list, bugs
        )
    except (IOError, OSError) as e:
        output = {"valid": False, "errors": ["Failed to create state directory: {}".format(str(e))]}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Success output
    output = {
        "valid": True,
        "bugs_count": len(bugs),
        "state_dir": abs_state_dir,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
