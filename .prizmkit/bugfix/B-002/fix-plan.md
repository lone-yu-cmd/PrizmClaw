# B-002 Fix Plan

- Bug: system command button unavailable
- Root cause: `ENABLE_SYSTEM_EXEC=false` in runtime env
- Scope: runtime configuration only
- Validation: `POST /api/system/exec` with `pwd` should return `ok: true`
