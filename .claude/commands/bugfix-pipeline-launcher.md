---
description: "Launch and manage the bugfix pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Use this skill whenever the user wants to start fixing bugs, run the bugfix pipeline, check bugfix progress, or stop the bugfix pipeline. Trigger on: 'start fixing bugs', 'run bugfix pipeline', 'bugfix status', 'stop bug fix', 'launch bug fix', 'start fixing bugs', 'fix progress', 'stop fixing'. (project)"
---

# Bugfix-Pipeline Launcher

Launch the autonomous bug fix pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Execution Mode

Always use daemon mode via `dev-pipeline/launch-bugfix-daemon.sh` for start/stop/status/log actions. Foreground `run-bugfix.sh` can be terminated by AI CLI command timeout, while daemon mode survives session timeout — this prevents half-finished bug fixes that leave the codebase in an inconsistent state.

### When to Use

**Start bugfix pipeline** -- User says:
- "start fixing bugs", "run bugfix pipeline", "launch bug fixes", "fix all bugs"
- "start bug fix", "run bug fix", "execute bug list", "begin fixing"
- "launch bug fix", "start fixing bugs", "run bug fix pipeline", "start fixing bugs"
- "fix all bugs", "batch fix", "launch fix pipeline"
- After bug-planner completes: "fix them", "start fixing"

**Check status** -- User says:
- "bugfix status", "check bug fixes", "how's the fixing going", "bug fix progress"
- "fix progress", "bug fix status", "check fix progress", "how far along are the fixes"

**Stop bugfix pipeline** -- User says:
- "stop bug fix", "stop fixing", "halt bugfix", "pause bug fix"
- "stop fixing", "pause bug fix", "stop fix pipeline"

**Show logs** -- User says:
- "bugfix logs", "show fix logs", "what's being fixed"
- "view fix logs", "fix logs", "check fix status"

**Do NOT use this skill when:**
- User wants to plan/collect bugs (use `bug-planner` instead)
- User wants to fix a single bug interactively in current session (use `bug-fix-workflow`)
- User wants to launch the feature pipeline (use `dev-pipeline-launcher`)

### Prerequisites

Before any action, validate:

1. **bugfix pipeline exists**: Confirm `dev-pipeline/launch-bugfix-daemon.sh` is present and executable
2. **For start**: `bug-fix-list.json` must exist in project root (or user-specified path)
3. **Dependencies**: `jq`, `python3`, AI CLI (`cbc` or `claude`) must be in PATH

Quick check:
```bash
command -v jq && command -v python3 && (command -v cbc || command -v claude) && echo "All dependencies OK"
```

If `bug-fix-list.json` is missing, inform user:
> "No bug-fix-list.json found. Run the `bug-planner` skill first to generate one, or provide a path to your bug fix list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Bugfix Pipeline

1. **Check prerequisites**:
   ```bash
   ls bug-fix-list.json 2>/dev/null && echo "Found" || echo "Missing"
   ```

