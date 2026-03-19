---
name: refactor-workflow
tier: 1
description: "End-to-end refactor workflow: analyze → plan → implement → review → commit. 5-phase behavior-preserving pipeline with mandatory test gates. Use this skill whenever the user wants to restructure, clean up, or optimize code without changing behavior. Trigger on: 'refactor', 'clean up code', 'restructure', 'optimize code structure', 'extract module', '重构', '优化代码结构', '代码重构'. (project)"
---

# PrizmKit Refactor Workflow

End-to-end orchestration skill for code refactoring and optimization. Chains existing PrizmKit skills into a 5-phase behavior-preserving pipeline with mandatory test gates after each task.

### When to Use
- User says "refactor", "clean up code", "restructure", "extract module", "重构", "优化代码结构"
- Code has accumulated tech debt that needs structural improvement
- Module needs to be split, merged, or reorganized
- When behavior must remain unchanged but internal quality needs improvement

**Do NOT use when:**
- User wants to add new features (use `feature-workflow`)
- User wants to fix bugs (use `bug-planner` + `bugfix-pipeline-launcher`)
- Change is trivial (single rename, <5 lines) — just do it directly

## Overview

```
refactor-workflow
  → Phase 1: Analyze   → refactor-analysis.md
  → Phase 2: Plan      → plan.md (including Tasks section)
  → Phase 3: Implement → (code)
  → Phase 4: Review    → (review report)
  → Phase 5: Commit    → git commit
```

### Pipeline Phases

| Phase | Name | Skill Used | Artifact |
|-------|------|-----------|----------|
| 1 | Analyze 代码分析 | Built-in code analysis + code reading | → `refactor-analysis.md` |
| 2 | Plan 重构方案与任务 | `/prizmkit-plan` | → `plan.md` (含 Tasks section) |
| 3 | Implement 实现 | `/prizmkit-implement` | (code changes) |
| 4 | Code Review | `/prizmkit-code-review` | (review report) |
| 5 | Commit | `/prizmkit-committer` | git commit |

### Key Principles

| Principle | Description |
|-----------|-------------|
| **Behavior preservation** | Refactoring changes structure, not behavior. If tests pass before and after, behavior is preserved. Acceptance criteria = "behavior unchanged + structure improved". |
| **Test gates** | Full test suite runs after every task — not just at checkpoints. A refactoring that breaks tests mid-way is much harder to debug than catching it immediately. |
| **Structural sync only** | Refactoring triggers `/prizmkit-retrospective` Job 1 (structural sync) — update `.prizm-docs/` to reflect file/interface changes. Skip knowledge injection unless a genuinely new pitfall was discovered during refactoring. |
| **Incremental safety** | Each task preserves all tests (green → green). If tests fail → stop and revert, because later tasks build on the assumption that previous ones are clean. |

### Artifacts
Refactor artifacts stored at `.prizmkit/refactor/<refactor-slug>/`:
- **`refactor-analysis.md`** — Code analysis (Phase 1)
- **`plan.md`** — Refactoring plan with Tasks section (Phase 2)

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
2. **Perform code analysis** on target area:
   - Identify code smells: long functions, deep nesting, duplicated logic, excessive coupling
   - Assess complexity metrics: function length, parameter count, cyclomatic complexity
   - Identify highest-impact refactoring opportunities
   - Check for TODO/FIXME/HACK comments indicating known debt
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

## Phase 2: Plan — 重构方案与任务

**Goal**: Generate technical refactoring plan that preserves behavior, including task breakdown.

**STEPS:**

1. **Read context**: refactor-analysis.md, `.prizm-docs/` (PATTERNS, RULES, TRAPS)
2. **Invoke `/prizmkit-plan`** with refactor-analysis.md as input (in place of spec.md):
   - Plan specifies: what changes, what stays the same, how behavior is preserved
   - plan.md Tasks section: each task is independently testable and preserves all tests (green → green) — this ensures any failure is immediately traceable to the task that caused it
   - Artifact path: `.prizmkit/refactor/<refactor-slug>/plan.md`
3. **Verify plan constraints**:
   - All public API contracts preserved
   - Test strategy: how to verify behavior unchanged at each step
   - Rollback strategy: how to revert if behavior breaks
   - Tasks ordered to minimize risk (safe renames first, structural changes later)
   - Every task ends with "run full test suite"

**CHECKPOINT CP-RW-2**: `plan.md` exists with behavior preservation strategy and Tasks section.

---

## Phase 3: Implement — 实现

**Goal**: Execute refactoring tasks with mandatory test verification after each task.

**STEPS:**

1. **For EACH task in plan.md Tasks section**:
   a. Implement the refactoring change
   b. **Run FULL test suite** (not just affected tests) — refactoring can have surprising cross-module effects that targeted tests miss
   c. Verify: all previously-passing tests still pass
   d. If any test fails → stop, revert task, investigate
2. **Progress tracking**:
   - Mark tasks complete in plan.md Tasks section as they finish
   - Record test results after each task

**CHECKPOINT CP-RW-3**: All tasks complete, full test suite green.

**Important constraints for Phase 3:**
- Never skip the test gate between tasks — a broken intermediate state compounds into much harder debugging later
- Never allow temporary test failures ("we'll fix it in the next task") — this assumption is almost always wrong in refactoring
- If a task cannot be completed without breaking tests → split it into smaller tasks
- Max 3 attempts per task before escalating to user

---

## Phase 4: Code Review — 代码审查

**Goal**: Verify refactoring quality and behavior preservation.

**STEPS:**

