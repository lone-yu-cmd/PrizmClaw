#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/retry-bug.sh - Retry a single failed bug fix
#
# Runs exactly ONE AI CLI session for the specified bug, then exits.
# Use this to manually retry a failed bug without restarting
# the full bugfix pipeline.
#
# Usage:
#   ./retry-bug.sh <bug-id> [bug-fix-list.json]
#
# Examples:
#   ./retry-bug.sh B-001
#   ./retry-bug.sh B-001 bug-fix-list.json
#   SESSION_TIMEOUT=3600 ./retry-bug.sh B-001
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/bugfix-state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}

# AI CLI detection: AI_CLI env > .prizmkit/config.json > CODEBUDDY_CLI > auto-detect
if [[ -n "${AI_CLI:-}" ]]; then
    CLI_CMD="$AI_CLI"
elif [[ -f ".prizmkit/config.json" ]]; then
    _config_cli=$(python3 -c "
import json, sys
try:
    with open('.prizmkit/config.json') as f:
        d = json.load(f)
    v = d.get('ai_cli', '')
    if v: print(v)
except: pass
" 2>/dev/null || true)
    CLI_CMD="${_config_cli:-}"
    if [[ -z "$CLI_CMD" ]]; then
        if [[ -n "${CODEBUDDY_CLI:-}" ]]; then CLI_CMD="$CODEBUDDY_CLI"
        elif command -v cbc &>/dev/null; then CLI_CMD="cbc"
        elif command -v claude &>/dev/null; then CLI_CMD="claude"
        else echo "ERROR: No AI CLI found. Set AI_CLI or configure .prizmkit/config.json" >&2; exit 1
        fi
    fi
elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
    CLI_CMD="$CODEBUDDY_CLI"
elif command -v cbc &>/dev/null; then
    CLI_CMD="cbc"
elif command -v claude &>/dev/null; then
    CLI_CMD="claude"
else
    echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude), or set AI_CLI." >&2
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

# Colors
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
# Args
# ============================================================

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <bug-id> [bug-fix-list.json]"
    echo ""
    echo "  bug-id              Bug to retry (e.g. B-001)"
    echo "  bug-fix-list.json   Path to bug fix list (default: bug-fix-list.json)"
    echo ""
    echo "Environment Variables:"
    echo "  SESSION_TIMEOUT     Timeout in seconds (default: 0 = no limit)"
    echo "  HEARTBEAT_INTERVAL  Heartbeat interval in seconds (default: 30)"
    exit 1
fi

BUG_ID="$1"
BUG_LIST="${2:-bug-fix-list.json}"