2. **Check not already running**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh status 2>/dev/null
   ```
   If running, inform user and ask: "Bugfix pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show bug summary** (so user knows what will be fixed):
   ```bash
   python3 -c "
   import json
   with open('bug-fix-list.json') as f:
       data = json.load(f)
   bugs = data.get('bugs', [])
   severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
   bugs_sorted = sorted(bugs, key=lambda b: (severity_order.get(b.get('severity', 'medium'), 2), b.get('priority', 99)))
   print(f'Total bugs: {len(bugs)}')
   sev_counts = {}
   for b in bugs:
       s = b.get('severity', 'medium')
       sev_counts[s] = sev_counts.get(s, 0) + 1
   print(f'By severity: {dict(sorted(sev_counts.items(), key=lambda x: severity_order.get(x[0], 2)))}')
   print()
   for b in bugs_sorted:
       print(f\"  {b['id']}: [{b.get('severity','?').upper()}] {b.get('title', 'untitled')}\")
   "
   ```
   If pipeline state already exists, use the status command instead:
   ```bash
   python3 dev-pipeline/scripts/update-bug-status.py \
     --bug-list bug-fix-list.json \
     --state-dir dev-pipeline/bugfix-state \
     --action status 2>/dev/null
   ```

4. **Ask user to confirm**: "Ready to launch the bugfix pipeline? It will process N bugs (by severity order) in the background."

5. **Launch**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json
   ```
   If user specified environment overrides (e.g. timeout, retries, verbose):
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json --env "SESSION_TIMEOUT=7200 MAX_RETRIES=5"
   ```

6. **Verify launch**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh status
   ```

7. **Start log monitoring** -- Use the Bash tool with `run_in_background: true`:
   ```bash
   tail -f dev-pipeline/bugfix-state/pipeline-daemon.log
   ```
   This runs in background so you can continue interacting with the user.

8. **Report to user**:
   - Pipeline PID
   - Log file location
   - "You can ask me 'bugfix status' or 'show fix logs' at any time"
   - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh status
   ```

2. **Show bug-level progress**:
   ```bash
   python3 dev-pipeline/scripts/update-bug-status.py \
     --bug-list bug-fix-list.json \
     --state-dir dev-pipeline/bugfix-state \
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```bash
   tail -20 dev-pipeline/bugfix-state/pipeline-daemon.log
   ```

4. **Summarize** to user: total bugs, completed, in-progress, failed, pending, needs-info.

---

#### Intent C: Stop Bugfix Pipeline

1. **Stop the daemon**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh stop
   ```

2. **Verify stopped**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh status 2>/dev/null || true
   ```

3. **Inform user**: "Bugfix pipeline stopped. State is preserved -- you can resume later with 'start bug fix' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```bash
   dev-pipeline/launch-bugfix-daemon.sh status 2>/dev/null
   ```

2. **If running** -- Start live tail with Bash tool `run_in_background: true`:
   ```bash
   tail -f dev-pipeline/bugfix-state/pipeline-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```bash
   tail -50 dev-pipeline/bugfix-state/pipeline-daemon.log
   ```

4. **For per-bug session logs** (when user asks about a specific bug):
   ```bash
   # Check bug status for last session ID
   cat dev-pipeline/bugfix-state/bugs/<BUG_ID>/status.json 2>/dev/null
   # Then tail that bug's session log
   tail -100 dev-pipeline/bugfix-state/bugs/<BUG_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Custom Parameters

When user specifies custom settings, map to environment variables:

| User says | Environment variable |
|-----------|---------------------|
| "timeout 2 hours" | `SESSION_TIMEOUT=7200` |
| "max 5 retries" | `MAX_RETRIES=5` |
| "verbose mode" | `VERBOSE=1` |
| "heartbeat every 60s" | `HEARTBEAT_INTERVAL=60` |

Pass via `--env`:
```bash
dev-pipeline/launch-bugfix-daemon.sh start bug-fix-list.json --env "SESSION_TIMEOUT=7200 MAX_RETRIES=5 VERBOSE=1"
```

---

#### Intent F: Retry Single Bug

When user says "retry B-001":

```bash
dev-pipeline/retry-bug.sh B-001 bug-fix-list.json
```

**Note:** `retry-bug.sh` automatically cleans bug artifacts and resets status before retrying. This is equivalent to `reset-feature.sh --clean --run` in the feature pipeline. No separate reset command is needed.

Environment variables (optional):
```bash
SESSION_TIMEOUT=3600 dev-pipeline/retry-bug.sh B-001 bug-fix-list.json
```

### Error Handling

| Error | Action |
|-------|--------|
| `bug-fix-list.json` not found | Tell user to run `bug-planner` skill first |
| `jq` not installed | Suggest: `brew install jq` |
| `cbc`/`claude` not in PATH | Check AI CLI installation |
| Bugfix pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-bugfix-daemon.sh` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `tail -20 dev-pipeline/bugfix-state/pipeline-daemon.log` |
| All bugs blocked/failed/needs-info | Show status, suggest retrying or providing more info |
| Permission denied on script | Run `chmod +x dev-pipeline/launch-bugfix-daemon.sh dev-pipeline/run-bugfix.sh` |

### Integration Notes

- **After bug-planner**: This is the natural next step. When user finishes bug planning and has `bug-fix-list.json`, suggest launching the bugfix pipeline.
- **Session independence**: The bugfix pipeline runs completely detached. User can close the AI CLI, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one bugfix pipeline can run at a time. The PID file prevents duplicates.
- **Feature pipeline coexistence**: Bugfix and feature pipelines use separate state directories (`bugfix-state/` vs `state/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the bugfix pipeline resumes from where it left off -- completed bugs are not re-fixed.
- **Bug ordering**: Bugs are processed by severity (critical → high → medium → low), then by priority number within the same severity.
- **HANDOFF**: After pipeline completes all bugs, suggest running `prizmkit-retrospective` to capture lessons learned, or checking the fix reports in `.prizmkit/bugfix/`.
