# B-001 Fix Report

## Changes
- `src/config.js:20` default `WEB_HOST` changed `127.0.0.1` -> `0.0.0.0`
- `.env.example:25` default `WEB_HOST` changed `127.0.0.1` -> `0.0.0.0`

## Verification
- LAN/bind test:
  - `127.0.0.1` -> HTTP 200
  - `192.168.3.14` -> HTTP 200
- Web API smoke:
  - `POST /api/chat` -> `ok: true`
  - `POST /api/screenshot` -> `ok: true`
  - `POST /api/system/exec` -> `ok: true`

## Result
- Fixed.
