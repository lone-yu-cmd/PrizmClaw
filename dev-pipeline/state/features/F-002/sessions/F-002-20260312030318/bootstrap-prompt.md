# Dev-Pipeline Session Bootstrap

## Session Context

- **Pipeline Run ID**: run-20260311-175307
- **Session ID**: F-002-20260312030318
- **Feature ID**: F-002
- **Feature Title**: Telegram Pipeline Command Router
- **Feature Slug**: 002-telegram-pipeline-command-router
- **Complexity**: medium (mode: standard)
- **Retry Count**: 0 / 3
- **Previous Session Status**: N/A (first run)
- **Resume From Phase**: 6
- **Init Status**: true | Artifacts: spec=true plan=true tasks=true

## Your Mission

You are the **session orchestrator**. Implement Feature F-002: "Telegram Pipeline Command Router".

**CRITICAL SESSION LIFECYCLE RULE**: You are the main session process. You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, you MUST **wait for each to finish** (run_in_background=false) before proceeding. Do NOT spawn an agent in the background and exit — that kills the session.

**MANDATORY TEAM REQUIREMENT**: You MUST use the `prizm-dev-team` multi-agent team to complete this feature. This is NON-NEGOTIABLE. You are FORBIDDEN from implementing the feature as a single agent — all work MUST be distributed through the prizm-dev-team members (PM, Dev, Reviewer). Specifically:
1. You MUST ensure a prizm-dev-team is available before starting any phase (see Step 1 below for reuse-or-create logic)
2. You MUST spawn PM, Dev, and Reviewer agents using the `Task` tool with `team_name` and `subagent_type` parameters
3. Every implementation, planning, and review phase MUST be executed by the appropriate team agent — NOT by you directly
4. If you attempt to do the work yourself without spawning team agents, the session is considered FAILED

### Team Definition Reference

The prizm-dev-team definition is maintained in the project at:
- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed team config (current platform)**: `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json`
  - CodeBuddy: `~/.codebuddy/teams/prizm-dev-team/config.json` — full team config with members, may support reuse
  - Claude Code: `.claude/team-info.json` — reference only (no native team system; agents are in `.claude/agents/`)

When creating a new team, use these files as reference for team member names, roles, agentTypes, and prompts.

### Feature Description

在 Telegram Bot 中新增管道控制命令路由层，支持解析与分发 /pipeline、/bugfix、/planner、/status、/logs、/stop 等命令，并将参数规范化后交给后端控制模块执行。该功能只负责命令语义与输入验证，不直接承载长任务执行。

需要提供统一帮助文本、参数错误提示、未授权用户拦截以及命令别名映射，以保证后续可扩展性。

### Acceptance Criteria

- Bot 能识别并正确路由核心管道命令，未知命令返回帮助信息
- 参数解析支持子命令与可选参数，错误参数会返回明确修正建议
- 未授权用户无法调用高权限命令，且会收到统一拒绝提示
- 命令路由层与执行层解耦，具备可测试的 handler 接口

### Dependencies (Already Completed)

