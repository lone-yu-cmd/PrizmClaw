#!/usr/bin/env python3
"""Initialize prizmkit directory structures for a feature.

Creates the standard directory layout expected by prizm-dev-team agents:
- .prizmkit/specs/<feature-slug>/    ← per-feature subdirectory

Usage:
    python3 init-dev-team.py --project-root <path> --feature-slug <slug>
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser(
        description="Initialize dev-team and prizmkit directories"
    )
    parser.add_argument(
        "--project-root",
        required=True,
        help="Project root directory",
    )
    parser.add_argument(
        "--feature-id",
        default=None,
        help="Feature ID (e.g. F-001)",
    )
    parser.add_argument(
        "--feature-slug",
        default=None,
        help="Feature slug for per-feature directory (e.g. 001-project-infrastructure-setup)",
    )
    return parser.parse_args()


def create_directories(project_root, feature_slug=None):
    """Create the prizmkit directory structures."""
    dirs_to_create = []

    # PrizmKit per-feature directories
    if feature_slug:
        dirs_to_create.extend([
            ".prizmkit/specs/{}".format(feature_slug),
        ])
    else:
        # Fallback: create flat directories (not recommended)
        dirs_to_create.extend([
            ".prizmkit/specs",
        ])
    
    created = []
    for dir_path in dirs_to_create:
        full_path = os.path.join(project_root, dir_path)
        if not os.path.exists(full_path):
            os.makedirs(full_path, exist_ok=True)
            created.append(dir_path)
    
    return created


def init_prizmkit_config(project_root, feature_id):
    """Initialize or update .prizmkit/config.json."""
    config_path = os.path.join(project_root, ".prizmkit", "config.json")
    
    if os.path.exists(config_path):
        # Update existing config
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        config["current_feature"] = feature_id
        config["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        # Create new config
        # Try to get project name from package.json or directory name
        project_name = os.path.basename(project_root)
        pkg_json_path = os.path.join(project_root, "package.json")
        if os.path.exists(pkg_json_path):
            try:
                with open(pkg_json_path, "r", encoding="utf-8") as f:
                    pkg = json.load(f)
                    project_name = pkg.get("name", project_name)
            except (json.JSONDecodeError, IOError):
                pass
        
        config = {
            "adoption_mode": "active",
            "speckit_hooks_enabled": True,
            "project_name": project_name,
            "initialized_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "feature_prefix": "F-",
            "current_feature": feature_id,
        }
    
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    
    return config_path


def main():
    args = parse_args()
    project_root = os.path.abspath(args.project_root)
    
    if not os.path.isdir(project_root):
        result = {
            "success": False,
            "error": f"Project root does not exist: {project_root}",
        }
        print(json.dumps(result, indent=2))
        sys.exit(1)
    
    # Create directories
    created_dirs = create_directories(project_root, args.feature_slug)
    
    # Initialize config
    config_path = init_prizmkit_config(project_root, args.feature_id)
    
    result = {
        "success": True,
        "project_root": project_root,
        "feature_slug": args.feature_slug,
        "directories_created": created_dirs,
        "config_path": config_path,
    }
    
    print(json.dumps(result, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
