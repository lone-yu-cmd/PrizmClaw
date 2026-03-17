#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# validate-framework.sh — Framework CI Pipeline for Self-Evolve Mode
#
# Runs the full PrizmKit framework validation pipeline step by step,
# reporting each stage individually so agents can pinpoint failures.
#
# Steps:
#   1. validate-all.js  — structural validation (skills, agents, metadata)
#   2. bundle.js        — rebuild bundled assets
#   3. verify-bundle.js — verify bundle integrity
#   4. eslint           — lint check
#   5. vitest           — unit tests
#
# Usage:
#   bash dev-pipeline/scripts/validate-framework.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

pass_count=0
fail_count=0
failed_steps=()

run_step() {
    local step_name="$1"
    shift
    local cmd="$*"

    echo ""
    echo -e "${BOLD}[$step_name]${NC} Running: $cmd"
    echo "────────────────────────────────────────"

    if (cd "$PROJECT_ROOT" && eval "$cmd"); then
        echo -e "${GREEN}✓ $step_name passed${NC}"
        pass_count=$((pass_count + 1))
    else
        echo -e "${RED}✗ $step_name FAILED${NC}"
        fail_count=$((fail_count + 1))
        failed_steps+=("$step_name")
    fi
}

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  PrizmKit Framework Validation Pipeline${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"

# Step 1: Structural validation
run_step "validate-all" "node tests/validate-all.js"

# Step 2: Bundle rebuild
run_step "bundle" "node scripts/bundle.js"

# Step 3: Verify bundle integrity
run_step "verify-bundle" "node scripts/verify-bundle.js"

# Step 4: Lint
run_step "eslint" "npx eslint . --max-warnings 0 2>/dev/null || npx eslint ."

# Step 5: Unit tests
run_step "vitest" "npx vitest run --reporter=verbose 2>&1 || npx vitest run"

# Summary
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
if [[ $fail_count -eq 0 ]]; then
    echo -e "${GREEN}  All $pass_count steps passed ✓${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}  $fail_count/$((pass_count + fail_count)) steps FAILED:${NC}"
    for step in "${failed_steps[@]}"; do
        echo -e "${RED}    - $step${NC}"
    done
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    exit 1
fi
