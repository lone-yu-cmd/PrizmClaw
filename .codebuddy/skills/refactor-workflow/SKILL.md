---
name: refactor-workflow
tier: 1
description: "[Tier 1] End-to-end refactor workflow: analyze → plan → tasks → implement → review → commit. 6-phase behavior-preserving pipeline with scope guard and mandatory test gates. (project)"
---

# PrizmKit Refactor Workflow

End-to-end orchestration skill for code refactoring and optimization. Chains existing PrizmKit skills (tech-debt-tracker, plan, tasks, implement, code-review, committer) into a 6-phase behavior-preserving pipeline with scope guard enforcement.

## Overview

```
prizmkit.refactor <目标模块或描述>
  → Phase 1: Analyze   → refactor-analysis.md
  → Phase 2: Plan      → plan.md
  → Phase 3: Tasks     → tasks.md
  → Phase 4: Implement → (code)
  → Phase 5: Review    → (review report)
  → Phase 6: Commit    → git commit
```

### Pipeline Phases

| Phase | Name | Skill Used | Artifact |
|-------|------|-----------|----------|
| 1 | Analyze 代码分析 | `prizmkit.tech-debt-tracker` + code reading | → `refactor-analysis.md` |
| 2 | Plan 重构方案 | `prizmkit.plan` | → `plan.md` |
| 3 | Tasks 任务拆解 | `prizmkit.tasks` | → `tasks.md` |
| 4 | Implement 实现 | `prizmkit.implement` | (code changes) |
| 5 | Code Review | `prizmkit.code-review` | (review report) |
| 6 | Commit | `prizmkit.committer` | git commit |

### Key Principles

- **Behavior preservation**: Refactoring MUST NOT change observable behavior
- **Acceptance criteria** = "behavior unchanged + structure improved"
- **No REGISTRY entry**: Refactoring does not go into REGISTRY.md
- **No spec.md**: Refactoring has no user stories
- **Mandatory test gates**: Full test suite after every task, not just checkpoints
- **Scope guard**: New behavior detected → STOP and suggest feature-workflow

### Artifacts

Refactor artifacts stored at `.prizmkit/refactor/<refactor-slug>/`:
- **`refactor-analysis.md`** — Code analysis (Phase 1)
- **`plan.md`** — Refactoring plan (Phase 2)
- **`tasks.md`** — Task breakdown (Phase 3)

## Commands

### prizmkit.refactor \<目标模块或描述\>

Execute the full refactor pipeline for a module or code area.

**INPUT**: Target description. Can be:
- Module or file path (e.g., "src/auth/")
- Natural language description (e.g., "重构认证模块，提取公共逻辑")
- Specific refactoring goal (e.g., "extract payment processing into separate service")

---

## Phase 1: Analyze — 代码分析

**Goal**: Assess current code state, identify refactoring targets, establish baseline.

**STEPS:**

1. **Read target code**: Thoroughly read and understand the target module/files:
   - Code structure and architecture
   - Dependencies (incoming and outgoing)
   - Current test coverage
   - Known tech debt (from `.prizm-docs/` TRAPS)

2. **Invoke `prizmkit.tech-debt-tracker`** on target area:
   - Receive: debt items, complexity metrics, code smell patterns
   - Identify highest-impact refactoring opportunities

3. **Establish baseline**:
   - Run full test suite — record pass/fail counts
   - Note any pre-existing test failures (isolate from refactor impact)
   - Document current behavior contracts (public API, interfaces)

4. **Generate `refactor-analysis.md`** at `.prizmkit/refactor/<refactor-slug>/refactor-analysis.md`:

   Required sections:
   - **Current State**: module overview, file inventory, dependency graph, complexity metrics
   - **Refactoring Goals**: what structural improvements are targeted, why (debt items, complexity, maintainability)
   - **Risk Assessment**: what could break, cross-module impact, data migration needs
   - **Baseline Tests**: test suite status (total, passing, failing), coverage estimate, behavior contracts to preserve
   - **Scope Boundary**: what IS in scope, what is explicitly OUT of scope

**CHECKPOINT CP-RW-1**: `refactor-analysis.md` exists with baseline test results.

---

## Phase 2: Plan — 重构方案

**Goal**: Generate technical refactoring plan that preserves behavior.

**STEPS:**

1. **Read context**: refactor-analysis.md, `.prizm-docs/` (PATTERNS, RULES, TRAPS)

