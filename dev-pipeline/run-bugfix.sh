#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run-bugfix.sh - Autonomous Bug Fix Pipeline Runner
#
# Drives the prizm-dev-team through iterative AI CLI sessions to
# fix bugs from a bug-fix-list.json specification.
#
# Usage:
#   ./run-bugfix.sh run [bug-fix-list.json]          Run all bugs
#   ./run-bugfix.sh run <bug-id> [options]            Run a single bug
#   ./run-bugfix.sh status [bug-fix-list.json]        Show pipeline status
#   ./run-bugfix.sh reset                             Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per bug (default: 3)
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (auto-detected: cbc or claude)
#   CODEBUDDY_CLI         Legacy alias for AI_CLI (deprecated, use AI_CLI instead)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)
#   LOG_CLEANUP_ENABLED   Run periodic log cleanup (default: 1)
#   LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)
#   LOG_MAX_TOTAL_MB      Keep total logs under N MB via oldest-first cleanup (default: 1024)
#   DEV_BRANCH            Custom dev branch name (default: auto-generated bugfix/pipeline-{run_id})
#   AUTO_PUSH             Auto-push to remote after successful bug fix (default: 0). Set to 1 to enable.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/bugfix-state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Configuration
MAX_RETRIES=${MAX_RETRIES:-3}
SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_STALE_THRESHOLD=${HEARTBEAT_STALE_THRESHOLD:-600}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}
LOG_CLEANUP_ENABLED=${LOG_CLEANUP_ENABLED:-1}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-14}
LOG_MAX_TOTAL_MB=${LOG_MAX_TOTAL_MB:-1024}
VERBOSE=${VERBOSE:-0}
DEV_BRANCH=${DEV_BRANCH:-""}
AUTO_PUSH=${AUTO_PUSH:-0}

# Source shared common helpers (CLI/platform detection + logs + deps)
source "$SCRIPT_DIR/lib/common.sh"
prizm_detect_cli_and_platform

# Source shared heartbeat library
source "$SCRIPT_DIR/lib/heartbeat.sh"

# Source shared branch library
source "$SCRIPT_DIR/lib/branch.sh"

# Detect stream-json support
detect_stream_json_support "$CLI_CMD"

# Bug list path (set in main, used by cleanup trap)
BUG_LIST=""

# Branch tracking (for cleanup on interrupt)
_ORIGINAL_BRANCH=""
_DEV_BRANCH_NAME=""

# ============================================================
# Shared: Spawn AI CLI session and wait for result
# ============================================================

spawn_and_wait_session() {
    local bug_id="$1"
    local bug_list="$2"
    local session_id="$3"
    local bootstrap_prompt="$4"
    local session_dir="$5"
    local max_retries="$6"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

    local verbose_flag=""
    if [[ "$VERBOSE" == "1" ]]; then
        verbose_flag="--verbose"
    fi

    local stream_json_flag=""
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        stream_json_flag="--output-format stream-json"
        # claude-internal requires --verbose when using stream-json with -p/--print
        verbose_flag="--verbose"
    fi

    local model_flag=""
    if [[ -n "${MODEL:-}" ]]; then
        model_flag="--model $MODEL"
    fi

    # Unset CLAUDECODE to prevent "nested session" error when launched from
    # within an existing Claude Code session (e.g. via launch-bugfix-daemon.sh).
    unset CLAUDECODE 2>/dev/null || true

    case "$CLI_CMD" in
        *claude*)
            # Claude Code: prompt via -p, --dangerously-skip-permissions for auto-accept
            "$CLI_CMD" \
                -p "$(cat "$bootstrap_prompt")" \
                --dangerously-skip-permissions \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                > "$session_log" 2>&1 &
            ;;
        *)
            # CodeBuddy (cbc) and others: prompt via stdin, -y for auto-accept
            "$CLI_CMD" \
                --print \
                -y \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                < "$bootstrap_prompt" \
                > "$session_log" 2>&1 &
            ;;
    esac
    local cli_pid=$!

    # Start progress parser (no-op if stream-json not supported)
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$cli_pid" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor
    start_heartbeat "$cli_pid" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL"
    local heartbeat_pid="${_HEARTBEAT_PID:-}"

    # Wait for AI CLI to finish
    local exit_code=0
    if wait "$cli_pid" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi

    # Cleanup
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "$heartbeat_pid"
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    [[ $exit_code -eq 143 ]] && exit_code=124

    # Session summary
    if [[ -f "$session_log" ]]; then
        local final_size=$(wc -c < "$session_log" 2>/dev/null | tr -d ' ')
        local final_lines=$(wc -l < "$session_log" 2>/dev/null | tr -d ' ')
        log_info "Session log: $final_lines lines, $((final_size / 1024))KB"
    fi

    # Check session outcome
    local session_status_file="$session_dir/session-status.json"
    local session_status

    if [[ $exit_code -eq 124 ]]; then
        log_warn "Session timed out after ${SESSION_TIMEOUT}s"
        session_status="timed_out"
    elif [[ -f "$session_status_file" ]]; then
        session_status=$(python3 "$SCRIPTS_DIR/check-session-status.py" \
            --status-file "$session_status_file" 2>/dev/null) || session_status="crashed"
    else
        log_warn "Session ended without status file — treating as crashed"
        session_status="crashed"
    fi

    if [[ "$session_status" == "success" ]]; then
        local project_root
        project_root="$(cd "$SCRIPT_DIR/.." && pwd)"
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            # Auto-commit any remaining dirty files produced during the session
            local dirty_files=""
            dirty_files=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
            if [[ -n "$dirty_files" ]]; then
                log_info "Auto-committing remaining session artifacts..."
                git -C "$project_root" add -A 2>/dev/null || true
                git -C "$project_root" commit -m "chore($bug_id): include remaining session artifacts" 2>/dev/null || true
            fi

            # Re-check: if still dirty after auto-commit, flag as failed
            dirty_files=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
            if [[ -n "$dirty_files" ]]; then
                log_error "Session reported success but git working tree is not clean."
                echo "$dirty_files" | sed 's/^/  - /'
                session_status="failed"
            fi
        fi
    fi

    log_info "Session result: $session_status"

    # Update bug status
    python3 "$SCRIPTS_DIR/update-bug-status.py" \
        --bug-list "$bug_list" \
        --state-dir "$STATE_DIR" \
        --bug-id "$bug_id" \
        --session-status "$session_status" \
        --session-id "$session_id" \
        --max-retries "$max_retries" \
        --action update >/dev/null 2>&1 || true

    _SPAWN_RESULT="$session_status"
}

