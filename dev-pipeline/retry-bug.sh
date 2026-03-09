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

# AI CLI detection
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

# Spawn AI CLI session
case "$CLI_CMD" in
    *claude*)
        "$CLI_CMD" \
            --print \
            -p "$(cat "$BOOTSTRAP_PROMPT")" \
            --yes \
            > "$SESSION_LOG" 2>&1 &
        ;;
    *)
        "$CLI_CMD" \
            --print \
            -y \
            < "$BOOTSTRAP_PROMPT" \
            > "$SESSION_LOG" 2>&1 &
        ;;
esac
CLI_PID=$!

# Timeout watchdog
WATCHER_PID=""
if [[ $SESSION_TIMEOUT -gt 0 ]]; then
    ( sleep "$SESSION_TIMEOUT" && kill -TERM "$CLI_PID" 2>/dev/null ) &
    WATCHER_PID=$!
fi

# Heartbeat
(
    elapsed=0
    prev_size=0
    while kill -0 "$CLI_PID" 2>/dev/null; do
        sleep "$HEARTBEAT_INTERVAL"
        elapsed=$((elapsed + HEARTBEAT_INTERVAL))
        kill -0 "$CLI_PID" 2>/dev/null || break

        cur_size=0
        if [[ -f "$SESSION_LOG" ]]; then
            cur_size=$(wc -c < "$SESSION_LOG" 2>/dev/null || echo 0)
            cur_size=$(echo "$cur_size" | tr -d ' ')
        fi

        growth=$((cur_size - prev_size))
        prev_size=$cur_size

        if [[ $cur_size -gt 1048576 ]]; then
            size_display="$((cur_size / 1048576))MB"
        elif [[ $cur_size -gt 1024 ]]; then
            size_display="$((cur_size / 1024))KB"
        else
            size_display="${cur_size}B"
        fi

        mins=$((elapsed / 60))
        secs=$((elapsed % 60))

        last_activity=""
        if [[ -f "$SESSION_LOG" ]]; then
            last_activity=$(tail -20 "$SESSION_LOG" 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-80 || echo "")
        fi

        if [[ $growth -gt 0 ]]; then
            icon="${GREEN}▶${NC}"
        else
            icon="${YELLOW}⏸${NC}"
        fi

        echo -e "  ${icon} ${BLUE}[HEARTBEAT]${NC} ${mins}m${secs}s | log: ${size_display} (+${growth}B) | ${last_activity}"
    done
) &
HEARTBEAT_PID=$!

# Ctrl+C cleanup
cleanup() {
    echo ""
    log_warn "Interrupted. Killing session..."
    kill "$CLI_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && kill "$WATCHER_PID" 2>/dev/null || true
    kill "$HEARTBEAT_PID" 2>/dev/null || true
    wait "$CLI_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && wait "$WATCHER_PID" 2>/dev/null || true
    wait "$HEARTBEAT_PID" 2>/dev/null || true
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
kill "$HEARTBEAT_PID" 2>/dev/null || true
[[ -n "$WATCHER_PID" ]] && wait "$WATCHER_PID" 2>/dev/null || true
wait "$HEARTBEAT_PID" 2>/dev/null || true

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
