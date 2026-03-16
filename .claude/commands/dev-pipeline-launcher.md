---
description: Launch and manage the dev-pipeline from within an AI CLI session. Start pipeline in background, monitor logs, check status, stop pipeline. Invoke when user wants to start building features, run the pipeline, or check pipeline progress. (project)
---

# Dev-Pipeline Launcher

Launch the autonomous development pipeline from within an AI CLI conversation. The pipeline runs as a fully detached background process -- closing the AI CLI session does NOT stop the pipeline.

### Mandatory Execution Mode (MUST)

- Always use daemon mode via `dev-pipeline/launch-daemon.sh` for start/stop/status/log actions.
- NEVER run `dev-pipeline/run.sh run ...` directly from this skill.
- Reason: foreground `run.sh` can be terminated by AI CLI command timeout (e.g. cbc 120s, claude may vary), while daemon mode survives session timeout.

### When to Use

**Start pipeline** -- User says:
- "run pipeline", "start pipeline", "start building", "launch dev-pipeline"
- "run the features", "execute feature list", "start implementing"
- "启动流水线", "开始实现", "运行流水线", "开始自动开发"
- "实现接下来的步骤", "执行 feature list", "开始构建"
- After app-planner completes: "build it", "按 feature list 开始开发"

**Check status** -- User says:
- "pipeline status", "check pipeline", "how's it going", "progress"
- "流水线状态", "查看进度", "现在什么情况"

**Stop pipeline** -- User says:
- "stop pipeline", "kill pipeline", "halt", "pause"
- "停止流水线", "暂停流水线"

**Show logs** -- User says:
- "show logs", "pipeline logs", "tail logs", "what's happening"
- "查看日志", "流水线日志", "看看日志"

**Retry single feature node** -- User says:
- "retry F-003", "retry this feature", "retry this node"
- "重试 F-003", "重试这个节点", "重跑这个 feature"

**Do NOT use this skill when:**
- User wants to plan features (use `app-planner` instead)
- User wants to implement a single feature manually within current session (use `prizmkit-implement`)
- User wants to define specs/plan (use `prizmkit-specify` / `prizmkit-plan`)

### Prerequisites

Before any action, validate:

1. **dev-pipeline exists**: Confirm `dev-pipeline/launch-daemon.sh` is present and executable
2. **For start**: `feature-list.json` must exist in project root (or user-specified path)
3. **Dependencies**: `jq`, `python3`, AI CLI (`cbc` or `claude`) must be in PATH
4. **Python version**: Requires Python 3.8+ for dev-pipeline scripts

Quick check:
```bash
command -v jq && command -v python3 && (command -v cbc || command -v claude) && echo "All dependencies OK"
```

If `feature-list.json` is missing, inform user:
> "No feature-list.json found. Run the `app-planner` skill first to generate one, or provide a path to your feature list."

### Workflow

Detect user intent from their message, then follow the corresponding workflow:

---

#### Intent A: Start Pipeline

1. **Check prerequisites**:
   ```bash
   ls feature-list.json 2>/dev/null && echo "Found" || echo "Missing"
   ```

2. **Check not already running**:
   ```bash
   dev-pipeline/launch-daemon.sh status 2>/dev/null
   ```
   If running, inform user and ask: "Pipeline is already running. Want to restart it, check status, or view logs?"

3. **Show feature summary** (so user knows what will be built):
   ```bash
   python3 -c "
   import json
   with open('feature-list.json') as f:
       data = json.load(f)
   features = data.get('features', [])
   print(f'Total features: {len(features)}')
   for f in features:
       print(f\"  {f['id']}: {f.get('title', 'untitled')}\")
   "
   ```
   If pipeline state already exists, use the status command instead:
   ```bash
   python3 dev-pipeline/scripts/update-feature-status.py \
     --feature-list feature-list.json \
     --state-dir dev-pipeline/state \
     --action status 2>/dev/null
   ```

4. **Ask user to confirm**: "Ready to launch the pipeline? It will process N features in the background."

5. **Launch**:
   ```bash
   dev-pipeline/launch-daemon.sh start feature-list.json
   ```
   If user specified environment overrides (e.g. timeout, retries, verbose):
   ```bash
   dev-pipeline/launch-daemon.sh start feature-list.json --env "SESSION_TIMEOUT=7200 MAX_RETRIES=5"
   ```

6. **Verify launch**:
   ```bash
   dev-pipeline/launch-daemon.sh status
   ```

7. **Start log monitoring** -- Use the Bash tool with `run_in_background: true`:
   ```bash
   tail -f dev-pipeline/state/pipeline-daemon.log
   ```
   This runs in background so you can continue interacting with the user.

8. **Report to user**:
   - Pipeline PID
   - Log file location
   - "You can ask me 'pipeline status' or 'show logs' at any time"
   - "Closing this session will NOT stop the pipeline"

---

#### Intent B: Check Status

