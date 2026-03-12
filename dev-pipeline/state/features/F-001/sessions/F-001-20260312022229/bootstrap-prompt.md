# Dev-Pipeline Session Bootstrap

## Session Context

- **Pipeline Run ID**: run-20260311-175307
- **Session ID**: F-001-20260312022229
- **Feature ID**: F-001
- **Feature Title**: Project Infrastructure Setup
- **Feature Slug**: 001-project-infrastructure-setup
- **Complexity**: medium (mode: standard)
- **Retry Count**: 1 / 3
- **Previous Session Status**: N/A (first run)
- **Resume From Phase**: null
- **Init Status**: true | Artifacts: spec=true plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-001: "Project Infrastructure Setup".

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

为 Telegram 管道模式建立统一的工程基线：明确配置分层、目录约定、日志与状态文件位置、脚本入口与错误码规范。该功能聚焦于让后续命令路由与 pipeline 控制能力有稳定的运行基础，并保持与现有 dev-pipeline 脚本兼容。

范围包括：规范 feature-list / bug-fix-list 输入目录、规范 state 与 session 日志目录、统一启动参数解析、补全 TypeScript 迁移所需的基础构建与检查配置（不要求一次性迁移全部历史代码）。

### Acceptance Criteria

- 提供统一的配置加载与校验入口，缺失关键配置时返回可读错误信息
- 定义并落地计划文件、状态文件、日志文件的标准目录结构与命名规则
- 提供可复用的脚本入口封装，能够以一致参数调用现有 dev-pipeline 脚本
- 基础构建与静态检查流程可运行，且不会破坏现有 Telegram 对话主流程

### Dependencies (Already Completed)

- (no dependencies)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

**ALWAYS** use per-feature subdirectory `.prizmkit/specs/001-project-infrastructure-setup/`:

```
.prizmkit/specs/001-project-infrastructure-setup/spec.md
.prizmkit/specs/001-project-infrastructure-setup/plan.md
.prizmkit/specs/001-project-infrastructure-setup/tasks.md
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
   - Call `TeamCreate` with `team_name="prizm-dev-team-F-001"` and `description="Implementing Project Infrastructure Setup"`
   - Set `TEAM_REUSED=false`

3. **Record which path was taken** — this determines whether `TeamDelete` is needed at the end (only delete if you created; do NOT delete a reused team)

#### Initialize dev-team directories

```bash
python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-001 --feature-slug 001-project-infrastructure-setup
```


### Step 2: Pipeline Phases

#### Phase 0: SKIP (already initialized)


#### Phase 1-3: Specify + Plan + Tasks (combined, one PM session)
- Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. For feature F-001 (slug: 001-project-infrastructure-setup), complete all three planning steps in this single session:
  1. Run prizmkit-specify → generate `.prizmkit/specs/001-project-infrastructure-setup/spec.md` (concise, under 150 lines)
  2. Run prizmkit-plan → generate `.prizmkit/specs/001-project-infrastructure-setup/plan.md` (architecture, components, interface design, data model, testing strategy — all in one file)
  3. Run prizmkit-tasks → generate `.prizmkit/specs/001-project-infrastructure-setup/tasks.md` with `[ ]` checkboxes
  All three files go under `.prizmkit/specs/001-project-infrastructure-setup/`."
- **Wait for PM to return**
- **CP-1**: spec.md, plan.md, and tasks.md all exist

#### Phase 4: Analyze (cross-check)
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Run prizmkit-analyze for feature F-001 (slug: 001-project-infrastructure-setup). Cross-check `.prizmkit/specs/001-project-infrastructure-setup/spec.md`, `plan.md`, and `tasks.md` for consistency. Report any CRITICAL or HIGH issues."
- **Wait for Reviewer to return**
- If CRITICAL issues found: spawn PM to fix, then re-run analyze (max 1 round)
- **CP-2**: No CRITICAL issues


#### Phase 5: Schedule & Implement
- Read tasks from `.prizmkit/specs/001-project-infrastructure-setup/tasks.md`
- Create TaskList entries and assign to Dev agents
- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement all tasks for feature F-001 (slug: 001-project-infrastructure-setup) using prizmkit-implement with TDD. Read the plan from `.prizmkit/specs/001-project-infrastructure-setup/plan.md` and tasks from `tasks.md`. Mark completed tasks [x] in tasks.md."
- **Wait for Dev to return**
- All tasks marked `[x]`, tests pass

#### Phase 6: Review
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-001 (slug: 001-project-infrastructure-setup):
  1. Run prizmkit-code-review for spec compliance and code quality
  2. Write and execute integration tests covering all user stories from spec.md
  Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."
- **Wait for Reviewer to return**
- If NEEDS_FIXES: spawn Dev to fix, then re-run Review (max 3 rounds)
- **CP-3**: Integration tests pass, review verdict is not NEEDS_FIXES

#### Phase 7: Summarize & Commit — DO NOT SKIP

**IMPORTANT**: Phase 7 is for **new feature** commits only. If this session is a bug fix to an existing feature, skip `prizmkit.summarize` (do NOT create new REGISTRY.md entries for bug fixes — bugs are refinements of incomplete features, not new functionality). Still run `prizmkit.committer` with `fix(<scope>):` prefix.

**7a.** Run `prizmkit.summarize` (invoke the prizmkit-summarize skill) → archive to REGISTRY.md

**7b.** Run `prizmkit.committer` (invoke the prizmkit-committer skill) → `feat(F-001): Project Infrastructure Setup`, do NOT push

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-001/sessions/F-001-20260312022229/session-status.json`

```json
{
  "session_id": "F-001-20260312022229",
  "feature_id": "F-001",
  "feature_slug": "001-project-infrastructure-setup",
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
    "spec_path": ".prizmkit/specs/001-project-infrastructure-setup/spec.md",
    "plan_path": ".prizmkit/specs/001-project-infrastructure-setup/plan.md",
    "tasks_path": ".prizmkit/specs/001-project-infrastructure-setup/tasks.md"
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
| Feature Artifacts Dir | `.prizmkit/specs/001-project-infrastructure-setup/` |
| PM Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-001/sessions/F-001-20260312022229/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- **MANDATORY**: You MUST use `prizm-dev-team` (reuse existing or create new) — single-agent execution is FORBIDDEN
- **Team definition source**: `core/team/prizm-dev-team.json`; installed at `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json`
- **All artifacts go under `.prizmkit/specs/001-project-infrastructure-setup/`** — only 3 files: spec.md, plan.md, tasks.md
- Dev agents use TDD approach
- Phase 7 (summarize + commit) is MANDATORY
- ALWAYS write session-status.json before exiting
- **NEVER exit the session early** — wait for all spawned agents to complete
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if you created the team; do NOT delete a reused team