if [[ ! "$BUG_LIST" = /* ]]; then
    BUG_LIST="$(pwd)/$BUG_LIST"
fi

# ============================================================
# Validation
# ============================================================

if [[ ! -f "$BUG_LIST" ]]; then
    log_error "Bug fix list not found: $BUG_LIST"
    exit 1
fi

if ! command -v jq &>/dev/null; then
    log_error "jq is required. Install with: brew install jq"
    exit 1
fi

# Initialize state if needed
if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
    log_info "Initializing bugfix pipeline state..."
    python3 "$SCRIPTS_DIR/init-bugfix-pipeline.py" \
        --bug-list "$BUG_LIST" \
        --state-dir "$STATE_DIR" >/dev/null 2>&1 || {
        log_error "Failed to initialize bugfix pipeline state"
        exit 1
    }
fi

# Verify bug exists
BUG_TITLE=$(python3 -c "
import json, sys
with open('$BUG_LIST') as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == '$BUG_ID':
        print(bug.get('title', ''))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
    log_error "Bug $BUG_ID not found in $BUG_LIST"
    exit 1
}

BUG_SEVERITY=$(python3 -c "
import json, sys
with open('$BUG_LIST') as f:
    data = json.load(f)
for bug in data.get('bugs', []):
    if bug.get('id') == '$BUG_ID':
        print(bug.get('severity', 'medium'))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || BUG_SEVERITY="medium"

# ============================================================
# Clean bug artifacts + reset status for a full restart
# ============================================================

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log_info "Cleaning $BUG_ID artifacts for full restart..."
python3 "$SCRIPTS_DIR/update-bug-status.py" \
    --bug-list "$BUG_LIST" \
    --state-dir "$STATE_DIR" \
    --bug-id "$BUG_ID" \
    --project-root "$PROJECT_ROOT" \
    --action clean >/dev/null 2>&1 || {
    log_warn "Failed to clean bug artifacts (continuing with fresh session only)"
}

# ============================================================
# Generate bootstrap prompt
# ============================================================

RUN_ID=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
SESSION_ID="${BUG_ID}-$(date +%Y%m%d%H%M%S)"
SESSION_DIR="$STATE_DIR/bugs/$BUG_ID/sessions/$SESSION_ID"
mkdir -p "$SESSION_DIR/logs"

BOOTSTRAP_PROMPT="$SESSION_DIR/bootstrap-prompt.md"

log_info "Generating bugfix bootstrap prompt..."
python3 "$SCRIPTS_DIR/generate-bugfix-prompt.py" \
    --bug-list "$BUG_LIST" \
    --bug-id "$BUG_ID" \
    --session-id "$SESSION_ID" \
    --run-id "$RUN_ID" \
    --retry-count 0 \
    --resume-phase "null" \
    --state-dir "$STATE_DIR" \
    --output "$BOOTSTRAP_PROMPT" >/dev/null 2>&1

# ============================================================
# Run single AI CLI session
# ============================================================

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Retry Bug Fix: $BUG_ID — $BUG_TITLE${NC}"
echo -e "${BOLD}  Severity: $BUG_SEVERITY${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
log_info "CLI: $CLI_CMD (platform: $PLATFORM)"
if [[ $SESSION_TIMEOUT -gt 0 ]]; then
    log_info "Session timeout: ${SESSION_TIMEOUT}s"
else
    log_info "Session timeout: none"
fi
log_info "Prompt: $BOOTSTRAP_PROMPT"
log_info "Log: $SESSION_DIR/logs/session.log"
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
echo ""

SESSION_LOG="$SESSION_DIR/logs/session.log"
PROGRESS_JSON="$SESSION_DIR/logs/progress.json"

# Build stream-json flag
STREAM_JSON_FLAG=""
if [[ "$USE_STREAM_JSON" == "true" ]]; then
    STREAM_JSON_FLAG="--output-format stream-json"
fi

# Spawn AI CLI session
MODEL_FLAG=""
if [[ -n "${MODEL:-}" ]]; then
    MODEL_FLAG="--model $MODEL"
fi

case "$CLI_CMD" in
    *claude*)
        "$CLI_CMD" \
            --print \
            -p "$(cat "$BOOTSTRAP_PROMPT")" \
            --yes \
            $STREAM_JSON_FLAG \
            $MODEL_FLAG \
            > "$SESSION_LOG" 2>&1 &
        ;;
    *)
        "$CLI_CMD" \
            --print \
            -y \
            $STREAM_JSON_FLAG \
            $MODEL_FLAG \
            < "$BOOTSTRAP_PROMPT" \
            > "$SESSION_LOG" 2>&1 &
        ;;
esac
CLI_PID=$!

# Start progress parser (no-op if stream-json not supported)
start_progress_parser "$SESSION_LOG" "$PROGRESS_JSON" "$SCRIPTS_DIR"
PARSER_PID="${_PARSER_PID:-}"

# Timeout watchdog
WATCHER_PID=""
if [[ $SESSION_TIMEOUT -gt 0 ]]; then
    ( sleep "$SESSION_TIMEOUT" && kill -TERM "$CLI_PID" 2>/dev/null ) &
    WATCHER_PID=$!
fi

# Heartbeat
start_heartbeat "$CLI_PID" "$SESSION_LOG" "$PROGRESS_JSON" "$HEARTBEAT_INTERVAL"
HEARTBEAT_PID="${_HEARTBEAT_PID:-}"

# Ctrl+C cleanup
cleanup() {
    echo ""
    log_warn "Interrupted. Killing session..."
    kill "$CLI_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && kill "$WATCHER_PID" 2>/dev/null || true
    stop_heartbeat "$HEARTBEAT_PID"
    stop_progress_parser "$PARSER_PID"
    wait "$CLI_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && wait "$WATCHER_PID" 2>/dev/null || true
    log_info "Session log: $SESSION_LOG"
    exit 130
}
trap cleanup SIGINT SIGTERM

# Wait
EXIT_CODE=0
if wait "$CLI_PID" 2>/dev/null; then
    EXIT_CODE=0
else
    EXIT_CODE=$?
fi

# Cleanup background processes
[[ -n "$WATCHER_PID" ]] && kill "$WATCHER_PID" 2>/dev/null || true
stop_heartbeat "$HEARTBEAT_PID"
stop_progress_parser "$PARSER_PID"
[[ -n "$WATCHER_PID" ]] && wait "$WATCHER_PID" 2>/dev/null || true

[[ $EXIT_CODE -eq 143 ]] && EXIT_CODE=124

# ============================================================
# Check result
# ============================================================

echo ""
if [[ -f "$SESSION_LOG" ]]; then
    FINAL_LINES=$(wc -l < "$SESSION_LOG" 2>/dev/null | tr -d ' ')
    FINAL_SIZE=$(wc -c < "$SESSION_LOG" 2>/dev/null | tr -d ' ')
    log_info "Session log: $FINAL_LINES lines, $((FINAL_SIZE / 1024))KB"
fi

SESSION_STATUS_FILE="$SESSION_DIR/session-status.json"

if [[ $EXIT_CODE -eq 124 ]]; then
    log_warn "Session timed out after ${SESSION_TIMEOUT}s"
    SESSION_STATUS="timed_out"
elif [[ -f "$SESSION_STATUS_FILE" ]]; then
    SESSION_STATUS=$(python3 "$SCRIPTS_DIR/check-session-status.py" \
        --status-file "$SESSION_STATUS_FILE" 2>/dev/null) || SESSION_STATUS="crashed"
else
    log_warn "Session ended without status file"
    SESSION_STATUS="crashed"
fi

if [[ "$SESSION_STATUS" == "success" ]]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        DIRTY_FILES=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || true)
        if [[ -n "$DIRTY_FILES" ]]; then
            log_error "Session reported success but git working tree is not clean."
            echo "$DIRTY_FILES" | sed 's/^/  - /'
            SESSION_STATUS="failed"
        fi
    fi
fi

# Update bug status
python3 "$SCRIPTS_DIR/update-bug-status.py" \
    --bug-list "$BUG_LIST" \
    --state-dir "$STATE_DIR" \
    --bug-id "$BUG_ID" \
    --session-status "$SESSION_STATUS" \
    --session-id "$SESSION_ID" \
    --max-retries 999 \
    --action update >/dev/null 2>&1 || true

echo ""
if [[ "$SESSION_STATUS" == "success" ]]; then
    log_success "════════════════════════════════════════════════════"
    log_success "  $BUG_ID fixed successfully!"
    log_success "════════════════════════════════════════════════════"
else
    log_error "════════════════════════════════════════════════════"
    log_error "  $BUG_ID result: $SESSION_STATUS"
    log_error "  Review log: $SESSION_LOG"
    log_error "════════════════════════════════════════════════════"
fi