- F-001 - Project Infrastructure Setup (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

**ALWAYS** use per-feature subdirectory `.prizmkit/specs/002-telegram-pipeline-command-router/`:

```
.prizmkit/specs/002-telegram-pipeline-command-router/spec.md
.prizmkit/specs/002-telegram-pipeline-command-router/plan.md
.prizmkit/specs/002-telegram-pipeline-command-router/tasks.md
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
   - Read the team config file at `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json`
   - If it exists and is valid (has members with correct agentTypes like `prizm-dev-team-pm`, `prizm-dev-team-dev`, `prizm-dev-team-reviewer`), try to reuse it
   - Set `TEAM_REUSED=true` and record the `team_name` from the config

2. **If no reusable team exists, create a new one**:
   - Reference the team definition at `core/team/prizm-dev-team.json` (source of truth for member roles and prompts)
   - Call `TeamCreate` with `team_name="prizm-dev-team-F-002"` and `description="Implementing Telegram Pipeline Command Router"`
   - Set `TEAM_REUSED=false`

3. **Record which path was taken** — this determines whether `TeamDelete` is needed at the end (only delete if you created; do NOT delete a reused team)


#### Resume Context

This is a **resume** from Phase 6. After completing the team setup above:
1. Read artifacts in `.prizmkit/specs/002-telegram-pipeline-command-router/` (spec.md, plan.md, tasks.md)
2. Resume the pipeline from Phase 6 below

### Step 2: Pipeline Phases

#### Phase 0: SKIP (already initialized)


#### Phase 1-3: Specify + Plan + Tasks (combined, one PM session)
- Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. For feature F-002 (slug: 002-telegram-pipeline-command-router), complete all three planning steps in this single session:
  1. Run prizmkit-specify → generate `.prizmkit/specs/002-telegram-pipeline-command-router/spec.md` (concise, under 150 lines)
  2. Run prizmkit-plan → generate `.prizmkit/specs/002-telegram-pipeline-command-router/plan.md` (architecture, components, interface design, data model, testing strategy — all in one file)
  3. Run prizmkit-tasks → generate `.prizmkit/specs/002-telegram-pipeline-command-router/tasks.md` with `[ ]` checkboxes
  All three files go under `.prizmkit/specs/002-telegram-pipeline-command-router/`."
- **Wait for PM to return**
- **CP-1**: spec.md, plan.md, and tasks.md all exist

#### Phase 4: Analyze (cross-check)
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Run prizmkit-analyze for feature F-002 (slug: 002-telegram-pipeline-command-router). Cross-check `.prizmkit/specs/002-telegram-pipeline-command-router/spec.md`, `plan.md`, and `tasks.md` for consistency. Report any CRITICAL or HIGH issues."
- **Wait for Reviewer to return**
- If CRITICAL issues found: spawn PM to fix, then re-run analyze (max 1 round)
- **CP-2**: No CRITICAL issues


#### Phase 5: Schedule & Implement
- Read tasks from `.prizmkit/specs/002-telegram-pipeline-command-router/tasks.md`
- Create TaskList entries and assign to Dev agents
- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement all tasks for feature F-002 (slug: 002-telegram-pipeline-command-router) using prizmkit-implement with TDD. Read the plan from `.prizmkit/specs/002-telegram-pipeline-command-router/plan.md` and tasks from `tasks.md`. Mark completed tasks [x] in tasks.md."
- **Wait for Dev to return**
- All tasks marked `[x]`, tests pass

#### Phase 6: Review
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-002 (slug: 002-telegram-pipeline-command-router):
  1. Run prizmkit-code-review for spec compliance and code quality
  2. Write and execute integration tests covering all user stories from spec.md
  Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."
- **Wait for Reviewer to return**
- If NEEDS_FIXES: spawn Dev to fix, then re-run Review (max 3 rounds)
- **CP-3**: Integration tests pass, review verdict is not NEEDS_FIXES

#### Phase 7: Summarize & Commit — DO NOT SKIP

**IMPORTANT**: Phase 7 is for **new feature** commits only. If this session is a bug fix to an existing feature, skip `prizmkit.summarize` (do NOT create new REGISTRY.md entries for bug fixes — bugs are refinements of incomplete features, not new functionality). Still run `prizmkit.committer` with `fix(<scope>):` prefix.

**7a.** Run `prizmkit.summarize` (invoke the prizmkit-summarize skill) → archive to REGISTRY.md

**7b.** Run `prizmkit.committer` (invoke the prizmkit-committer skill) → `feat(F-002): Telegram Pipeline Command Router`, do NOT push

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-002/sessions/F-002-20260312030318/session-status.json`

```json
{
  "session_id": "F-002-20260312030318",
  "feature_id": "F-002",
  "feature_slug": "002-telegram-pipeline-command-router",
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
    "spec_path": ".prizmkit/specs/002-telegram-pipeline-command-router/spec.md",
    "plan_path": ".prizmkit/specs/002-telegram-pipeline-command-router/plan.md",
    "tasks_path": ".prizmkit/specs/002-telegram-pipeline-command-router/tasks.md"
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
| Team Config (installed) | `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json` |
| Feature Artifacts Dir | `.prizmkit/specs/002-telegram-pipeline-command-router/` |
| PM Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-002/sessions/F-002-20260312030318/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- **MANDATORY**: You MUST use `prizm-dev-team` (reuse existing or create new) — single-agent execution is FORBIDDEN
- **Team definition source**: `core/team/prizm-dev-team.json`; installed at `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json`
- **All artifacts go under `.prizmkit/specs/002-telegram-pipeline-command-router/`** — only 3 files: spec.md, plan.md, tasks.md
- Dev agents use TDD approach
- Phase 7 (summarize + commit) is MANDATORY
- ALWAYS write session-status.json before exiting
- **NEVER exit the session early** — wait for all spawned agents to complete
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if you created the team; do NOT delete a reused team
