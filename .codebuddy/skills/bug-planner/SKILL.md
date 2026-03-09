---
name: bug-planner
tier: companion
description: "Interactive bug planning that produces bug-fix-list.json for the Bug Fix Pipeline. Supports multiple input formats: error logs, stack traces, user reports, failed tests, monitoring alerts. (project)"
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

## Commands

### prizmkit.bug-plan

Launch the interactive bug planning process.

### prizmkit.bug-plan-from-log \<log-file-or-content\>

Auto-generate bug entries from error logs or stack traces.

### prizmkit.bug-plan-from-tests \<test-output\>

Auto-generate bug entries from failed test case output.

### prizmkit.bug-plan-validate \<bug-fix-list.json\>

Validate an existing `bug-fix-list.json` against the schema.

### prizmkit.bug-plan-summary \<bug-fix-list.json\>

Print a summary of bugs grouped by severity and status.

---

## Interactive Planning Process

The interactive `prizmkit.bug-plan` command guides through 4 phases:

### Phase 1: Project Context

1. **Identify project**: Read project name and description from existing `feature-list.json` or ask user
2. **Identify tech stack**: Read from `feature-list.json` global_context or `.prizm-docs/root.prizm`, or ask user
3. **Identify testing framework**: Auto-detect from package.json/requirements.txt/etc., or ask user

Output: `project_name`, `project_description`, `global_context` fields populated.

### Phase 2: Bug Collection

Accept bug information in ANY of these formats (auto-detect):

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
2. **Validate against schema**: Auto-run validation
3. **Write file** to project root (or user-specified path)
4. **Output**: File path, summary, and next steps:
   ```
   ✅ bug-fix-list.json generated with 3 bugs (1 critical, 1 medium, 1 low)
   
   Next steps:
   - Review: cat bug-fix-list.json
   - Start fixing: say "开始修复" or "start fixing bugs" to launch the bugfix pipeline
   - Or run directly: ./dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json
   - Fix one interactively: invoke prizmkit-bug-fix-workflow for each bug
   ```

---

## Non-Interactive Commands

### prizmkit.bug-plan-from-log

Batch-parse error logs to generate bug entries without interactive prompts:

1. Accept log file path or piped content
2. Parse all unique errors (deduplicate by error message pattern)
3. Auto-generate bug entries with:
   - Title: first line of error message
   - Description: full error context
   - Severity: auto-classify (crash/OOM=critical, auth/timeout=high, validation=medium, other=low)
   - error_source: populated from log content
   - verification_type: default to `automated`
   - acceptance_criteria: auto-generate "Error no longer occurs in [scenario]"
4. Output draft `bug-fix-list.json` for user review
5. Ask: "Review and confirm? You can edit individual entries."

### prizmkit.bug-plan-from-tests

Batch-parse failed test output:

1. Accept test runner output (Jest, pytest, Go test, etc.)
2. Parse each failed test case as a separate bug entry
3. Auto-populate `failed_test_path`, `error_message`
4. Set verification_type to `automated` (test already exists)
5. Output draft `bug-fix-list.json`

### prizmkit.bug-plan-validate

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

### prizmkit.bug-plan-summary

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
4. **Fix single bug interactively**: invoke `prizmkit-bug-fix-workflow` in current session
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

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- `bug-fix-list.json` conforming to `dev-pipeline/templates/bug-fix-list-schema.json`
- Validation report (if validation run)
- Summary report (if summary run)
