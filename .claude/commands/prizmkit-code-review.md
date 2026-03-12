---
description: Code review against spec, plan, and best practices. Read-only analysis with severity ratings. Invoke after implementation or when user requests review. (project)
---

# PrizmKit Code Review

Perform a comprehensive code review against the feature spec, implementation plan, and project best practices. Produces a structured review report with severity ratings. This skill is strictly read-only and does not modify any files.

## Commands

### `/prizmkit-code`-review

Review implemented code against spec and plan.

**PRECONDITION:** `spec.md`, `plan.md`, `tasks.md` exist in `.prizmkit/specs/###-feature-name/` with completed tasks

**STEPS:**

1. Read `spec.md`, `plan.md`, `tasks.md` as review baseline
2. Read `.prizm-docs/root.prizm` RULES for project conventions
3. Scan all code files referenced in completed tasks
4. Review across 6 dimensions:
   - **Spec compliance**: Does code implement all acceptance criteria?
   - **Plan adherence**: Does implementation follow architectural decisions?
   - **Code quality**: Naming, structure, complexity, DRY
   - **Security**: Common vulnerabilities (injection, auth, data exposure)
   - **Consistency**: Follows project patterns from `.prizm-docs/` PATTERNS
   - **Test coverage**: Are critical paths tested?
5. Generate findings with severity: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW`
6. Max 30 findings
7. Verdict: `PASS` | `PASS WITH WARNINGS` | `NEEDS FIXES`
8. OUTPUT: Structured review report (to conversation only, NOT written to file)

**KEY RULES:**
- This is STRICTLY READ-ONLY — does NOT modify any files
- Output goes to conversation ONLY, not to any file
- Max 30 findings to keep review actionable
- Every CRITICAL finding MUST include a specific fix suggestion
- Spec compliance failures are always rated HIGH or CRITICAL
- Security findings are always rated HIGH or CRITICAL

**VERDICT CRITERIA:**
- `PASS`: No CRITICAL or HIGH findings
- `PASS WITH WARNINGS`: No CRITICAL findings, some HIGH findings
- `NEEDS FIXES`: Any CRITICAL findings present

**HANDOFF:** ``/prizmkit-summarize`` (if PASS) or ``/prizmkit-implement`` (if NEEDS FIXES)

## Output

Review report is output to conversation only. No files are created or modified.

**Report Format:**
```
## Code Review: [Feature Name]

### Summary
- Files reviewed: N
- Findings: N (Critical: N, High: N, Medium: N, Low: N)
- Verdict: [PASS | PASS WITH WARNINGS | NEEDS FIXES]

### Findings

#### [SEVERITY] Finding Title
- File: path/to/file:line
- Dimension: [spec-compliance | plan-adherence | code-quality | security | consistency | test-coverage]
- Description: [What was found]
- Suggestion: [How to fix]
```
