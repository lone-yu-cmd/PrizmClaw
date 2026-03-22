# B-002 Fix Report

## Changes
- Runtime `.env` updated: `ENABLE_SYSTEM_EXEC=true` (local runtime config)

## Verification
- `POST /api/system/exec` with payload `{ "command": "pwd" }` returns:
  - `ok: true`
  - `exitCode: 0`

## Result
- Fixed for current runtime environment.
