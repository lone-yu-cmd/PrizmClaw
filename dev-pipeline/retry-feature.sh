#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/retry-feature.sh - Retry a single failed feature
#
# Runs exactly ONE AI CLI session for the specified feature, then exits.
# Use this to manually retry a failed feature without restarting
# the full pipeline.
#
# Usage:
#   ./retry-feature.sh <feature-id> [feature-list.json]
#
# Examples:
#   ./retry-feature.sh F-007
#   ./retry-feature.sh F-007 feature-list.json
#   SESSION_TIMEOUT=3600 ./retry-feature.sh F-007  # with 1h timeout
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}

# AI CLI detection: AI_CLI > CODEBUDDY_CLI > auto-detect
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
    echo "Usage: $0 <feature-id> [feature-list.json]"
    echo ""
    echo "  feature-id          Feature to retry (e.g. F-007)"
    echo "  feature-list.json   Path to feature list (default: feature-list.json)"
    echo ""
    echo "Environment Variables:"
    echo "  SESSION_TIMEOUT     Timeout in seconds (default: 0 = no limit)"
    echo "  HEARTBEAT_INTERVAL  Heartbeat interval in seconds (default: 30)"
    echo "  AI_CLI              AI CLI command (auto-detected: cbc or claude)"
    exit 1
fi

FEATURE_ID="$1"
FEATURE_LIST="${2:-feature-list.json}"

# Resolve absolute path
if [[ ! "$FEATURE_LIST" = /* ]]; then
    FEATURE_LIST="$(pwd)/$FEATURE_LIST"
fi

# ============================================================
# Validation
# ============================================================

if [[ ! -f "$FEATURE_LIST" ]]; then
    log_error "Feature list not found: $FEATURE_LIST"
    exit 1
fi

if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
    log_error "No pipeline state found. Run './run.sh run' first to initialize."
    exit 1
fi

if ! command -v jq &>/dev/null; then
    log_error "jq is required. Install with: brew install jq"
    exit 1
fi

# Verify feature exists in feature list
FEATURE_TITLE=$(python3 -c "
import json, sys
with open('$FEATURE_LIST') as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == '$FEATURE_ID':
        print(feat.get('title', ''))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
    log_error "Feature $FEATURE_ID not found in $FEATURE_LIST"
    exit 1
}

# ============================================================
# Clean feature artifacts + reset status for a full restart
# ============================================================

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FEATURE_SLUG=$(FEATURE_ID="$FEATURE_ID" FEATURE_TITLE="$FEATURE_TITLE" python3 -c "
import os, re
fid = os.environ['FEATURE_ID'].replace('F-', '').replace('f-', '').zfill(3)
title = os.environ.get('FEATURE_TITLE', '').lower()
title = re.sub(r'[^a-z0-9\s-]', '', title)
title = re.sub(r'[\s]+', '-', title.strip())
title = re.sub(r'-+', '-', title).strip('-') or 'feature'
print(f'{fid}-{title}')
" 2>/dev/null)

log_info "Cleaning $FEATURE_ID artifacts for full restart..."
python3 "$SCRIPTS_DIR/update-feature-status.py" \
    --feature-list "$FEATURE_LIST" \
    --state-dir "$STATE_DIR" \
    --feature-id "$FEATURE_ID" \
    --feature-slug "$FEATURE_SLUG" \
    --project-root "$PROJECT_ROOT" \
    --action clean >/dev/null 2>&1 || {
    log_warn "Failed to clean feature artifacts (continuing with fresh session only)"
}

# ============================================================
# Generate bootstrap prompt
# ============================================================

RUN_ID=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
SESSION_ID="${FEATURE_ID}-$(date +%Y%m%d%H%M%S)"
SESSION_DIR="$STATE_DIR/features/$FEATURE_ID/sessions/$SESSION_ID"
mkdir -p "$SESSION_DIR/logs"

BOOTSTRAP_PROMPT="$SESSION_DIR/bootstrap-prompt.md"

log_info "Generating bootstrap prompt..."
python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" \
    --feature-list "$FEATURE_LIST" \
    --feature-id "$FEATURE_ID" \
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
echo -e "${BOLD}  Retry: $FEATURE_ID — $FEATURE_TITLE${NC}"
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
CBC_PID=$!

# Timeout watchdog (only if SESSION_TIMEOUT > 0)
WATCHER_PID=""
if [[ $SESSION_TIMEOUT -gt 0 ]]; then
    ( sleep "$SESSION_TIMEOUT" && kill -TERM "$CBC_PID" 2>/dev/null ) &
    WATCHER_PID=$!
fi

# Heartbeat
(
    elapsed=0
    prev_size=0
    while kill -0 "$CBC_PID" 2>/dev/null; do
        sleep "$HEARTBEAT_INTERVAL"
        elapsed=$((elapsed + HEARTBEAT_INTERVAL))
        kill -0 "$CBC_PID" 2>/dev/null || break

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
    kill "$CBC_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && kill "$WATCHER_PID" 2>/dev/null || true
    kill "$HEARTBEAT_PID" 2>/dev/null || true
    wait "$CBC_PID" 2>/dev/null || true
    [[ -n "$WATCHER_PID" ]] && wait "$WATCHER_PID" 2>/dev/null || true
    wait "$HEARTBEAT_PID" 2>/dev/null || true
    log_info "Session log: $SESSION_LOG"
    exit 130
}
trap cleanup SIGINT SIGTERM

# Wait
EXIT_CODE=0
if wait "$CBC_PID" 2>/dev/null; then
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

# Update feature status
python3 "$SCRIPTS_DIR/update-feature-status.py" \
    --feature-list "$FEATURE_LIST" \
    --state-dir "$STATE_DIR" \
    --feature-id "$FEATURE_ID" \
    --session-status "$SESSION_STATUS" \
    --session-id "$SESSION_ID" \
    --max-retries 999 \
    --action update >/dev/null 2>&1 || true

echo ""
if [[ "$SESSION_STATUS" == "success" ]]; then
    log_success "════════════════════════════════════════════════════"
    log_success "  $FEATURE_ID completed successfully!"
    log_success "════════════════════════════════════════════════════"
else
    log_error "════════════════════════════════════════════════════"
    log_error "  $FEATURE_ID result: $SESSION_STATUS"
    log_error "  Review log: $SESSION_LOG"
    log_error "════════════════════════════════════════════════════"
fi
