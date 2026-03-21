#!/usr/bin/env python3
"""Shared utility functions for dev-pipeline scripts.

Centralizes common operations (JSON I/O, error reporting, display helpers)
to avoid duplication across pipeline scripts.
"""

import json
import logging
import os
import sys


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


def setup_logging(name="prizmkit.dev_pipeline", level=None):
    """Configure and return a standard logger for pipeline scripts.

    Logs are written to stderr to avoid interfering with stdout JSON outputs.
    """
    resolved_level = (level or os.environ.get("PRIZMKIT_LOG_LEVEL", "INFO")).upper()
    numeric_level = getattr(logging, resolved_level, logging.INFO)

    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=numeric_level,
            stream=sys.stderr,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )

    logger = logging.getLogger(name)
    logger.setLevel(numeric_level)
    return logger


def error_out(message, code=1):
    """Print an error JSON and exit with the given code."""
    output = {"error": message}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(code)


def pad_right(text, width):
    """Pad text with spaces to fill width, accounting for ANSI escape codes."""
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
    """Build a text progress bar.

    Example: ████████░░░░░░░░░░░░ 40%
    """
    filled = int(width * percent / 100)
    empty = width - filled
    bar = "\u2588" * filled + "\u2591" * empty
    return "{} {:>3}%".format(bar, int(percent))


def detect_project_context(project_root):
    """Auto-detect project tech stack from project files.

    Reads package.json, pyproject.toml, and common config files
    to infer language, test framework, and other stack details.
    Returns a dict of detected key-value pairs.
    """
    detected = {}

    # 1. Node.js / JavaScript / TypeScript project
    pkg_path = os.path.join(project_root, "package.json")
    if os.path.isfile(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)

            # Language detection
            deps = {}
            deps.update(pkg.get("dependencies", {}))
            deps.update(pkg.get("devDependencies", {}))
            if "typescript" in deps or os.path.isfile(
                os.path.join(project_root, "tsconfig.json")
            ):
                detected["language"] = "TypeScript"
            else:
                detected["language"] = "JavaScript"

            # Test framework detection (order: more specific first)
            scripts = pkg.get("scripts", {})
            test_script = (
                scripts.get("test", "")
                + " "
                + scripts.get("test:unit", "")
            )
            if "vitest" in deps or "vitest" in test_script:
                detected["testing_framework"] = "Vitest"
            elif "jest" in deps or "jest" in test_script:
                detected["testing_framework"] = "Jest"
            elif "mocha" in deps or "mocha" in test_script:
                detected["testing_framework"] = "Mocha"
            elif "--test" in test_script or "node:test" in test_script:
                detected["testing_framework"] = "Node.js built-in test runner"

            # Framework detection
            if "next" in deps:
                detected["framework"] = "Next.js"
            elif "express" in deps:
                detected["framework"] = "Express.js"
            elif "fastify" in deps:
                detected["framework"] = "Fastify"
            elif "react" in deps:
                detected["framework"] = "React"
            elif "vue" in deps:
                detected["framework"] = "Vue.js"
        except (json.JSONDecodeError, IOError):
            pass

    # 2. Python project detection
    if not detected:
        for marker in ["pyproject.toml", "setup.py", "requirements.txt"]:
            if os.path.isfile(os.path.join(project_root, marker)):
                detected["language"] = "Python"
                # Check for pytest
                toml_path = os.path.join(project_root, "pyproject.toml")
                if os.path.isfile(toml_path):
                    try:
                        with open(toml_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        if "pytest" in content:
                            detected["testing_framework"] = "pytest"
                    except IOError:
                        pass
                break

    return detected


def enrich_global_context(global_context, project_root):
    """Fill gaps in global_context using auto-detected project info.

    Only adds auto-detected values for keys not already present.
    Mutates global_context in place and returns it.
    """
    if not project_root:
        return global_context

    detected = detect_project_context(project_root)
    # Map detected keys → global_context convention names
    key_mapping = {
        "language": "language",
        "testing_framework": "testing_strategy",
        "framework": "framework",
    }
    # Alternate key names that should block auto-detection
    alt_keys = {
        "testing_strategy": ["testing_framework", "test_framework"],
    }
    for det_key, ctx_key in key_mapping.items():
        if det_key not in detected:
            continue
        if ctx_key in global_context:
            continue
        already_set = any(
            k in global_context for k in alt_keys.get(ctx_key, [])
        )
        if not already_set:
            global_context[ctx_key] = detected[det_key] + " (auto-detected)"

    return global_context
