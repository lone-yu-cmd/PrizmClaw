# Dev-Pipeline Session Bootstrap

## Session Context

- **Pipeline Run ID**: run-20260312-123136
- **Session ID**: F-009-20260312221228
- **Feature ID**: F-009
- **Feature Title**: General Command Executor
- **Feature Slug**: 009-general-command-executor
- **Complexity**: medium (mode: standard)
- **Retry Count**: 0 / 3
- **Previous Session Status**: N/A (first run)
- **Resume From Phase**: null
- **Init Status**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-009: "General Command Executor".

**CRITICAL SESSION LIFECYCLE RULE**: You are the main session process. You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, you MUST **wait for each to finish** (run_in_background=false) before proceeding. Do NOT spawn an agent in the background and exit — that kills the session.

**MANDATORY TEAM REQUIREMENT**: You MUST use the `prizm-dev-team` multi-agent team to complete this feature. This is NON-NEGOTIABLE. You are FORBIDDEN from implementing the feature as a single agent — all work MUST be distributed through the prizm-dev-team members (PM, Dev, Reviewer). Specifically:
1. You MUST ensure a prizm-dev-team is available before starting any phase (see Step 1 below for reuse-or-create logic)
2. You MUST spawn PM, Dev, and Reviewer agents using the `Task` tool with `team_name` and `subagent_type` parameters
3. Every implementation, planning, and review phase MUST be executed by the appropriate team agent — NOT by you directly
4. If you attempt to do the work yourself without spawning team agents, the session is considered FAILED

### Team Definition Reference

The prizm-dev-team definition is maintained in the project at:
- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed team config (current platform)**: `/Users/wylonyu/.codebuddy/teams/prizm-dev-team/config.json`
  - CodeBuddy: `~/.codebuddy/teams/prizm-dev-team/config.json` — full team config with members, may support reuse
  - Claude Code: `.claude/team-info.json` — reference only (no native team system; agents are in `.claude/agents/`)

When creating a new team, use these files as reference for team member names, roles, agentTypes, and prompts.

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

**ALWAYS** use per-feature subdirectory `.prizmkit/specs/009-general-command-executor/`:

```
.prizmkit/specs/009-general-command-executor/spec.md
.prizmkit/specs/009-general-command-executor/plan.md
.prizmkit/specs/009-general-command-executor/tasks.md
.prizmkit/specs/REGISTRY.md
```

## Execution Instructions

**YOU are the orchestrator. Do NOT delegate to a Coordinator agent. Execute each phase yourself by spawning the appropriate team agent with run_in_background=false and waiting for its result.**

**TEAM ENFORCEMENT**: Every phase below that mentions spawning a PM/Dev/Reviewer agent MUST use the `Task` tool with the active team's `team_name`. You MUST NOT skip the team setup step or attempt to perform PM/Dev/Reviewer work yourself. Violation of this rule constitutes a session failure.

### Step 1: Initialize

#### Team Setup: Reuse or Create

Different AI CLI platforms have different team lifecycle behaviors. Some support reusing an existing team across sessions; others require creating a new team every time.

**Follow this logic to determine team availability:**

1. **Check if a team already exists and can be reused**:
   - Read the team config file at `/Users/wylonyu/.codebuddy/teams/prizm-dev-team/config.json`
   - If it exists and is valid (has members with correct agentTypes like `prizm-dev-team-pm`, `prizm-dev-team-dev`, `prizm-dev-team-reviewer`), try to reuse it
   - Set `TEAM_REUSED=true` and record the `team_name` from the config

2. **If no reusable team exists, create a new one**:
   - Reference the team definition at `core/team/prizm-dev-team.json` (source of truth for member roles and prompts)
   - Call `TeamCreate` with `team_name="prizm-dev-team-F-009"` and `description="Implementing General Command Executor"`
   - Set `TEAM_REUSED=false`

3. **Record which path was taken** — this determines whether `TeamDelete` is needed at the end (only delete if you created; do NOT delete a reused team)

#### Initialize dev-team directories

```bash
python3 /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/wylonyu/selfProjects/PrizmClaw --feature-id F-009 --feature-slug 009-general-command-executor
```


### Step 2: Pipeline Phases

#### Phase 0: SKIP (already initialized)


#### Phase 1-3: Specify + Plan + Tasks (combined, one PM session)
- Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false)
  Prompt: "Read /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. For feature F-009 (slug: 009-general-command-executor), complete all three planning steps in this single session:
  1. Run prizmkit-specify → generate `.prizmkit/specs/009-general-command-executor/spec.md` (concise, under 150 lines)
  2. Run prizmkit-plan → generate `.prizmkit/specs/009-general-command-executor/plan.md` (architecture, components, interface design, data model, testing strategy — all in one file)
  3. Run prizmkit-tasks → generate `.prizmkit/specs/009-general-command-executor/tasks.md` with `[ ]` checkboxes
  All three files go under `.prizmkit/specs/009-general-command-executor/`."