1. **Invoke `/prizmkit-code-review`** (scoped to changed files):
   - Review dimensions for refactoring:
     - **Behavior preservation**: Does observable behavior remain identical?
     - **Structural improvement**: Is the code measurably better? (complexity, coupling, readability)
     - **Test integrity**: Are all tests still meaningful and passing?
     - **Code quality**: Does refactored code follow project conventions?
   - Verdict: PASS / PASS_WITH_WARNINGS / NEEDS_FIXES
2. **Run full test suite one final time**: All tests must pass
3. **Handle review results**:
   - **PASS / PASS_WITH_WARNINGS**: Proceed to Phase 5
   - **NEEDS_FIXES**: Return to Phase 3 (max 2 review rounds)

**CHECKPOINT CP-RW-4**: Code review passes, all tests green.

---

## Phase 5: Commit — 提交

**Goal**: Commit with refactor convention.

**STEPS:**

1. **Invoke `/prizmkit-retrospective`** (Job 1: structural sync only):
   - Update KEY_FILES/INTERFACES/DEPENDENCIES in affected `.prizm-docs/` files
   - Skip knowledge injection unless refactoring revealed a genuinely new pitfall (e.g. a non-obvious coupling)
   - If structural changes are significant (module split/merge), update L1 doc
   - Stage doc changes: `git add .prizm-docs/`
2. **Invoke `/prizmkit-committer`**:
   - Commit message: `refactor(<scope>): <description>`
   - Include all refactored code + any test updates
   - Do NOT push

**CHECKPOINT CP-RW-5**: Commit recorded with `refactor()` prefix.

---

## Fast Path — 快速路径

For single-file refactoring (rename, extract method, <30 lines changed):

```
Phase 1 (Analyze) → Phase 2 (Simplified Plan) → Phase 3 (Implement) → Phase 4 (Review) → Phase 5 (Commit)
```

Skip Phase 2's detailed planning process, but still generate a lightweight `plan.md` with a simplified Tasks section (typically 1-2 tasks).

**CRITERIA** (ALL must be true):
- Single file change
- Estimated change < 30 lines
- Well-known refactoring pattern (rename, extract method/class, inline, move)
- No cross-module impact
- No dependency changes

**Fast Path implementation differs from full path:**
- Phase 2 is simplified: generate a lightweight plan.md with 1-2 tasks directly from refactor-analysis.md, without deep architecture research
- Phase 3 still reads plan.md Tasks as normal, marks tasks `[x]` on completion
- Single-task refactors typically have just one task in plan.md

**Fast Path still requires:**
- refactor-analysis.md (lightweight version with baseline)
- plan.md (simplified, 1-2 tasks)
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
| `refactor-analysis.md` + `plan.md` | Phase 3: Implement |
| All docs + code changes exist | Phase 4: Review |
| All docs + review passed | Phase 5: Commit |

**Resume**: If `<slug>` matches an existing `.prizmkit/refactor/<slug>/` directory, resume instead of starting fresh.

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Cannot identify target module | Ask user for clarification |
| No tests exist for target module | WARN user, recommend writing tests first |
| Baseline tests already failing | Isolate failures, document, proceed with caution |
| Test fails after a refactoring task | Revert task, investigate, retry or split |
| Implementation fails after 3 rounds | Escalate to user with analysis |
| Review fails after 2 rounds | Escalate with review findings |
| Refactoring creates circular dependency | STOP, revise plan |
| Performance regression detected | STOP, investigate, revise approach |

---

## Relationship to Other Skills

| Skill | Role in Refactor Workflow |
|-------|--------------------------|
| (built-in code analysis) | Phase 1: identify debt and complexity |
| `/prizmkit-plan` | Phase 2: refactoring plan + task generation |
| `/prizmkit-implement` | Phase 3: execute refactoring tasks |
| `/prizmkit-code-review` | Phase 4: review quality and behavior preservation |
| `/prizmkit-committer` | Phase 5: commit with `refactor()` convention |
| `/prizmkit-retrospective` | Phase 5: structural sync before commit (Job 1 only, skip knowledge injection unless new pitfall) |
| `feature-workflow` | Handoff target when new behavior is needed |
| `/prizmkit-specify` | NOT used (no user stories for refactoring) |
| `/prizmkit-analyze` | NOT used (no spec ↔ plan consistency needed) |

---

## Comparison with Feature and Bug Fix Pipelines

| Dimension | Feature Workflow | Refactor Workflow | Bug Fix Pipeline |
|-----------|-----------------|-------------------|------------------|
| Input | Natural language requirement | Module/code target | Bug description |
| Pipeline Phases | 6 (Fast: 4) | 5 (Fast: 3) | 5 (Fast: 3) |
| Phase 1 | Specify (spec.md) | Analyze (refactor-analysis.md) | Triage (fix-plan.md) |
| Artifact Path | `.prizmkit/specs/<slug>/` | `.prizmkit/refactor/<slug>/` | `.prizmkit/bugfix/<id>/` |
| Commit Prefix | `feat(<scope>):` | `refactor(<scope>):` | `fix(<scope>):` |
| REGISTRY Update | ✅ | ❌ | ❌ |
| Test Strategy | TDD per task | Full suite after EVERY task | Reproduction test |
| Scope Guard | N/A | ✅ (enforced) | N/A |
| Behavior Change | ✅ Expected | ❌ Forbidden | ✅ Fix behavior |

## Output

- `refactor-analysis.md` (Phase 1 artifact)
- `plan.md` with Tasks section (Phase 2 artifact)
- Refactored implementation code (Phase 3)
- Code review report (Phase 4, conversation only)
- Git commit with `refactor(<scope>):` prefix (Phase 5)
- Updated `.prizm-docs/` (if applicable)
