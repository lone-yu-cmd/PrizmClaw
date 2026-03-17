# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: F-016 | **Session**: F-016-20260317172609 | **Run**: run-20260317-091756
- **Complexity**: low | **Retry**: 1 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-016: "Telegram Command Bug Fixes".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written.

**Tier 1 — Single Agent**: You handle everything directly. No subagents, no TeamCreate.

### Feature Description

修复现有 Telegram 命令的已知 bug，确保所有已注册命令可正常工作。

已知问题：(1) /planner run 报错 Invalid pipelineType: planner — handlePlanner 向 handlePipeline 传递了 type='planner'，但 script-runner.js 的 PIPELINE_TYPES 只支持 feature 和 bugfix，需要将 planner handler 的 type 映射为 feature；(2) pipeline.js meta 中 params.type.enum 包含不存在的 'planner' 类型，需移除或改为由 planner handler 自行处理；(3) 排查并修复其他命令路由中的类似类型映射问题。

### Acceptance Criteria

- /planner run <target> 不再报 Invalid pipelineType 错误，正确启动 feature 类型 pipeline
- /planner status 返回当前 pipeline 状态而不是错误
- pipeline meta 的 type enum 与 script-runner PIPELINE_TYPES 保持一致
- 所有已注册的 Telegram 命令发送后均能正常响应，无未捕获异常

### Dependencies (Already Completed)

- F-002 - Telegram Pipeline Command Router (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/016-telegram-command-bug-fixes/context-snapshot.md
.prizmkit/specs/016-telegram-command-bug-fixes/plan.md
.prizmkit/specs/016-telegram-command-bug-fixes/tasks.md
.prizmkit/specs/REGISTRY.md
```

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot

```bash
ls .prizmkit/specs/016-telegram-command-bug-fixes/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/016-telegram-command-bug-fixes/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: output of relevant `ls src/` calls
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/016-telegram-command-bug-fixes/ 2>/dev/null
```

If plan.md or tasks.md missing, write them directly (no PM needed):
- `plan.md`: key components, data flow, files to create/modify (under 80 lines)
- `tasks.md`: checklist with `[ ]` checkboxes, each task = one implementable unit

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement

For each task in tasks.md:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task
4. Mark task `[x]` in tasks.md immediately

After all tasks complete, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

### Phase 4: Self-Review

1. Re-read acceptance criteria from Section 1 of context-snapshot.md
2. Run the full test suite
3. Check error handling and edge cases
4. Fix any issues found

**CP-2**: All acceptance criteria met, tests pass.

### Phase 4.5: Prizm Doc Update (mandatory for feature sessions)

Run `/prizmkit-prizm-docs` and sync project docs before commit:
1. Use `git diff --cached --name-status` (fallback: `git diff --name-status`) to locate changed modules
2. Update affected `.prizm-docs/` files (L1/L2, changelog.prizm)
3. Stage documentation updates (`git add .prizm-docs/`) if changed

Doc maintenance pass condition (pipeline-enforced): `REGISTRY.md` **or** `.prizm-docs/` changed in the final commit.

### Phase 4.7: Retrospective (feature sessions only, before commit)

If this session is a feature (not a bug-fix-only commit), run `/prizmkit-retrospective` now — **before committing**.
Retrospective must update relevant `.prizm-docs/` sections (TRAPS/RULES/DECISIONS) when applicable, so those changes are included in the feature commit.
Stage any `.prizm-docs/` changes produced: `git add .prizm-docs/`

### Phase 5: Commit

- Run `/prizmkit-summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/scripts/update-feature-status.py \
    --feature-list "/Users/wylonyu/selfProjects/PrizmClaw/feature-list.json" \
    --state-dir "/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state" \
    --feature-id "F-016" --session-id "F-016-20260317172609" --action complete
  ```
- Run `/prizmkit-committer` → `feat(F-016): Telegram Command Bug Fixes`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.

---

## Step 3: Write Session Status

Write to: `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-016/sessions/F-016-20260317172609/session-status.json`

```json
{
  "session_id": "F-016-20260317172609",
  "feature_id": "F-016",
  "feature_slug": "016-telegram-command-bug-fixes",
  "exec_tier": 1,
  "status": "<success|partial|failed|commit_missing|docs_missing>",
  "completed_phases": [0, 1, 2, 3, 4, 5],
  "current_phase": 5,
  "checkpoint_reached": "CP-2",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "docs_maintained": true,
  "retrospective_done": true,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/016-telegram-command-bug-fixes/context-snapshot.md",
    "plan_path": ".prizmkit/specs/016-telegram-command-bug-fixes/plan.md",
    "tasks_path": ".prizmkit/specs/016-telegram-command-bug-fixes/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

### Step 3.1: Final Clean Check (before exit)

After writing `session-status.json`, verify repository is clean:

```bash
git status --short
```

If any files remain, include them in the last commit:

```bash
git add -A
git commit --amend --no-edit
```

Re-check `git status --short` and ensure it is empty before exiting.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/016-telegram-command-bug-fixes/` |
| Context Snapshot | `.prizmkit/specs/016-telegram-command-bug-fixes/context-snapshot.md` |
| Session Status Output | /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-016/sessions/F-016-20260317172609/session-status.json |
| Project Root | /Users/wylonyu/selfProjects/PrizmClaw |

## Reminders

- Tier 1: you do everything — no subagents, no TeamCreate
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Before exiting, `git status --short` must be empty
