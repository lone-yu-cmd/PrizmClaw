---
name: bug-planner
tier: companion
description: "Interactive bug planning that produces bug-fix-list.json for the Bug Fix Pipeline. Supports multiple input formats: error logs, stack traces, user reports, failed tests, monitoring alerts. Use this skill whenever the user has bugs to report, errors to parse, or test failures to organize. Trigger on: 'plan bug fixes', 'report bugs', 'I have some bugs', 'these tests are failing', 'here is an error log', 'parse these errors', '修复 bug', '生成 bug 列表', '规划 bug 修复'. (project)"
---

# Bug Planner

Interactive skill that collects bug information from various input formats and generates a standardized `bug-fix-list.json` for the Bug Fix Pipeline. This is the bug-fix counterpart to `app-planner` (which generates `feature-list.json`).

## When to Use

User says:
- "plan bug fixes", "report bugs", "create bug list"
- "修复 bug", "生成 bug 列表", "规划 bug 修复"
- "I have some bugs to fix", "these tests are failing"
- "here's an error log", "parse these errors"
- After receiving bug reports, error logs, or failed test output

**Do NOT use when:**
- User wants to start fixing bugs now (use `bugfix-pipeline-launcher`)
- User wants to fix a single bug interactively (use `bug-fix-workflow`)
- User wants to plan features (use `app-planner`)

## Intent Routing

This skill handles multiple operations. Determine the user's intent and execute the matching operation:

| User Intent | Operation | Trigger Phrases |
|---|---|---|
| Plan bugs interactively | **Interactive Planning** | "plan bug fixes", "report bugs", "规划 bug 修复" |
| Parse error logs into bugs | **From Log** | "parse this error log", "here's a stack trace", "parse these errors" |
| Parse test failures into bugs | **From Tests** | "these tests are failing", "parse test output" |
| Validate existing bug list | **Validate** | "validate bug list", "check bug-fix-list.json" |
| Summarize bug list | **Summary** | "bug summary", "show bug list", "list bugs" |

---

## Operation: Interactive Planning

Launch the interactive bug planning process through 4 phases.

### Phase 1: Project Context

1. **Identify project**: Read project name and description from existing `feature-list.json` or ask user
2. **Identify tech stack**: Read from `feature-list.json` global_context or `.prizm-docs/root.prizm`, or ask user
3. **Identify testing framework**: Auto-detect from package.json/requirements.txt/etc., or ask user

Output: `project_name`, `project_description`, `global_context` fields populated.

### Phase 2: Bug Collection

Accept bug information in ANY of these formats (auto-detect):

#### Severity Auto-Classification Rules

When extracting bugs, apply these rules to auto-suggest severity:

| Severity | Indicators | Examples |
|----------|------------|----------|
| **critical** | System crash, data loss, security breach, OOM, unrecoverable error | `Segmentation fault`, `OutOfMemoryError`, `SQL injection vulnerability`, `Database corrupted` |
| **high** | Core feature broken, authentication failure, data integrity issue, timeout | `Auth token invalid`, `Payment failed`, `Connection timeout`, `500 Internal Server Error` |
| **medium** | Feature partially broken, workaround exists, incorrect output | `CSV encoding issue`, `Pagination not working`, `Wrong date format`, `Missing validation` |
| **low** | Cosmetic issue, minor inconvenience, edge case | `UI misalignment`, `Typo in error message`, `Slow loading (non-critical page)`, `Non-breaking warning` |

**Special cases:**
- Failed test → medium (unless test covers critical path, then high)
- User report with "cannot use app" → high
- User report with "annoying but works" → low

#### Format A: Stack Trace / Error Log
```
TypeError: Cannot read property 'token' of null
    at AuthService.handleLogin (src/services/auth.ts:42)
    at LoginPage.onSubmit (src/pages/login.tsx:28)
```
→ Auto-extract: `error_source.type="stack_trace"`, `error_message`, `stack_trace`, `affected_modules`

#### Format B: Natural Language User Report
```
When I click the login button with correct credentials, the page turns white.
Expected: redirect to home page.
Actual: white screen with no error message visible.
```
→ Auto-extract: `error_source.type="user_report"`, `reproduction_steps`, `description` (expected vs actual)

#### Format C: Failed Test Output
```
FAIL src/services/__tests__/auth.test.ts
  ● AuthService > handleLogin > should return token on success
    Expected: "abc123"
    Received: null
```
→ Auto-extract: `error_source.type="failed_test"`, `failed_test_path`, `error_message`

#### Format D: Log Pattern
```
[2026-03-07 10:23:45] ERROR [auth-service] Connection timeout after 30000ms
[2026-03-07 10:23:45] ERROR [auth-service] Failed to authenticate user: ETIMEDOUT
[2026-03-07 10:23:46] ERROR [auth-service] Connection timeout after 30000ms
```
→ Auto-extract: `error_source.type="log_pattern"`, `log_snippet`, `affected_modules`

#### Format E: Monitoring Alert
```
ALERT: CPU usage > 95% for auth-service pod (5min avg)
ALERT: Error rate spike: 500 errors/min on /api/login endpoint
```
→ Auto-extract: `error_source.type="monitoring_alert"`, `error_message`, `affected_modules`

**For each bug collected**, interactively confirm or fill in:
- Title (auto-suggest from error message, user can edit)
- Description (auto-generate expected vs actual, user can edit)
- Severity (auto-suggest based on error type, user can override)
- Affected feature (ask if known, map to existing F-NNN IDs)
- Environment (ask or auto-detect from logs)
- Verification type (suggest `automated` by default, ask user)
- Acceptance criteria (auto-suggest based on description, user can edit)

**Multiple bugs per session**: After each bug, ask "Any more bugs to add? (yes/no)"

