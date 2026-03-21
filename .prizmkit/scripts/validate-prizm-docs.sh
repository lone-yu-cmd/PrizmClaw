#!/bin/sh
# validate-prizm-docs.sh — validate .prizm file format and size limits
# Usage: validate-prizm-docs.sh [--all | --staged]

MODE="${1:---staged}"
ERRORS=0

# Not a prizm project — exit silently
[ -f ".prizm-docs/root.prizm" ] || exit 0

# Collect files to check
if [ "$MODE" = "--all" ]; then
    FILES=$(find .prizm-docs -name '*.prizm' 2>/dev/null)
elif [ "$MODE" = "--staged" ]; then
    FILES=$(git diff --cached --name-only 2>/dev/null | grep '\.prizm$')
else
    echo "Usage: validate-prizm-docs.sh [--all | --staged]" >&2
    exit 1
fi

# Nothing to check — exit silently
[ -z "$FILES" ] && exit 0

for FILE in $FILES; do
    [ -f "$FILE" ] || continue

    # Check markdown headers
    if grep -qE '^#{1,6} ' "$FILE"; then
        echo "ERROR: $FILE contains markdown headers (##). Use KEY: value format." >&2
        ERRORS=$((ERRORS + 1))
    fi

    # Check code blocks
    if grep -q '^```' "$FILE"; then
        echo "ERROR: $FILE contains code blocks. Use file_path:line_number reference." >&2
        ERRORS=$((ERRORS + 1))
    fi

    # Size limits — determine level by path depth
    SIZE=$(wc -c < "$FILE" | tr -d ' ')
    case "$FILE" in
        *root.prizm)
            LIMIT=4096; LEVEL="L0"
            HINT="Consolidate MODULE_INDEX, keep top-5 RULES."
            ;;
        *)
            # L1 = direct child of .prizm-docs/, L2 = nested deeper
            DIR=$(dirname "$FILE")
            if [ "$DIR" = ".prizm-docs" ]; then
                LIMIT=3072; LEVEL="L1"
                HINT="Move implementation details to L2."
            else
                LIMIT=5120; LEVEL="L2"
                HINT="Archive CHANGELOG entries older than 90 days."
            fi
            ;;
    esac

    if [ "$SIZE" -gt "$LIMIT" ]; then
        echo "ERROR: $FILE exceeds $LEVEL limit (${SIZE}B > ${LIMIT}B). $HINT" >&2
        ERRORS=$((ERRORS + 1))
    fi

    # Required fields in root.prizm
    case "$FILE" in
        *root.prizm)
            if ! grep -q 'PRIZM_VERSION:' "$FILE"; then
                echo "ERROR: $FILE missing required field PRIZM_VERSION:" >&2
                ERRORS=$((ERRORS + 1))
            fi
            if ! grep -q 'MODULE_INDEX:' "$FILE"; then
                echo "ERROR: $FILE missing required field MODULE_INDEX:" >&2
                ERRORS=$((ERRORS + 1))
            fi
            ;;
    esac
done

if [ "$ERRORS" -gt 0 ]; then
    echo "PrizmKit: $ERRORS format error(s) in .prizm files. Fix before committing." >&2
    exit 1
fi

exit 0
