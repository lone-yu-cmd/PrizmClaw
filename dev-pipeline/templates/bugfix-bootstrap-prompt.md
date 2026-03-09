# Dev-Pipeline Bug Fix Session Bootstrap

## Session Context

- **Pipeline Run ID**: {{RUN_ID}}
- **Session ID**: {{SESSION_ID}}
- **Bug ID**: {{BUG_ID}}
- **Bug Title**: {{BUG_TITLE}}
- **Severity**: {{SEVERITY}}
- **Verification Type**: {{VERIFICATION_TYPE}}
- **Retry Count**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Session Status**: {{PREV_SESSION_STATUS}}
- **Resume From Phase**: {{RESUME_PHASE}}

## Your Mission

You are the **bug fix session orchestrator**. Fix Bug {{BUG_ID}}: "{{BUG_TITLE}}".

**CRITICAL SESSION LIFECYCLE RULE**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, you MUST **wait for each to finish** (run_in_background=false) before proceeding. Do NOT spawn an agent in the background and exit — that kills the session.

**MANDATORY TEAM REQUIREMENT**: You MUST use the `prizm-dev-team` multi-agent team. This is NON-NEGOTIABLE. All implementation and review work MUST be performed by the appropriate team agents (Dev, Reviewer).

**BUG FIX DOCUMENTATION POLICY**: Bug fixes MUST NOT be recorded as new documentation entries:
- Do NOT run `prizmkit.summarize` (no REGISTRY.md entries)
- Do NOT create spec/plan/tasks under `.prizmkit/specs/`
- Do NOT update `.prizm-docs/` module docs for pure bug fixes (unless TRAPS update is needed)
- Commit with `fix(<scope>):` prefix, NOT `feat:`

### Team Definition Reference

- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed team config**: `{{TEAM_CONFIG_PATH}}`

### Bug Description

{{BUG_DESCRIPTION}}

### Error Source

