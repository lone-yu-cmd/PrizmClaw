#!/usr/bin/env python3
"""
Validate bug-fix-list.json against the PrizmKit bug-fix-list schema.

Usage:
    python3 validate-bug-list.py [bug-fix-list.json] [--feature-list feature-list.json]

Exit codes:
    0 = valid
    1 = validation errors found
    2 = file not found or JSON parse error
"""

import json
import sys
import os
import re

VALID_SEVERITIES = {"critical", "high", "medium", "low"}
VALID_SOURCE_TYPES = {"stack_trace", "user_report", "failed_test", "log_pattern", "monitoring_alert"}
VALID_VERIFICATION_TYPES = {"automated", "manual", "hybrid"}
VALID_STATUSES = {"pending", "in_progress", "fixed", "failed", "skipped", "needs_info"}
BUG_ID_PATTERN = re.compile(r"^B-\d{3}$")


def validate(bug_list_path, feature_list_path=None):
    errors = []
    warnings = []

    # Load bug-fix-list.json
    try:
        with open(bug_list_path) as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {bug_list_path}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {bug_list_path}: {e}", file=sys.stderr)
        return 2

    # Load feature-list.json (optional, for cross-reference)
    feature_ids = set()
    if feature_list_path:
        try:
            with open(feature_list_path) as f:
                fl_data = json.load(f)
            feature_ids = {f.get("id") for f in fl_data.get("features", [])}
        except (FileNotFoundError, json.JSONDecodeError):
            warnings.append(f"Could not load feature-list.json at {feature_list_path}")

    # Top-level required fields
    if "$schema" not in data:
        errors.append("Missing required field: $schema")
    elif data["$schema"] != "dev-pipeline-bug-fix-list-v1":
        errors.append(f"Invalid $schema: expected 'dev-pipeline-bug-fix-list-v1', got '{data['$schema']}'")

    if not data.get("project_name"):
        errors.append("Missing or empty required field: project_name")

    bugs = data.get("bugs", [])
    if not bugs:
        errors.append("Missing or empty required field: bugs")

    # Per-bug validation
    seen_ids = set()
    seen_priorities = set()

    for i, bug in enumerate(bugs):
        prefix = f"bugs[{i}]"

        # Required fields
        bug_id = bug.get("id", "")
        if not bug_id:
            errors.append(f"{prefix}: missing required field 'id'")
        elif not BUG_ID_PATTERN.match(bug_id):
            errors.append(f"{prefix}: id '{bug_id}' does not match pattern B-NNN")

        if bug_id in seen_ids:
            errors.append(f"{prefix}: duplicate bug id '{bug_id}'")
        seen_ids.add(bug_id)

        if not bug.get("title"):
            errors.append(f"{prefix} ({bug_id}): missing required field 'title'")

        if not bug.get("description"):
            errors.append(f"{prefix} ({bug_id}): missing required field 'description'")

        severity = bug.get("severity", "")
        if severity not in VALID_SEVERITIES:
            errors.append(f"{prefix} ({bug_id}): invalid severity '{severity}' — must be one of {VALID_SEVERITIES}")

        # error_source
        error_source = bug.get("error_source", {})
        source_type = error_source.get("type", "") if isinstance(error_source, dict) else ""
        if source_type not in VALID_SOURCE_TYPES:
            errors.append(f"{prefix} ({bug_id}): invalid error_source.type '{source_type}' — must be one of {VALID_SOURCE_TYPES}")

        # verification_type
        vtype = bug.get("verification_type", "")
        if vtype not in VALID_VERIFICATION_TYPES:
            errors.append(f"{prefix} ({bug_id}): invalid verification_type '{vtype}' — must be one of {VALID_VERIFICATION_TYPES}")

        # acceptance_criteria
        ac = bug.get("acceptance_criteria", [])
        if not ac or not isinstance(ac, list):
            errors.append(f"{prefix} ({bug_id}): missing or empty acceptance_criteria array")

        # status
        status = bug.get("status", "")
        if status not in VALID_STATUSES:
            errors.append(f"{prefix} ({bug_id}): invalid status '{status}' — must be one of {VALID_STATUSES}")

        # Priority uniqueness
        priority = bug.get("priority")
        if priority is not None:
            if priority in seen_priorities:
                warnings.append(f"{prefix} ({bug_id}): duplicate priority {priority}")
            seen_priorities.add(priority)

        # Cross-reference affected_feature
        affected_feature = bug.get("affected_feature")
        if affected_feature and feature_ids and affected_feature not in feature_ids:
            warnings.append(f"{prefix} ({bug_id}): affected_feature '{affected_feature}' not found in feature-list.json")

    # Output results
    if errors:
        print(f"VALIDATION FAILED — {len(errors)} error(s), {len(warnings)} warning(s)\n")
        for e in errors:
            print(f"  ERROR: {e}")
        for w in warnings:
            print(f"  WARN:  {w}")
        return 1
    else:
        bug_count = len(bugs)
        severity_counts = {}
        for b in bugs:
            s = b.get("severity", "unknown")
            severity_counts[s] = severity_counts.get(s, 0) + 1
        sev_str = ", ".join(f"{k}={v}" for k, v in sorted(severity_counts.items()))
        print(f"VALIDATION PASSED — {bug_count} bugs ({sev_str})")
        if warnings:
            for w in warnings:
                print(f"  WARN:  {w}")
        return 0


if __name__ == "__main__":
    bug_list = sys.argv[1] if len(sys.argv) > 1 else "bug-fix-list.json"
    feature_list = None

    if "--feature-list" in sys.argv:
        idx = sys.argv.index("--feature-list")
        if idx + 1 < len(sys.argv):
            feature_list = sys.argv[idx + 1]

    sys.exit(validate(bug_list, feature_list))
