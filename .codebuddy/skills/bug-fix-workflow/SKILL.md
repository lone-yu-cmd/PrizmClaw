---
name: bug-fix-workflow
tier: companion
description: "Interactive single-bug fix in current session. Guides through triage → reproduce → fix → review → commit without the background pipeline. Use this skill when the user wants to fix one specific bug right now, interactively. Trigger on: 'fix this bug', 'debug this', 'fix B-001', 'help me fix', 'let me fix this bug myself', '修这个 bug', '交互式修复', '手动修 bug'. (project)"
---

# Bug Fix Workflow

Fix a single bug interactively within the current AI CLI session. This is the in-session counterpart to `bugfix-pipeline-launcher` (which runs multiple bugs in the background).

## When to Use

- User wants to fix **one specific bug** right now, with full visibility
- User says "fix this bug", "debug this error", "help me fix B-001", "修这个 bug"
- User has a stack trace or error and wants interactive debugging
- User prefers hands-on fixing over background pipeline

**Do NOT use when:**
- User has multiple bugs to fix in batch → `bug-planner` + `bugfix-pipeline-launcher`
- User wants to plan/collect bugs without fixing → `bug-planner`
- User wants background autonomous fixing → `bugfix-pipeline-launcher`
- User wants to build features → `feature-workflow`

## Input

The bug can come from:
- **A bug-fix-list.json entry**: "fix B-001" → read the entry from bug-fix-list.json
- **A stack trace/error message**: user pastes error directly
- **A description**: "the login page crashes when I click submit"
- **A failed test**: "this test is failing: src/auth/__tests__/login.test.ts"

## Execution

### Phase 1: Triage

**Goal**: Understand the bug, locate affected code, classify severity.

1. **Gather bug info**:
   - If bug ID given (e.g. B-001): read entry from `bug-fix-list.json`
   - If raw error: extract error message, stack trace, affected files
   - If description: ask clarifying questions to narrow down the issue
2. **Read project context**: `.prizm-docs/root.prizm` → relevant L1/L2 docs for affected modules
3. **Locate affected code**: read the files mentioned in the error/stack trace
4. **Check known issues**: search `.prizm-docs/` TRAPS sections for matching patterns
5. **Classify**: root cause (confirmed/suspected), blast radius, fix complexity
6. **Present diagnosis to user**:
   ```
   Bug: Login page crash on submit
   Root Cause: AuthService.handleLogin() receives null token when API returns 401
   Affected Files: src/services/auth.ts (L42), src/pages/login.tsx (L28)
   Fix Complexity: Low (null check + error handling)
   ```
   Ask: "Does this diagnosis look right? Should I proceed with the fix?"

### Phase 2: Reproduce

**Goal**: Create a failing test that proves the bug exists.

1. **Write a reproduction test** that demonstrates the bug:
   - Name: `<module>.test.ts` → add a test case named `should handle <bug scenario>`
   - The test captures the exact failure condition
2. **Run the test** → confirm it **fails** (red)
3. **Show result to user**: "Reproduction test written and confirmed failing."

If the bug is hard to reproduce automatically (e.g. environment-specific):
- Ask the user for reproduction steps
- Write a manual reproduction checklist instead
- Proceed to Phase 3 with the manual checklist

### Phase 3: Fix

**Goal**: Implement the minimal fix. Red test → green.

1. **Implement the fix**:
   - Change the minimum amount of code to fix the root cause
   - Do NOT refactor or add unrelated improvements — fix the bug only
   - Follow existing code conventions (read from `.prizm-docs/` RULES/PATTERNS)
2. **Run the reproduction test** → must **pass** (green)
3. **Run the full module test suite** → must pass (no regressions)
4. **Show the fix to user**:
   - Summary of changes made
   - Test results (reproduction + regression)
   - Ask: "Fix looks good? Any concerns?"

If the fix causes test regressions:
- Show which tests broke and why
- Revise the fix (max 3 attempts)
- If still failing after 3 attempts, escalate to user with analysis

### Phase 4: Review

**Goal**: Verify fix quality before committing.

1. **Self-review** the changes:
   - Does the fix address the root cause (not just the symptom)?
   - Are there edge cases not covered?
   - Is the reproduction test thorough enough?
   - Does the fix follow project conventions?
2. **Run full test suite** one final time
3. **Present review summary**:
   ```
   Fix Review:
   - Root cause addressed: Yes (null check added at auth service level)
   - Edge cases: Covered (401, 403, network error)
   - Regression: None (48/48 tests pass)
   - Code quality: Clean, follows existing patterns

   Ready to commit.
   ```

### Phase 5: Commit

**Goal**: Commit the fix with proper conventions.

1. **Run `/prizmkit-committer`**:
   - Commit message: `fix(<scope>): <description>`
   - Include both fix code and reproduction test
   - Do NOT push (user decides when to push)
   - Do NOT run `/prizmkit-retrospective` — bug fixes do not update `.prizm-docs/` (per project rules: "bugs are incomplete features, recording bug details causes doc bloat with no AI value")
   - `/prizmkit-committer` is a pure commit tool — it does NOT modify `.prizm-docs/` or any project files
2. **If bug came from bug-fix-list.json**: inform user to update bug status
   ```
   Bug B-001 fixed and committed.
   To update the bug list: manually set B-001 status to "fixed" in bug-fix-list.json
   Or retry the pipeline to pick up remaining bugs.
   ```

## Artifacts

Bug fix artifacts are stored at `.prizmkit/bugfix/<BUG_ID>/`:
- `fix-plan.md` — Triage output (diagnosis, root cause, fix approach)
- `fix-report.md` — Post-fix summary (what changed, test results, TRAPS added)

Only 2 artifact files per bug, consistent with the pipeline convention.

## Comparison with Pipeline Bug Fix

| Dimension | bug-fix-workflow (this skill) | bugfix-pipeline-launcher |
|-----------|-------------------------------|--------------------------|
| Scope | One bug at a time | All bugs in batch |
| Execution | Interactive, in-session | Background daemon |
| Visibility | Full user interaction at each phase | Async, check status periodically |
| Best for | Complex bugs needing user input | Batch of well-defined bugs |
| Artifacts | Same (fix-plan.md + fix-report.md) | Same |
| Commit prefix | `fix(<scope>):` | `fix(<scope>):` |

## Error Handling

| Scenario | Action |
|----------|--------|
| Bug ID not found in bug-fix-list.json | Ask user to provide bug details directly |
| Cannot reproduce the bug | Ask for more context, try alternative reproduction |
| Fix causes regressions | Revert, analyze, retry (max 3 rounds) |
| Root cause unclear after investigation | Present findings, ask user for guidance |
| Affected files are in unfamiliar module | Read `.prizm-docs/` L1/L2 for that module first |

## HANDOFF

| From | To | Condition |
|------|----|-----------|
| `bug-planner` | **this skill** | User picks one bug to fix interactively |
| `bugfix-pipeline-launcher` | **this skill** | User wants to fix a stuck/complex bug manually |
| **this skill** | `bugfix-pipeline-launcher` | After fixing, user wants to continue with remaining bugs |
| **this skill** | `prizmkit-committer` | Built into Phase 5 (pure commit, no doc sync) |

## Output

- Fixed code with reproduction test
- `.prizmkit/bugfix/<BUG_ID>/fix-plan.md`
- `.prizmkit/bugfix/<BUG_ID>/fix-report.md`
- Git commit with `fix(<scope>):` prefix
