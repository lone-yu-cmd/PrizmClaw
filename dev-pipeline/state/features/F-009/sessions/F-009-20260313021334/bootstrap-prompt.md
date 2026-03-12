# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-009 | **Session**: F-009-20260313021334 | **Run**: run-20260312-123136
- **Complexity**: medium | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: false | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-009: "General Command Executor".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

### Feature Description

通用命令执行引擎，将 PrizmClaw 从纯 pipeline 控制工具升级为通用远程 CLI 助手。用户在 Telegram 中发送任意 shell 命令（如 ls、git status、npm run build 等），Bot 在电脑端执行并将 stdout/stderr 回传。

核心能力：基于现有 ENABLE_SYSTEM_EXEC 与 ALLOWED_COMMAND_PREFIXES 配置扩展，支持可配置的命令白名单/黑名单安全策略；命令执行有超时保护（SYSTEM_EXEC_TIMEOUT_MS），超时后自动 SIGTERM → SIGKILL 并通知用户；长输出自动截断至 Telegram 消息长度限制并支持 /more 分页查看剩余内容；支持通过 /cd 命令切换工作目录且目录状态在用户会话内保持。

命令入口格式：直接发送文本即当作 shell 命令执行（当 ENABLE_SYSTEM_EXEC=true），或使用 /exec <cmd> 前缀显式调用。需要与 F-006 的权限系统集成，高风险命令（rm -rf、sudo 等）需要二次确认。

### Acceptance Criteria

- 用户发送 shell 命令，Bot 在电脑端执行并返回 stdout/stderr 结果
- 支持可配置的命令白名单/黑名单安全策略，黑名单命令直接拒绝并提示原因
- 命令执行有超时保护，超时后自动终止进程并向用户返回超时提示
- 长输出（超过 Telegram 4096 字符限制）自动截断并支持 /more 分页查看
- 支持通过 /cd 切换工作目录，目录状态在用户会话内保持
- 高风险命令（含 rm -rf、sudo、kill 等关键词）执行前需用户二次确认

### Dependencies (Already Completed)

- F-001 - Project Infrastructure Setup (completed)
- F-006 - Safety and Permission Guard (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/009-general-command-executor/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/009-general-command-executor/plan.md
.prizmkit/specs/009-general-command-executor/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/009-general-command-executor/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/009-general-command-executor/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: Project Bootstrap
- Run `prizmkit.init` (invoke the prizmkit-init skill)
- Run `python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-009 --feature-slug 009-general-command-executor`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/009-general-command-executor/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/009-general-command-executor/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/009-general-command-executor/plan.md .prizmkit/specs/009-general-command-executor/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-009 (slug: 009-general-command-executor).
>
> 1. Read `.prizmkit/specs/009-general-command-executor/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/009-general-command-executor/plan.md` and `.prizmkit/specs/009-general-command-executor/tasks.md`.
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
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Review feature F-009 (slug: 009-general-command-executor).
>
> 1. Read `.prizmkit/specs/009-general-command-executor/context-snapshot.md` FIRST:
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
    --feature-id "F-009" --session-id "F-009-20260313021334" --action complete
  ```
- Run `prizmkit.committer` → `feat(F-009): General Command Executor`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-009/sessions/F-009-20260313021334/session-status.json`

```json
{
  "session_id": "F-009-20260313021334",
  "feature_id": "F-009",
  "feature_slug": "009-general-command-executor",
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
    "context_snapshot_path": ".prizmkit/specs/009-general-command-executor/context-snapshot.md",
    "plan_path": ".prizmkit/specs/009-general-command-executor/plan.md",
    "tasks_path": ".prizmkit/specs/009-general-command-executor/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/009-general-command-executor/` |
| Context Snapshot | `.prizmkit/specs/009-general-command-executor/context-snapshot.md` |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-009/sessions/F-009-20260313021334/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `prizmkit.committer` is mandatory
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
