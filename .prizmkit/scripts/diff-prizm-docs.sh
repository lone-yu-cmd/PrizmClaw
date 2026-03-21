#!/bin/sh
# PrizmKit: diff-prizm-docs.sh
# Outputs structural differences between .prizm-docs/ and source code.
# Silent (exit 0) if no differences or if .prizm-docs doesn't exist.
# POSIX sh only — no arrays, no bashisms.

set -e

ROOT_PRIZM=".prizm-docs/root.prizm"

# 1. Exit silently if no root.prizm
[ -f "$ROOT_PRIZM" ] || exit 0

# 2. Detect language from LANG: field
LANG_VAL=$(grep '^LANG:' "$ROOT_PRIZM" | head -1 | sed 's/^LANG:[[:space:]]*//' | tr '[:upper:]' '[:lower:]')

case "$LANG_VAL" in
  go)
    FILE_PATTERN="*.go"
    ;;
  javascript|typescript|javascript/typescript|typescript/javascript)
    FILE_PATTERN="*.ts *.tsx *.js *.jsx"
    ;;
  python)
    FILE_PATTERN="*.py"
    ;;
  rust)
    FILE_PATTERN="*.rs"
    ;;
  *)
    FILE_PATTERN=""
    ;;
esac

# Helper: count source files in a directory (maxdepth 1) by language
count_source_files() {
  _dir="$1"
  [ -d "$_dir" ] || { echo 0; return; }
  if [ -z "$FILE_PATTERN" ]; then
    # All non-hidden files
    find "$_dir" -maxdepth 1 -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' '
  else
    _count=0
    for _pat in $FILE_PATTERN; do
      _c=$(find "$_dir" -maxdepth 1 -type f -name "$_pat" 2>/dev/null | wc -l | tr -d ' ')
      _count=$((_count + _c))
    done
    echo "$_count"
  fi
}

# 3. Parse MODULE_INDEX from root.prizm
# Extract lines between MODULE_INDEX: and next ALL-CAPS header or EOF
# Each module line: "- src/auth: ..." -> source path is text before first ":" after "- "
REGISTERED_PATHS=""
_in_index=0
while IFS= read -r line; do
  case "$line" in
    MODULE_INDEX:*)
      _in_index=1
      continue
      ;;
  esac
  if [ "$_in_index" -eq 1 ]; then
    # Check for next ALL-CAPS section header (word followed by colon, all uppercase letters)
    _header=$(echo "$line" | grep '^[A-Z_][A-Z_]*:' || true)
    if [ -n "$_header" ]; then
      break
    fi
    # Extract source path from "- src/auth: ..."
    case "$line" in
      "- "*)
        _path=$(echo "$line" | sed 's/^- //' | sed 's/:.*//')
        if [ -n "$_path" ]; then
          REGISTERED_PATHS="${REGISTERED_PATHS}${_path}
"
        fi
        ;;
    esac
  fi
done < "$ROOT_PRIZM"

# 4. Check each registered module for drift
echo "$REGISTERED_PATHS" | while IFS= read -r source_path; do
  [ -z "$source_path" ] && continue

  # Derive L1 prizm file path
  l1_file=".prizm-docs/${source_path}.prizm"

  if [ ! -f "$l1_file" ]; then
    continue
  fi

  # Read declared FILES: count
  declared=$(grep '^FILES:' "$l1_file" | head -1 | awk '{print $2}')
  [ -z "$declared" ] && continue

  # Count actual source files
  actual=$(count_source_files "$source_path")

  if [ "$actual" -gt 0 ] && [ "$declared" != "$actual" ]; then
    echo "MODULE_DRIFT: $source_path | declared FILES: $declared | actual: $actual"
  fi
done

# 5. Find orphan docs
find .prizm-docs -name '*.prizm' 2>/dev/null | while IFS= read -r prizm_file; do
  _basename=$(basename "$prizm_file")
  case "$_basename" in
    root.prizm|changelog.prizm|changelog-archive.prizm)
      continue
      ;;
  esac

  # Derive source path: remove .prizm-docs/ prefix and .prizm suffix
  source_path=$(echo "$prizm_file" | sed 's|^\.prizm-docs/||' | sed 's|\.prizm$||')

  if [ ! -d "$source_path" ]; then
    echo "ORPHAN_DOC: $prizm_file | source dir missing"
  fi
done

# 6. Find unregistered directories
find . -mindepth 1 -maxdepth 3 -type d \
  ! -path '*/.*' \
  ! -path '*/node_modules/*' ! -path './node_modules' \
  ! -path '*/vendor/*' ! -path './vendor' \
  ! -path '*/dist/*' ! -path './dist' \
  ! -path '*/build/*' ! -path './build' \
  ! -path '*/__pycache__/*' ! -path './__pycache__' \
  ! -path '*/target/*' ! -path './target' \
  ! -path '*/tests/*' ! -path './tests' \
  ! -path '*/__tests__/*' ! -path './__tests__' \
  ! -path '*/.prizm-docs/*' ! -path './.prizm-docs' \
  ! -path '*/.claude/*' ! -path './.claude' \
  ! -path '*/.codebuddy/*' ! -path './.codebuddy' \
  ! -path '*/dev-pipeline/*' ! -path './dev-pipeline' \
  ! -path '*/coverage/*' ! -path './coverage' \
  ! -path '*/.nyc_output/*' ! -path './.nyc_output' \
  ! -path '*/out/*' ! -path './out' \
  ! -path '*/tmp/*' ! -path './tmp' \
  2>/dev/null | while IFS= read -r candidate; do
  # Normalize: remove leading ./
  candidate_clean=$(echo "$candidate" | sed 's|^\./||')

  # Count source files
  file_count=$(count_source_files "$candidate_clean")

  if [ "$file_count" -ge 3 ]; then
    # Check if registered in MODULE_INDEX
    _match=$(echo "$REGISTERED_PATHS" | grep -Fx "$candidate_clean" || true)
    if [ -z "$_match" ]; then
      echo "UNREGISTERED: $candidate_clean | $file_count source files | not in MODULE_INDEX"
    fi
  fi
done

exit 0