2. **Invoke `prizmkit.plan`** with refactor-analysis.md as input (in place of spec.md):
   - Plan MUST specify: what changes, what stays the same, how behavior is preserved
   - Artifact path: `.prizmkit/refactor/<refactor-slug>/plan.md`

3. **Verify plan constraints**:
   - No new user-facing behavior (scope guard)
   - All public API contracts preserved
   - Test strategy: how to verify behavior unchanged at each step
   - Rollback strategy: how to revert if behavior breaks

**CHECKPOINT CP-RW-2**: `plan.md` exists with behavior preservation strategy.

---

## Phase 3: Tasks — 任务拆解

**Goal**: Break refactoring plan into safe, atomic, testable tasks.

**STEPS:**

1. **Invoke `prizmkit.tasks`** with plan.md:
   - Each task MUST be independently testable
   - Each task MUST preserve all tests (green → green)
   - Artifact path: `.prizmkit/refactor/<refactor-slug>/tasks.md`

2. **Verify task safety**:
   - Every task ends with "run full test suite"
   - No task introduces temporary test failures
   - Tasks are ordered to minimize risk (safe renames first, structural changes later)

**CHECKPOINT CP-RW-3**: `tasks.md` exists with test gates on every task.

---

## Phase 4: Implement — 实现

**Goal**: Execute refactoring tasks with mandatory test verification after each task.

**STEPS:**

1. **For EACH task in tasks.md**:
   a. Implement the refactoring change
   b. **Run FULL test suite** (not just affected tests)
   c. Verify: all previously-passing tests still pass
   d. If any test fails → STOP, revert task, investigate

2. **Scope Guard** (checked after each task):
   - If implementation reveals need for new behavior → **STOP**
   - Output: "Scope guard triggered: <description of new behavior needed>"
   - Recommend: "Switch to `prizmkit.feature` for this change"
   - Do NOT proceed with behavior changes in refactor pipeline

3. **Progress tracking**:
   - Mark tasks complete in tasks.md as they finish
   - Record test results after each task

**CHECKPOINT CP-RW-4**: All tasks complete, full test suite green.

**KEY RULES:**
- NEVER skip the test gate between tasks
- NEVER allow temporary test failures ("we'll fix it in the next task")
- If a task cannot be completed without breaking tests → split it into smaller tasks
- Max 3 attempts per task before escalating to user

---

## Phase 5: Code Review — 代码审查

**Goal**: Verify refactoring quality and behavior preservation.

**STEPS:**

1. **Invoke `prizmkit.code-review`** (scoped to changed files):
   - Review dimensions for refactoring:
     - **Behavior preservation**: Does observable behavior remain identical?
     - **Structural improvement**: Is the code measurably better? (complexity, coupling, readability)
     - **Test integrity**: Are all tests still meaningful and passing?
     - **Code quality**: Does refactored code follow project conventions?
   - Verdict: PASS / PASS_WITH_WARNINGS / NEEDS_FIXES

2. **Run full test suite one final time**: All tests MUST pass

3. **Handle review results**:
   - **PASS / PASS_WITH_WARNINGS**: Proceed to Phase 6
   - **NEEDS_FIXES**: Return to Phase 4 (max 2 review rounds)

**CHECKPOINT CP-RW-5**: Code review passes, all tests green.

---

## Phase 6: Commit — 提交

**Goal**: Commit with refactor convention.

**STEPS:**

1. **Invoke `prizmkit.committer`**:
   - Commit message: `refactor(<scope>): <description>`
   - Include all refactored code + any test updates
   - Do NOT push
   - Do NOT invoke `prizmkit.summarize` (no REGISTRY entry for refactoring)

2. **Update `.prizm-docs/`** if needed:
   - Updated module structure documentation
   - New PATTERNS discovered
   - Resolved TRAPS (remove if debt is paid)

**CHECKPOINT CP-RW-6**: Commit recorded with `refactor()` prefix.

---

## Fast Path — 快速路径

For single-file refactoring (rename, extract method, <30 lines changed):

```
Phase 1 (Analyze) → Phase 4 (Implement) → Phase 5 (Review) → Phase 6 (Commit)
```

Skip Phase 2 (Plan) and Phase 3 (Tasks).

**CRITERIA** (ALL must be true):
- Single file change
- Estimated change < 30 lines
- Well-known refactoring pattern (rename, extract method/class, inline, move)
- No cross-module impact
- No dependency changes

