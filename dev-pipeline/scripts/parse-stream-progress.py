#!/usr/bin/env python3
"""
parse-stream-progress.py - Real-time stream-json progress parser

Continuously reads an AI CLI session log (JSONL from --output-format stream-json),
extracts tool calls, phase changes, and activity metrics, and writes structured
progress to a progress.json file for heartbeat monitoring.

Usage:
    python3 parse-stream-progress.py --session-log <path> --progress-file <path>

The script runs until:
  - The session log stops growing and the CLI process exits
  - It receives SIGTERM/SIGINT
"""

import argparse
import json
import os
import signal
import sys
import tempfile
import time
from collections import Counter
from datetime import datetime, timezone


# Phase keywords for detection
PHASE_KEYWORDS = {
    "specify": ["prizmkit-specify", "spec.md", "specification", "gathering requirements"],
    "plan": ["prizmkit-plan", "plan.md", "architecture", "design plan", "task checklist", "task breakdown", "tasks.md"],
    "analyze": ["prizmkit-analyze", "cross-check", "consistency", "analyzing"],
    "implement": ["prizmkit-implement", "implement", "TDD", "coding", "writing code"],
    "code-review": ["prizmkit-code-review", "code review", "review verdict", "reviewing"],
    "summarize": ["prizmkit-summarize", "REGISTRY.md", "summarize", "summary"],
    "commit": ["prizmkit-committer", "git commit", "feat(", "fix(", "committing"],
}


class ProgressTracker:
    """Tracks progress state from stream-json events."""

    def __init__(self):
        self.message_count = 0
        self.current_tool = None
        self.current_tool_input_summary = ""
        self.current_phase = None
        self.detected_phases = []
        self.tool_call_counts = Counter()
        self.total_tool_calls = 0
        self.last_text_snippet = ""
        self.is_active = True
        self.errors = []
        self._text_buffer = ""
        self._in_tool_use = False
        self._current_tool_input_parts = []

    def process_event(self, event):
        """Process a single stream-json event and update state."""
        event_type = event.get("type", "")

        if event_type == "message_start":
            self.message_count += 1
            self.is_active = True

        elif event_type == "message_stop":
            self.current_tool = None
            self.current_tool_input_summary = ""
            self._in_tool_use = False
            self._current_tool_input_parts = []

        elif event_type == "content_block_start":
            content_block = event.get("content_block", {})
            block_type = content_block.get("type", "")

            if block_type == "tool_use":
                tool_name = content_block.get("name", "unknown")
                self.current_tool = tool_name
                self.current_tool_input_summary = ""
                self.tool_call_counts[tool_name] += 1
                self.total_tool_calls += 1
                self._in_tool_use = True
                self._current_tool_input_parts = []

            elif block_type == "text":
                self._text_buffer = ""
                self._in_tool_use = False

        elif event_type == "content_block_delta":
            delta = event.get("delta", {})
            delta_type = delta.get("type", "")

            if delta_type == "text_delta":
                text = delta.get("text", "")
                self._text_buffer += text
                # Keep last meaningful snippet
                stripped = text.strip()
                if stripped:
                    self.last_text_snippet = stripped[:120]
                # Try to detect phase from text
                self._detect_phase(text)

            elif delta_type == "input_json_delta":
                partial = delta.get("partial_json", "")
                self._current_tool_input_parts.append(partial)
                # Build a summary from accumulated input
                accumulated = "".join(self._current_tool_input_parts)
                self.current_tool_input_summary = accumulated[:150]

        elif event_type == "content_block_stop":
            if self._in_tool_use:
                # Try to extract a better summary from complete tool input
                full_input = "".join(self._current_tool_input_parts)
                self._extract_tool_summary(full_input)
                self._detect_phase(full_input)
            else:
                # Text block finished - detect phase from accumulated text
                if self._text_buffer:
                    self._detect_phase(self._text_buffer)
            self._in_tool_use = False
            self._current_tool_input_parts = []

        elif event_type == "error":
            error_msg = event.get("error", {}).get("message", "Unknown error")
            self.errors.append(error_msg)

        # Check for subagent indicator
        if event.get("parent_tool_use_id"):
            # This is a sub-agent event; tool name is still tracked normally
            pass

    def _detect_phase(self, text):
        """Detect pipeline phase from text content."""
        text_lower = text.lower()
        for phase, keywords in PHASE_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    self.current_phase = phase
                    if phase not in self.detected_phases:
                        self.detected_phases.append(phase)
                    return

    def _extract_tool_summary(self, raw_input):
        """Extract a human-readable summary from tool input JSON."""
        try:
            data = json.loads(raw_input)
            # Common patterns in tool inputs
            if isinstance(data, dict):
                # Agent tool - look for description or prompt
                if "description" in data:
                    self.current_tool_input_summary = str(data["description"])[:100]
                elif "command" in data:
                    self.current_tool_input_summary = str(data["command"])[:100]
                elif "file_path" in data:
                    self.current_tool_input_summary = str(data["file_path"])[:100]
                elif "pattern" in data:
                    self.current_tool_input_summary = str(data["pattern"])[:100]
                elif "query" in data:
                    self.current_tool_input_summary = str(data["query"])[:100]
                elif "prompt" in data:
                    self.current_tool_input_summary = str(data["prompt"])[:100]
        except (json.JSONDecodeError, TypeError):
            # Keep whatever partial summary we had
            pass

    def to_dict(self):
        """Export current state as a dictionary for JSON serialization."""
        tool_calls = [
            {"name": name, "count": count}
            for name, count in self.tool_call_counts.most_common()
        ]
        return {
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "message_count": self.message_count,
            "current_tool": self.current_tool,
            "current_tool_input_summary": self.current_tool_input_summary,
            "current_phase": self.current_phase,
            "detected_phases": self.detected_phases,
            "tool_calls": tool_calls,
            "total_tool_calls": self.total_tool_calls,
            "last_text_snippet": self.last_text_snippet,
            "is_active": self.is_active,
            "errors": self.errors[-10:],  # Keep last 10 errors
        }


