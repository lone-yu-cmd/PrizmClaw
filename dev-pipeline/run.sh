#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run.sh - Autonomous Dev Pipeline Runner
#
# Drives the prizm-dev-team multi-agent team through iterative
# AI CLI sessions (CodeBuddy or Claude Code) to build a complete app
# from a feature list.
#
# Usage:
#   ./run.sh run [feature-list.json]            Run all features
#   ./run.sh run <feature-id> [options]         Run a single feature
#   ./run.sh status [feature-list.json]         Show pipeline status
#   ./run.sh reset                              Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per feature (default: 3)
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (auto-detected: cbc or claude)
#   CODEBUDDY_CLI         Legacy alias for AI_CLI (deprecated, use AI_CLI instead)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI (shows subagent output)
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Configuration (override via environment variables)
MAX_RETRIES=${MAX_RETRIES:-3}
SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_STALE_THRESHOLD=${HEARTBEAT_STALE_THRESHOLD:-600}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}
VERBOSE=${VERBOSE:-0}

# AI CLI detection: AI_CLI > CODEBUDDY_CLI > auto-detect > error
if [[ -n "${AI_CLI:-}" ]]; then
    CLI_CMD="$AI_CLI"
elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
    CLI_CMD="$CODEBUDDY_CLI"
elif command -v cbc &>/dev/null; then
    CLI_CMD="cbc"
elif command -v claude &>/dev/null; then
    CLI_CMD="claude"
else
    echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude)." >&2
    exit 1
fi

# Platform detection
if [[ -n "${PRIZMKIT_PLATFORM:-}" ]]; then
    PLATFORM="$PRIZMKIT_PLATFORM"
elif [[ "$CLI_CMD" == *"claude"* ]]; then
    PLATFORM="claude"
else
    PLATFORM="codebuddy"
fi

export PRIZMKIT_PLATFORM="$PLATFORM"

# Source shared heartbeat library
source "$SCRIPT_DIR/lib/heartbeat.sh"

# Detect stream-json support
detect_stream_json_support "$CLI_CMD"

# Feature list path (set in main, used by cleanup trap)
FEATURE_LIST=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# ============================================================
# Shared: Spawn an AI CLI session and wait for result
# ============================================================

# Spawns an AI CLI session with heartbeat + timeout, waits for completion,
# checks session status, and updates feature status.
#
# Arguments:
#   $1 - feature_id
#   $2 - feature_list (absolute path)
#   $3 - session_id
#   $4 - bootstrap_prompt (path)
#   $5 - session_dir
#   $6 - max_retries (for status update)
spawn_and_wait_session() {
    local feature_id="$1"
    local feature_list="$2"
    local session_id="$3"
    local bootstrap_prompt="$4"
    local session_dir="$5"
    local max_retries="$6"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

    # Spawn AI CLI session
    local verbose_flag=""
    if [[ "$VERBOSE" == "1" ]]; then
        verbose_flag="--verbose"
    fi

    local stream_json_flag=""
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        stream_json_flag="--output-format stream-json"
    fi

    case "$CLI_CMD" in
        *claude*)
            # Claude Code: prompt via -p argument, --yes for auto-accept
            "$CLI_CMD" \
                --print \
                -p "$(cat "$bootstrap_prompt")" \
                --yes \
                $verbose_flag \
                $stream_json_flag \
                > "$session_log" 2>&1 &
            ;;
        *)
            # CodeBuddy (cbc) and others: prompt via stdin
            "$CLI_CMD" \
                --print \
                -y \
                $verbose_flag \
                $stream_json_flag \
                < "$bootstrap_prompt" \
                > "$session_log" 2>&1 &
            ;;
    esac
    local cbc_pid=$!

    # Start progress parser (no-op if stream-json not supported)
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog (only if SESSION_TIMEOUT > 0)
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$cbc_pid" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor (reads progress.json when available, falls back to tail)
    start_heartbeat "$cbc_pid" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL"
    local heartbeat_pid="${_HEARTBEAT_PID:-}"

    # Wait for AI CLI to finish
    local exit_code=0
    if wait "$cbc_pid" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi

    # Clean up watcher, heartbeat, and parser
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "$heartbeat_pid"
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    # Map SIGTERM (143) to timeout code 124
    if [[ $exit_code -eq 143 ]]; then
        exit_code=124
    fi

    # Show final session summary
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

    log_info "Session result: $session_status"

    # Update feature status
    python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$feature_list" \
        --state-dir "$STATE_DIR" \
        --feature-id "$feature_id" \
        --session-status "$session_status" \
        --session-id "$session_id" \
        --max-retries "$max_retries" \
        --action update >/dev/null 2>&1 || true

    # Return status via global variable (avoids $() swallowing stdout)
    _SPAWN_RESULT="$session_status"
}

