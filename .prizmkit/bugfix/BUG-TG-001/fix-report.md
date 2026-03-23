# Fix Report: BUG-TG-001 — telegram.js multiple errors

## Changes Made

### Fix 1: Removed duplicate `const sessionKey` (line 1088)
- **Root cause**: `const sessionKey` was declared twice in the same `try` block — at line 1039 for `messageRouter.processMessage()` and again at line 1088 for `outputHistoryService.addOutput()`. Both are identical (`\`telegram:${sessionId}\``).
- **Fix**: Removed the second `const sessionKey = ...` declaration; line 1088 now reuses the variable from line 1039.
- **Impact**: SyntaxError crash at bot startup (file could not be loaded).

### Fix 2: Escaped `toLocaleString()` in MarkdownV2 notification (line 585)
- **Root cause**: `new Date(...).toLocaleString()` produces strings like "3/23/2026, 10:30:45 AM" containing `.`, `,`, `/` which are MarkdownV2 special characters. The message is sent with `parse_mode: 'MarkdownV2'` but this line had no escaping.
- **Fix**: Wrapped with `escapeMarkdownV2()`.
- **Impact**: Telegram API returned "Bad Request: can't parse entities" for scheduled task completion notifications.

### Fix 3: Escaped `stdout` content in MarkdownV2 notification (line 588)
- **Root cause**: `truncate(result.stdout, 500)` is arbitrary command output that can contain MarkdownV2 special chars (`_`, `*`, `[`, `]`, `(`, `)`, `~`, etc.). Not escaped before sending.
- **Fix**: Wrapped `truncate(result.stdout, 500)` with `escapeMarkdownV2()`.
- **Impact**: Same as Bug 2 — Telegram API parse error whenever stdout contained special chars.

## Test Results
- Pre-existing failing tests: 20 (unrelated to telegram.js — status-aggregator, telegram-pusher, path-policy, guard, etc.)
- No new regressions introduced
- Only `src/bot/telegram.js` was modified
