# Bug Fix Plan: BUG-TG-001 — telegram.js multiple errors

## Diagnosis

**Bug 1 — Duplicate `const sessionKey` (SyntaxError, Critical)**
- File: src/bot/telegram.js
- Lines: 1039 and 1088
- Both in the same `try` block inside `bot.on('text', ...)` handler
- Line 1039: `const sessionKey = \`telegram:${sessionId}\`;` (for messageRouter.processMessage)
- Line 1088: `const sessionKey = \`telegram:${sessionId}\`;` (for outputHistoryService)
- Both are identical — the second is a duplicate declaration
- Fix: Remove the second `const sessionKey` (line 1088), reuse the variable already declared at line 1039

**Bug 2 — Unescaped MarkdownV2 in scheduled task notification (Message parse error)**
- File: src/bot/telegram.js
- Line 585: `执行时间: ${new Date(result.executedAt || Date.now()).toLocaleString()}`
- `toLocaleString()` produces strings like "3/23/2026, 10:30:45 AM" with `.`, `,`, `/` — MarkdownV2 special chars
- Message is sent with `parse_mode: 'MarkdownV2'` but this line has no escaping
- Fix: Wrap with `escapeMarkdownV2()`

**Bug 3 — Unescaped stdout content in MarkdownV2 (Message parse error)**
- File: src/bot/telegram.js
- Line 588: `result.stdout ? \`stdout:\n${truncate(result.stdout, 500)}\` : 'stdout: (empty)'`
- `truncate(result.stdout, 500)` is arbitrary command output — may contain `_`, `*`, `[`, `]`, `(`, `)`, etc.
- Message is sent with `parse_mode: 'MarkdownV2'` but stdout is not escaped
- Fix: Wrap `truncate(result.stdout, 500)` with `escapeMarkdownV2()`

## Fix Approach
- Minimal changes only: remove duplicate `const`, add two `escapeMarkdownV2()` wrappers
- No refactoring, no other changes
