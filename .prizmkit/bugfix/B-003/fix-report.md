# B-003 Fix Report

## Changes
- `src/index.js`
  - Track `botLaunched` state around `bot.launch()` promise
  - Add launch rejection logging (`Failed to launch telegram bot`)
  - Keep web service available if telegram init fails
  - Guard `bot.stop()` with `botLaunched` and safe try/catch
- `src/bot/telegram.js`
  - `bot.catch(...)` upgraded to async and now attempts to notify user with fallback message

## Verification
- Startup/shutdown smoke test passes without `Bot is not running!` crash.
- Web API remains available even if Telegram launch path fails.

## Result
- Stabilized telegram runtime behavior and improved failure visibility.
