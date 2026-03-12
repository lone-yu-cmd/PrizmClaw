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

### Feature Description

{{FEATURE_DESCRIPTION}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Dependencies (Already Completed)

{{COMPLETED_DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

## Execution Tier Model

This pipeline uses **adaptive execution**: the number of agents used scales with task complexity. You MUST follow the tier assigned in Step 1 (after dynamic evaluation).

| Tier | When | Agents | Team Required |
|------|------|--------|---------------|
| **Tier 1 — Single Agent** | Simple: config, docs, small utilities | Orchestrator only | No |
| **Tier 2 — Dual Agent** | Standard: feature with clear scope | Orchestrator + Dev + Reviewer subagents | No |
| **Tier 3 — Full Team** | Complex: multi-module, data model, security | PM + Dev + Reviewer via TeamCreate | Yes |

**Initial tier** is determined by `estimated_complexity` (low → Tier 1, medium → Tier 2, high → Tier 3), then **dynamically upgraded** in Step 1 based on runtime checks. Tiers only go UP, never down.

## PrizmKit Directory Convention

**ALWAYS** use per-feature subdirectory `.prizmkit/specs/{{FEATURE_SLUG}}/`:

```
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← Shared knowledge base (written first, read by all)
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md
.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md
.prizmkit/specs/{{FEATURE_SLUG}}/spec.md              ← Tier 3 only
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md` is the single source of truth for all project context.** It is written once (by PM in Tier 3, or by Orchestrator in Tier 1/2) and read by every subsequent agent. This eliminates redundant file I/O across all agents.

---

## Execution Instructions

### Step 1: Determine Execution Tier

#### 1a. Start with initial tier from complexity

```
{{COMPLEXITY}} → initial tier:
  low    → Tier 1 (single agent)
  medium → Tier 2 (dual agent)
  high   → Tier 3 (full team)
```

Set `EXEC_TIER = <1|2|3>`.

#### 1b. Dynamic upgrade evaluation

Read the feature description, acceptance criteria, and dependencies above. Then run:

```bash
# Count related source files (fast scan)
find src/ -type f -name "*.js" -o -name "*.ts" 2>/dev/null | head -5
ls src/ 2>/dev/null
```

Apply these upgrade rules (only upgrade, never downgrade):

| Condition | Upgrade to |
|-----------|-----------|
| Acceptance criteria count > 5 | at least Tier 2 |
| Description mentions: database schema, data model, migration | at least Tier 2 |
| Description mentions: authentication, authorization, security, permissions | Tier 3 |
| Description mentions: API contract change, breaking change | Tier 3 |
| `completed_dependencies` list has > 2 entries | at least Tier 2 |
| Related source files in `src/` > 3 (from scan above) | at least Tier 2 |
| Related source files > 6 OR spans > 3 distinct modules | Tier 3 |

After applying all rules, set final `EXEC_TIER`.

#### 1c. Team setup (Tier 3 only)

**Skip this section entirely if EXEC_TIER is 1 or 2.**

For Tier 3, set up `prizm-dev-team`:

1. **Check if a team already exists and can be reused**:
   - Read the team config at `{{TEAM_CONFIG_PATH}}`
   - If valid (has members with agentTypes `prizm-dev-team-pm`, `prizm-dev-team-dev`, `prizm-dev-team-reviewer`) → set `TEAM_REUSED=true`

2. **If no reusable team exists**:
   - Reference `core/team/prizm-dev-team.json` for member definitions
   - Call `TeamCreate` with `team_name="prizm-dev-team-{{FEATURE_ID}}"` and `description="Implementing {{FEATURE_TITLE}}"`
   - Set `TEAM_REUSED=false`

3. Record the path taken — needed for Step 4 cleanup decision.

#### 1d. Initialize directories

{{IF_FRESH_START}}
```bash
python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}
```
{{END_IF_FRESH_START}}

{{IF_RESUME}}
**Resume from Phase {{RESUME_PHASE}}**:
1. Check if `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` exists — if so, all agents MUST use it (skip re-scanning source files)
2. Read existing artifacts in `.prizmkit/specs/{{FEATURE_SLUG}}/`
3. Skip to Phase {{RESUME_PHASE}} in Step 2 below
{{END_IF_RESUME}}

---

### Subagent Timeout Recovery Protocol

**Apply whenever any spawned agent times out or returns no output.**

1. Check existing artifacts:
   ```bash
   ls .prizmkit/specs/{{FEATURE_SLUG}}/
   ```
2. **Do NOT re-spawn with the same prompt** — diagnose what's missing first.
3. Recovery spawn rules:
   - If `context-snapshot.md` exists → open prompt with: `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for full context. Do NOT re-read individual source files."`
   - List **only the remaining steps** (skip completed ones)
   - Use `model: "lite"` for faster first-token response
4. **Max 2 retries per agent phase**. After 2 failures, the orchestrator completes the work directly.
5. If orchestrator writes artifacts directly, append to `context-snapshot.md`:
   ```
   ## Recovery Note
   [agent role] timed out. Orchestrator completed: [files written].
   ```

---

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

---

{{IF_MODE_LITE}}
## Tier 1 Execution Path — Single Agent

> EXEC_TIER=1. You (the orchestrator) do ALL work directly. No subagents. No TeamCreate.

#### Phase 1: Build Context Snapshot

Check if snapshot exists first:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now (you are reading the files yourself):
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` with:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: output of relevant `ls src/` calls
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code block

#### Phase 2: Plan & Tasks

Check if plan.md and tasks.md exist:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

If missing, write them yourself (no PM agent needed for Tier 1):
- `plan.md`: brief architecture — key components, data flow, files to create/modify (under 80 lines)
- `tasks.md`: checklist with `[ ]` checkboxes, each task = one implementable unit

#### Phase 3: Implement

Implement all tasks directly. For each task in tasks.md:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task
4. Mark task `[x]` in tasks.md

After all tasks complete, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

#### Phase 4: Self-Review

Review your own implementation against the acceptance criteria:
1. Re-read acceptance criteria from Section 1 of context-snapshot.md
2. Run the full test suite
3. Check for obvious issues (error handling, edge cases)
4. If issues found, fix them now

**CP-1**: All acceptance criteria met, tests pass.

#### Phase 5: Commit
- Run `prizmkit.summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
    --feature-list "{{FEATURE_LIST_PATH}}" \
    --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
    --feature-id "{{FEATURE_ID}}" --session-id "{{SESSION_ID}}" --action complete
  ```
- Run `prizmkit.committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push

{{END_IF_MODE_LITE}}

---

{{IF_MODE_STANDARD}}
## Tier 2 Execution Path — Dual Agent (Dev + Reviewer)

> EXEC_TIER=2. You (orchestrator) handle context + planning. Then spawn Dev and Reviewer as subagents. No TeamCreate required.

#### Phase 1: Build Context Snapshot

Check first:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it yourself now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` with:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: root.prizm and L1/L2 content
   - **Section 4 — Existing Source Files**: full content of each related file
   - **Section 5 — Existing Tests**: full content of related test files

#### Phase 2: Plan & Tasks

Check:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/plan.md .prizmkit/specs/{{FEATURE_SLUG}}/tasks.md 2>/dev/null
```

If missing, write them yourself (orchestrator writes planning artifacts in Tier 2):
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

#### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` for architecture and `.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md` for the task list.
> 3. Implement task-by-task using TDD. Mark each completed task `[x]` in tasks.md immediately after completion.
> 4. After ALL tasks are complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are marked [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

#### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. Review feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log' section: what Dev changed
> 2. Run prizmkit-code-review: verify all acceptance criteria are met, check code quality and correctness. Only read files mentioned in the Implementation Log (not files that haven't changed).
> 3. Run the test suite and report results.
> 4. Append a 'Review Notes' section to `context-snapshot.md` with: issues found (severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

#### Phase 5: Commit
- Run `prizmkit.summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
    --feature-list "{{FEATURE_LIST_PATH}}" \
    --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
    --feature-id "{{FEATURE_ID}}" --session-id "{{SESSION_ID}}" --action complete
  ```
- Run `prizmkit.committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push

{{END_IF_MODE_STANDARD}}

---

{{IF_MODE_FULL}}
## Tier 3 Execution Path — Full Team (PM + Dev + Reviewer)

> EXEC_TIER=3. Requires TeamCreate from Step 1c. PM agent handles all planning. Full 7-phase pipeline.

### Team Definition Reference
- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed config**: `{{TEAM_CONFIG_PATH}}`

#### Phase 1-3: Specify + Plan + Tasks — PM Agent

**BEFORE spawning PM**, check existing artifacts:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

- All three files (spec.md, plan.md, tasks.md) exist → **SKIP to CP-1 check**
- `context-snapshot.md` exists → PM reads it instead of re-scanning source files
- Some missing → PM generates only missing files

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false, team_name from Step 1c).

**Construct the prompt dynamically:**

Always prefix with:
> "Read {{PM_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}), complete the following IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

**Step A — Build Context Snapshot** (include only if `context-snapshot.md` does NOT exist):
> "Step A: Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`. This is the knowledge base for the entire team — complete it before doing anything else. Include:
> - Section 1 'Feature Brief': feature description and acceptance criteria (from the bootstrap prompt)
> - Section 2 'Project Structure': output of `ls src/` and relevant subdirectories
> - Section 3 'Prizm Context': full content of `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
> - Section 4 'Existing Source Files': full content of every related source file as a code block
> - Section 5 'Existing Tests': full content of related test files as code blocks
> Confirm with `ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`."

**Step B — Create Planning Artifacts** (include only missing files):
- spec.md missing: "Run prizmkit-specify → generate spec.md. Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input."
- plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy, risk assessment — all in one file)"
- tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/{{FEATURE_SLUG}}/`. Confirm each with `ls` after writing."

Wait for PM to return. **CP-1**: All three files exist. If missing, diagnose from PM output — do NOT spawn another PM blindly.

#### Phase 4: Analyze — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false, team_name from Step 1c).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all source files and project context are embedded there. Do NOT re-read individual source files.
> 2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency.
> 3. Before flagging CRITICAL or HIGH issues, verify each against Section 4 of the snapshot. Do NOT report based on incomplete information.
> Report: CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."

Wait for Reviewer to return.
- If CRITICAL issues found: spawn PM to fix (PM reads snapshot), re-run analyze (max 1 round)

**CP-2**: No CRITICAL issues.

#### Phase 5: Implement — Dev Agent

Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false, team_name from Step 1c).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}) using TDD.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all source files and context are there. Do NOT re-read individual source files.
> 2. Read `plan.md` and `tasks.md` from `.prizmkit/specs/{{FEATURE_SLUG}}/`.
> 3. Implement task-by-task. Mark each `[x]` immediately after completion.
> 4. After ALL tasks done, append 'Implementation Log' to context-snapshot.md: files changed/created, key decisions, deviations from plan.
> Do NOT exit until all tasks are [x] and Implementation Log is written."

Wait for Dev to return. All tasks `[x]`, tests pass.

#### Phase 6: Review — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false, team_name from Step 1c).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — Section 4 has original source, 'Implementation Log' has what Dev changed.
> 2. Run prizmkit-code-review: spec compliance (against spec.md), code quality, correctness. Only re-read files mentioned in the Implementation Log.
> 3. Write and execute integration tests covering all user stories from spec.md.
> 4. Append 'Review Notes' to context-snapshot.md: issues (with severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (reads updated snapshot), re-run Review (max 3 rounds)

**CP-3**: Integration tests pass, verdict is not NEEDS_FIXES.

#### Phase 7: Summarize & Commit — DO NOT SKIP

**IMPORTANT**: For bug fixes, skip `prizmkit.summarize` (no new REGISTRY.md entries). Use `fix(<scope>):` prefix for commits.

**7a.** Run `prizmkit.summarize` → archive to REGISTRY.md

**7b.** Mark feature complete:
```bash
python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
  --feature-list "{{FEATURE_LIST_PATH}}" \
  --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
  --feature-id "{{FEATURE_ID}}" --session-id "{{SESSION_ID}}" --action complete
```

**7c.** Run `prizmkit.committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push

{{END_IF_MODE_FULL}}

---

### Step 3: Report Session Status

**CRITICAL**: Before this session ends, write the session status file.

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "feature_id": "{{FEATURE_ID}}",
  "feature_slug": "{{FEATURE_SLUG}}",
  "exec_tier": "<1|2|3>",
  "status": "<success|partial|failed>",
  "completed_phases": [0, 1, 2, 3, 4, 5, 6, 7],
  "current_phase": 7,
  "checkpoint_reached": "<CP-1|CP-2|CP-3>",
  "tasks_completed": 12,
  "tasks_total": 12,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md",
    "plan_path": ".prizmkit/specs/{{FEATURE_SLUG}}/plan.md",
    "tasks_path": ".prizmkit/specs/{{FEATURE_SLUG}}/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

**Status values**: `success` | `partial` (can resume) | `failed` (unrecoverable)

If you encounter an error, still write session-status.json with status="failed" and error details.

### Step 4: Team Cleanup (Tier 3 only)

**Only for Tier 3, and only if you CREATED the team** (`TEAM_REUSED=false`):
```
TeamDelete
```

For Tier 1/2 (no team was created) or if you reused a team — skip this step entirely.

---

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| **Context Snapshot (shared knowledge base)** | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| Team Definition (Tier 3 source of truth) | `core/team/prizm-dev-team.json` |
| Team Config (Tier 3 installed) | `{{TEAM_CONFIG_PATH}}` |
| PM Agent Def | {{PM_SUBAGENT_PATH}} |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |
| Feature List Path | {{FEATURE_LIST_PATH}} |

## Reminders

- **Adaptive execution**: Tier 1 = orchestrator only; Tier 2 = orchestrator + Dev + Reviewer subagents; Tier 3 = full team. Tier is set in Step 1 and only goes UP.
- **TeamCreate is only for Tier 3** — do NOT create a team for Tier 1 or Tier 2
- **context-snapshot.md is the shared knowledge base**: built once, read by all subsequent agents. Always check if it exists before spawning any agent.
- **All artifacts go under `.prizmkit/specs/{{FEATURE_SLUG}}/`**
- Dev agents use TDD approach
- The commit phase is MANDATORY for all tiers
- ALWAYS write session-status.json before exiting
- **NEVER exit the session early** — wait for all spawned agents to complete
- Do NOT use `run_in_background=true` when spawning agents
- Only call `TeamDelete` if Tier 3 AND you created the team
- **On timeout**: check snapshot → use model:lite → prompt only remaining steps → max 2 retries → orchestrator fallback
