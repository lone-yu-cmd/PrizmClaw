# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-013 | **Session**: F-013-20260313051900 | **Run**: run-20260312-123136
- **Complexity**: medium | **Retry**: 1 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-013: "Session and Context Manager".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

### Feature Description

会话管理与上下文保持系统，为多用户场景提供独立的会话隔离和状态管理。每个 Telegram 用户有独立的工作上下文（当前工作目录、环境变量覆盖、命令历史），会话超时后自动清理。

核心能力：多用户会话隔离——每个用户的工作目录、环境变量互不干扰；命令历史——/history 查看近期执行的命令，支持 /history N 指定条数；命令别名——/alias name=command 定义常用命令快捷方式，/alias 查看所有别名，别名持久化存储；会话超时——配置 SESSION_TIMEOUT 后不活跃会话自动清理并通知用户；管理员能力——admin 用户可通过 /sessions 查看所有活跃会话。

与 F-009 的工作目录切换、F-006 的权限系统、现有 MAX_HISTORY_TURNS 配置集成。

### Acceptance Criteria

- 每个用户有独立的会话上下文，工作目录和环境变量互不干扰
- /history 可查看近期命令历史，支持指定条数
- /alias 支持定义、查看和删除命令别名，别名持久化存储
- 会话超时后自动清理临时状态并通知用户
- 管理员可通过 /sessions 查看所有活跃会话的概要信息
- 会话状态在 Bot 重启后可从持久化存储恢复

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)
- F-006 - Safety and Permission Guard (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/013-session-and-context-manager/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/013-session-and-context-manager/plan.md
.prizmkit/specs/013-session-and-context-manager/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/013-session-and-context-manager/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/013-session-and-context-manager/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/013-session-and-context-manager/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/013-session-and-context-manager/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/013-session-and-context-manager/plan.md .prizmkit/specs/013-session-and-context-manager/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-013 (slug: 013-session-and-context-manager).
>
> 1. Read `.prizmkit/specs/013-session-and-context-manager/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/013-session-and-context-manager/plan.md` and `.prizmkit/specs/013-session-and-context-manager/tasks.md`.
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
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Review feature F-013 (slug: 013-session-and-context-manager).
>
> 1. Read `.prizmkit/specs/013-session-and-context-manager/context-snapshot.md` FIRST:
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
    --feature-id "F-013" --session-id "F-013-20260313051900" --action complete
  ```
- Run `prizmkit.committer` → `feat(F-013): Session and Context Manager`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-013/sessions/F-013-20260313051900/session-status.json`

```json
{
  "session_id": "F-013-20260313051900",
  "feature_id": "F-013",
  "feature_slug": "013-session-and-context-manager",
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
    "context_snapshot_path": ".prizmkit/specs/013-session-and-context-manager/context-snapshot.md",
    "plan_path": ".prizmkit/specs/013-session-and-context-manager/plan.md",
    "tasks_path": ".prizmkit/specs/013-session-and-context-manager/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/013-session-and-context-manager/` |
| Context Snapshot | `.prizmkit/specs/013-session-and-context-manager/context-snapshot.md` |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-013/sessions/F-013-20260313051900/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `prizmkit.committer` is mandatory
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