**Fast Path still requires:**
- refactor-analysis.md (lightweight version with baseline)
- Full test suite run after implementation
- Code review
- `refactor(<scope>):` commit convention

---

## Resume — 中断恢复

The pipeline supports resuming from the last completed phase by detecting existing artifacts.

**Detection logic**: Check `.prizmkit/refactor/<slug>/` for:

| Artifact Found | Resume From |
|---------------|------------|
| (nothing) | Phase 1: Analyze |
| `refactor-analysis.md` only | Phase 2: Plan |
| `refactor-analysis.md` + `plan.md` | Phase 3: Tasks |
| All 3 docs | Phase 4: Implement |
| All 3 docs + code changes exist | Phase 5: Review |
| All 3 docs + review passed | Phase 6: Commit |

**Resume command**: `prizmkit.refactor <slug>` — if `<slug>` matches an existing `.prizmkit/refactor/<slug>/` directory, resume instead of starting fresh.

---

## Scope Guard — 范围守卫

The scope guard is a critical safety mechanism that prevents behavior changes from sneaking into refactoring.

**Triggers:**
- New public API method or endpoint added
- New user-facing feature or UI element
- Changed return values or response formats
- New configuration options
- Modified business logic (not just restructured)

**When triggered:**
1. STOP current task immediately
2. Output clear message: "⚠️ Scope Guard: This change introduces new behavior"
3. Describe what new behavior was detected
4. Recommend: "Create a feature request and use `prizmkit.feature` instead"
5. Offer to continue refactoring WITHOUT the behavior change

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Cannot identify target module | Ask user for clarification |
| No tests exist for target module | WARN user, recommend writing tests first |
| Baseline tests already failing | Isolate failures, document, proceed with caution |
| Test fails after a refactoring task | Revert task, investigate, retry or split |
| Scope guard triggered | STOP, recommend feature-workflow |
| Implementation fails after 3 rounds | Escalate to user with analysis |
| Review fails after 2 rounds | Escalate with review findings |
| Refactoring creates circular dependency | STOP, revise plan |
| Performance regression detected | STOP, investigate, revise approach |

---

## Relationship to Other Skills

| Skill | Role in Refactor Workflow |
|-------|--------------------------|
| `prizmkit-tech-debt-tracker` | Phase 1: identify debt and complexity |
| `prizmkit-plan` | Phase 2: refactoring plan generation |
| `prizmkit-tasks` | Phase 3: task breakdown |
| `prizmkit-implement` | Phase 4: execute refactoring tasks |
| `prizmkit-code-review` | Phase 5: review quality and behavior preservation |
| `prizmkit-committer` | Phase 6: commit with `refactor()` convention |
| `feature-workflow` | Handoff target when scope guard triggers |
| `prizmkit-specify` | NOT used (no user stories for refactoring) |
| `prizmkit-analyze` | NOT used (no spec ↔ plan consistency needed) |
| `prizmkit-summarize` | NOT used (no REGISTRY entry for refactoring) |
| `prizmkit-retrospective` | Optional: post-refactor lessons learned |

---

## Comparison with Feature and Bug Fix Pipelines

| Dimension | Feature Workflow | Refactor Workflow | Bug Fix Pipeline |
|-----------|-----------------|-------------------|-----------------|
| Input | Requirement description | Module/code target | Bug description |
| Pipeline Phases | 7 (Fast: 5) | 6 (Fast: 4) | 5 (Fast: 3) |
| Phase 1 | Specify (spec.md) | Analyze (refactor-analysis.md) | Triage (fix-plan.md) |
| Artifact Path | `.prizmkit/specs/<slug>/` | `.prizmkit/refactor/<slug>/` | `.prizmkit/bugfix/<id>/` |
| Commit Prefix | `feat(<scope>):` | `refactor(<scope>):` | `fix(<scope>):` |
| REGISTRY Update | ✅ | ❌ | ❌ |
| Test Strategy | TDD per task | Full suite after EVERY task | Reproduction test |
| Scope Guard | N/A | ✅ (enforced) | N/A |
| Behavior Change | ✅ Expected | ❌ Forbidden | ✅ Fix behavior |

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- `refactor-analysis.md` (Phase 1 artifact)
- `plan.md` (Phase 2 artifact)
- `tasks.md` (Phase 3 artifact)
- Refactored implementation code (Phase 4)
- Code review report (Phase 5, conversation only)
- Git commit with `refactor(<scope>):` prefix (Phase 6)
- Updated `.prizm-docs/` (if applicable)