1. **Check daemon status**:
   ```bash
   dev-pipeline/launch-daemon.sh status
   ```

2. **Show feature-level progress**:
   ```bash
   python3 dev-pipeline/scripts/update-feature-status.py \
     --feature-list feature-list.json \
     --state-dir dev-pipeline/state \
     --action status
   ```

3. **Show recent log activity** (last 20 lines):
   ```bash
   tail -20 dev-pipeline/state/pipeline-daemon.log
   ```

4. **Summarize** to user: total features, completed, in-progress, failed, pending.

---

#### Intent C: Stop Pipeline

1. **Stop the daemon**:
   ```bash
   dev-pipeline/launch-daemon.sh stop
   ```

2. **Verify stopped**:
   ```bash
   dev-pipeline/launch-daemon.sh status 2>/dev/null || true
   ```

3. **Inform user**: "Pipeline stopped. State is preserved -- you can resume later with 'start pipeline' and it will pick up where it left off."

---

#### Intent D: Show Logs

1. **Check if running**:
   ```bash
   dev-pipeline/launch-daemon.sh status 2>/dev/null
   ```

2. **If running** -- Start live tail with Bash tool `run_in_background: true`:
   ```bash
   tail -f dev-pipeline/state/pipeline-daemon.log
   ```

3. **If not running** -- Show last 50 lines:
   ```bash
   tail -50 dev-pipeline/state/pipeline-daemon.log
   ```

4. **For per-feature session logs** (when user asks about a specific feature):
   ```bash
   # Find current/recent session
   cat dev-pipeline/state/current-session.json 2>/dev/null
   # Then tail that feature's session log
   tail -100 dev-pipeline/state/features/<FEATURE_ID>/sessions/<SESSION_ID>/logs/session.log
   ```

---

#### Intent E: Custom Parameters

When user specifies custom settings, map to environment variables:

| User says | Environment variable |
|-----------|---------------------|
| "timeout 2 hours" / "超时2小时" | `SESSION_TIMEOUT=7200` |
| "max 5 retries" / "最多重试5次" | `MAX_RETRIES=5` |
| "verbose mode" / "详细模式" | `VERBOSE=1` |
| "heartbeat every 60s" | `HEARTBEAT_INTERVAL=60` |

Pass via `--env`:
```bash
dev-pipeline/launch-daemon.sh start feature-list.json --env "SESSION_TIMEOUT=7200 MAX_RETRIES=5 VERBOSE=1"
```

---

#### Intent F: Retry Single Feature Node

When user says "retry F-003" or "重试 F-003":

```bash
dev-pipeline/retry-feature.sh F-003 feature-list.json
```

When user says "从头重试 F-003" or "clean retry F-003":

```bash
dev-pipeline/reset-feature.sh F-003 --clean --run feature-list.json
```

Environment variables (optional):
```bash
SESSION_TIMEOUT=3600 dev-pipeline/retry-feature.sh F-003 feature-list.json
```

Notes:
- `retry-feature.sh` runs exactly one feature session and exits.
- `reset-feature.sh --clean --run` clears the feature state before retrying (fresh start).
- Keep pipeline daemon mode for main run management (`launch-daemon.sh`).

### Error Handling

| Error | Action |
|-------|--------|
| `feature-list.json` not found | Tell user to run `app-planner` skill first |
| `jq` not installed | Suggest: `brew install jq` |
| `cbc`/`claude` not in PATH | Check AI CLI installation |
| Pipeline already running | Show status, ask if user wants to stop and restart |
| PID file stale (process dead) | `launch-daemon.sh` auto-cleans, retry start |
| Launch failed (process died immediately) | Show last 20 lines of log: `tail -20 dev-pipeline/state/pipeline-daemon.log` |
| Feature stuck/blocked | Use `retry-feature.sh <F-XXX>` to retry; use `reset-feature.sh <F-XXX> --clean --run` for fresh start |
| All features blocked/failed | Show status, suggest daemon-safe recovery: `dev-pipeline/reset-feature.sh <F-XXX> --clean --run feature-list.json` |
| Permission denied on script | Run `chmod +x dev-pipeline/launch-daemon.sh dev-pipeline/run.sh` |

### Integration Notes

- **After app-planner**: This is the natural next step. When user finishes planning and has `feature-list.json`, suggest launching the pipeline.
- **Session independence**: The pipeline runs completely detached. User can close the AI CLI session, open a new session later, and use this skill to check progress or stop the pipeline.
- **Single instance**: Only one pipeline can run at a time. The PID file prevents duplicates.
- **Pipeline coexistence**: Feature and bugfix pipelines use separate state directories (`state/` vs `bugfix-state/`), so they can run simultaneously without conflict.
- **State preservation**: Stopping and restarting the pipeline resumes from where it left off -- completed features are not re-run.
- **HANDOFF**: After pipeline completes all features, suggest running `prizmkit-code-review` for overall review, or `prizmkit-summarize` to archive.
