#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/reset-feature.sh - Reset a failed/stuck feature
#
# Clears all state and artifacts for a feature so it can be
# re-executed from scratch by the pipeline.
#
# Usage:
#   ./reset-feature.sh <feature-id> [options] [feature-list.json]
#
# Options:
#   --clean    Also delete session history and .prizmkit/specs/{slug}/ artifacts
#   --run      After reset, immediately retry the feature (calls retry-feature.sh)
#
# Examples:
#   ./reset-feature.sh F-007                          # Reset status only
#   ./reset-feature.sh F-007 --clean                  # Reset + delete artifacts
#   ./reset-feature.sh F-007 --clean --run             # Reset + delete + retry
#   ./reset-feature.sh F-007 --clean my-features.json  # Custom feature list
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}      $*"; }

# ============================================================
# Parse args
# ============================================================

FEATURE_ID=""
FEATURE_LIST=""
DO_CLEAN=false
DO_RUN=false

for arg in "$@"; do
    case "$arg" in
        --clean)  DO_CLEAN=true ;;
        --run)    DO_RUN=true ;;
        -h|--help) ;;
        F-*)      FEATURE_ID="$arg" ;;
        *)        FEATURE_LIST="$arg" ;;
    esac
done

if [[ -z "$FEATURE_ID" ]]; then
    echo "Usage: $0 <feature-id> [--clean] [--run] [feature-list.json]"
    echo ""
    echo "  feature-id          Feature to reset (e.g. F-007)"
    echo "  --clean             Delete session history and .prizmkit artifacts"
    echo "  --run               Retry the feature immediately after reset"
    echo "  feature-list.json   Path to feature list (default: feature-list.json)"
    exit 1
fi

FEATURE_LIST="${FEATURE_LIST:-feature-list.json}"

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

# Get feature info from feature list
FEATURE_INFO=$(python3 -c "
import json, sys, re
with open('$FEATURE_LIST') as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == '$FEATURE_ID':
        title = feat.get('title', '')
        # Compute slug
        numeric = '$FEATURE_ID'.replace('F-', '').replace('f-', '').zfill(3)
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s]+', '-', slug.strip())
        slug = re.sub(r'-+', '-', slug).strip('-')
        slug = '{}-{}'.format(numeric, slug)
        print(json.dumps({'title': title, 'slug': slug, 'status': feat.get('status', 'unknown')}))
        sys.exit(0)
sys.exit(1)
" 2>/dev/null) || {
    log_error "Feature $FEATURE_ID not found in $FEATURE_LIST"
    exit 1
}

FEATURE_TITLE=$(echo "$FEATURE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")
FEATURE_SLUG=$(echo "$FEATURE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])")
FEATURE_STATUS=$(echo "$FEATURE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")

# ============================================================
# Show current state
# ============================================================

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Reset: $FEATURE_ID — $FEATURE_TITLE${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

# Read current status.json
STATUS_FILE="$STATE_DIR/features/$FEATURE_ID/status.json"
if [[ -f "$STATUS_FILE" ]]; then
    CURRENT_STATUS=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(d.get('status','?'))")
    CURRENT_RETRY=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(d.get('retry_count',0))")
    SESSION_COUNT=$(python3 -c "import json; d=json.load(open('$STATUS_FILE')); print(len(d.get('sessions',[])))")
    log_info "Current status: $CURRENT_STATUS (retry $CURRENT_RETRY, $SESSION_COUNT sessions)"
else
    log_info "No status file found (never executed)"
fi

# Count artifacts
SPECS_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)/.prizmkit/specs/$FEATURE_SLUG"
SPECS_COUNT=0
if [[ -d "$SPECS_DIR" ]]; then
    SPECS_COUNT=$(find "$SPECS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
    log_info "PrizmKit artifacts: $SPECS_COUNT files in .prizmkit/specs/$FEATURE_SLUG/"
fi

SESSIONS_DIR="$STATE_DIR/features/$FEATURE_ID/sessions"
SESSIONS_COUNT=0
if [[ -d "$SESSIONS_DIR" ]]; then
    SESSIONS_COUNT=$(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    log_info "Session history: $SESSIONS_COUNT session(s)"
fi

echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

# ============================================================
# Execute reset
# ============================================================

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ "$DO_CLEAN" == true ]]; then
    log_info "Cleaning $FEATURE_ID (reset + delete artifacts)..."
    RESULT=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$FEATURE_LIST" \
        --state-dir "$STATE_DIR" \
        --feature-id "$FEATURE_ID" \
        --feature-slug "$FEATURE_SLUG" \
        --project-root "$PROJECT_ROOT" \
        --action clean 2>&1)
else
    log_info "Resetting $FEATURE_ID status..."
    RESULT=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$FEATURE_LIST" \
        --state-dir "$STATE_DIR" \
        --feature-id "$FEATURE_ID" \
        --action reset 2>&1)
fi

# Check for errors
if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'error' not in d else 1)" 2>/dev/null; then
    : # no error
else
    ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$RESULT")
    log_error "Reset failed: $ERROR_MSG"
    exit 1
fi

# ============================================================
# Summary
# ============================================================

echo ""
if [[ "$DO_CLEAN" == true ]]; then
    log_success "$FEATURE_ID cleaned: status → pending, $SESSIONS_COUNT session(s) deleted, $SPECS_COUNT artifact(s) deleted"
else
    log_success "$FEATURE_ID reset: status → pending, retry count → 0"
fi

echo ""
echo -e "${BOLD}Next steps:${NC}"
if [[ "$DO_RUN" == true ]]; then
    log_info "Auto-retrying $FEATURE_ID..."
    echo ""
    exec "$SCRIPT_DIR/retry-feature.sh" "$FEATURE_ID" "$FEATURE_LIST"
else
    log_info "  ./dev-pipeline/retry-feature.sh $FEATURE_ID        # Retry once"
    log_info "  ./dev-pipeline/run.sh run feature-list.json         # Resume pipeline"
fi
echo ""
