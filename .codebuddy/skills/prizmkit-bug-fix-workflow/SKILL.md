---
name: prizmkit-bug-fix-workflow
tier: 1
description: "[Tier 1] End-to-end bug fix workflow: triage → reproduce → fix → verify → commit. Orchestrates existing skills into a closed-loop 5-phase pipeline with standardized input/output artifacts. (project)"
---

# PrizmKit Bug Fix Workflow

End-to-end orchestration skill for bug fixes. Chains existing PrizmKit skills (error-triage, bug-reproducer, implement, code-review, committer) into a closed-loop 5-phase pipeline with standardized artifacts.

## Overview

```
bug-planner → bug-fix-list.json → Bug Fix Pipeline → fix-plan.md + fix-report.md
  (plan)         (input)             (5 phases)         (2 artifacts per bug)
```

### Pipeline Phases

| Phase | Name | Skill Used | Artifact |
|-------|------|-----------|----------|
| 1 | Triage 分诊 | `prizmkit.error-triage` | → `fix-plan.md` |
| 2 | Reproduce 复现 | `prizmkit.bug-reproduce` | (reproduction test) |
| 3 | Fix 修复 | `prizmkit.implement` | (code changes) |
| 4 | Verify 验证 | `prizmkit.code-review` | (review report) |
| 5 | Commit & Learn | `prizmkit.committer` | → `fix-report.md` |

### Artifacts — Fixed at 2, NEVER more

Each bug produces exactly **2 artifact documents**:

1. **`fix-plan.md`** — Generated after Phase 1 Triage. Contains root cause analysis, impact assessment, test strategy, and fix approach.
2. **`fix-report.md`** — Generated after Phase 5 Commit. Contains fix details, verification results, knowledge captured, and acceptance criteria verification.

Artifacts are stored at: `.prizmkit/bugfix/<BUG_ID>/`

## Commands

### prizmkit.bug-fix \<bug-description-or-error\>

Execute the full bug fix pipeline for a single bug.

**INPUT FORMATS** (any of the following):
- Natural language bug description
- Stack trace / error log
- Failed test case output
- User reproduction steps
- Reference to a `bug-fix-list.json` entry

### prizmkit.bug-fix-batch \<bug-fix-list.json\>

Execute the bug fix pipeline for all pending bugs in a standardized `bug-fix-list.json` file.

- Processes bugs in priority order (lower priority number = processed first)
- Skips bugs with status ≠ `pending`
- Updates status in `bug-fix-list.json` as each bug progresses through phases

---

## Phase 1: Triage — 分诊分类

**Goal**: Classify the bug, identify scope and severity, check known issues, produce `fix-plan.md`.

**STEPS:**

1. **Parse bug input**: Extract:
   - Error message / stack trace (if provided)
   - Expected vs actual behavior
   - Steps to reproduce (if provided)
   - Environment details (OS, runtime, browser)
   - Affected feature / module (if identifiable)

2. **Invoke `prizmkit.error-triage`**:
   - Receive: error category, subcategory, root cause analysis, affected files
   - Receive: severity rating (CRITICAL / HIGH / MEDIUM / LOW)

3. **Check TRAPS for known issues**:
   - Read `.prizm-docs/` TRAPS sections for identified modules
   - If matching trap found:
     - Set `KNOWN_ISSUE=true`, `SKIP_REPRODUCE=true`
     - Include documented solution in fix-plan.md
     - Jump to Phase 3

4. **Generate `fix-plan.md`** at `.prizmkit/bugfix/<BUG_ID>/fix-plan.md`:

   Required sections:
   - **Bug Summary**: ID, title, severity, source type, affected feature
   - **Root Cause Analysis**: error classification, root cause, call chain, TRAP match status
   - **Impact Assessment**: directly affected files (with impact level), potentially affected modules (with risk level), cross-module impact notes
   - **Test Strategy**: verification type, reproduction test design, regression test plan, manual verification steps (if verification_type=manual/hybrid)
   - **Fix Approach**: proposed fix, fix scope (estimated lines changed), constraints

**CHECKPOINT CP-BF-1**: `fix-plan.md` exists.

**DECISION GATE — Fast Path**:
- If severity ∈ {low, medium} AND root cause confidence is HIGH AND estimated change < 10 lines:
  → Skip Phase 2, go directly to Phase 3
- Otherwise → proceed to Phase 2

---

## Phase 2: Reproduce — 复现确认

**Goal**: Create an automated reproduction that proves the bug exists.

**STEPS:**

1. **Invoke `prizmkit.bug-reproduce`** with triage results and bug description

2. **Receive and execute reproduction**:
   - Run the generated reproduction test
   - Verify it FAILS (proving the bug exists)

3. **Handle reproduction result**:
   - **Success** (test fails as expected): record as regression baseline, proceed to Phase 3
   - **Failure** (cannot reproduce): refine and retry, **max 2 rounds**
   - **After 2 failed rounds**: set status to `needs_info`, output questions for reporter, STOP