### Phase 3: Prioritization & Review

1. **Auto-assign priorities**: Based on severity (critical=1, high=2, medium=3, low=4), adjustable by user
2. **Display summary table**:
   ```
   ID    | Title                        | Severity | Priority | Verification
   B-001 | Login null reference crash    | critical | 1        | automated
   B-002 | CSV export Chinese encoding   | medium   | 3        | hybrid
   B-003 | Slow dashboard loading        | low      | 4        | manual
   ```
3. **Ask for adjustments**: "Want to reorder priorities, change severity, or remove any bugs?"
4. **Detect potential duplicates**: If two bugs have similar error messages or affected modules, warn user

### Phase 4: Generate & Validate

1. **Generate `bug-fix-list.json`**: Conform to `dev-pipeline/templates/bug-fix-list-schema.json`
2. **Validate against schema**: Run the validation script:
   ```bash
   python3 ${SKILL_DIR}/scripts/validate-bug-list.py bug-fix-list.json --feature-list feature-list.json
   ```
   If the script is not available, perform the validation checks manually (see checklist below).
3. **Write file** to project root (or user-specified path)
4. **Output**: File path, summary, and next steps

#### Schema Validation Checklist

Before writing the file, verify all items pass:

**Required fields:**
- [ ] `$schema`: must be `"dev-pipeline-bug-fix-list-v1"`
- [ ] `project_name`: non-empty string
- [ ] `bugs`: non-empty array

**Per-bug required fields:**
- [ ] `id`: matches pattern `B-NNN` (e.g., `B-001`)
- [ ] `title`: non-empty string
- [ ] `description`: non-empty string
- [ ] `severity`: one of `critical`, `high`, `medium`, `low`
- [ ] `error_source.type`: one of `stack_trace`, `user_report`, `failed_test`, `log_pattern`, `monitoring_alert`
- [ ] `verification_type`: one of `automated`, `manual`, `hybrid`
- [ ] `acceptance_criteria`: non-empty array of strings
- [ ] `status`: must be `pending` for new bugs

**Consistency checks:**
- [ ] No duplicate bug IDs
- [ ] No duplicate priorities (each bug should have unique priority number)
- [ ] If `affected_feature` is set, verify it exists in `feature-list.json` (if available)

If any check fails, fix before writing the file.

#### Success Output

```
✅ bug-fix-list.json generated with 3 bugs (1 critical, 1 medium, 1 low)

Next steps:
- Review: cat bug-fix-list.json
- Start fixing: say "开始修复" or "start fixing bugs" to launch the bugfix pipeline
- Or run directly: ./dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json
```

---

## Operation: From Log

Batch-parse error logs to generate bug entries without interactive prompts:

1. Accept log file path or piped content
2. Parse all unique errors (deduplicate by error message pattern)
3. Auto-generate bug entries with:
   - Title: first line of error message
   - Description: full error context
   - Severity: use the **Severity Auto-Classification Rules** (see Phase 2)
   - error_source: populated from log content
   - verification_type: default to `automated`
   - acceptance_criteria: auto-generate "Error no longer occurs in [scenario]"
4. Output draft `bug-fix-list.json` for user review
5. Ask: "Review and confirm? You can edit individual entries."

## Operation: From Tests

Batch-parse failed test output:

1. Accept test runner output (Jest, pytest, Go test, etc.)
2. Parse each failed test case as a separate bug entry
3. Auto-populate `failed_test_path`, `error_message`
4. Set verification_type to `automated` (test already exists)
5. Output draft `bug-fix-list.json`

## Operation: Validate

Validate existing `bug-fix-list.json`:

1. Check JSON syntax
2. Validate against `dev-pipeline/templates/bug-fix-list-schema.json`
3. Check for:
   - Duplicate IDs
   - Missing required fields
   - Invalid status values
   - Priority conflicts (same priority for different bugs)
   - Invalid `affected_feature` references (if feature-list.json exists)
4. Output: validation result with specific errors/warnings

## Operation: Summary

Print human-readable summary:

```
Bug Fix List Summary: my-web-app
═══════════════════════════════

Total: 3 bugs
By Severity: critical=1, high=0, medium=1, low=1
By Status:   pending=3

Bug List (by priority):
  1. [B-001] Login null reference crash (CRITICAL) — automated
  2. [B-002] CSV export Chinese encoding (MEDIUM) — hybrid
  3. [B-003] Slow dashboard loading (LOW) — manual

Affected Features: F-003 (1 bug), F-012 (1 bug), none (1 bug)
```

---

## Integration with Bug Fix Pipeline

After `bug-fix-list.json` is generated, the user can:

1. **Say "开始修复" or "start fixing bugs"** — triggers `bugfix-pipeline-launcher` skill to auto-launch pipeline in background (recommended)
2. **Background daemon**: `./dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json`
3. **Foreground run**: `./dev-pipeline/run-bugfix.sh run bug-fix-list.json`
4. **Fix single bug interactively**: invoke `bug-fix-workflow` in current session
5. **Retry a failed bug**: `./dev-pipeline/retry-bug.sh B-001`

## Error Handling

| Error | Action |
|-------|--------|
| Cannot parse error log format | Ask user to specify format or provide raw text |
| Ambiguous severity classification | Present options, ask user to choose |
| Duplicate bug detected | Warn user, suggest merging or keeping separate |
| No bugs provided | Prompt with examples of supported input formats |
| Invalid feature reference | Warn and ask user to correct or remove reference |
| Schema validation failure | Show specific errors, offer to fix interactively |

## Output

- `bug-fix-list.json` conforming to `dev-pipeline/templates/bug-fix-list-schema.json`
- Validation report (if validation run)
- Summary report (if summary run)
