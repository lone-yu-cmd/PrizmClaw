#!/usr/bin/env python3
"""Initialize the dev-pipeline state directory from a feature-list.json file.

Validates the feature list schema, checks dependency DAG for cycles,
and creates the state directory structure with pipeline and feature status files.

Usage:
    python3 init-pipeline.py --feature-list <path> --state-dir <path>
"""

import argparse
import json
import os
import re
import sys
from collections import deque
from datetime import datetime, timezone


EXPECTED_SCHEMA = "dev-pipeline-feature-list-v1"
FEATURE_ID_PATTERN = re.compile(r"^F-\d{3}$")
TERMINAL_STATUSES = {"completed", "failed", "skipped"}

REQUIRED_FEATURE_FIELDS = [
    "id",
    "title",
    "description",
    "priority",
    "dependencies",
    "acceptance_criteria",
    "status",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Initialize dev-pipeline state from a feature-list.json file."
    )
    parser.add_argument(
        "--feature-list",
        required=True,
        help="Path to the feature-list.json file",
    )
    parser.add_argument(
        "--state-dir",
        required=True,
        help="Path to the state directory to create/initialize",
    )
    return parser.parse_args()


def load_feature_list(path):
    """Load and return the parsed JSON from the feature list file."""
    abs_path = os.path.abspath(path)
    if not os.path.isfile(abs_path):
        return None, ["Feature list file not found: {}".format(abs_path)]
    try:
        with open(abs_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return None, ["Invalid JSON in feature list: {}".format(str(e))]
    except IOError as e:
        return None, ["Cannot read feature list file: {}".format(str(e))]
    return data, []


def validate_schema(data):
    """Validate the top-level schema and structure of the feature list."""
    errors = []

    # Check $schema
    schema = data.get("$schema")
    if schema != EXPECTED_SCHEMA:
        errors.append(
            "Invalid $schema: expected '{}', got '{}'".format(EXPECTED_SCHEMA, schema)
        )

    # Check app_name
    if "app_name" not in data:
        errors.append("Missing required field: app_name")
    elif not isinstance(data["app_name"], str) or not data["app_name"].strip():
        errors.append("app_name must be a non-empty string")

    # Check features array
    if "features" not in data:
        errors.append("Missing required field: features")
    elif not isinstance(data["features"], list):
        errors.append("features must be an array")

    return errors


def validate_features(features):
    """Validate each feature object and cross-reference dependencies."""
    errors = []
    feature_ids = set()
    seen_ids = set()

    # First pass: collect all feature IDs and validate structure
    for i, feature in enumerate(features):
        if not isinstance(feature, dict):
            errors.append("Feature at index {} is not an object".format(i))
            continue

        # Check required fields
        for field in REQUIRED_FEATURE_FIELDS:
            if field not in feature:
                errors.append(
                    "Feature at index {} missing required field: {}".format(i, field)
                )

        # Validate feature ID format
        fid = feature.get("id")
        if fid is not None:
            if not isinstance(fid, str) or not FEATURE_ID_PATTERN.match(fid):
                errors.append(
                    "Feature at index {} has invalid id '{}' "
                    "(must match F-NNN pattern)".format(i, fid)
                )
            elif fid in seen_ids:
                errors.append("Duplicate feature id: {}".format(fid))
            else:
                seen_ids.add(fid)
                feature_ids.add(fid)

        # Validate dependencies is a list
        deps = feature.get("dependencies")
        if deps is not None and not isinstance(deps, list):
            errors.append(
                "Feature '{}' dependencies must be an array".format(
                    fid if fid else "index {}".format(i)
                )
            )

        # Validate acceptance_criteria is a list
        ac = feature.get("acceptance_criteria")
        if ac is not None and not isinstance(ac, list):
            errors.append(
                "Feature '{}' acceptance_criteria must be an array".format(
                    fid if fid else "index {}".format(i)
                )
            )

    # Second pass: validate dependency references
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id", "unknown")
        deps = feature.get("dependencies", [])
        if not isinstance(deps, list):
            continue
        for dep in deps:
            if dep not in feature_ids:
                errors.append(
                    "Feature '{}' depends on unknown feature '{}'".format(fid, dep)
                )

    return errors, feature_ids


def check_dag(features):
    """Check that feature dependencies form a DAG (no cycles) using topological sort.

    Uses Kahn's algorithm. Returns a list of errors if cycles are detected.
    """
    # Build adjacency list and in-degree count
    adj = {}  # feature_id -> list of features that depend on it
    in_degree = {}
    feature_map = {}

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if fid is None:
            continue
        feature_map[fid] = feature
        if fid not in adj:
            adj[fid] = []
        if fid not in in_degree:
            in_degree[fid] = 0

    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        deps = feature.get("dependencies", [])
        if not isinstance(deps, list) or fid is None:
            continue
        for dep in deps:
            if dep in adj:
                # dep -> fid (fid depends on dep, so dep must come first)
                adj[dep].append(fid)
                in_degree[fid] = in_degree.get(fid, 0) + 1

    # Kahn's algorithm
    queue = deque()
    for fid in in_degree:
        if in_degree[fid] == 0:
            queue.append(fid)

    sorted_count = 0
    while queue:
        node = queue.popleft()
        sorted_count += 1
        for neighbor in adj.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if sorted_count != len(feature_map):
        # Find which features are part of cycles
        cycle_members = [
            fid for fid, deg in in_degree.items() if deg > 0
        ]
        return [
            "Dependency cycle detected involving features: {}".format(
                ", ".join(sorted(cycle_members))
            )
        ]

    return []


def create_state_directory(state_dir, feature_list_path, features):
    """Create the state directory structure with pipeline.json and per-feature status files."""
    abs_state_dir = os.path.abspath(state_dir)
    abs_feature_list_path = os.path.abspath(feature_list_path)
    # Store as relative path from state_dir so pipeline.json is portable across machines
    rel_feature_list_path = os.path.relpath(abs_feature_list_path, abs_state_dir)
    features_dir = os.path.join(abs_state_dir, "features")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run_id = "run-" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M")

    # Create top-level state directory
    os.makedirs(abs_state_dir, exist_ok=True)
    os.makedirs(features_dir, exist_ok=True)

    # Count features already in terminal status at init time
    completed_count = sum(
        1 for f in features
        if isinstance(f, dict) and f.get("status") in TERMINAL_STATUSES
    )

    # Write pipeline.json
    pipeline_state = {
        "run_id": run_id,
        "status": "initialized",
        "feature_list_path": rel_feature_list_path,
        "created_at": now,
        "total_features": len(features),
        "completed_features": completed_count,
    }
    pipeline_path = os.path.join(abs_state_dir, "pipeline.json")
    with open(pipeline_path, "w", encoding="utf-8") as f:
        json.dump(pipeline_state, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Write per-feature status.json and create sessions directory
    for feature in features:
        if not isinstance(feature, dict):
            continue
        fid = feature.get("id")
        if fid is None:
            continue

        feature_dir = os.path.join(features_dir, fid)
        sessions_dir = os.path.join(feature_dir, "sessions")
        os.makedirs(sessions_dir, exist_ok=True)

        # Respect existing terminal status from feature-list.json
        fl_status = feature.get("status", "pending")
        init_status = fl_status if fl_status in TERMINAL_STATUSES else "pending"

        feature_status = {
            "feature_id": fid,
            "status": init_status,
            "retry_count": 0,
            "max_retries": 3,
            "sessions": [],
            "last_session_id": None,
            "resume_from_phase": None,
            "created_at": now,
            "updated_at": now,
        }
        status_path = os.path.join(feature_dir, "status.json")
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(feature_status, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return abs_state_dir


def main():
    args = parse_args()

    # Load feature list
    data, load_errors = load_feature_list(args.feature_list)
    if load_errors:
        output = {"valid": False, "errors": load_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Warn if feature-list.json is not at project root
    feature_list_dir = os.path.dirname(os.path.abspath(args.feature_list))
    indicators = ['.git', 'package.json', '.prizmkit']
    is_at_root = any(os.path.exists(os.path.join(feature_list_dir, i)) for i in indicators)
    if not is_at_root:
        sys.stderr.write(
            "Warning: feature-list.json may not be at project root: {}\n".format(feature_list_dir)
        )

    # Validate schema
    schema_errors = validate_schema(data)
    if schema_errors:
        output = {"valid": False, "errors": schema_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Validate features
    features = data["features"]
    feature_errors, feature_ids = validate_features(features)
    if feature_errors:
        output = {"valid": False, "errors": feature_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Check DAG (no cycles)
    dag_errors = check_dag(features)
    if dag_errors:
        output = {"valid": False, "errors": dag_errors}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Create state directory
    try:
        abs_state_dir = create_state_directory(
            args.state_dir, args.feature_list, features
        )
    except (IOError, OSError) as e:
        output = {"valid": False, "errors": ["Failed to create state directory: {}".format(str(e))]}
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(1)

    # Success output
    output = {
        "valid": True,
        "features_count": len(features),
        "state_dir": abs_state_dir,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
