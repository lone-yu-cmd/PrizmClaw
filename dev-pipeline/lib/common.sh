#!/usr/bin/env bash
# ============================================================
# dev-pipeline/lib/common.sh - Shared shell helpers
#
# Shared by feature and bugfix pipeline runners.
# Provides:
#   - CLI/platform detection
#   - Common color + log helpers
#   - Common dependency checks
# ============================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Detect AI CLI + platform.
# Priority:
#   AI_CLI env > .prizmkit/config.json > CODEBUDDY_CLI > auto-detect(cbc/claude) > error
#
# Exports:
#   CLI_CMD
#   PLATFORM
#   PRIZMKIT_PLATFORM
prizm_detect_cli_and_platform() {
    local _raw_cli=""

    if [[ -n "${AI_CLI:-}" ]]; then
        _raw_cli="$AI_CLI"
    elif [[ -f ".prizmkit/config.json" ]]; then
        _config_ai_cli=$(python3 -c "
import json, sys
try:
    with open('.prizmkit/config.json') as f:
        d = json.load(f)
    v = d.get('ai_cli', '')
    if v: print(v)
except: pass
" 2>/dev/null || true)
        if [[ -n "$_config_ai_cli" ]]; then
            _raw_cli="$_config_ai_cli"
        elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
            _raw_cli="$CODEBUDDY_CLI"
        elif command -v cbc &>/dev/null; then
            _raw_cli="cbc"
        elif command -v claude &>/dev/null; then
            _raw_cli="claude"
        else
            echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude)." >&2
            exit 1
        fi
    elif [[ -n "${CODEBUDDY_CLI:-}" ]]; then
        _raw_cli="$CODEBUDDY_CLI"
    elif command -v cbc &>/dev/null; then
        _raw_cli="cbc"
    elif command -v claude &>/dev/null; then
        _raw_cli="claude"
    else
        echo "ERROR: No AI CLI found. Install CodeBuddy (cbc) or Claude Code (claude)." >&2
        exit 1
    fi

    CLI_CMD="$_raw_cli"

    if [[ -n "${PRIZMKIT_PLATFORM:-}" ]]; then
        PLATFORM="$PRIZMKIT_PLATFORM"
    elif [[ "$_raw_cli" == *"claude"* ]]; then
        PLATFORM="claude"
    else
        PLATFORM="codebuddy"
    fi

    export CLI_CMD
    export PLATFORM
    export PRIZMKIT_PLATFORM="$PLATFORM"
}

# Common dependency check (jq + python3 + optional CLI in PATH)
# Args:
#   $1 - cli command (optional)
prizm_check_common_dependencies() {
    local cli_cmd="${1:-}"

    if ! command -v jq &>/dev/null; then
        log_error "jq is required but not installed. Install with: brew install jq"
        exit 1
    fi

    if ! command -v python3 &>/dev/null; then
        log_error "python3 is required but not installed."
        exit 1
    fi

    if [[ -n "$cli_cmd" ]] && ! command -v "$cli_cmd" &>/dev/null; then
        log_warn "AI CLI '$cli_cmd' not found in PATH."
        log_warn "Set AI_CLI environment variable to the correct command."
        log_warn "Continuing anyway (will fail when spawning sessions)..."
    fi
}