# ============================================================
# Graceful Shutdown
# ============================================================

cleanup() {
    echo ""
    log_warn "Received interrupt signal. Saving state..."

    # Kill all child processes (claude-internal, heartbeat, progress parser, etc.)
    kill 0 2>/dev/null || true

    # Log current branch info for recovery
    if [[ -n "$_DEV_BRANCH_NAME" ]]; then
        log_info "Development was on branch: $_DEV_BRANCH_NAME"
        log_info "Original branch was: $_ORIGINAL_BRANCH"
    fi

    if [[ -n "$BUG_LIST" && -f "$BUG_LIST" ]]; then
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$BUG_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    log_info "Bug fix pipeline paused. Run './run-bugfix.sh run' to resume."
    exit 130
}
trap cleanup SIGINT SIGTERM

# ============================================================
# Dependency Check
# ============================================================

check_dependencies() {
    prizm_check_common_dependencies "$CLI_CMD"
}

run_log_cleanup() {
    if [[ "$LOG_CLEANUP_ENABLED" != "1" ]]; then
        return 0
    fi

    local cleanup_result
    cleanup_result=$(python3 "$SCRIPTS_DIR/cleanup-logs.py" \
        --state-dir "$STATE_DIR" \
        --retention-days "$LOG_RETENTION_DAYS" \
        --max-total-mb "$LOG_MAX_TOTAL_MB" 2>/dev/null) || {
        log_warn "Log cleanup failed (continuing)"
        return 0
    }

    local deleted reclaimed_kb
    deleted=$(echo "$cleanup_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deleted_files', 0))" 2>/dev/null || echo "0")
    reclaimed_kb=$(echo "$cleanup_result" | python3 -c "import sys,json; print(int(json.load(sys.stdin).get('reclaimed_bytes', 0)/1024))" 2>/dev/null || echo "0")

    if [[ "$deleted" -gt 0 ]]; then
        log_info "Log cleanup: deleted $deleted files, reclaimed ${reclaimed_kb}KB"
    fi
}

# ============================================================
# run-one: Run a single bug fix
# ============================================================

