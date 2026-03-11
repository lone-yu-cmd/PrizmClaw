#!/usr/bin/env python3
"""Path policy utilities for pipeline infrastructure.

This module provides path calculation and validation functions that mirror
the JavaScript implementation in src/pipeline-infra/path-policy.js.

Maintains exact behavioral parity with the JS version for cross-language compatibility.
"""

import os
import re

SAFE_SEGMENT_PATTERN = re.compile(r'^[A-Za-z0-9._-]+$')


def _assert_safe_segment(value, label):
    """Validate that a path segment is safe.

    Args:
        value: The value to validate
        label: Label for error messages

    Returns:
        The normalized, validated string

    Raises:
        ValueError: If the segment is invalid
    """
    normalized = str(value or '').strip()
    if not normalized or not SAFE_SEGMENT_PATTERN.match(normalized) or '..' in normalized:
        raise ValueError('Invalid path segment for {}: {}'.format(label, value))
    return normalized


def compute_feature_slug(feature_id, title):
    """Compute a feature slug from ID and title.

    Args:
        feature_id: Feature ID like 'F-001'
        title: Feature title

    Returns:
        Slug string like '001-feature-name'
    """
    normalized_feature_id = _assert_safe_segment(feature_id, 'featureId')
    # Remove 'F-' prefix (case-insensitive), strip leading zeros, pad to 3 digits
    numeric = re.sub(r'^F-', '', normalized_feature_id, flags=re.IGNORECASE)
    numeric = numeric.lstrip('0') or '0'
    numeric = numeric.zfill(3)

    raw_title = str(title or '').lower()
    # Remove non-alphanumeric chars except spaces and hyphens
    cleaned_title = re.sub(r'[^a-z0-9\s-]', '', raw_title)
    cleaned_title = cleaned_title.strip()
    # Replace whitespace with hyphens
    cleaned_title = re.sub(r'\s+', '-', cleaned_title)
    # Collapse multiple hyphens
    cleaned_title = re.sub(r'-+', '-', cleaned_title)

    safe_title = cleaned_title or 'feature'
    return '{}-{}'.format(numeric, safe_title)


def resolve_feature_paths(project_root, feature_id, title, session_id):
    """Resolve all paths related to a feature.

    Args:
        project_root: Project root directory
        feature_id: Feature ID like 'F-001'
        title: Feature title (for slug computation)
        session_id: Session ID

    Returns:
        Dict with featureSlug, specsDir, sessionDir, sessionLog, sessionStatus
    """
    resolved_root = os.path.abspath(str(project_root or ''))
    validated_feature_id = _assert_safe_segment(feature_id, 'featureId')
    validated_session_id = _assert_safe_segment(session_id, 'sessionId')
    feature_slug = compute_feature_slug(feature_id, title or '')

    specs_dir = os.path.join(resolved_root, '.prizmkit', 'specs', feature_slug)
    session_dir = os.path.join(
        resolved_root, 'dev-pipeline', 'state', 'features',
        validated_feature_id, 'sessions', validated_session_id
    )

    return {
        'featureSlug': feature_slug,
        'specsDir': specs_dir,
        'sessionDir': session_dir,
        'sessionLog': os.path.join(session_dir, 'logs', 'session.log'),
        'sessionStatus': os.path.join(session_dir, 'session-status.json')
    }


def resolve_bug_paths(project_root, bug_id, session_id):
    """Resolve all paths related to a bug fix.

    Args:
        project_root: Project root directory
        bug_id: Bug ID like 'B-100'
        session_id: Session ID

    Returns:
        Dict with bugDir, sessionDir, sessionLog, sessionStatus
    """
    resolved_root = os.path.abspath(str(project_root or ''))
    validated_bug_id = _assert_safe_segment(bug_id, 'bugId')
    validated_session_id = _assert_safe_segment(session_id, 'sessionId')

    bug_dir = os.path.join(resolved_root, 'dev-pipeline', 'bugfix-state', 'bugs', validated_bug_id)
    session_dir = os.path.join(bug_dir, 'sessions', validated_session_id)

    return {
        'bugDir': bug_dir,
        'sessionDir': session_dir,
        'sessionLog': os.path.join(session_dir, 'logs', 'session.log'),
        'sessionStatus': os.path.join(session_dir, 'session-status.json')
    }


def resolve_daemon_log_paths(project_root):
    """Resolve daemon log file paths.

    Args:
        project_root: Project root directory

    Returns:
        Dict with featureDaemonLog, bugfixDaemonLog
    """
    resolved_root = os.path.abspath(str(project_root or ''))

    return {
        'featureDaemonLog': os.path.join(resolved_root, 'dev-pipeline', 'state', 'pipeline-daemon.log'),
        'bugfixDaemonLog': os.path.join(resolved_root, 'dev-pipeline', 'bugfix-state', 'pipeline-daemon.log')
    }
