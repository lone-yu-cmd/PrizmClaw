---
description: "Code review against spec, plan, and best practices. Read-only analysis with severity ratings. Use this skill after implementation to catch spec compliance gaps, security issues, and pattern violations before committing. Trigger on: 'review', 'check code', 'review my implementation', 'code review', 'is it ready to commit'. (project)"
---

# PrizmKit Code Review

Perform a comprehensive code review against the feature spec, implementation plan, and project best practices. Produces a structured review report with severity ratings. This skill is strictly read-only — it surfaces issues without auto-fixing them, so you can decide what actually needs changing.

### When to Use
- After `/prizmkit-implement` to verify code quality before commit
- User says "review", "check code", "review my implementation"
- As a quality gate before `/prizmkit-committer`

**PRECONDITION (multi-mode):**
- **Feature mode**: `spec.md` and `plan.md` (with Tasks section) exist in `.prizmkit/specs/###-feature-name/` with completed tasks
- **Refactor mode**: `refactor-analysis.md` and `plan.md` (with Tasks section) exist in `.prizmkit/refactor/<refactor-slug>/` with completed tasks. No `spec.md` is needed — review against `refactor-analysis.md` goals and behavior preservation instead.
- **Bugfix mode**: `fix-plan.md` exists in `.prizmkit/bugfix/<BUG_ID>/` with completed tasks. Review against the bug description and reproduction test.
- **Auto-detect**: Check which artifact directory was passed by the calling workflow, or scan `.prizmkit/` for the most recently modified feature/refactor/bugfix directory.

## Execution Steps

1. **Detect mode and load review baseline**:
   - If `spec.md` exists → **Feature mode**: read `spec.md` + `plan.md` as baseline. Review dimensions: spec compliance, plan adherence, code quality, security, consistency, test coverage.
   - If `refactor-analysis.md` exists → **Refactor mode**: read `refactor-analysis.md` + `plan.md` as baseline. Review dimensions shift: replace "spec compliance" with **behavior preservation** (observable behavior unchanged), replace "plan adherence" with **structural improvement** (is the code measurably better?). Also check test integrity and code quality.
   - If `fix-plan.md` exists → **Bugfix mode**: read `fix-plan.md` as baseline. Review dimensions: bug is actually fixed, no regressions, reproduction test passes, minimal change scope.
   - If none found → prompt user: "No review baseline found. Which workflow are you in? (feature/refactor/bugfix)"
2. Read **architecture index**: `.prizm-docs/root.prizm` RULES and PATTERNS for project conventions
3. Read **past decisions**: check DECISIONS sections in relevant `.prizm-docs/` L1/L2 files — helps verify implementation respects established conventions
4. Read '## Implementation Log' section of context-snapshot.md in the feature directory (if exists) — understand Dev's implementation decisions, trade-offs, and notable discoveries. This context helps distinguish intentional design choices from accidental patterns during review.
5. Scan all code files referenced in completed tasks
4. Review across 6 dimensions:
   - **Spec compliance**: Does code implement all acceptance criteria? Missing criteria are the #1 source of "it works but it's wrong" bugs
   - **Plan adherence**: Does implementation follow architectural decisions in plan.md? Deviations may be improvements or may break assumptions other components depend on
   - **Code quality**: Naming, structure, complexity, DRY. Focus on maintainability — will someone understand this code in 6 months?
   - **Security**: Injection (SQL, XSS, command), auth/authz gaps, sensitive data exposure, insecure defaults. Security issues are always HIGH+ because they're the hardest to catch later
   - **Consistency**: Follows project patterns from `.prizm-docs/` PATTERNS section. Inconsistent patterns increase cognitive load for every future reader
   - **Test coverage**: Are critical paths tested? Focus on paths that handle user input, money, or state transitions
5. Generate findings with severity: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW`
6. Determine verdict (see criteria below)
7. Output structured review report to conversation only

## Severity & Verdict

Spec compliance failures are always HIGH or CRITICAL — if the code doesn't match what was agreed in the spec, that's a functional gap, not a style issue. Security findings follow the same rule.

**Verdict criteria:**
- `PASS`: No CRITICAL or HIGH findings
- `PASS WITH WARNINGS`: No CRITICAL findings, some HIGH findings
- `NEEDS FIXES`: Any CRITICAL findings present

Cap findings at 30 to keep the review actionable. If there are more, summarize the overflow with counts by dimension. Every CRITICAL finding includes a specific fix suggestion — telling someone "this is broken" without saying how to fix it wastes their time.

If you're unsure whether something is a bug or intentional design, flag it as MEDIUM with a note asking the developer to confirm. Don't silently skip uncertain findings.

## Example Finding

```
#### [CRITICAL] SQL Injection in User Search
- File: src/services/userService.ts:47
- Dimension: security
- Description: User input `searchTerm` is interpolated directly into SQL query string without parameterization
- Suggestion: Use parameterized query: `db.query('SELECT * FROM users WHERE name LIKE $1', [`%${searchTerm}%`])`

#### [HIGH] Missing Acceptance Criterion
- File: src/routes/upload.ts
- Dimension: spec-compliance
- Description: spec.md §AC-3 requires "display progress bar during upload" but no progress tracking is implemented
- Suggestion: Add upload progress callback using xhr.upload.onprogress or fetch with ReadableStream
```

**HANDOFF:** `/prizmkit-retrospective` (if PASS) or `/prizmkit-implement` (if NEEDS FIXES)

## Loop Protection

In unattended pipeline mode, the review→fix→review cycle can loop indefinitely if fixes introduce new issues. To prevent this:

- Track a `review_iteration` counter starting at 1. Each review-fix-review cycle increments the counter.
- **max_iterations = 5**: If `review_iteration >= 5`, you MUST proceed to `/prizmkit-retrospective` regardless of remaining findings. Log remaining issues as known technical debt: "Loop protection triggered — proceeding to retrospective with N unresolved findings (iterations: 5/5)."
- Unresolved findings should be recorded in the review report so they can be tracked as follow-up work.
- This guard exists because some review cycles oscillate (fixing one issue introduces another) and blocking forever is worse than shipping with documented known issues.

## Output

Review report is output to conversation only. No files are created or modified.
