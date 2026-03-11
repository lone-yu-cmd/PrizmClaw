---
name: feature-workflow
tier: 1
description: "[Tier 1] End-to-end feature workflow: specify → plan → tasks → analyze → implement → review → commit. 7-phase pipeline with resume support and fast path for simple changes. (project)"
---

# PrizmKit Feature Workflow

End-to-end orchestration skill for new features. Chains existing PrizmKit skills (specify, plan, tasks, analyze, implement, code-review, committer, summarize) into a 7-phase pipeline with standardized artifacts and resume support.

## Overview

```
prizmkit.feature <需求描述>
  → Phase 1: Specify   → spec.md
  → Phase 2: Plan      → plan.md
  → Phase 3: Tasks     → tasks.md
  → Phase 4: Analyze   → (consistency report)
  → Phase 5: Implement → (code)
  → Phase 6: Review    → (review report)
  → Phase 7: Commit    → git commit + REGISTRY
```

### Pipeline Phases

| Phase | Name | Skill Used | Artifact |
|-------|------|-----------|----------|
| 1 | Specify 需求规格 | `prizmkit.specify` | → `spec.md` |
| 2 | Plan 技术方案 | `prizmkit.plan` | → `plan.md` |
| 3 | Tasks 任务拆解 | `prizmkit.tasks` | → `tasks.md` |
| 4 | Analyze 一致性检查 | `prizmkit.analyze` | (quality report) |
| 5 | Implement 实现 | `prizmkit.implement` | (code changes) |
| 6 | Code Review | `prizmkit.code-review` | (review report) |
| 7 | Commit & Archive | `prizmkit.committer` + `prizmkit.summarize` | git commit + REGISTRY |

### Artifacts

Standard feature artifacts stored at `.prizmkit/specs/<feature-slug>/`:
- **`spec.md`** — Feature specification (Phase 1)
- **`plan.md`** — Technical implementation plan (Phase 2)
- **`tasks.md`** — Executable task breakdown (Phase 3)

## Commands

### prizmkit.feature \<需求描述\>

Execute the full feature pipeline from natural language description to committed code.

**INPUT**: Natural language feature description. Can be:
- A brief one-liner (e.g., "添加用户头像上传功能")
- A detailed requirement paragraph
- A reference to an existing spec file

---

## Phase 1: Specify — 需求规格

**Goal**: Transform natural language into structured feature specification.

**STEPS:**

1. **Parse feature description**: Extract:
   - Core functionality requested
   - User-facing behavior expectations
   - Implicit constraints and edge cases
   - Affected modules (from `.prizm-docs/`)

2. **Invoke `prizmkit.specify`** with the feature description:
   - Receive structured `spec.md` with user stories, acceptance criteria, scope
   - Artifact path: `.prizmkit/specs/<feature-slug>/spec.md`

3. **Validate spec completeness**:
   - All acceptance criteria are testable
   - Scope boundaries are clear
   - No ambiguous requirements remain

**CHECKPOINT CP-FW-1**: `spec.md` exists and is well-formed.

---

## Phase 2: Plan — 技术方案

**Goal**: Generate technical implementation plan from the specification.

**STEPS:**

1. **Read context**: spec.md, `.prizm-docs/` (PATTERNS, RULES, TRAPS)

2. **Invoke `prizmkit.plan`** with spec.md:
   - Receive `plan.md` with architecture decisions, file changes, dependencies
   - Artifact path: `.prizmkit/specs/<feature-slug>/plan.md`

3. **Verify plan alignment**:
   - Plan addresses all spec acceptance criteria
   - No out-of-scope changes
   - Dependencies are identified

**CHECKPOINT CP-FW-2**: `plan.md` exists and aligns with spec.md.

---

## Phase 3: Tasks — 任务拆解

**Goal**: Break implementation plan into executable, ordered tasks.

**STEPS:**

1. **Invoke `prizmkit.tasks`** with plan.md:
   - Receive `tasks.md` with ordered task list, dependencies, estimated scope
   - Artifact path: `.prizmkit/specs/<feature-slug>/tasks.md`