**CHECKPOINT CP-BF-2**: Reproduction test exists and FAILS.

**KEY RULES:**
- Reproduction test MUST be automated
- MUST fail with current code and pass after fix
- Use project's existing test framework and conventions
- Naming convention: `test_bugfix_<short-description>.<ext>`

---

## Phase 3: Fix — 修复实现

**Goal**: Implement the fix using TDD — reproduction test goes red → green.

**STEPS:**

1. **Read context**: fix-plan.md, reproduction test, `.prizm-docs/` (TRAPS, RULES, PATTERNS)

2. **Plan fix** (lightweight, inline — NO spec/plan/tasks files):
   - Identify exact code location(s) to modify
   - Determine minimal fix approach
   - Assess regression risk

3. **Implement fix** via `prizmkit.implement` in TDD mode:
   - Reproduction test is the "red test"
   - Implement minimal code change to make it pass
   - Ensure all existing tests still pass

4. **Local verification**:
   - Reproduction test → MUST PASS (green)
   - Module test suite → MUST PASS (no regression)

**CHECKPOINT CP-BF-3**: Reproduction test passes, module tests pass.

**FIX LOOP**: Max 3 rounds. If still failing → escalate to user.

**KEY RULES:**
- Do NOT create `.prizmkit/specs/` directories
- Do NOT create spec.md, plan.md, or tasks.md
- Fix MUST be minimal and targeted — no scope creep
- If fix requires architectural changes → STOP, recommend creating a Feature instead

---

## Phase 4: Verify — 代码审查与回归验证

**Goal**: Ensure fix correctness and zero regressions.

**STEPS:**

1. **Invoke `prizmkit.code-review`** (scoped to changed files only):
   - Review dimensions for bug fix:
     - **Fix correctness**: Does it address the root cause?
     - **Regression safety**: Does it break existing behavior?
     - **Code quality**: Is the fix clean and maintainable?
     - **Test coverage**: Is the reproduction test adequate?
   - Verdict: PASS / PASS_WITH_WARNINGS / NEEDS_FIXES

2. **Run full test suite**: All tests MUST pass

3. **Handle review results**:
   - PASS / PASS_WITH_WARNINGS → proceed to Phase 5
   - NEEDS_FIXES → return to Phase 3 (max 2 review rounds)

**CHECKPOINT CP-BF-4**: Code review passes, all tests green.

**MANUAL VERIFICATION GATE** (when verification_type=manual or hybrid):
- Pipeline PAUSES after automated review passes
- Output UAT checklist from fix-plan.md
- Set status to `verifying`, wait for user confirmation
- Resume to Phase 5 after user sign-off

---

## Phase 5: Commit & Learn — 提交与知识积累

**Goal**: Commit with proper conventions, capture lessons, generate `fix-report.md`.

**STEPS:**

1. **Invoke `prizmkit.committer`**:
   - Commit message: `fix(<scope>): <description>`
   - Include fix code + reproduction test
   - Do NOT run `prizmkit.summarize` (no REGISTRY.md entry)
   - Do NOT push

2. **Update TRAPS** (if new pitfall discovered):
   - Append to affected module's TRAPS section in `.prizm-docs/`
   - Format: `- TRAP: <description> | FIX: <solution> | DATE: YYYY-MM-DD`
   - If no new pitfall: skip

3. **Generate `fix-report.md`** at `.prizmkit/bugfix/<BUG_ID>/fix-report.md`:

   Required sections:
   - **Bug Resolution Summary**: ID, title, status (✅ FIXED), phases completed, duration
   - **What Was Fixed**: changes made (file, change type, description), diff summary, commit message
   - **Verification Results**: reproduction test before/after, regression test results, review verdict
   - **Knowledge Captured**: TRAPS updated (yes/no with details), prevention recommendation
   - **Acceptance Criteria Verification**: checklist with pass/fail for each criterion

   Additional sections (when verification_type=manual or hybrid):
   - **Manual Verification Results**: UAT checklist results, sign-off status, reviewer, date

**CHECKPOINT CP-BF-5**: Commit recorded, fix-report.md written.

---

## Fast Path — 快速修复路径

For LOW/MEDIUM severity bugs with obvious root cause and high confidence:

```
Phase 1 (Triage) → Phase 3 (Fix) → Phase 5 (Commit)
```

Skip Phase 2 (Reproduce) and Phase 4 (full Review).
- Still write a basic test for the fix
- Still use `fix(<scope>):` commit convention
- Still update TRAPS if applicable
- Still generate both fix-plan.md and fix-report.md

**CRITERIA**:
- Triage confidence is HIGH
- Root cause is a single, obvious code error
- Fix is less than 10 lines of code changes
- No cross-module impact

---

## Status Mapping

`bug-fix-list.json` status values map to pipeline phases:

