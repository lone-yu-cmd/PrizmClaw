# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-014 | **Session**: F-014-20260313052934 | **Run**: run-20260312-123136
- **Complexity**: medium | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-014: "Notification and Scheduled Tasks".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

### Feature Description

定时任务与通知能力，让用户可以设置自动化任务调度。支持 cron 表达式定义的周期性任务和一次性延迟任务，任务执行后自动推送结果到 Telegram。

定时任务：/cron add "*/5 * * * *" <command> 添加周期任务；/cron add --once "2026-03-15 10:00" <command> 添加一次性任务；/jobs 查看所有定时任务列表；/jobs pause|resume|delete <id> 管理任务。

文件监听：/watch <path> 监听文件或目录变更，有变化时推送通知（使用 fs.watch）；/unwatch <path> 取消监听。

持久化：任务列表和监听规则持久化到 JSON 文件，Bot 重启后自动恢复所有任务和监听。使用 node-cron 或类似轻量级库实现调度。

### Acceptance Criteria

- 用户可通过 /cron 创建周期性定时任务，指定 cron 表达式和要执行的命令
- 支持一次性延迟任务，指定执行时间
- 定时任务执行后自动推送执行结果（stdout/stderr/退出码）到 Telegram
- /jobs 可查看、暂停、恢复、删除定时任务
- 支持 /watch 监听文件或目录变更，有变化时推送通知
- 定时任务和监听规则持久化存储，Bot 重启后自动恢复

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)
- F-013 - Session and Context Manager (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/014-notification-and-scheduled-tasks/plan.md
.prizmkit/specs/014-notification-and-scheduled-tasks/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/014-notification-and-scheduled-tasks/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/014-notification-and-scheduled-tasks/plan.md .prizmkit/specs/014-notification-and-scheduled-tasks/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-014 (slug: 014-notification-and-scheduled-tasks).
>
> 1. Read `.prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/014-notification-and-scheduled-tasks/plan.md` and `.prizmkit/specs/014-notification-and-scheduled-tasks/tasks.md`.
> 3. Implement task-by-task using TDD. Mark each task `[x]` in tasks.md immediately after completion.
> 4. After ALL tasks complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Review feature F-014 (slug: 014-notification-and-scheduled-tasks).
>
> 1. Read `.prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md` FIRST:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log': what Dev changed
> 2. Run prizmkit-code-review: verify all acceptance criteria, check code quality and correctness. Only read files mentioned in the Implementation Log.
> 3. Run the test suite and report results.
> 4. Append a 'Review Notes' section to `context-snapshot.md`: issues found (severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 5: Commit

- Run `prizmkit.summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/update-feature-status.py \
    --feature-list "/Users/loneyu/SelfProjects/PrizmClaw/feature-list.json" \
    --state-dir "/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state" \
    --feature-id "F-014" --session-id "F-014-20260313052934" --action complete
  ```
- Run `prizmkit.committer` → `feat(F-014): Notification and Scheduled Tasks`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-014/sessions/F-014-20260313052934/session-status.json`

```json
{
  "session_id": "F-014-20260313052934",
  "feature_id": "F-014",
  "feature_slug": "014-notification-and-scheduled-tasks",
  "exec_tier": 2,
  "status": "<success|partial|failed>",
  "completed_phases": [0, 1, 2, 3, 4, 5],
  "current_phase": 5,
  "checkpoint_reached": "CP-2",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md",
    "plan_path": ".prizmkit/specs/014-notification-and-scheduled-tasks/plan.md",
    "tasks_path": ".prizmkit/specs/014-notification-and-scheduled-tasks/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/014-notification-and-scheduled-tasks/` |
| Context Snapshot | `.prizmkit/specs/014-notification-and-scheduled-tasks/context-snapshot.md` |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-014/sessions/F-014-20260313052934/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `prizmkit.committer` is mandatory
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
