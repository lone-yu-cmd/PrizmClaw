# Dev-Pipeline Session Bootstrap — Tier 3 (Full Team)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}} tasks={{HAS_TASKS}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false). Do NOT spawn agents in background and exit — that kills the session.

**Tier 3 — Full Team**: Requires PM + Dev + Reviewer via TeamCreate. Full 7-phase pipeline.

### Feature Description

{{FEATURE_DESCRIPTION}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Dependencies (Already Completed)

{{COMPLETED_DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

## PrizmKit Directory Convention

```
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← PM writes, all agents read
.prizmkit/specs/{{FEATURE_SLUG}}/spec.md
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md
.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. PM writes it once; Dev and Reviewer read it instead of re-scanning source files. This eliminates redundant I/O across all agents.

### Team Definition Reference
- **Source of truth**: `core/team/prizm-dev-team.json`
- **Installed config**: `{{TEAM_CONFIG_PATH}}`

---

## Subagent Timeout Recovery

If any agent times out:
1. `ls .prizmkit/specs/{{FEATURE_SLUG}}/` — check what exists
2. If `context-snapshot.md` exists: open recovery prompt with `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries per phase. After 2 failures, orchestrator completes the work directly and appends a Recovery Note to context-snapshot.md.

---

## Execution

{{IF_INIT_NEEDED}}
### Phase 0: Project Bootstrap
- Run `prizmkit.init` (invoke the prizmkit-init skill)
- Run `python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist
{{END_IF_INIT_NEEDED}}
{{IF_INIT_DONE}}
### Phase 0: SKIP (already initialized)
{{END_IF_INIT_DONE}}

### Step 1: Team Setup

1. **Check for reusable team**: Read `{{TEAM_CONFIG_PATH}}`
   - Valid if it has members with agentTypes `prizm-dev-team-pm`, `prizm-dev-team-dev`, `prizm-dev-team-reviewer`
   - If valid → set `TEAM_REUSED=true`, record `team_name`

2. **If no reusable team**: Reference `core/team/prizm-dev-team.json` for member definitions, then:
   - Call `TeamCreate` with `team_name="prizm-dev-team-{{FEATURE_ID}}"` and `description="Implementing {{FEATURE_TITLE}}"`
   - Set `TEAM_REUSED=false`

3. Record which path was taken — determines whether TeamDelete is needed at end.

{{IF_FRESH_START}}
```bash
python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}
```
{{END_IF_FRESH_START}}

{{IF_RESUME}}
### Resume from Phase {{RESUME_PHASE}}
After team setup: check `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — if exists, all agents MUST use it. Read existing artifacts and resume from Phase {{RESUME_PHASE}}.
{{END_IF_RESUME}}

### Phase 1-3: Specify + Plan + Tasks — PM Agent

Check existing artifacts first:
```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

- All three (spec.md, plan.md, tasks.md) exist → **SKIP to CP-1**
- `context-snapshot.md` exists → PM reads it instead of re-scanning source files
- Some missing → PM generates only missing files

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false, team_name from Step 1).

**Construct prompt dynamically** — always prefix with:
> "Read {{PM_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}), complete the following IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

**Step A — Build Context Snapshot** (include only if `context-snapshot.md` does NOT exist):
> "Step A: Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`. This is the team knowledge base — complete it before anything else. Include:
> - Section 1 'Feature Brief': feature description and acceptance criteria
> - Section 2 'Project Structure': output of `ls src/` and relevant subdirectories
> - Section 3 'Prizm Context': full content of `.prizm-docs/root.prizm` and relevant L1/L2 docs
> - Section 4 'Existing Source Files': full content of every related source file as a code block
> - Section 5 'Existing Tests': full content of related test files as code blocks
> Confirm with `ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`."

**Step B — Planning Artifacts** (include only missing files):
- spec.md missing: "Run prizmkit-specify → generate spec.md. Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input."
- plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy, risk assessment — all in one file)"
- tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/{{FEATURE_SLUG}}/`. Confirm each with `ls` after writing."

Wait for PM to return. **CP-1**: All three files exist. If missing, diagnose from PM output — do NOT spawn another PM blindly.

### Phase 4: Analyze — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false, team_name from Step 1).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all source files and project context are there. Do NOT re-read individual source files.
> 2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency.
> 3. Before flagging CRITICAL or HIGH issues, verify each against Section 4 of the snapshot. Do NOT report based on incomplete information.
> Report: CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."

Wait for Reviewer to return.
- If CRITICAL issues found: spawn PM to fix (PM reads snapshot for context), re-run analyze (max 1 round)

**CP-2**: No CRITICAL issues.

### Phase 5: Implement — Dev Agent

Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false, team_name from Step 1).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}) using TDD.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all source files and context are there. Do NOT re-read individual source files.
> 2. Read `plan.md` and `tasks.md` from `.prizmkit/specs/{{FEATURE_SLUG}}/`.
> 3. Implement task-by-task. Mark each `[x]` in tasks.md immediately after completion.
> 4. After ALL tasks done, append 'Implementation Log' to context-snapshot.md: files changed/created, key decisions, deviations from plan.
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks `[x]`, tests pass.

### Phase 6: Review — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false, team_name from Step 1).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — Section 4 has original source, 'Implementation Log' has what Dev changed.
> 2. Run prizmkit-code-review: spec compliance (against spec.md), code quality, correctness. Only re-read files mentioned in the Implementation Log.
> 3. Write and execute integration tests covering all user stories from spec.md.
> 4. Append 'Review Notes' to context-snapshot.md: issues (severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (reads updated snapshot), re-run Review (max 3 rounds)

**CP-3**: Integration tests pass, verdict is not NEEDS_FIXES.

### Phase 7: Summarize & Commit — DO NOT SKIP

**For bug fixes**: skip `prizmkit.summarize`, use `fix(<scope>):` commit prefix.

**7a.** Run `prizmkit.summarize` → archive to REGISTRY.md

**7b.** Mark feature complete:
```bash
python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
  --feature-list "{{FEATURE_LIST_PATH}}" \
  --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
  --feature-id "{{FEATURE_ID}}" --session-id "{{SESSION_ID}}" --action complete
```

**7c.** Run `prizmkit.committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push

---

## Step 3: Write Session Status

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "feature_id": "{{FEATURE_ID}}",
  "feature_slug": "{{FEATURE_SLUG}}",
  "exec_tier": 3,
  "status": "<success|partial|failed>",
  "completed_phases": [0, 1, 2, 3, 4, 5, 6, 7],
  "current_phase": 7,
  "checkpoint_reached": "CP-3",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md",
    "spec_path": ".prizmkit/specs/{{FEATURE_SLUG}}/spec.md",
    "plan_path": ".prizmkit/specs/{{FEATURE_SLUG}}/plan.md",
    "tasks_path": ".prizmkit/specs/{{FEATURE_SLUG}}/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Step 4: Team Cleanup

**Only if TEAM_REUSED=false** (you created it):
```
TeamDelete
```
If TEAM_REUSED=true — do NOT delete.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| Context Snapshot | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| Team Definition | `core/team/prizm-dev-team.json` |
| Team Config | `{{TEAM_CONFIG_PATH}}` |
| PM Agent Def | {{PM_SUBAGENT_PATH}} |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |
| Feature List Path | {{FEATURE_LIST_PATH}} |

## Reminders

- Tier 3: full team — PM (planning) → Dev (implementation) → Reviewer (review) via TeamCreate
- context-snapshot.md is the team knowledge base: PM writes it once, all agents read it
- Do NOT use `run_in_background=true` when spawning agents
- ALWAYS write session-status.json before exiting
- Only call TeamDelete if you created the team (TEAM_REUSED=false)
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
