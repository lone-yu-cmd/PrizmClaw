# Dev-Pipeline Session Bootstrap

## Session Context

- **Pipeline Run ID**: {{RUN_ID}}
- **Session ID**: {{SESSION_ID}}
- **Feature ID**: {{FEATURE_ID}}
- **Feature Title**: {{FEATURE_TITLE}}
- **Feature Slug**: {{FEATURE_SLUG}}
- **Complexity**: {{COMPLEXITY}} (mode: {{PIPELINE_MODE}})
- **Retry Count**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Session Status**: {{PREV_SESSION_STATUS}}
- **Resume From Phase**: {{RESUME_PHASE}}
- **Init Status**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}} tasks={{HAS_TASKS}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL SESSION LIFECYCLE RULE**: You are the main session process. You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, you MUST **wait for each to finish** (run_in_background=false) before proceeding. Do NOT spawn an agent in the background and exit — that kills the session.

**MANDATORY TEAM REQUIREMENT**: You MUST use the `prizm-dev-team` multi-agent team to complete this feature. This is NON-NEGOTIABLE. You are FORBIDDEN from implementing the feature as a single agent — all work MUST be distributed through the prizm-dev-team members (PM, Dev, Reviewer). Specifically:
1. You MUST ensure a prizm-dev-team is available before starting any phase (see Step 1 below for reuse-or-create logic)
2. You MUST spawn PM, Dev, and Reviewer agents using the `Task` tool with `team_name` and `subagent_type` parameters
3. Every implementation, planning, and review phase MUST be executed by the appropriate team agent — NOT by you directly
4. If you attempt to do the work yourself without spawning team agents, the session is considered FAILED

### Team Definition Reference

The prizm-dev-team definition is maintained in the project at:
- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed team config (current platform)**: `{{TEAM_CONFIG_PATH}}`
  - CodeBuddy: `~/.codebuddy/teams/prizm-dev-team/config.json` — full team config with members, may support reuse
  - Claude Code: `.claude/team-info.json` — reference only (no native team system; agents are in `.claude/agents/`)

When creating a new team, use these files as reference for team member names, roles, agentTypes, and prompts.

### Feature Description

{{FEATURE_DESCRIPTION}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Dependencies (Already Completed)

{{COMPLETED_DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

## PrizmKit Directory Convention

**ALWAYS** use per-feature subdirectory `.prizmkit/specs/{{FEATURE_SLUG}}/`:

```
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← Knowledge base (PM writes, all agents read)
.prizmkit/specs/{{FEATURE_SLUG}}/spec.md
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md
.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md` is the single source of truth for all project context in this session.** PM writes it once after scanning the codebase. Dev and Reviewer read it instead of re-reading individual source files. This eliminates redundant I/O across all agents.

## Execution Instructions

**YOU are the orchestrator. Do NOT delegate to a Coordinator agent. Execute each phase yourself by spawning the appropriate team agent with run_in_background=false and waiting for its result.**

**TEAM ENFORCEMENT**: Every phase below that mentions spawning a PM/Dev/Reviewer agent MUST use the `Task` tool with the active team's `team_name`. You MUST NOT skip the team setup step or attempt to perform PM/Dev/Reviewer work yourself. Violation of this rule constitutes a session failure.

### Step 1: Initialize

#### Team Setup: Reuse or Create

Different AI CLI platforms have different team lifecycle behaviors. Some support reusing an existing team across sessions; others require creating a new team every time.

**Follow this logic to determine team availability:**

1. **Check if a team already exists and can be reused**:
   - Read the team config file at `{{TEAM_CONFIG_PATH}}`
   - If it exists and is valid (has members with correct agentTypes like `prizm-dev-team-pm`, `prizm-dev-team-dev`, `prizm-dev-team-reviewer`), try to reuse it
   - Set `TEAM_REUSED=true` and record the `team_name` from the config

2. **If no reusable team exists, create a new one**:
   - Reference the team definition at `core/team/prizm-dev-team.json` (source of truth for member roles and prompts)
   - Call `TeamCreate` with `team_name="prizm-dev-team-{{FEATURE_ID}}"` and `description="Implementing {{FEATURE_TITLE}}"`
   - Set `TEAM_REUSED=false`

3. **Record which path was taken** — this determines whether `TeamDelete` is needed at the end (only delete if you created; do NOT delete a reused team)

{{IF_FRESH_START}}
#### Initialize dev-team directories

```bash
python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}
```
{{END_IF_FRESH_START}}

{{IF_RESUME}}
#### Resume Context

This is a **resume** from Phase {{RESUME_PHASE}}. After completing the team setup above:
1. Check if `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` exists — if so, all agents MUST use it (do not re-scan source files)
2. Read artifacts in `.prizmkit/specs/{{FEATURE_SLUG}}/` (spec.md, plan.md, tasks.md)
3. Resume the pipeline from Phase {{RESUME_PHASE}} below
{{END_IF_RESUME}}

### Subagent Timeout Recovery Protocol

**This protocol applies to ALL subagent spawns (PM, Dev, Reviewer). Apply it whenever a spawned agent times out or returns with no output.**

1. **Check what was already completed**:
   ```bash
   ls .prizmkit/specs/{{FEATURE_SLUG}}/
   ```
   Check which files exist. If `context-snapshot.md` already exists, it contains the full codebase context — no need to re-scan source files.

2. **Do NOT re-spawn with the same prompt** — it will likely timeout again for the same reason.

3. **Re-spawn with a focused recovery prompt** using these rules:
   - Open with: `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for full project context. Do NOT re-read individual source files — all relevant content is already in the snapshot."`
   - List **only the remaining tasks** (skip anything already completed based on the `ls` check)
   - Prefer `model: "lite"` for faster first-token response on the retry

4. **Max 2 retries per agent phase**: If still failing after 2 retries, the orchestrator completes the remaining work directly (orchestrator has context from the bootstrap prompt and any existing snapshot content).

5. **After recovery**: If the orchestrator had to write artifacts directly, append a note to `context-snapshot.md`:
   ```
   ## Recovery Note
   [Agent role] timed out at [phase]. Orchestrator completed: [list of files written].
   ```

### Step 2: Pipeline Phases

{{IF_INIT_NEEDED}}
#### Phase 0: Project Bootstrap
- Run `prizmkit.init` (invoke the prizmkit-init skill)
- Run `python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist
{{END_IF_INIT_NEEDED}}
{{IF_INIT_DONE}}
#### Phase 0: SKIP (already initialized)
{{END_IF_INIT_DONE}}

{{IF_MODE_LITE}}
#### Phase 1-3: Lightweight Planning (combined)

**BEFORE spawning PM**, check which artifacts already exist:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```
- If `context-snapshot.md` exists → PM must read it instead of re-scanning source files
- If `plan.md` and `tasks.md` exist → **SKIP Phase 1-3**, proceed to CP-1 check

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false).

Construct the PM prompt:
> "Read {{PM_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}), complete the following IN THIS SINGLE SESSION — do NOT exit until ALL steps are done and files are written to disk:
>
> **Step A — Build Context Snapshot** (SKIP if `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` already exists):
> 1. Read `.prizm-docs/root.prizm` and any relevant L1 prizm docs
> 2. Scan `src/` for files related to this feature
> 3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` with sections: Feature Brief, Project Structure, Prizm Context, Existing Source Files (full content inline), Existing Tests (full content inline). This file is the knowledge base for all team agents.
>
> **Step B — Create Planning Artifacts**:
> 1. `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` — brief architecture (under 100 lines): key components, data flow, file structure
> 2. `.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md` — task checklist with `[ ]` checkboxes, each task = one implementable unit
> Do NOT generate spec.md. Keep it minimal.
> After writing each file, confirm it exists with `ls`."

- **Wait for PM to return**
- **CP-1**: plan.md and tasks.md exist

#### Phase 4: SKIP (lite mode)
{{END_IF_MODE_LITE}}

{{IF_MODE_STANDARD}}
#### Phase 1-3: Specify + Plan + Tasks (combined, one PM session)

**BEFORE spawning PM**, check which artifacts already exist:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

- If all three files (spec.md, plan.md, tasks.md) already exist → **SKIP Phase 1-3**, proceed directly to CP-1 check
- If `context-snapshot.md` exists → PM must read it instead of re-scanning source files
- If none exist → spawn PM for full planning
- If some exist → spawn PM with instructions to only generate the missing files

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false).

**Construct the prompt dynamically:**

Always prefix the PM prompt with:
> "Read {{PM_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}), complete the following steps IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

Then append:

**Step A — Build Context Snapshot** (include this step only if `context-snapshot.md` does NOT already exist):
> "Step A: Read all project context and write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`. This is the knowledge base for the entire team — it must be complete before doing anything else. Include:
> - Section 1 'Feature Brief': Copy the feature description and acceptance criteria from the bootstrap prompt
> - Section 2 'Project Structure': Output of `ls src/` and any relevant subdirectory listings
> - Section 3 'Prizm Context': Full content of `.prizm-docs/root.prizm` and any relevant L1/L2 prizm docs
> - Section 4 'Existing Source Files': Read every source file related to this feature and embed its full content as a code block. Include files that already implement similar functionality.
> - Section 5 'Existing Tests': Read every test file related to this feature and embed its full content as a code block.
> After writing, confirm with `ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`."

**Step B — Create Planning Artifacts** (include only the steps for missing files):
- If spec.md missing: "Run prizmkit-specify → generate spec.md (concise, under 150 lines). Do NOT use interactive clarification — resolve any ambiguity using the feature description provided."
- If plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy — all in one file)"
- If tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/{{FEATURE_SLUG}}/`. After writing each file, confirm it exists with `ls`."

- **Wait for PM to return** (run_in_background=false — do not proceed until PM exits)
- **CP-1**: Verify all three files exist. If any still missing after PM returns, check if `context-snapshot.md` was written (it contains all context needed). If it's a path error, fix it yourself — do NOT spawn another PM session blindly.

#### Phase 4: Analyze (cross-check)
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
  1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — this contains all source file content and project context. Do NOT re-read individual source files.
  2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency. All spec files are in `.prizmkit/specs/{{FEATURE_SLUG}}/`.
  3. When flagging CRITICAL or HIGH issues, verify each issue against the actual source code content in context-snapshot.md Section 4 before reporting. Do NOT report issues based on incomplete information.
  Report: list of CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."
- **Wait for Reviewer to return**
- If CRITICAL issues found: spawn PM to fix (PM reads context-snapshot.md for context), then re-run analyze (max 1 round)
- **CP-2**: No CRITICAL issues
{{END_IF_MODE_STANDARD}}

{{IF_MODE_FULL}}
#### Phase 1-3: Specify + Plan + Tasks (combined, one PM session)

**BEFORE spawning PM**, check which artifacts already exist:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

- If all three files (spec.md, plan.md, tasks.md) already exist → **SKIP Phase 1-3**, proceed directly to CP-1 check
- If `context-snapshot.md` exists → PM must read it instead of re-scanning source files
- If none exist → spawn PM for full planning
- If some exist → spawn PM with instructions to only generate the missing files

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false).

**Construct the prompt dynamically:**

Always prefix the PM prompt with:
> "Read {{PM_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}), complete the following steps IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

Then append:

**Step A — Build Context Snapshot** (include this step only if `context-snapshot.md` does NOT already exist):
> "Step A: Read all project context and write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`. This is the knowledge base for the entire team — it must be complete before doing anything else. Include:
> - Section 1 'Feature Brief': Copy the feature description and acceptance criteria from the bootstrap prompt
> - Section 2 'Project Structure': Output of `ls src/` and any relevant subdirectory listings
> - Section 3 'Prizm Context': Full content of `.prizm-docs/root.prizm` and any relevant L1/L2 prizm docs
> - Section 4 'Existing Source Files': Read every source file related to this feature and embed its full content as a code block. Include files that already implement similar functionality.
> - Section 5 'Existing Tests': Read every test file related to this feature and embed its full content as a code block.
> After writing, confirm with `ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`."

**Step B — Create Planning Artifacts** (include only the steps for missing files):
- If spec.md missing: "Run prizmkit-specify → generate spec.md. If there are `[NEEDS CLARIFICATION]` markers, resolve them using the feature description — do NOT pause for interactive input."
- If plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy, risk assessment — all in one file)"
- If tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/{{FEATURE_SLUG}}/`. After writing each file, confirm it exists with `ls`."

- **Wait for PM to return** (run_in_background=false — do not proceed until PM exits)
- **CP-1**: Verify all three files exist. If any still missing after PM returns, check if `context-snapshot.md` was written. Fix path errors yourself if needed — do NOT spawn another PM session blindly.

#### Phase 4: Analyze (cross-check)
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
  1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — this contains all source file content and project context. Do NOT re-read individual source files.
  2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency. All spec files are in `.prizmkit/specs/{{FEATURE_SLUG}}/`.
  3. When flagging CRITICAL or HIGH issues, verify each issue against the actual source code content in context-snapshot.md Section 4 before reporting. Do NOT report issues based on incomplete information.
  Report: list of CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."
- **Wait for Reviewer to return**
- If CRITICAL issues found: spawn PM to fix (PM reads context-snapshot.md for context), then re-run analyze (max 1 round)
- **CP-2**: No CRITICAL issues
{{END_IF_MODE_FULL}}

#### Phase 5: Schedule & Implement
- Read tasks from `.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md`
- Create TaskList entries and assign to Dev agents
- Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false)
  Prompt: "Read {{DEV_SUBAGENT_PATH}}. Implement all tasks for feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}) using prizmkit-implement with TDD.
  1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — this contains all relevant source files, tests, and project context. Do NOT re-read individual source files listed there.
  2. Read plan from `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` and tasks from `tasks.md`.
  3. Implement task-by-task. Mark completed tasks [x] in tasks.md.
  4. After ALL tasks are complete, append an 'Implementation Log' section to `context-snapshot.md` with: list of files changed/created, key decisions made, any deviations from the plan."
- **Wait for Dev to return**
- All tasks marked `[x]`, tests pass

#### Phase 6: Review
- Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false)
  Prompt: "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
  1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — Section 4 has original source files, Section 6 (Implementation Log) has what Dev changed. Do NOT re-read files that haven't changed.
  2. Run prizmkit-code-review: check spec compliance (against spec.md), code quality, and correctness of changes described in the Implementation Log.
  3. Write and execute integration tests covering all user stories from spec.md.
  4. Append a 'Review Notes' section to `context-snapshot.md` with: issues found (severity + description), test results, final verdict.
  Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."
- **Wait for Reviewer to return**
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated context-snapshot.md for context), then re-run Review (max 3 rounds)
- **CP-3**: Integration tests pass, review verdict is not NEEDS_FIXES

#### Phase 7: Summarize & Commit — DO NOT SKIP

**IMPORTANT**: Phase 7 is for **new feature** commits only. If this session is a bug fix to an existing feature, skip `prizmkit.summarize` (do NOT create new REGISTRY.md entries for bug fixes — bugs are refinements of incomplete features, not new functionality). Still run `prizmkit.committer` with `fix(<scope>):` prefix.

**7a.** Run `prizmkit.summarize` (invoke the prizmkit-summarize skill) → archive to REGISTRY.md

**7b.** BEFORE commit, mark current feature as completed in feature-list:
```bash
python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
  --feature-list "{{FEATURE_LIST_PATH}}" \
  --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
  --feature-id "{{FEATURE_ID}}" \
  --session-id "{{SESSION_ID}}" \
  --action complete
```

**7c.** Run `prizmkit.committer` (invoke the prizmkit-committer skill) → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, you MUST write the session status file.

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "feature_id": "{{FEATURE_ID}}",
  "feature_slug": "{{FEATURE_SLUG}}",
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
    "context_snapshot_path": ".prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md",
    "spec_path": ".prizmkit/specs/{{FEATURE_SLUG}}/spec.md",
    "plan_path": ".prizmkit/specs/{{FEATURE_SLUG}}/plan.md",
    "tasks_path": ".prizmkit/specs/{{FEATURE_SLUG}}/tasks.md"
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
| Team Config (installed) | `{{TEAM_CONFIG_PATH}}` |
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| **Context Snapshot (knowledge base)** | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| PM Agent Def | {{PM_SUBAGENT_PATH}} |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |
| Feature List Path | {{FEATURE_LIST_PATH}} |

## Reminders

- **MANDATORY**: You MUST use `prizm-dev-team` (reuse existing or create new) — single-agent execution is FORBIDDEN
- **Team definition source**: `core/team/prizm-dev-team.json`; installed at `{{TEAM_CONFIG_PATH}}`
- **context-snapshot.md is the team's shared knowledge base**: PM writes it once; Dev and Reviewer read it instead of re-reading source files. Always check if it exists before spawning any agent.
- **All artifacts go under `.prizmkit/specs/{{FEATURE_SLUG}}/`** — 4 files: context-snapshot.md, spec.md, plan.md, tasks.md
- Dev agents use TDD approach
- Phase 7 (summarize + commit) is MANDATORY
- ALWAYS write session-status.json before exiting
- **NEVER exit the session early** — wait for all spawned agents to complete
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if you created the team; do NOT delete a reused team
- **On timeout**: follow the Subagent Timeout Recovery Protocol — always check what's in the snapshot before re-spawning
