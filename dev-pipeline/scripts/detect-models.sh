#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# detect-models.sh - CLI model detection adapter
#
# Detects available AI models for the current CLI platform.
# Usage: ./detect-models.sh [--quiet]
# Writes: $PROJECT_ROOT/.prizmkit/available-models.json
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh" && prizm_detect_cli_and_platform

# --- Parse flags ---
QUIET=false
for arg in "$@"; do
    case "$arg" in
        --quiet) QUIET=true ;;
        *) log_warn "Unknown argument: $arg" ;;
    esac
done

# --- Project root ---
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# --- CLI version ---
CLI_VERSION="$($CLI_CMD -v 2>&1 | head -1 | sed 's/^[^0-9]*//')" || CLI_VERSION="unknown"

# --- Platform-specific detection ---
MODELS_JSON="[]"
DEFAULT_MODEL=""
MODEL_SWITCH_SUPPORTED="false"
DETECTION_METHOD="unknown"

case "$PLATFORM" in
    codebuddy)
        DETECTION_METHOD="probe"
        MODEL_SWITCH_SUPPORTED="true"

        PROBE_OUTPUT="$(echo "x" | $CLI_CMD --print -y --model _probe_ 2>&1)" || true

        MODELS_JSON="$(python3 -c "
import sys, re, json

output = sys.stdin.read()
models = []

# Look for 'Currently supported models' line and extract model names
for line in output.splitlines():
    if 'supported model' in line.lower():
        # Extract everything after the colon/are:
        match = re.search(r'(?:are|:)\s*(.+)', line, re.IGNORECASE)
        if match:
            raw = match.group(1)
            # Split by comma, clean up
            for m in raw.split(','):
                m = m.strip().rstrip('.')
                if m:
                    models.append(m)

# Fallback: look for model-like identifiers anywhere
if not models:
    models = re.findall(r'claude-[\w.-]+', output)
    models = list(dict.fromkeys(models))  # dedupe preserving order

print(json.dumps(models))
" <<< "$PROBE_OUTPUT")" || MODELS_JSON="[]"

        # Set default_model to first model if available
        DEFAULT_MODEL="$(python3 -c "
import json, sys
models = json.loads(sys.stdin.read())
print(models[0] if models else '')
" <<< "$MODELS_JSON")" || DEFAULT_MODEL=""
        ;;

    claude)
        DETECTION_METHOD="self-report"
        MODEL_SWITCH_SUPPORTED="false"
        MODELS_JSON="[]"

        DEFAULT_MODEL="$($CLI_CMD -p "Reply with ONLY your model identifier, nothing else" \
            --dangerously-skip-permissions --no-session-persistence 2>&1 \
            | head -1 | tr -d '[:space:]')" || DEFAULT_MODEL="unknown"
        ;;

    *)
        DETECTION_METHOD="help-parse"
        MODEL_SWITCH_SUPPORTED="false"

        HELP_OUTPUT="$($CLI_CMD --help 2>&1)" || HELP_OUTPUT=""

        MODELS_JSON="$(python3 -c "
import sys, re, json

output = sys.stdin.read()
models = re.findall(r'claude-[\w.-]+', output)
models = list(dict.fromkeys(models))  # dedupe preserving order
print(json.dumps(models))
" <<< "$HELP_OUTPUT")" || MODELS_JSON="[]"
        ;;
esac

# --- Write output JSON atomically ---
mkdir -p "$PROJECT_ROOT/.prizmkit"

OUTPUT_FILE="$PROJECT_ROOT/.prizmkit/available-models.json"
TMP_FILE="$(mktemp "${OUTPUT_FILE}.XXXXXX")"

# Determine cli short name
CLI_SHORT="$(basename "$CLI_CMD")"

python3 -c "
import json, sys
from datetime import datetime, timezone

data = {
    'cli': sys.argv[1],
    'cli_version': sys.argv[2],
    'platform': sys.argv[3],
    'models': json.loads(sys.argv[4]),
    'default_model': sys.argv[5],
    'model_switch_supported': sys.argv[6] == 'true',
    'detection_method': sys.argv[7],
    'updated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}

with open(sys.argv[8], 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
" "$CLI_SHORT" "$CLI_VERSION" "$PLATFORM" "$MODELS_JSON" "$DEFAULT_MODEL" \
  "$MODEL_SWITCH_SUPPORTED" "$DETECTION_METHOD" "$TMP_FILE"

mv "$TMP_FILE" "$OUTPUT_FILE"

# --- Summary ---
if [[ "$QUIET" != "true" ]]; then
    MODEL_COUNT="$(python3 -c "import json; print(len(json.loads(open('$OUTPUT_FILE').read())['models']))")"
    log_info "Model detection complete"
    log_info "  CLI:        $CLI_SHORT ($CLI_VERSION)"
    log_info "  Platform:   $PLATFORM"
    log_info "  Method:     $DETECTION_METHOD"
    log_info "  Models:     $MODEL_COUNT detected"
    if [[ -n "$DEFAULT_MODEL" ]]; then
        log_info "  Default:    $DEFAULT_MODEL"
    fi
    log_info "  Switch:     $MODEL_SWITCH_SUPPORTED"
    log_info "  Written to: $OUTPUT_FILE"
fi
