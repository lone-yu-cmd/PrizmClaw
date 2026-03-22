# B-003 Fix Plan

- Bug: Telegram message no reply
- Root causes addressed in code:
  1. Launch status not tracked robustly
  2. Shutdown could call `bot.stop()` while bot not launched
  3. Unhandled update errors only logged, no user notification
- Scope:
  - `src/index.js`
  - `src/bot/telegram.js`
- Validation:
  - service startup/shutdown no crash
  - launch failures logged explicitly
  - unhandled bot update errors trigger user notification attempt
