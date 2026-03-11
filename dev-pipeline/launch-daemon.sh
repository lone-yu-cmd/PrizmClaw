#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/launch-daemon.sh - Daemon wrapper for run.sh
#
# Manages run.sh as a background daemon process with PID tracking,
# log consolidation, and lifecycle commands.
#
# Usage:
#   ./launch-daemon.sh start [feature-list.json] [--env "KEY=VAL ..."]
#   ./launch-daemon.sh stop
#   ./launch-daemon.sh status
#   ./launch-daemon.sh logs [--lines N] [--follow]
#   ./launch-daemon.sh restart [feature-list.json] [--env "KEY=VAL ..."]
#
# NOTE:
#   In AI skill sessions, always use this daemon wrapper.
#   Do NOT call `run.sh run ...` directly, because foreground sessions may be killed by CLI timeout.
#
# Files managed:
#   state/.pipeline.pid          - PID of the background run.sh process
#   state/pipeline-daemon.log    - Consolidated stdout+stderr from run.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
PID_FILE="$STATE_DIR/.pipeline.pid"
LOG_FILE="$STATE_DIR/pipeline-daemon.log"
RUN_SCRIPT="$SCRIPT_DIR/run.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $*" >&2; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $*" >&2; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*" >&2; }
log_success() { echo -e "${GREEN}[OK]${NC}      $*" >&2; }

# ============================================================
# Helpers
# ============================================================

# Check if pipeline process is alive
# Returns 0 if alive, 1 if dead/no PID file
is_running() {
    if [[ ! -f "$PID_FILE" ]]; then
        return 1
    fi
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null) || return 1
    if [[ -z "$pid" ]]; then
        return 1
    fi
    if kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get PID from file (or empty string)
get_pid() {
    if [[ -f "$PID_FILE" ]]; then
        cat "$PID_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Clean stale PID file
clean_stale_pid() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(get_pid)
        if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$PID_FILE"
            log_warn "Cleaned stale PID file (process $pid no longer running)"
        fi
    fi
}

# ============================================================
# start: Launch run.sh in background
# ============================================================

cmd_start() {
    local feature_list=""
    local env_overrides=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --env)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--env requires a value (e.g. --env \"MAX_RETRIES=5 SESSION_TIMEOUT=3600\")"
                    exit 1
                fi
                env_overrides="$1"
                shift
                ;;
            *)
                feature_list="$1"
                shift
                ;;
        esac
    done

    # Default feature list
    if [[ -z "$feature_list" ]]; then
        feature_list="feature-list.json"
    fi

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(cd "$(dirname "$feature_list")" 2>/dev/null && pwd)/$(basename "$feature_list")"
    fi

    # Validate feature list
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        log_error "Run the app-planner skill first to generate feature-list.json"
        exit 2
    fi

    # Validate run.sh exists
    if [[ ! -x "$RUN_SCRIPT" ]]; then
        log_error "run.sh not found or not executable: $RUN_SCRIPT"
        exit 2
    fi

    # Clean stale PID if needed
    clean_stale_pid

    # Check if already running
    if is_running; then
        local pid
        pid=$(get_pid)
        log_error "Pipeline is already running (PID: $pid)"
        log_error "Use './launch-daemon.sh stop' first, or './launch-daemon.sh restart'"
        exit 1
    fi

    # Ensure state directory exists
    mkdir -p "$STATE_DIR"

    # Build environment prefix
    local env_cmd=""
    if [[ -n "$env_overrides" ]]; then
        env_cmd="env $env_overrides"
    fi

    # Record start time
    local start_time
    start_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Launch run.sh in background, fully detached
    log_info "Launching pipeline..."
    log_info "Feature list: $feature_list"
    log_info "Log file: $LOG_FILE"
    if [[ -n "$env_overrides" ]]; then
        log_info "Environment overrides: $env_overrides"
    fi

    # Write a separator to the log file
    {
        echo ""
        echo "================================================================"
        echo "  Pipeline Daemon Started: $start_time"
        echo "  Feature list: $feature_list"
        if [[ -n "$env_overrides" ]]; then
            echo "  Environment: $env_overrides"
        fi
        echo "================================================================"
        echo ""
    } >> "$LOG_FILE"

    # Launch with nohup + disown for full detachment
    if [[ -n "$env_cmd" ]]; then
        nohup $env_cmd "$RUN_SCRIPT" run "$feature_list" >> "$LOG_FILE" 2>&1 &
    else
        nohup "$RUN_SCRIPT" run "$feature_list" >> "$LOG_FILE" 2>&1 &
    fi
    local pipeline_pid=$!
    disown "$pipeline_pid" 2>/dev/null || true

    # Write PID file
    echo "$pipeline_pid" > "$PID_FILE"

    # Write start metadata
    python3 -c "
