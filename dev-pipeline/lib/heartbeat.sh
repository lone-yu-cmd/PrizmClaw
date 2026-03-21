#!/usr/bin/env bash
# ============================================================
# dev-pipeline/lib/heartbeat.sh - Shared heartbeat monitoring
#
# Provides start_heartbeat / stop_heartbeat functions that read
# structured progress from progress.json (written by
# parse-stream-progress.py) and fall back to tail-based monitoring.
#
# Usage:
#   source "$SCRIPT_DIR/lib/heartbeat.sh"
#   start_heartbeat "$cli_pid" "$session_log" "$progress_json" "$interval"
#   # ... wait for CLI to finish ...
#   stop_heartbeat "$_HEARTBEAT_PID"
#
# Requires: colors (GREEN, YELLOW, BLUE, NC) and log functions
# to be defined before sourcing.
# ============================================================

# Start a heartbeat monitor in the background.
# Sets _HEARTBEAT_PID to the background process PID.
#
# Arguments:
#   $1 - cli_pid         PID of the AI CLI process to monitor
#   $2 - session_log     Path to session.log
#   $3 - progress_json   Path to progress.json (may not exist if stream-json disabled)
#   $4 - interval        Heartbeat interval in seconds
start_heartbeat() {
    local cli_pid="$1"
    local session_log="$2"
    local progress_json="$3"
    local heartbeat_interval="$4"

    (
        local elapsed=0
        local prev_size=0
        while kill -0 "$cli_pid" 2>/dev/null; do
            sleep "$heartbeat_interval"
            elapsed=$((elapsed + heartbeat_interval))
            kill -0 "$cli_pid" 2>/dev/null || break

            # Get log file size
            local cur_size=0
            if [[ -f "$session_log" ]]; then
                cur_size=$(wc -c < "$session_log" 2>/dev/null || echo 0)
                cur_size=$(echo "$cur_size" | tr -d ' ')
            fi

            local growth=$((cur_size - prev_size))
            prev_size=$cur_size

            local size_display
            if [[ $cur_size -gt 1048576 ]]; then
                size_display="$((cur_size / 1048576))MB"
            elif [[ $cur_size -gt 1024 ]]; then
                size_display="$((cur_size / 1024))KB"
            else
                size_display="${cur_size}B"
            fi

            local mins=$((elapsed / 60))
            local secs=$((elapsed % 60))

            local status_icon
            if [[ $growth -gt 0 ]]; then
                status_icon="${GREEN}▶${NC}"
            else
                status_icon="${YELLOW}⏸${NC}"
            fi

            # Try structured progress from progress.json
            if [[ -f "$progress_json" ]]; then
                local phase tool msgs tools_total
                phase=$(python3 -c "
import json, sys
try:
    with open('$progress_json') as f:
        d = json.load(f)
    parts = []
    if d.get('current_phase'):
        parts.append('phase: ' + d['current_phase'])
    if d.get('current_tool'):
        parts.append('tool: ' + d['current_tool'])
    parts.append('msgs: ' + str(d.get('message_count', 0)))
    parts.append(str(d.get('total_tool_calls', 0)) + ' tool calls')
    print(' | '.join(parts))
except Exception:
    sys.exit(1)
" 2>/dev/null) && {
                    echo -e "  ${status_icon} ${BLUE}[HEARTBEAT]${NC} ${mins}m${secs}s | log: ${size_display} | ${phase}"
                    continue
                }
            fi

            # Fallback: tail-based activity detection
            local last_activity=""
            if [[ -f "$session_log" ]]; then
                last_activity=$(tail -20 "$session_log" 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-80 || echo "")
            fi

            echo -e "  ${status_icon} ${BLUE}[HEARTBEAT]${NC} ${mins}m${secs}s elapsed | log: ${size_display} (+${growth}B) | ${last_activity}"
        done
    ) &
    _HEARTBEAT_PID=$!
}

# Stop a heartbeat monitor process.
#
# Arguments:
#   $1 - heartbeat_pid   PID returned by start_heartbeat
stop_heartbeat() {
    local heartbeat_pid="$1"
    if [[ -n "$heartbeat_pid" ]]; then
        kill "$heartbeat_pid" 2>/dev/null || true
        wait "$heartbeat_pid" 2>/dev/null || true
    fi
}

# Start the stream-json progress parser as a background process.
# Sets _PARSER_PID to the background process PID.
# No-op if USE_STREAM_JSON is not "true".
#
# Arguments:
#   $1 - session_log     Path to session.log
#   $2 - progress_json   Path to write progress.json
#   $3 - scripts_dir     Path to scripts/ directory
start_progress_parser() {
    local session_log="$1"
    local progress_json="$2"
    local scripts_dir="$3"

    _PARSER_PID=""

    if [[ "${USE_STREAM_JSON:-}" != "true" ]]; then
        return 0
    fi

    local parser_script="$scripts_dir/parse-stream-progress.py"
    if [[ ! -f "$parser_script" ]]; then
        return 0
    fi

    python3 "$parser_script" \
        --session-log "$session_log" \
        --progress-file "$progress_json" &
    _PARSER_PID=$!
}

# Stop the progress parser process.
#
# Arguments:
#   $1 - parser_pid   PID returned by start_progress_parser
stop_progress_parser() {
    local parser_pid="$1"
    if [[ -n "$parser_pid" ]]; then
        kill "$parser_pid" 2>/dev/null || true
        wait "$parser_pid" 2>/dev/null || true
    fi
}

# Detect whether the AI CLI supports --output-format stream-json.
# Sets USE_STREAM_JSON to "true" or "false".
#
# Arguments:
#   $1 - cli_cmd   The AI CLI command
detect_stream_json_support() {
    local cli_cmd="$1"
    USE_STREAM_JSON="false"

    # CodeBuddy (cbc) always supports stream-json
    if [[ "$cli_cmd" == "cbc" ]]; then
        USE_STREAM_JSON="true"
        return 0
    fi

    # For other CLIs, try to detect support via --help output
    # Use explicit file descriptor to avoid issues in background processes
    local help_output
    help_output=$("$cli_cmd" --help 2>&1) || true

    if echo "$help_output" | grep -q "stream-json"; then
        USE_STREAM_JSON="true"
    fi
}
