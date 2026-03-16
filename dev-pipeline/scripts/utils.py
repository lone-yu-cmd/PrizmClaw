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