import json, sys, os
pid, started_at, feature_list, env_overrides, log_file, state_dir = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
data = {
    'pid': pid,
    'started_at': started_at,
    'feature_list': feature_list,
    'env_overrides': env_overrides,
    'log_file': log_file
}
with open(os.path.join(state_dir, '.pipeline-meta.json'), 'w') as f:
    json.dump(data, f, indent=2)
" "$pipeline_pid" "$start_time" "$feature_list" "$env_overrides" "$LOG_FILE" "$STATE_DIR" 2>/dev/null || true

    # Wait briefly and verify
    sleep 2
    if is_running; then
        log_success "Pipeline started successfully (PID: $pipeline_pid)"
        log_info "Monitor logs: ./launch-daemon.sh logs --follow"
        log_info "Check status: ./launch-daemon.sh status"

        # Output JSON on stdout for programmatic consumption
        echo "{\"success\": true, \"pid\": $pipeline_pid, \"log_file\": \"$LOG_FILE\", \"started_at\": \"$start_time\"}"
    else
        log_error "Pipeline process died immediately after launch"
        log_error "Check log for errors: tail -20 $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# ============================================================
# stop: Gracefully stop the pipeline
# ============================================================

cmd_stop() {
    if [[ ! -f "$PID_FILE" ]]; then
        log_info "Pipeline is not running (no PID file)"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    local pid
    pid=$(get_pid)

    if [[ -z "$pid" ]]; then
        log_info "Pipeline is not running (empty PID file)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        log_info "Pipeline is not running (process $pid already exited)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "already exited"}'
        return 0
    fi

    log_info "Stopping pipeline (PID: $pid)..."

    # Send SIGTERM for graceful shutdown (triggers run.sh cleanup trap)
    kill -TERM "$pid" 2>/dev/null || true

    # Wait up to 30 seconds for graceful exit
    local waited=0
    while [[ $waited -lt 30 ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Force kill if still alive
    if kill -0 "$pid" 2>/dev/null; then
        log_warn "Process did not exit after 30s, sending SIGKILL..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"

    if ! kill -0 "$pid" 2>/dev/null; then
        log_success "Pipeline stopped"
        echo "{\"success\": true, \"pid\": $pid, \"message\": \"stopped\"}"
    else
        log_error "Failed to stop pipeline (PID: $pid)"
        echo "{\"success\": false, \"pid\": $pid, \"message\": \"failed to stop\"}"
        exit 1
    fi
}

# ============================================================
# status: Check pipeline status
# ============================================================

cmd_status() {
    clean_stale_pid

    if ! is_running; then
        log_info "Pipeline is not running"

        # Check if log file exists for last run info
        if [[ -f "$LOG_FILE" ]]; then
            local log_size
            log_size=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
            log_info "Last log: $LOG_FILE ($((log_size / 1024))KB)"
        fi

        # Show feature-level progress from last run if metadata exists
        if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
            local last_feature_list
            last_feature_list=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    print(json.load(f).get('feature_list', ''))
" "$STATE_DIR/.pipeline-meta.json" 2>/dev/null || echo "")

            if [[ -n "$last_feature_list" && -f "$last_feature_list" ]]; then
                echo "" >&2
                log_info "Last run feature progress:"
                python3 "$SCRIPT_DIR/scripts/update-feature-status.py" \
                    --feature-list "$last_feature_list" \
                    --state-dir "$STATE_DIR" \
                    --action status >&2 2>/dev/null || true
                echo "" >&2
            fi
        fi

        echo '{"running": false}'
        return 1
    fi

    local pid
    pid=$(get_pid)

    # Gather metadata
    local log_size_kb=0
    if [[ -f "$LOG_FILE" ]]; then
        local log_size
        log_size=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
        log_size_kb=$((log_size / 1024))
    fi

    local started_at=""
    local feature_list_path=""
    if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
        started_at=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    print(json.load(f).get('started_at', ''))
" "$STATE_DIR/.pipeline-meta.json" 2>/dev/null || echo "")
        feature_list_path=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    print(json.load(f).get('feature_list', ''))
" "$STATE_DIR/.pipeline-meta.json" 2>/dev/null || echo "")
    fi

    log_success "Pipeline is running (PID: $pid)"
    if [[ -n "$started_at" ]]; then
        log_info "Started at: $started_at"
    fi
    if [[ -n "$feature_list_path" ]]; then
        log_info "Feature list: $feature_list_path"
    fi
    log_info "Log file: $LOG_FILE (${log_size_kb}KB)"

    # Show feature-level progress if feature list is available
    if [[ -n "$feature_list_path" && -f "$feature_list_path" ]]; then
        echo "" >&2
        python3 "$SCRIPT_DIR/scripts/update-feature-status.py" \
            --feature-list "$feature_list_path" \
            --state-dir "$STATE_DIR" \
            --action status >&2 2>/dev/null || true
        echo "" >&2
    fi

    # Show last few log lines
    if [[ -f "$LOG_FILE" ]]; then
        log_info "--- Last 5 log lines ---"
        tail -5 "$LOG_FILE" >&2 || true
        echo "" >&2
    fi

    # JSON output on stdout (enhanced with progress info)
    local progress_json=""
    if [[ -n "$feature_list_path" && -f "$feature_list_path" ]]; then
        progress_json=$(python3 -c "
import json, sys, os

def load_json(p):
    with open(p, 'r') as f:
        return json.load(f)

feature_list_path, state_dir = sys.argv[1], sys.argv[2]
fl = load_json(feature_list_path)
features = fl.get('features', [])
total = len(features)
counts = {'completed': 0, 'in_progress': 0, 'failed': 0, 'pending': 0, 'skipped': 0}
for feat in features:
    fid = feat.get('id', '')
    sp = os.path.join(state_dir, 'features', fid, 'status.json')
    if os.path.isfile(sp):
        fs = load_json(sp)
        st = fs.get('status', 'pending')
    else:
        st = 'pending'
    if st in counts:
        counts[st] += 1
    else:
        counts['pending'] += 1

pct = round(counts['completed'] / total * 100, 1) if total > 0 else 0
print(json.dumps({
    'total': total,
    'completed': counts['completed'],
    'in_progress': counts['in_progress'],
    'failed': counts['failed'],
    'pending': counts['pending'],
    'percent': pct
}))
" "$feature_list_path" "$STATE_DIR" 2>/dev/null || echo "")
    fi

    if [[ -n "$progress_json" ]]; then
        # Merge progress into the main JSON output
        cat <<EOF
{"running": true, "pid": $pid, "log_file": "$LOG_FILE", "log_size_kb": $log_size_kb, "started_at": "$started_at", "feature_list": "$feature_list_path", "progress": $progress_json}
EOF
    else
        cat <<EOF
{"running": true, "pid": $pid, "log_file": "$LOG_FILE", "log_size_kb": $log_size_kb, "started_at": "$started_at", "feature_list": "$feature_list_path"}
EOF
    fi
}

# ============================================================
# logs: View or follow pipeline logs
# ============================================================

cmd_logs() {
    local lines=50
    local follow=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines|-n)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--lines requires a number"
                    exit 1
                fi
                lines="$1"
                shift
                ;;
            --follow|-f)
                follow=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    if [[ ! -f "$LOG_FILE" ]]; then
        log_info "No log file found at $LOG_FILE"
        log_info "Pipeline has not been started yet"
        exit 0
    fi

    if [[ "$follow" == true ]]; then
        log_info "Following $LOG_FILE (Ctrl+C to stop)..."
        echo "" >&2
        tail -f "$LOG_FILE"
    else
        tail -"$lines" "$LOG_FILE"
    fi
}