def atomic_write_json(data, filepath):
    """Write JSON data atomically using tmp file + rename."""
    dir_path = os.path.dirname(filepath)
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        os.rename(tmp_path, filepath)
    except OSError:
        # Best effort - remove tmp file if rename failed
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def tail_and_parse(session_log, progress_file, poll_interval=0.5):
    """Tail session log and parse stream-json events."""
    tracker = ProgressTracker()
    last_write_state = None

    # Wait for log file to appear
    wait_count = 0
    while not os.path.exists(session_log):
        time.sleep(poll_interval)
        wait_count += 1
        if wait_count > 120:  # 60 seconds max wait
            sys.stderr.write(f"Timeout waiting for {session_log}\n")
            sys.exit(1)

    with open(session_log, "r") as f:
        idle_count = 0
        while True:
            line = f.readline()
            if line:
                idle_count = 0
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    tracker.process_event(event)
                except json.JSONDecodeError:
                    # Not a JSON line (could be stderr mixed in)
                    # Use it as a text snippet if meaningful
                    stripped = line.strip()
                    if stripped and len(stripped) > 5:
                        tracker.last_text_snippet = stripped[:120]
                    continue

                # Write progress if state changed
                current_state = tracker.to_dict()
                state_key = (
                    current_state["message_count"],
                    current_state["current_tool"],
                    current_state["current_phase"],
                    current_state["total_tool_calls"],
                )
                if state_key != last_write_state:
                    atomic_write_json(current_state, progress_file)
                    last_write_state = state_key
            else:
                idle_count += 1
                # After 2 seconds of no new data, write current state anyway
                # (ensures progress.json stays fresh)
                if idle_count == 4:
                    current_state = tracker.to_dict()
                    atomic_write_json(current_state, progress_file)

                # After 3600 idle cycles (30 min), mark inactive and exit
                if idle_count > 3600:
                    tracker.is_active = False
                    atomic_write_json(tracker.to_dict(), progress_file)
                    break

                time.sleep(poll_interval)

    # Final write
    tracker.is_active = False
    atomic_write_json(tracker.to_dict(), progress_file)


def main():
    parser = argparse.ArgumentParser(description="Parse stream-json progress")
    parser.add_argument("--session-log", required=True, help="Path to session.log (JSONL)")
    parser.add_argument("--progress-file", required=True, help="Path to write progress.json")
    args = parser.parse_args()

    # Handle graceful shutdown
    def handle_signal(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        tail_and_parse(args.session_log, args.progress_file)
    except SystemExit:
        pass
    except Exception as e:
        sys.stderr.write(f"parse-stream-progress.py error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
