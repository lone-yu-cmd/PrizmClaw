#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/launch-bugfix-daemon.sh - Daemon wrapper for run-bugfix.sh
#
# Manages run-bugfix.sh as a background daemon process with PID tracking,
# log consolidation, and lifecycle commands.
#
# Usage:
#   ./launch-bugfix-daemon.sh start [bug-fix-list.json] [--env "KEY=VAL ..."]
#   ./launch-bugfix-daemon.sh stop
#   ./launch-bugfix-daemon.sh status
#   ./launch-bugfix-daemon.sh logs [--lines N] [--follow]
#   ./launch-bugfix-daemon.sh restart [bug-fix-list.json] [--env "KEY=VAL ..."]
#
# Files managed:
#   bugfix-state/.pipeline.pid          - PID of the background run-bugfix.sh process
#   bugfix-state/pipeline-daemon.log    - Consolidated stdout+stderr
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/bugfix-state"
PID_FILE="$STATE_DIR/.pipeline.pid"
LOG_FILE="$STATE_DIR/pipeline-daemon.log"
RUN_SCRIPT="$SCRIPT_DIR/run-bugfix.sh"

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

get_pid() {
    if [[ -f "$PID_FILE" ]]; then
        cat "$PID_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

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
# start
# ============================================================

cmd_start() {
    local bug_list=""
    local env_overrides=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --env) shift; env_overrides="${1:-}"; shift ;;
            *) bug_list="$1"; shift ;;
        esac
    done

    if [[ -z "$bug_list" ]]; then
        bug_list="bug-fix-list.json"
    fi
    if [[ ! "$bug_list" = /* ]]; then
        bug_list="$(cd "$(dirname "$bug_list")" 2>/dev/null && pwd)/$(basename "$bug_list")"
    fi

    if [[ ! -f "$bug_list" ]]; then
        log_error "Bug fix list not found: $bug_list"
        log_error "Run the bug-planner skill first to generate bug-fix-list.json"
        exit 2
    fi

    if [[ ! -x "$RUN_SCRIPT" ]]; then
        log_error "run-bugfix.sh not found or not executable: $RUN_SCRIPT"
        exit 2
    fi

    clean_stale_pid

    if is_running; then
        local pid
        pid=$(get_pid)
        log_error "Bugfix pipeline is already running (PID: $pid)"
        log_error "Use './launch-bugfix-daemon.sh stop' first, or './launch-bugfix-daemon.sh restart'"
        exit 1
    fi

    mkdir -p "$STATE_DIR"

    local env_cmd=""
    if [[ -n "$env_overrides" ]]; then
        env_cmd="env $env_overrides"
    fi

    local start_time
    start_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    log_info "Launching bugfix pipeline..."
    log_info "Bug fix list: $bug_list"
    log_info "Log file: $LOG_FILE"

    {
        echo ""
        echo "================================================================"
        echo "  Bugfix Pipeline Daemon Started: $start_time"
        echo "  Bug fix list: $bug_list"
        if [[ -n "$env_overrides" ]]; then
            echo "  Environment: $env_overrides"
        fi
        echo "================================================================"
        echo ""
    } >> "$LOG_FILE"

    if [[ -n "$env_cmd" ]]; then
        nohup $env_cmd "$RUN_SCRIPT" run "$bug_list" >> "$LOG_FILE" 2>&1 &
    else
        nohup "$RUN_SCRIPT" run "$bug_list" >> "$LOG_FILE" 2>&1 &
    fi
    local pipeline_pid=$!
    disown "$pipeline_pid" 2>/dev/null || true

    echo "$pipeline_pid" > "$PID_FILE"

    python3 -c "
import json
from datetime import datetime
data = {
    'pid': $pipeline_pid,
    'pipeline_type': 'bugfix',
    'started_at': '$start_time',
    'bug_list': '$bug_list',
    'env_overrides': '$env_overrides',
    'log_file': '$LOG_FILE'
}
with open('$STATE_DIR/.pipeline-meta.json', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null || true

    sleep 2
    if is_running; then
        log_success "Bugfix pipeline started successfully (PID: $pipeline_pid)"
        log_info "Monitor logs: ./launch-bugfix-daemon.sh logs --follow"
        log_info "Check status: ./launch-bugfix-daemon.sh status"
        echo "{\"success\": true, \"pid\": $pipeline_pid, \"log_file\": \"$LOG_FILE\", \"started_at\": \"$start_time\"}"
    else
        log_error "Bugfix pipeline process died immediately after launch"
        log_error "Check log for errors: tail -20 $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# ============================================================
# stop
# ============================================================

cmd_stop() {
    if [[ ! -f "$PID_FILE" ]]; then
        log_info "Bugfix pipeline is not running (no PID file)"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    local pid
    pid=$(get_pid)

    if [[ -z "$pid" ]]; then
        log_info "Bugfix pipeline is not running (empty PID file)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "not running"}'
        return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        log_info "Bugfix pipeline is not running (process $pid already exited)"
        rm -f "$PID_FILE"
        echo '{"success": true, "message": "already exited"}'
        return 0
    fi

    log_info "Stopping bugfix pipeline (PID: $pid)..."
    kill -TERM "$pid" 2>/dev/null || true

    local waited=0
    while [[ $waited -lt 30 ]]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
        waited=$((waited + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        log_warn "Process did not exit after 30s, sending SIGKILL..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi

    rm -f "$PID_FILE"

    if ! kill -0 "$pid" 2>/dev/null; then
        log_success "Bugfix pipeline stopped"
        echo "{\"success\": true, \"pid\": $pid, \"message\": \"stopped\"}"
    else
        log_error "Failed to stop bugfix pipeline (PID: $pid)"
        echo "{\"success\": false, \"pid\": $pid, \"message\": \"failed to stop\"}"
        exit 1
    fi
}

# ============================================================
# status
# ============================================================

cmd_status() {
    clean_stale_pid

    if ! is_running; then
        log_info "Bugfix pipeline is not running"

        if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
            local last_bug_list
            last_bug_list=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('bug_list', ''))
" 2>/dev/null || echo "")

            if [[ -n "$last_bug_list" && -f "$last_bug_list" ]]; then
                echo "" >&2
                log_info "Last run bug fix progress:"
                python3 "$SCRIPT_DIR/scripts/update-bug-status.py" \
                    --bug-list "$last_bug_list" \
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

    local started_at=""
    local bug_list_path=""
    if [[ -f "$STATE_DIR/.pipeline-meta.json" ]]; then
        started_at=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('started_at', ''))
" 2>/dev/null || echo "")
        bug_list_path=$(python3 -c "
import json
with open('$STATE_DIR/.pipeline-meta.json') as f:
    print(json.load(f).get('bug_list', ''))
" 2>/dev/null || echo "")
    fi

    log_success "Bugfix pipeline is running (PID: $pid)"
    if [[ -n "$started_at" ]]; then
        log_info "Started at: $started_at"
    fi
    log_info "Log file: $LOG_FILE"

    if [[ -n "$bug_list_path" && -f "$bug_list_path" ]]; then
        echo "" >&2
        python3 "$SCRIPT_DIR/scripts/update-bug-status.py" \
            --bug-list "$bug_list_path" \
            --state-dir "$STATE_DIR" \
            --action status >&2 2>/dev/null || true
        echo "" >&2
    fi

    if [[ -f "$LOG_FILE" ]]; then
        log_info "--- Last 5 log lines ---"
        tail -5 "$LOG_FILE" >&2 || true
        echo "" >&2
    fi

    local progress_json=""
    if [[ -n "$bug_list_path" && -f "$bug_list_path" ]]; then
        progress_json=$(python3 -c "
import json, os
bl = json.load(open('$bug_list_path'))
bugs = bl.get('bugs', [])
total = len(bugs)
counts = {'completed': 0, 'in_progress': 0, 'failed': 0, 'pending': 0, 'needs_info': 0}
for bug in bugs:
    bid = bug.get('id', '')
    sp = os.path.join('$STATE_DIR', 'bugs', bid, 'status.json')
    if os.path.isfile(sp):
        fs = json.load(open(sp))
        st = fs.get('status', 'pending')
    else:
        st = 'pending'
    if st in counts:
        counts[st] += 1
    else:
        counts['pending'] += 1
pct = round(counts['completed'] / total * 100, 1) if total > 0 else 0
print(json.dumps({'total': total, 'completed': counts['completed'], 'in_progress': counts['in_progress'], 'failed': counts['failed'], 'pending': counts['pending'], 'needs_info': counts['needs_info'], 'percent': pct}))
" 2>/dev/null || echo "")
    fi

    if [[ -n "$progress_json" ]]; then
        echo "{\"running\": true, \"pid\": $pid, \"pipeline_type\": \"bugfix\", \"log_file\": \"$LOG_FILE\", \"started_at\": \"$started_at\", \"bug_list\": \"$bug_list_path\", \"progress\": $progress_json}"
    else
        echo "{\"running\": true, \"pid\": $pid, \"pipeline_type\": \"bugfix\", \"log_file\": \"$LOG_FILE\", \"started_at\": \"$started_at\", \"bug_list\": \"$bug_list_path\"}"
    fi
}

# ============================================================
# logs
# ============================================================

cmd_logs() {
    local lines=50
    local follow=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --lines|-n) shift; lines="${1:-50}"; shift ;;
            --follow|-f) follow=true; shift ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done

    if [[ ! -f "$LOG_FILE" ]]; then
        log_info "No log file found at $LOG_FILE"
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
# restart
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
Usage: launch-bugfix-daemon.sh <command> [options]

Commands:
  start [bug-fix-list.json] [--env "K=V ..."]   Start bugfix pipeline in background
  stop                                            Gracefully stop pipeline
  status                                          Check if pipeline is running
  logs [--lines N] [--follow]                     View pipeline logs
  restart [bug-fix-list.json] [--env "K=V ..."]  Stop + start pipeline
  help                                            Show this help

Examples:
  ./launch-bugfix-daemon.sh start                         # Start with default bug-fix-list.json
  ./launch-bugfix-daemon.sh start my-bugs.json            # Start with custom bug list
  ./launch-bugfix-daemon.sh start --env "MAX_RETRIES=5"
  ./launch-bugfix-daemon.sh status                        # Check if running (JSON on stdout)
  ./launch-bugfix-daemon.sh logs --follow                 # Live log tailing
  ./launch-bugfix-daemon.sh stop                          # Graceful shutdown
  ./launch-bugfix-daemon.sh restart                       # Stop + start
HELP
}

case "${1:-help}" in
    start) shift; cmd_start "$@" ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    logs|log) shift; cmd_logs "$@" ;;
    restart) shift; cmd_restart "$@" ;;
    help|--help|-h) show_help ;;
    *) log_error "Unknown command: $1"; echo "" >&2; show_help; exit 1 ;;
esac