# ============================================================
# restart: Stop + Start
# ============================================================

cmd_restart() {
    cmd_stop 2>/dev/null || true
    sleep 1
    cmd_start "$@"
}

# ============================================================
# Entry point
# ============================================================

show_help() {
    cat <<'HELP'
Usage: launch-daemon.sh <command> [options]

Commands:
  start [feature-list.json] [--env "K=V ..."]   Start pipeline in background
  stop                                            Gracefully stop pipeline
  status                                          Check if pipeline is running
  logs [--lines N] [--follow]                     View pipeline logs
  restart [feature-list.json] [--env "K=V ..."]  Stop + start pipeline
  help                                            Show this help

Examples:
  ./launch-daemon.sh start                        # Start with default feature-list.json
  ./launch-daemon.sh start my-features.json       # Start with custom feature list
  ./launch-daemon.sh start --env "MAX_RETRIES=5 SESSION_TIMEOUT=7200"
  ./launch-daemon.sh status                       # Check if running (JSON on stdout)
  ./launch-daemon.sh logs --follow                # Live log tailing
  ./launch-daemon.sh logs --lines 100             # Last 100 lines
  ./launch-daemon.sh stop                         # Graceful shutdown
  ./launch-daemon.sh restart                      # Stop + start

Environment Variables (pass via --env):
  MAX_RETRIES           Max retries per feature (default: 3)
  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
  VERBOSE               Set to 1 for verbose AI CLI output
  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
HELP
}

case "${1:-help}" in
    start)
        shift
        cmd_start "$@"
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    logs|log)
        shift
        cmd_logs "$@"
        ;;
    restart)
        shift
        cmd_restart "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        echo "" >&2
        show_help
        exit 1
        ;;
esac
