# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-012 | **Session**: F-012-20260313042923 | **Run**: run-20260312-123136
- **Complexity**: medium | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-012: "System Monitor".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

### Feature Description

系统信息查看与监控能力，让用户随时了解电脑的运行状态。通过 Telegram 命令获取 CPU、内存、磁盘、网络等系统指标，查看进程列表，管理进程生命周期。

命令设计：/sysinfo 返回系统概览（CPU 使用率、内存占用、磁盘空间、系统运行时间、网络状态）；/ps 返回进程列表支持按 CPU/内存排序和过滤；/kill <pid> 终止进程（需权限确认，集成 F-006）。

告警能力：支持通过 /monitor set cpu>80 等语法设置阈值告警，超过阈值时自动推送通知到 Telegram。告警规则持久化存储。

实现方式：使用 Node.js 原生 os 模块和 child_process 获取系统信息，避免引入重量级系统监控依赖。系统信息以格式化表格或 Markdown 展示，保证可读性。

### Acceptance Criteria

- /sysinfo 返回 CPU、内存、磁盘、网络的当前状态摘要，格式化为可读表格
- /ps 返回进程列表，支持按 CPU/内存排序，支持过滤关键词
- /kill 可终止指定进程，执行前需权限确认（集成 F-006 权限系统）
- 支持设置监控阈值（如 CPU>80%），超过阈值时自动推送告警到 Telegram
- 告警规则持久化存储，Bot 重启后自动恢复监控
- 系统信息展示适配 Telegram 消息格式，信息密度高且可读性好

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/012-system-monitor/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/012-system-monitor/plan.md
.prizmkit/specs/012-system-monitor/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/012-system-monitor/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/012-system-monitor/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/012-system-monitor/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/012-system-monitor/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/012-system-monitor/plan.md .prizmkit/specs/012-system-monitor/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-012 (slug: 012-system-monitor).
>
> 1. Read `.prizmkit/specs/012-system-monitor/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/012-system-monitor/plan.md` and `.prizmkit/specs/012-system-monitor/tasks.md`.
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
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Review feature F-012 (slug: 012-system-monitor).
>
> 1. Read `.prizmkit/specs/012-system-monitor/context-snapshot.md` FIRST:
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
    --feature-id "F-012" --session-id "F-012-20260313042923" --action complete
  ```
- Run `prizmkit.committer` → `feat(F-012): System Monitor`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-012/sessions/F-012-20260313042923/session-status.json`

```json
{
  "session_id": "F-012-20260313042923",
  "feature_id": "F-012",
  "feature_slug": "012-system-monitor",
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
    "context_snapshot_path": ".prizmkit/specs/012-system-monitor/context-snapshot.md",
    "plan_path": ".prizmkit/specs/012-system-monitor/plan.md",
    "tasks_path": ".prizmkit/specs/012-system-monitor/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/012-system-monitor/` |
| Context Snapshot | `.prizmkit/specs/012-system-monitor/context-snapshot.md` |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-012/sessions/F-012-20260313042923/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `prizmkit.committer` is mandatory
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
