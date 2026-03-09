#!/usr/bin/env python3
"""Shared path policy for dev-pipeline Python scripts.

Keeps path and naming conventions aligned with src/pipeline-infra/path-policy.js.
"""

import os
import re


_SAFE_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def _assert_safe_segment(value: str, label: str) -> str:
    normalized = str(value or "").strip()
    if not normalized or not _SAFE_SEGMENT_PATTERN.match(normalized) or ".." in normalized:
        raise ValueError(f"Invalid path segment for {label}: {value}")
    return normalized


def compute_feature_slug(feature_id: str, title: str) -> str:
    normalized_feature_id = _assert_safe_segment(feature_id, "feature_id")
    numeric = re.sub(r"^[Ff]-", "", normalized_feature_id)
    numeric = numeric.lstrip("0").zfill(3)

    cleaned_title = re.sub(r"[^a-z0-9\s-]", "", str(title or "").lower())
    cleaned_title = re.sub(r"[\s]+", "-", cleaned_title.strip())
    cleaned_title = re.sub(r"-+", "-", cleaned_title)
    safe_title = cleaned_title or "feature"

    return f"{numeric}-{safe_title}"


def resolve_specs_dir(project_root: str, feature_slug: str) -> str:
    return os.path.join(os.path.abspath(project_root), ".prizmkit", "specs", feature_slug)


def resolve_feature_paths(project_root: str, feature_id: str, title: str, session_id: str) -> dict:
    root = os.path.abspath(str(project_root or ""))
    safe_feature_id = _assert_safe_segment(feature_id, "feature_id")
    safe_session_id = _assert_safe_segment(session_id, "session_id")
    feature_slug = compute_feature_slug(safe_feature_id, title)

    specs_dir = resolve_specs_dir(root, feature_slug)
    session_dir = os.path.join(root, "dev-pipeline", "state", "features", safe_feature_id, "sessions", safe_session_id)

    return {
        "featureSlug": feature_slug,
        "specsDir": specs_dir,
        "sessionDir": session_dir,
        "sessionLog": os.path.join(session_dir, "logs", "session.log"),
        "sessionStatus": os.path.join(session_dir, "session-status.json"),
    }


def resolve_bug_paths(project_root: str, bug_id: str, session_id: str) -> dict:
    root = os.path.abspath(str(project_root or ""))
    safe_bug_id = _assert_safe_segment(bug_id, "bug_id")
    safe_session_id = _assert_safe_segment(session_id, "session_id")

    bug_dir = os.path.join(root, "dev-pipeline", "bugfix-state", "bugs", safe_bug_id)
    session_dir = os.path.join(bug_dir, "sessions", safe_session_id)

    return {
        "bugDir": bug_dir,
        "sessionDir": session_dir,
        "sessionLog": os.path.join(session_dir, "logs", "session.log"),
        "sessionStatus": os.path.join(session_dir, "session-status.json"),
    }


def resolve_daemon_log_paths(project_root: str) -> dict:
    root = os.path.abspath(str(project_root or ""))
    return {
        "featureDaemonLog": os.path.join(root, "dev-pipeline", "state", "pipeline-daemon.log"),
        "bugfixDaemonLog": os.path.join(root, "dev-pipeline", "bugfix-state", "pipeline-daemon.log"),
    }