- **Wait for PM to return**
- **CP-1**: spec.md, plan.md, and tasks.md all exist

#### Phase 4: Analyze (cross-check)
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Run prizmkit-analyze for feature F-009 (slug: 009-general-command-executor). Cross-check `.prizmkit/specs/009-general-command-executor/spec.md`, `plan.md`, and `tasks.md` for consistency. Report any CRITICAL or HIGH issues."
- **Wait for Reviewer to return**
- If CRITICAL issues found: spawn PM to fix, then re-run analyze (max 1 round)
- **CP-2**: No CRITICAL issues


#### Phase 5: Schedule & Implement
- Read tasks from `.prizmkit/specs/009-general-command-executor/tasks.md`
- Create TaskList entries and assign to Dev agents
- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement all tasks for feature F-009 (slug: 009-general-command-executor) using prizmkit-implement with TDD. Read the plan from `.prizmkit/specs/009-general-command-executor/plan.md` and tasks from `tasks.md`. Mark completed tasks [x] in tasks.md."
- **Wait for Dev to return**
- All tasks marked `[x]`, tests pass

#### Phase 6: Review
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-009 (slug: 009-general-command-executor):
  1. Run prizmkit-code-review for spec compliance and code quality
  2. Write and execute integration tests covering all user stories from spec.md
  Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."
- **Wait for Reviewer to return**
- If NEEDS_FIXES: spawn Dev to fix, then re-run Review (max 3 rounds)
- **CP-3**: Integration tests pass, review verdict is not NEEDS_FIXES

#### Phase 7: Summarize & Commit — DO NOT SKIP

**IMPORTANT**: Phase 7 is for **new feature** commits only. If this session is a bug fix to an existing feature, skip `prizmkit.summarize` (do NOT create new REGISTRY.md entries for bug fixes — bugs are refinements of incomplete features, not new functionality). Still run `prizmkit.committer` with `fix(<scope>):` prefix.

**7a.** Run `prizmkit.summarize` (invoke the prizmkit-summarize skill) → archive to REGISTRY.md

**7b.** Run `prizmkit.committer` (invoke the prizmkit-committer skill) → `feat(F-009): General Command Executor`, do NOT push

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-009/sessions/F-009-20260312221228/session-status.json`

```json
{
  "session_id": "F-009-20260312221228",
  "feature_id": "F-009",
  "feature_slug": "009-general-command-executor",
  "status": "<success|partial|failed>",
  "completed_phases": [0, 1, 2, 3, 4, 5, 6, 7],
  "current_phase": 7,
  "checkpoint_reached": "CP-3",
  "tasks_completed": 12,
  "tasks_total": 12,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "spec_path": ".prizmkit/specs/009-general-command-executor/spec.md",
    "plan_path": ".prizmkit/specs/009-general-command-executor/plan.md",
    "tasks_path": ".prizmkit/specs/009-general-command-executor/tasks.md"
  },
  "git_commit": "<commit hash if Phase 7 completed>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

**Status values**: `success` (all phases done) | `partial` (can resume) | `failed` (unrecoverable)

If you encounter an error, still write session-status.json with status="failed" and error details.

### Step 4: Team Cleanup (conditional)

**Only if you CREATED the team in Step 1** (i.e. `TEAM_REUSED=false`), clean up:
```
TeamDelete
```

**If you REUSED an existing team** (i.e. `TEAM_REUSED=true`), do NOT call `TeamDelete` — the team is shared and may be used by other sessions.

## Critical Paths

| Resource | Path |
|----------|------|
| Team Definition (source of truth) | `core/team/prizm-dev-team.json` |
| Team Config (installed) | `/Users/wylonyu/.codebuddy/teams/prizm-dev-team/config.json` |
| Feature Artifacts Dir | `.prizmkit/specs/009-general-command-executor/` |
| PM Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md |
| Dev Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-009/sessions/F-009-20260312221228/session-status.json |
| Project Root | /Users/wylonyu/selfProjects/PrizmClaw |

## Reminders

- **MANDATORY**: You MUST use `prizm-dev-team` (reuse existing or create new) — single-agent execution is FORBIDDEN
- **Team definition source**: `core/team/prizm-dev-team.json`; installed at `/Users/wylonyu/.codebuddy/teams/prizm-dev-team/config.json`
- **All artifacts go under `.prizmkit/specs/009-general-command-executor/`** — only 3 files: spec.md, plan.md, tasks.md
- Dev agents use TDD approach
- Phase 7 (summarize + commit) is MANDATORY
- ALWAYS write session-status.json before exiting
- **NEVER exit the session early** — wait for all spawned agents to complete
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if you created the team; do NOT delete a reused team