# ============================================================
# Graceful Shutdown
# ============================================================

cleanup() {
    echo ""
    log_warn "Received interrupt signal. Saving state..."

    if [[ -n "$FEATURE_LIST" && -f "$FEATURE_LIST" ]]; then
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$FEATURE_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    log_info "Pipeline paused. Run './run.sh run' to resume."
    exit 130
}
trap cleanup SIGINT SIGTERM

# ============================================================
# Dependency Check
# ============================================================

check_dependencies() {
    # Check for jq
    if ! command -v jq &>/dev/null; then
        log_error "jq is required but not installed. Install with: brew install jq"
        exit 1
    fi

    # Check for python3
    if ! command -v python3 &>/dev/null; then
        log_error "python3 is required but not installed."
        exit 1
    fi

    # Check for AI CLI
    if ! command -v "$CLI_CMD" &>/dev/null; then
        log_warn "AI CLI '$CLI_CMD' not found in PATH."
        log_warn "Set AI_CLI environment variable to the correct command."
        log_warn "Continuing anyway (will fail when spawning sessions)..."
    fi
}

# ============================================================
# run-one: Run a single feature with full control
# ============================================================

run_one() {
    local feature_id=""
    local feature_list=""
    local dry_run=false
    local resume_phase=""
    local mode_override=""
    local do_clean=false
    local no_reset=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
                shift
                ;;
            --resume-phase)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--resume-phase requires a value"
                    exit 1
                fi
                resume_phase="$1"
                shift
                ;;
            --mode)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--mode requires a value (lite|standard|full)"
                    exit 1
                fi
                case "$1" in
                    lite|standard|full)
                        mode_override="$1"
                        ;;
                    *)
                        log_error "Invalid mode: $1 (must be lite, standard, or full)"
                        exit 1
                        ;;
                esac
                shift
                ;;
            --clean)
                do_clean=true
                shift
                ;;
            --no-reset)
                no_reset=true
                shift
                ;;
            --timeout)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--timeout requires a value in seconds"
                    exit 1
                fi
                SESSION_TIMEOUT="$1"
                shift
                ;;
            F-*|f-*)
                feature_id="$1"
                shift
                ;;
            *)
                feature_list="$1"
                shift
                ;;
        esac
    done

    # Validate required args
    if [[ -z "$feature_id" ]]; then
        log_error "Feature ID is required (e.g. F-007)"
        echo ""
        show_help
        exit 1
    fi

    # Default feature list
    if [[ -z "$feature_list" ]]; then
        feature_list="feature-list.json"
    fi

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Default resume phase
    if [[ -z "$resume_phase" ]]; then
        resume_phase="null"
    fi

    # Validation
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        exit 1
    fi

    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_error "No pipeline state found. Run './run.sh run' first to initialize."
        exit 1
    fi

    check_dependencies

    # Verify feature exists
    local feature_title
    feature_title=$(python3 -c "
import json, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        print(feat.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
        log_error "Feature $feature_id not found in $feature_list"
        exit 1
    }

    # Optional Clean
    if [[ "$do_clean" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_warn "Dry-run mode: --clean ignored (no artifacts will be deleted)"
        else
            log_info "Cleaning artifacts for $feature_id..."

            local feature_slug
            feature_slug=$(python3 -c "
import json, re, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        fnum = feat['id'].replace('F-', '').replace('f-', '').zfill(3)
        title = feat.get('title', '').lower()
        title = re.sub(r'[^a-z0-9\s-]', '', title)
        title = re.sub(r'[\s]+', '-', title.strip())
        title = re.sub(r'-+', '-', title).strip('-')
        print(f'{fnum}-{title}')
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
                log_warn "Could not determine feature slug for cleanup"
                feature_slug=""
            }

            local project_root
            project_root="$(cd "$SCRIPT_DIR/.." && pwd)"

            if [[ -n "$feature_slug" ]]; then
                local specs_dir="$project_root/.prizmkit/specs/$feature_slug"
                if [[ -d "$specs_dir" ]]; then
                    rm -rf "$specs_dir"
                    log_info "Removed $specs_dir"
                fi
            fi

            local dev_team_dir="$project_root/.dev-team"
            if [[ -d "$dev_team_dir" ]]; then
                rm -rf "$dev_team_dir"
                log_info "Removed $dev_team_dir"
            fi

            local feature_state_dir="$STATE_DIR/features/$feature_id"
            if [[ -d "$feature_state_dir" ]]; then
                rm -rf "$feature_state_dir"
                log_info "Removed $feature_state_dir"
            fi
        fi
    fi

    # Reset Status
    if [[ "$no_reset" == false && "$dry_run" == false ]]; then
        log_info "Resetting $feature_id status..."
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action reset >/dev/null 2>&1 || {
            log_warn "Failed to reset feature status (may already be pending)"
        }
    elif [[ "$dry_run" == true && "$no_reset" == false ]]; then
        log_info "Dry-run mode: skipping status reset"
    fi

    # Generate Bootstrap Prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    local prompt_args=(
        --feature-list "$feature_list"
        --feature-id "$feature_id"
        --session-id "$session_id"
        --run-id "$run_id"
        --retry-count 0
        --resume-phase "$resume_phase"
        --state-dir "$STATE_DIR"
        --output "$bootstrap_prompt"
    )

    if [[ -n "$mode_override" ]]; then
        prompt_args+=(--mode "$mode_override")
    fi

    log_info "Generating bootstrap prompt..."
    python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" "${prompt_args[@]}" >/dev/null 2>&1

    # Dry-Run: Print info and exit
    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $feature_id — $feature_title${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Session ID:    $session_id"
        log_info "Resume Phase:  $resume_phase"
        if [[ -n "$mode_override" ]]; then
            log_info "Mode Override: $mode_override"
        else
            log_info "Mode:          auto-detect (from complexity)"
        fi
        echo ""
        log_info "Bootstrap prompt written to:"
        echo "  $bootstrap_prompt"
        echo ""

        local prompt_lines
        prompt_lines=$(wc -l < "$bootstrap_prompt" | tr -d ' ')
        log_info "Prompt: $prompt_lines lines"
        echo ""
        echo -e "${BOLD}--- Session Context (from prompt) ---${NC}"
        sed -n '/^## Session Context/,/^##[^#]/p' "$bootstrap_prompt" | head -20
        echo -e "${BOLD}--- end ---${NC}"
        echo ""

        log_success "Dry run complete. Inspect full prompt with:"
        echo "  cat $bootstrap_prompt"
        return 0
    fi

    # Spawn AI CLI Session
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Run: $feature_id — $feature_title${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Session ID: $session_id"
    log_info "Resume Phase: $resume_phase"
    if [[ -n "$mode_override" ]]; then
        log_info "Mode Override: $mode_override"
    fi
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "Prompt: $bootstrap_prompt"
    log_info "Log: $session_dir/logs/session.log"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Override cleanup trap for single-feature mode
    cleanup() {
        echo ""
        log_warn "Interrupted. Killing session..."
        # Kill all child processes
        kill 0 2>/dev/null || true
        log_info "Session log: $session_dir/logs/session.log"
        exit 130
    }
    trap cleanup SIGINT SIGTERM

    _SPAWN_RESULT=""
    spawn_and_wait_session \
        "$feature_id" "$feature_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999
    local session_status="$_SPAWN_RESULT"

    echo ""
    if [[ "$session_status" == "success" ]]; then
        log_success "════════════════════════════════════════════════════"
        log_success "  $feature_id completed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $feature_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all features
# ============================================================

main() {
    local feature_list="${1:-feature-list.json}"

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Validate feature list exists
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        log_info "Create a feature list first using the app-planner skill,"
        log_info "or provide a path: ./run.sh run <path-to-feature-list.json>"
        exit 1
    fi

    check_dependencies

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing pipeline state..."
        local init_result
        init_result=$(python3 "$SCRIPTS_DIR/init-pipeline.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" 2>&1)

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local features_count
        features_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('features_count', 0))" 2>/dev/null || echo "0")
        log_success "Pipeline initialized with $features_count features"
    else
        log_info "Resuming existing pipeline..."
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}          Dev-Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Feature list: $feature_list"
    log_info "Max retries per feature: $MAX_RETRIES"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Main processing loop
    local session_count=0

    while true; do
        # Check for stuck features
        local stuck_result
        stuck_result=$(python3 "$SCRIPTS_DIR/detect-stuck.py" \
            --state-dir "$STATE_DIR" \
            --feature-list "$FEATURE_LIST" \
            --max-retries "$MAX_RETRIES" \
            --stale-threshold "$HEARTBEAT_STALE_THRESHOLD" 2>/dev/null || echo '{"stuck_count": 0}')

        local stuck_count
        stuck_count=$(echo "$stuck_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stuck_count', 0))" 2>/dev/null || echo "0")

        if [[ "$stuck_count" -gt 0 ]]; then
            log_warn "Detected $stuck_count stuck feature(s):"
            echo "$stuck_result" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('stuck_features', []):
    print(f'  - {f[\"feature_id\"]}: {f[\"reason\"]} — {f[\"suggestion\"]}')
" 2>/dev/null || true
        fi

        # Find next feature to process
        local next_feature
        next_feature=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --max-retries "$MAX_RETRIES" \
            --action get_next 2>/dev/null) || true

        if [[ "$next_feature" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  All features completed! Pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "════════════════════════════════════════════════════"
            break
        fi

        if [[ "$next_feature" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining features are blocked by dependencies or failed."
            log_warn "Run './run.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse feature info
        local feature_id feature_title retry_count resume_phase
        feature_id=$(echo "$next_feature" | jq -r '.feature_id')
        feature_title=$(echo "$next_feature" | jq -r '.title')
        retry_count=$(echo "$next_feature" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_feature" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Feature: ${BOLD}$feature_id${NC} — $feature_title"
        log_info "Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Generate session ID and bootstrap prompt
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"
        python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" \
            --feature-list "$feature_list" \
            --feature-id "$feature_id" \
            --session-id "$session_id" \
            --run-id "$run_id" \
            --retry-count "$retry_count" \
            --resume-phase "$resume_phase" \
            --state-dir "$STATE_DIR" \
            --output "$bootstrap_prompt" >/dev/null 2>&1

        # Update current session tracking
        python3 -c "
import json, sys, os
from datetime import datetime
feature_id, session_id, state_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = {
    'feature_id': feature_id,
    'session_id': session_id,
    'started_at': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
}
with open(os.path.join(state_dir, 'current-session.json'), 'w') as f:
    json.dump(data, f, indent=2)
" "$feature_id" "$session_id" "$STATE_DIR"

        # Mark feature as in-progress before spawning session
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action start >/dev/null 2>&1 || true

        # Spawn session and wait
        log_info "Spawning AI CLI session: $session_id"
        _SPAWN_RESULT=""
        spawn_and_wait_session \
            "$feature_id" "$feature_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES"
        local session_status="$_SPAWN_RESULT"

        session_count=$((session_count + 1))

        # Brief pause before next iteration
        log_info "Pausing 5s before next feature..."
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
    echo "  run [feature-list.json]                 Run all features sequentially"
    echo "  run <feature-id> [options]              Run a single feature"
    echo "  status [feature-list.json]               Show pipeline status"
    echo "  reset                                    Clear all state and start fresh"
    echo "  help                                     Show this help message"
    echo ""
    echo "Single Feature Options (run <feature-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --resume-phase N            Override resume phase (default: auto-detect)"
    echo "  --mode <lite|standard|full> Override pipeline mode (bypasses estimated_complexity)"
    echo "  --clean                     Delete artifacts and reset before running"
    echo "  --no-reset                  Skip feature status reset step"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES           Max retries per feature (default: 3)"
    echo "  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)"
    echo "  AI_CLI                AI CLI command name (auto-detected: cbc or claude)"
    echo "  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)"
    echo "  HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)"
    echo ""
    echo "Examples:"
    echo "  ./run.sh run                                         # Run all features"
    echo "  ./run.sh run F-007 --dry-run                          # Inspect generated prompt"
    echo "  ./run.sh run F-007 --dry-run --mode lite               # Test lite mode"
    echo "  ./run.sh run F-007 --resume-phase 6                    # Skip to implementation"
    echo "  ./run.sh run F-007 --mode full --timeout 3600          # Full mode, 1h timeout"
    echo "  ./run.sh run F-007 --clean --mode standard             # Clean + run standard"
    echo "  ./run.sh status                                        # Show pipeline status"
    echo "  MAX_RETRIES=5 SESSION_TIMEOUT=7200 ./run.sh run        # Custom config"
}

case "${1:-run}" in
    run|resume)
        shift || true
        # Check if first arg is a feature ID (F-xxx pattern)
        if [[ "${1:-}" =~ ^[Ff]-[0-9]+ ]]; then
            run_one "$@"
        else
            main "${1:-feature-list.json}"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No pipeline state found. Run './run.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "${2:-feature-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    reset)
        log_warn "Resetting pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "State cleared. Run './run.sh run' to start fresh."
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