2. **Verify task coverage**:
   - Every plan item maps to at least one task
   - Tasks include test tasks (not just implementation)
   - Task order respects dependencies

**CHECKPOINT CP-FW-3**: `tasks.md` exists with complete task coverage.

---

## Phase 4: Analyze — 一致性检查

**Goal**: Cross-document consistency analysis before implementation begins.

**STEPS:**

1. **Invoke `prizmkit.analyze`** with spec.md, plan.md, tasks.md:
   - Check spec ↔ plan alignment
   - Check plan ↔ tasks coverage
   - Check for contradictions or gaps
   - Verify naming consistency

2. **Handle analysis results**:
   - **PASS**: Proceed to Phase 5
   - **WARNINGS**: Log warnings, proceed to Phase 5
   - **ERRORS**: Return to the earliest affected phase to fix inconsistencies

**CHECKPOINT CP-FW-4**: Analysis passes (no blocking errors).

---

## Phase 5: Implement — 实现

**Goal**: Execute tasks.md with TDD approach.

**STEPS:**

1. **Invoke `prizmkit.implement`**:
   - Follow tasks.md order
   - TDD: write tests first, then implementation
   - Run tests after each task completion

2. **Progress tracking**:
   - Mark tasks complete in tasks.md as they finish
   - If a task fails after 3 attempts → escalate to user

3. **Local verification**:
   - All new tests pass
   - All existing tests pass (no regression)

**CHECKPOINT CP-FW-5**: All tasks complete, all tests green.

---

## Phase 6: Code Review — 代码审查

**Goal**: Ensure implementation quality and spec compliance.

**STEPS:**

1. **Invoke `prizmkit.code-review`** (scoped to changed files):
   - Review dimensions:
     - **Spec compliance**: Does implementation match all acceptance criteria?
     - **Plan adherence**: Does code follow the technical plan?
     - **Code quality**: Clean, maintainable, follows project conventions?
     - **Test coverage**: Are all acceptance criteria tested?
   - Verdict: PASS / PASS_WITH_WARNINGS / NEEDS_FIXES

2. **Handle review results**:
   - **PASS / PASS_WITH_WARNINGS**: Proceed to Phase 7
   - **NEEDS_FIXES**: Return to Phase 5 (max 2 review rounds)

**CHECKPOINT CP-FW-6**: Code review passes.

---

## Phase 7: Commit & Archive — 提交与归档

**Goal**: Commit with proper conventions, archive to REGISTRY.

**STEPS:**

1. **Invoke `prizmkit.committer`**:
   - Commit message: `feat(<scope>): <description>`
   - Include all implementation code + tests
   - Do NOT push

2. **Invoke `prizmkit.summarize`**:
   - Archive feature to REGISTRY.md
   - Include: feature slug, description, files changed, date

3. **Update `.prizm-docs/`** if needed:
   - New PATTERNS discovered during implementation
   - New TRAPS encountered
   - Updated module documentation

**CHECKPOINT CP-FW-7**: Commit recorded, REGISTRY updated.

---

## Fast Path — 快速路径

For simple features (single file, <50 lines, no cross-module impact):

```
Phase 2 (Plan) → Phase 3 (Tasks) → Phase 5 (Implement) → Phase 6 (Review) → Phase 7 (Commit)
```

Skip Phase 1 (Specify) and Phase 4 (Analyze).

**CRITERIA** (ALL must be true):
- Single file change or tightly scoped to one module
- Estimated change < 50 lines
- No cross-module dependencies or side effects
- No new user-facing API surface
- Clear and unambiguous requirement

**Fast Path still requires:**
- plan.md and tasks.md (lightweight versions)
- Code review
- `feat(<scope>):` commit convention
- REGISTRY update via summarize

---

## Resume — 中断恢复

The pipeline supports resuming from the last completed phase by detecting existing artifacts.

**Detection logic**: Check `.prizmkit/specs/<slug>/` for:

| Artifact Found | Resume From |
|---------------|------------|
| (nothing) | Phase 1: Specify |
| `spec.md` only | Phase 2: Plan |
| `spec.md` + `plan.md` | Phase 3: Tasks |
| `spec.md` + `plan.md` + `tasks.md` | Phase 4: Analyze |
| All 3 docs + analysis passed | Phase 5: Implement |
| All 3 docs + code changes exist | Phase 6: Review |
| All 3 docs + review passed | Phase 7: Commit |