- **Type**: {{ERROR_SOURCE_TYPE}}
{{ERROR_SOURCE_DETAILS}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Affected Feature

{{AFFECTED_FEATURE}}

### Environment

{{ENVIRONMENT}}

### App Global Context

{{GLOBAL_CONTEXT}}

## Bug Fix Artifacts Directory

**ALWAYS** use per-bug subdirectory `.prizmkit/bugfix/{{BUG_ID}}/`:

```
.prizmkit/bugfix/{{BUG_ID}}/
├── fix-plan.md       ← Phase 1 output (generated after triage)
└── fix-report.md     ← Phase 5 output (generated after commit)
```

**IMPORTANT**: Only 2 artifact files per bug, NEVER more. This is a fixed convention.

## Execution Instructions

**YOU are the orchestrator. Execute each phase by spawning the appropriate team agent with run_in_background=false.**

### Step 1: Initialize

#### Team Setup: Reuse or Create

1. **Check if a team already exists and can be reused**:
   - Read the team config file at `{{TEAM_CONFIG_PATH}}`
   - If valid, reuse it. Set `TEAM_REUSED=true`

2. **If no reusable team**, create a new one:
   - Reference `core/team/prizm-dev-team.json`
   - Call `TeamCreate` with `team_name="prizm-dev-team-{{BUG_ID}}"` and `description="Fixing {{BUG_TITLE}}"`
   - Set `TEAM_REUSED=false`

3. Create bug fix artifacts directory:
   ```bash
   mkdir -p .prizmkit/bugfix/{{BUG_ID}}
   ```

### Step 2: Pipeline Phases

#### Phase 1: Triage — 分诊分类

**Goal**: Classify the bug, identify scope and severity, check known issues, produce fix-plan.md.

- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. For bug {{BUG_ID}} ('{{BUG_TITLE}}'):
  1. Run `prizmkit.error-triage` with the bug description and error source
  2. Check `.prizm-docs/` TRAPS sections for matching known issues
  3. Classify: category, subcategory, root cause (confirmed or suspected), affected files
  4. Assess impact: which modules are affected, what is the blast radius
  5. Design test strategy based on verification_type='{{VERIFICATION_TYPE}}'
  6. Propose fix approach: specific code changes, estimated scope
  7. Write the complete fix plan to `.prizmkit/bugfix/{{BUG_ID}}/fix-plan.md`

  The fix-plan.md MUST contain these sections:
  - Bug Summary (ID, title, severity, source type, affected feature)
  - Root Cause Analysis (error classification, root cause, call chain, TRAP match)
  - Impact Assessment (directly affected files, potentially affected modules)
  - Test Strategy (reproduction test design, regression test plan, manual steps if hybrid/manual)
  - Fix Approach (proposed fix, fix scope, constraints)
  "
- **Wait for Dev to return**
- **CP-BF-1**: `.prizmkit/bugfix/{{BUG_ID}}/fix-plan.md` exists

**DECISION GATE — Fast Path Check**:
- If severity is LOW or MEDIUM, AND root cause is obvious (high confidence), AND fix is < 10 lines:
  → Set `FAST_PATH=true`, skip Phase 2, go to Phase 3
- Otherwise → proceed to Phase 2

{{IF_VERIFICATION_MANUAL_OR_HYBRID}}
**NOTE**: When verification_type is 'manual' or 'hybrid', the fix-plan.md MUST also include:
- Manual Verification Plan section with UAT checklist
- User Review Required section specifying reviewer and blocking behavior
{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}

---

#### Phase 2: Reproduce — 复现确认

**Goal**: Create an automated reproduction that proves the bug exists.

- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. For bug {{BUG_ID}}:
  1. Read the fix plan from `.prizmkit/bugfix/{{BUG_ID}}/fix-plan.md`
  2. Run `prizmkit.bug-reproduce` with the bug description and triage results
  3. Generate a minimal reproduction test that FAILS with current code
  4. Execute the reproduction test to confirm it fails
  5. If reproduction fails, refine and retry (max 2 rounds)
  6. Report: reproduction test path, red/green status, investigation pointers
  "
- **Wait for Dev to return**
- If Dev reports reproduction failed after 2 rounds:
  - Output: "Unable to reproduce bug {{BUG_ID}}. Need more information."
  - Write session-status.json with status="partial", errors=["reproduction_failed"]
  - Set bug status to `needs_info` and STOP
- **CP-BF-2**: Reproduction test exists and FAILS

---

#### Phase 3: Fix — 修复实现

**Goal**: Implement the fix. The reproduction test goes from red to green.

- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. For bug {{BUG_ID}}:
  1. Read the fix plan from `.prizmkit/bugfix/{{BUG_ID}}/fix-plan.md`
  2. Read `.prizm-docs/` for affected modules (TRAPS, RULES, PATTERNS)
  3. Implement the minimal fix following TDD:
     - The reproduction test is the 'red test'
     - Make it pass with the smallest possible code change
     - Do NOT refactor — fix the bug only
  4. Run the reproduction test → MUST PASS
  5. Run the module's test suite → MUST PASS (no regression)
  6. If fix fails after 3 rounds, report detailed analysis
  "
- **Wait for Dev to return**
- If fix fails after 3 rounds: escalate to user, write status="failed"
- **CP-BF-3**: Reproduction test passes, module tests pass

---

#### Phase 4: Verify — 代码审查与回归验证

**Goal**: Ensure fix correctness and no regressions.

- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read {{REVIEWER_SUBAGENT_PATH}}. For bug {{BUG_ID}}:
  1. Run `prizmkit.code-review` scoped to CHANGED FILES ONLY
  2. Review dimensions (adjusted for bug fix):
     - Fix correctness: Does it address the root cause?
     - Regression safety: Does it break existing behavior?
     - Code quality: Is the fix clean and maintainable?
     - Test coverage: Is the reproduction test adequate?
  3. Run full test suite and verify ALL tests pass
  4. Report verdict: PASS / PASS_WITH_WARNINGS / NEEDS_FIXES
  "
- **Wait for Reviewer to return**
- If NEEDS_FIXES: return to Phase 3 for refinement (max 2 review rounds)
- **CP-BF-4**: Code review passes, all tests green

{{IF_VERIFICATION_MANUAL_OR_HYBRID}}
**MANUAL VERIFICATION GATE**:
- After automated review passes, Pipeline PAUSES here
- Output: "Bug {{BUG_ID}} fix is ready for manual verification. Please perform UAT checklist from fix-plan.md."
- Write session-status.json with status="partial", current_phase=4, resume_from_phase=5
- Set bug status to `verifying` and wait for user confirmation
{{END_IF_VERIFICATION_MANUAL_OR_HYBRID}}

---

#### Phase 5: Commit & Learn — 提交与知识积累

**Goal**: Commit the fix, update TRAPS, generate fix-report.md.

- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. For bug {{BUG_ID}}:
  1. Run `prizmkit.committer` with:
     - Commit message: `fix({{FIX_SCOPE}}): {{BUG_TITLE}}`
     - Include both fix code and reproduction test
     - Do NOT run `prizmkit.summarize`
     - Do NOT push (user will push manually)
  2. If a new pitfall was discovered (not previously in TRAPS):
     - Update the affected module's TRAPS section in `.prizm-docs/`
     - Format: `- TRAP: <description> | FIX: <solution> | DATE: YYYY-MM-DD`
  3. Write the complete fix report to `.prizmkit/bugfix/{{BUG_ID}}/fix-report.md`

  The fix-report.md MUST contain these sections:
  - Bug Resolution Summary (ID, title, status, phases completed, duration)
  - What Was Fixed (changes made, diff summary, commit message)
  - Verification Results (reproduction test before/after, regression tests, review verdict)
  - Knowledge Captured (TRAPS updated, prevention recommendation)
  - Acceptance Criteria Verification (checklist with pass/fail for each criterion)
  "
- **Wait for Dev to return**
- **CP-BF-5**: Commit recorded, fix-report.md written, TRAPS updated (if applicable)

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "bug_id": "{{BUG_ID}}",
  "status": "<success|partial|failed>",
  "completed_phases": [1, 2, 3, 4, 5],
  "current_phase": 5,
  "checkpoint_reached": "CP-BF-5",
  "fast_path": false,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "fix_plan_path": ".prizmkit/bugfix/{{BUG_ID}}/fix-plan.md",
    "fix_report_path": ".prizmkit/bugfix/{{BUG_ID}}/fix-report.md"
  },
  "git_commit": "<commit hash>",
  "traps_updated": false,
  "timestamp": "{{TIMESTAMP}}"
}
```

**Status values**: `success` (all phases done) | `partial` (can resume) | `failed` (unrecoverable)

### Step 4: Team Cleanup (conditional)

**Only if you CREATED the team** (`TEAM_REUSED=false`), clean up with `TeamDelete`.
**If you REUSED an existing team** (`TEAM_REUSED=true`), do NOT call `TeamDelete`.

## Critical Paths

| Resource | Path |
|----------|------|
| Team Definition (source of truth) | `core/team/prizm-dev-team.json` |
| Team Config (installed) | `{{TEAM_CONFIG_PATH}}` |
| Bug Fix Artifacts Dir | `.prizmkit/bugfix/{{BUG_ID}}/` |
| Fix Plan | `.prizmkit/bugfix/{{BUG_ID}}/fix-plan.md` |
| Fix Report | `.prizmkit/bugfix/{{BUG_ID}}/fix-report.md` |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |

## Reminders

- **MANDATORY**: Use `prizm-dev-team` — single-agent execution is FORBIDDEN
- **Only 2 artifact files per bug**: fix-plan.md + fix-report.md — NEVER more
- **Do NOT create** spec.md, plan.md, or tasks.md for bug fixes
- **Do NOT run** `prizmkit.summarize` (no REGISTRY.md entries for bugs)
- **Commit with** `fix(<scope>):` prefix, NOT `feat:`
- **Update TRAPS** in `.prizm-docs/` only if a genuinely new pitfall was discovered
- Dev agents use TDD approach: reproduction test goes from RED → GREEN
- ALWAYS write session-status.json before exiting
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if you created the team
