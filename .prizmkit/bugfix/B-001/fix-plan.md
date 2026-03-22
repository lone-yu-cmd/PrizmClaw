# B-001 Fix Plan

- Bug: Web UI all buttons fail with `Failed to fetch`
- Root cause: service bound to `127.0.0.1`, inaccessible from LAN IP
- Scope:
  - `src/config.js` default `WEB_HOST`
  - `.env.example` default `WEB_HOST`
- Validation:
  - `http://127.0.0.1:8787/` returns 200
  - `http://<LAN_IP>:8787/` returns 200
  - `/api/chat`, `/api/screenshot`, `/api/system/exec` endpoints are reachable