run_one() {
    local bug_id=""
    local bug_list=""
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) dry_run=true; shift ;;
            --timeout) shift; SESSION_TIMEOUT="${1:-0}"; shift ;;
            B-*|b-*) bug_id="$1"; shift ;;
            *) bug_list="$1"; shift ;;
        esac
    done

    if [[ -z "$bug_id" ]]; then
        log_error "Bug ID is required (e.g. B-001)"
        echo ""
        show_help
        exit 1
    fi

    if [[ -z "$bug_list" ]]; then
        bug_list="bug-fix-list.json"
    fi
    if [[ ! "$bug_list" = /* ]]; then
        bug_list="$(pwd)/$bug_list"
    fi
    BUG_LIST="$bug_list"

    if [[ ! -f "$bug_list" ]]; then
        log_error "Bug fix list not found: $bug_list"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing bugfix pipeline state..."
        python3 "$SCRIPTS_DIR/init-bugfix-pipeline.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" >/dev/null 2>&1 || {
            log_error "Failed to initialize bugfix pipeline state"
            exit 1
        }
    fi

    # Verify bug exists
    local bug_title
    bug_title=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == sys.argv[2]:
        print(bug.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$bug_list" "$bug_id" 2>/dev/null) || {
        log_error "Bug $bug_id not found in $bug_list"
        exit 1
    }

    local bug_severity
    bug_severity=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == sys.argv[2]:
        print(bug.get('severity', 'medium'))
        sys.exit(0)
sys.exit(1)
" "$bug_list" "$bug_id" 2>/dev/null) || bug_severity="medium"

    # Reset bug status
    python3 "$SCRIPTS_DIR/update-bug-status.py" \
        --bug-list "$bug_list" \
        --state-dir "$STATE_DIR" \
        --bug-id "$bug_id" \
        --action reset >/dev/null 2>&1 || true

    # Generate bootstrap prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${bug_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/bugs/$bug_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    log_info "Generating bugfix bootstrap prompt..."
    python3 "$SCRIPTS_DIR/generate-bugfix-prompt.py" \
        --bug-list "$bug_list" \
        --bug-id "$bug_id" \
        --session-id "$session_id" \
        --run-id "$run_id" \
        --retry-count 0 \
        --resume-phase "null" \
        --state-dir "$STATE_DIR" \
        --output "$bootstrap_prompt" >/dev/null 2>&1

    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $bug_id — $bug_title${NC}"
        echo -e "${BOLD}  Severity: $bug_severity${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Bootstrap prompt written to:"
        echo "  $bootstrap_prompt"
        echo ""
        log_success "Dry run complete. Inspect full prompt with:"
        echo "  cat $bootstrap_prompt"
        return 0
    fi

    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Bug Fix: $bug_id — $bug_title${NC}"
    echo -e "${BOLD}  Severity: $bug_severity${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Session ID: $session_id"
    log_info "Prompt: $bootstrap_prompt"
    log_info "Log: $session_dir/logs/session.log"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    cleanup_single_bug() {
        echo ""
        log_warn "Interrupted. Killing session..."
        kill 0 2>/dev/null || true
        # Log current branch info
        if [[ -n "$_DEV_BRANCH_NAME" ]]; then
            log_info "Development was on branch: $_DEV_BRANCH_NAME"
        fi
        log_info "Session log: $session_dir/logs/session.log"
        exit 130
    }
    trap cleanup_single_bug SIGINT SIGTERM

    _SPAWN_RESULT=""

    # Branch lifecycle: create and checkout bugfix branch
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    local _branch_name="${DEV_BRANCH:-bugfix/${bug_id}-$(date +%s)}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
    else
        log_warn "Failed to create branch; running session on current branch"
    fi

    spawn_and_wait_session \
        "$bug_id" "$bug_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999
    local session_status="$_SPAWN_RESULT"

    # Merge dev branch back to original on success
    if [[ "$session_status" == "success" && -n "$_DEV_BRANCH_NAME" ]]; then
        if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
            _DEV_BRANCH_NAME=""
        else
            log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
        fi
    fi

    echo ""
    if [[ "$session_status" == "success" ]]; then
        log_success "════════════════════════════════════════════════════"
        log_success "  $bug_id fixed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $bug_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all bugs
# ============================================================

main() {
    local bug_list="${1:-bug-fix-list.json}"

    if [[ ! "$bug_list" = /* ]]; then
        bug_list="$(pwd)/$bug_list"
    fi
    BUG_LIST="$bug_list"

    if [[ ! -f "$bug_list" ]]; then
        log_error "Bug fix list not found: $bug_list"
        log_info "Create a bug fix list first using the bug-planner skill,"
        log_info "or provide a path: ./run-bugfix.sh run <path-to-bug-fix-list.json>"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing bugfix pipeline state..."
        local init_result
        init_result=$(python3 "$SCRIPTS_DIR/init-bugfix-pipeline.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" 2>&1)

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Bugfix pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local bugs_count
        bugs_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bugs_count', 0))" 2>/dev/null || echo "0")
        log_success "Bugfix pipeline initialized with $bugs_count bugs"
    else
        log_info "Resuming existing bugfix pipeline..."
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}        Bug-Fix Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Bug fix list: $bug_list"
    log_info "Max retries per bug: $MAX_RETRIES"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    if [[ -n "${MODEL:-}" ]]; then
        log_info "Default Model: $MODEL"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Branch lifecycle: create bugfix branch for this pipeline run
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    local run_id_for_branch
    run_id_for_branch=$(jq -r '.run_id' "$STATE_DIR/pipeline.json" 2>/dev/null || echo "$$")
    local _branch_name="${DEV_BRANCH:-bugfix/pipeline-${run_id_for_branch}}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
        log_info "Dev branch: $_branch_name"
    else
        log_warn "Failed to create bugfix branch; running on current branch: $_source_branch"
    fi

    local session_count=0

    while true; do
        # Find next bug to process
        local next_bug
        next_bug=$(python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "$bug_list" \
            --state-dir "$STATE_DIR" \
            --max-retries "$MAX_RETRIES" \
            --action get_next 2>/dev/null) || true

        if [[ "$next_bug" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  All bugs processed! Bug fix pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "════════════════════════════════════════════════════"
            rm -f "$STATE_DIR/current-session.json"

            # Merge dev branch back to original
            if [[ -n "$_DEV_BRANCH_NAME" ]]; then
                if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
                    _DEV_BRANCH_NAME=""
                else
                    log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
                    log_warn "Merge manually: git checkout $_ORIGINAL_BRANCH && git merge $_DEV_BRANCH_NAME"
                fi
            fi
            break
        fi

        if [[ "$next_bug" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining bugs are blocked (needs_info/failed)."
            log_warn "Run './run-bugfix.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse bug info
        local bug_id bug_title bug_severity retry_count resume_phase
        bug_id=$(echo "$next_bug" | jq -r '.bug_id')
        bug_title=$(echo "$next_bug" | jq -r '.title')
        bug_severity=$(echo "$next_bug" | jq -r '.severity')
        retry_count=$(echo "$next_bug" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_bug" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Bug: ${BOLD}$bug_id${NC} — $bug_title"
        log_info "Severity: $bug_severity | Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Generate session
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${bug_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/bugs/$bug_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"
        python3 "$SCRIPTS_DIR/generate-bugfix-prompt.py" \
            --bug-list "$bug_list" \
            --bug-id "$bug_id" \
            --session-id "$session_id" \
            --run-id "$run_id" \
            --retry-count "$retry_count" \
            --resume-phase "$resume_phase" \
            --state-dir "$STATE_DIR" \
            --output "$bootstrap_prompt" >/dev/null 2>&1

        # Track current session (atomic write via temp file)
        python3 -c "
import json, sys, os
from datetime import datetime, timezone
bug_id, session_id, state_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = {
    'bug_id': bug_id,
    'session_id': session_id,
    'started_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
target = os.path.join(state_dir, 'current-session.json')
tmp = target + '.tmp'
with open(tmp, 'w') as f:
    json.dump(data, f, indent=2)
os.replace(tmp, target)
" "$bug_id" "$session_id" "$STATE_DIR"

        # Spawn session
        log_info "Spawning AI CLI session: $session_id"
        _SPAWN_RESULT=""

        spawn_and_wait_session \
            "$bug_id" "$bug_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES"

        session_count=$((session_count + 1))

        log_info "Pausing 5s before next bug..."
        sleep 5
    done
}

# ============================================================
# Entry Point
# ============================================================

show_help() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  run [bug-fix-list.json]                 Run all bugs by severity/priority order"
    echo "  run <bug-id> [options]                   Run a single bug fix"
    echo "  status [bug-fix-list.json]               Show bug fix pipeline status"
    echo "  reset                                    Clear all bugfix state"
    echo "  help                                     Show this help message"
    echo ""
    echo "Single Bug Options (run <bug-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES           Max retries per bug (default: 3)"
    echo "  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)"
    echo "  AI_CLI                AI CLI command name (auto-detected: cbc or claude)"
    echo "  VERBOSE               Set to 1 for verbose AI CLI output"
    echo "  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)"
    echo "  LOG_CLEANUP_ENABLED   Run log cleanup before execution (default: 1)"
    echo "  LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)"
    echo "  LOG_MAX_TOTAL_MB      Keep total logs under N MB (default: 1024)"
    echo ""
    echo "Examples:"
    echo "  ./run-bugfix.sh run                                    # Run all bugs"
    echo "  ./run-bugfix.sh run bug-fix-list.json                  # Custom bug list"
    echo "  ./run-bugfix.sh run B-001 --dry-run                    # Inspect generated prompt"
    echo "  ./run-bugfix.sh run B-001 --timeout 3600               # 1h timeout"
    echo "  ./run-bugfix.sh status                                 # Show status"
    echo "  MAX_RETRIES=5 ./run-bugfix.sh run                      # Custom retries"
}

case "${1:-run}" in
    run|resume)
        shift || true
        if [[ "${1:-}" =~ ^[Bb]-[0-9]+ ]]; then
            run_one "$@"
        else
            main "${1:-bug-fix-list.json}"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No bugfix pipeline state found. Run './run-bugfix.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-bug-status.py" \
            --bug-list "${2:-bug-fix-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    reset)
        log_warn "Resetting bugfix pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "Bugfix state cleared. Run './run-bugfix.sh run' to start fresh."
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