**Resume command**: `prizmkit.feature <slug>` — if `<slug>` matches an existing `.prizmkit/specs/<slug>/` directory, resume instead of starting fresh.

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Cannot parse feature description | Ask user for clarification |
| Spec has ambiguous requirements | Invoke `prizmkit.clarify` before proceeding |
| Plan-spec misalignment detected | Return to Phase 2 with feedback |
| Analyze finds blocking errors | Return to earliest affected phase |
| Implementation fails after 3 rounds | Escalate to user with analysis |
| Review fails after 2 rounds | Escalate with review findings |
| Full test suite has pre-existing failures | Warn user, isolate feature tests |
| Feature requires breaking changes | STOP, recommend ADR via `prizmkit.adr-manager` |

---

## Relationship to Other Skills

| Skill | Role in Feature Workflow |
|-------|------------------------|
| `prizmkit-specify` | Phase 1: structured spec generation |
| `prizmkit-clarify` | Phase 1 fallback: resolve ambiguities |
| `prizmkit-plan` | Phase 2: technical implementation plan |
| `prizmkit-tasks` | Phase 3: task breakdown |
| `prizmkit-analyze` | Phase 4: cross-document consistency |
| `prizmkit-implement` | Phase 5: TDD implementation |
| `prizmkit-code-review` | Phase 6: review and quality gate |
| `prizmkit-committer` | Phase 7: commit with `feat()` convention |
| `prizmkit-summarize` | Phase 7: archive to REGISTRY |
| `prizmkit-retrospective` | Optional: post-feature lessons learned |
| `prizmkit-bug-fix-workflow` | NOT used (separate pipeline for bugs) |
| `refactor-workflow` | NOT used (separate pipeline for refactoring) |
| `app-planner` | Pre-pipeline: interactive feature planning |

---

## Comparison with Refactor and Bug Fix Pipelines

| Dimension | Feature Workflow | Refactor Workflow | Bug Fix Pipeline |
|-----------|-----------------|-------------------|------------------|
| Input | Natural language requirement | Module/code target | Bug description / stack trace |
| Pipeline Phases | 7 (Fast Path: 5) | 6 (Fast Path: 4) | 5 (Fast Path: 3) |
| Phase 1 | Specify (spec.md) | Analyze (refactor-analysis.md) | Triage (fix-plan.md) |
| Artifact Docs | 3: spec.md + plan.md + tasks.md | 3: refactor-analysis.md + plan.md + tasks.md | 2: fix-plan.md + fix-report.md |
| Artifact Path | `.prizmkit/specs/<feature-slug>/` | `.prizmkit/refactor/<slug>/` | `.prizmkit/bugfix/<bug-id>/` |
| Skills Chain | specify → plan → tasks → analyze → implement → review → commit + summarize | tech-debt-tracker → plan → tasks → implement → review → commit | error-triage → bug-reproduce → implement → code-review → commit |
| Commit Prefix | `feat(<scope>):` | `refactor(<scope>):` | `fix(<scope>):` |
| REGISTRY Update | ✅ via summarize | ❌ not applicable | ❌ not applicable |
| Test Strategy | TDD per task | Full suite after EVERY task | Reproduction test |
| Scope Guard | N/A | ✅ (enforced) | N/A |
| Behavior Change | ✅ Expected | ❌ Forbidden | ✅ Fix behavior |
| Resume Support | ✅ artifact-based detection | ✅ artifact-based detection | ❌ |

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- `spec.md` (Phase 1 artifact)
- `plan.md` (Phase 2 artifact)
- `tasks.md` (Phase 3 artifact)
- Consistency analysis report (Phase 4, conversation only)
- Implementation code + tests (Phase 5)
- Code review report (Phase 6, conversation only)
- Git commit with `feat(<scope>):` prefix (Phase 7)
- REGISTRY.md entry (Phase 7)
- Updated `.prizm-docs/` (if applicable)