| Phase | Entry Status | In-Progress | Success Exit | Failure Exit |
|-------|-------------|-------------|-------------|-------------|
| Phase 1: Triage | `pending` | `triaging` | → `reproducing` | → `failed` |
| Phase 2: Reproduce | `reproducing` | `reproducing` | → `fixing` | → `needs_info` |
| Phase 3: Fix | `fixing` | `fixing` | → `verifying` | → `failed` (3 rounds) |
| Phase 4: Verify | `verifying` | `verifying` | → Phase 5 | → `fixing` (return) |
| Phase 5: Commit | — | — | → `completed` | → `failed` |

---

## Knowledge Accumulation Mechanism

### Automatic TRAPS Update

After each successful bug fix (Phase 5):
- If new pitfall discovered (not previously in TRAPS):
  → Append to `.prizm-docs/<affected-module>.prizm` TRAPS section
- If `affected_feature` is set:
  → Cross-reference original Feature ID in TRAPS entry

### Bug Pattern Analysis (optional, manual trigger)

When `.prizmkit/bugfix/` accumulates 5+ completed bugs:
- Analyze `error_source.type` distribution
- Analyze `severity` distribution trends
- Analyze `affected_modules` frequency (identify fragile modules)
- Output recommendations for preventive refactoring

### Feature Quality Tracking

When `affected_feature` is non-empty:
- If same Feature accumulates 3+ bugs → flag as "needs-revisit"

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Cannot parse bug description | Ask user for clarification |
| Triage returns LOW confidence | Proceed with warning |
| Cannot reproduce after 2 rounds | STOP, set `needs_info`, request more info |
| Fix fails after 3 rounds | Escalate to user with analysis |
| Review fails after 2 rounds | Escalate with review findings |
| Full test suite has pre-existing failures | Warn user, isolate bug fix tests |
| Fix requires architectural change | STOP, recommend Feature instead |
| verification_type=manual and no user response | Keep status `verifying`, wait |

---

## Relationship to Other Skills

| Skill | Role in Bug Fix Workflow |
|-------|------------------------|
| `prizmkit-error-triage` | Phase 1: error classification and root cause analysis |
| `prizmkit-bug-reproducer` | Phase 2: generate minimal reproduction |
| `prizmkit-implement` | Phase 3: TDD-style fix implementation |
| `prizmkit-code-review` | Phase 4: review fix correctness |
| `prizmkit-committer` | Phase 5: commit with `fix()` convention |
| `prizmkit-log-analyzer` | Optional: analyze logs if bug includes log files |
| `bug-planner` | Pre-pipeline: generate standardized `bug-fix-list.json` |
| `prizmkit-retrospective` | NOT used (bug fixes don't get retrospectives) |
| `prizmkit-summarize` | NOT used (no REGISTRY entries for bugs) |
| `prizmkit-specify` | NOT used (no spec.md for bugs) |
| `prizmkit-plan` | NOT used (no plan.md for bugs) |
| `prizmkit-tasks` | NOT used (no tasks.md for bugs) |

---

## Comparison with Feature Pipeline

| Dimension | Feature Pipeline | Bug Fix Pipeline |
|-----------|-----------------|-----------------|
| Input Skill | `app-planner` (7-phase interactive) | `bug-planner` (multi-format parser) |
| Input File | `feature-list.json` (F-NNN) | `bug-fix-list.json` (B-NNN) |
| Schema Version | `dev-pipeline-feature-list-v1` | `dev-pipeline-bug-fix-list-v1` |
| Pipeline Phases | 10 Phase (0-7 + init + cleanup) | 5 Phase (Fast Path: 3) |
| Artifact Docs | 3: spec.md + plan.md + tasks.md | 2: fix-plan.md + fix-report.md |
| Artifact Path | `.prizmkit/specs/<feature-slug>/` | `.prizmkit/bugfix/<bug-id>/` |
| Prompt Template | `bootstrap-prompt.md` | `bugfix-bootstrap-prompt.md` |
| Skills Chain | specify → plan → tasks → implement → review → summarize → commit | error-triage → bug-reproduce → implement → code-review → commit |
| Commit Prefix | `feat(<scope>):` | `fix(<scope>):` |
| REGISTRY Update | ✅ via summarize | ❌ not applicable |
| TRAPS Update | Only in retrospective | ✅ automatic after every fix |
| Manual Verification | None | Supported (verification_type=manual/hybrid) |
| Agent Roles | PM → Dev → Reviewer → Doc | Dev → Reviewer (streamlined) |

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- `fix-plan.md` (Phase 1 artifact)
- Reproduction test file (Phase 2)
- Fix implementation (Phase 3)
- Code review report (Phase 4, conversation only)
- `fix-report.md` (Phase 5 artifact)
- Git commit with `fix(<scope>):` prefix (Phase 5)
- Updated `.prizm-docs/` TRAPS (if applicable)
