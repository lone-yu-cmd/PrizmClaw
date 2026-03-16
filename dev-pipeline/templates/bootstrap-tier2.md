# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}} tasks={{HAS_TASKS}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

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
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md
.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/{{FEATURE_SLUG}}/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

{{IF_INIT_NEEDED}}
### Phase 0: Project Bootstrap
- Run `/prizmkit-init` (invoke the prizmkit-init skill)
- Run `python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist
{{END_IF_INIT_NEEDED}}
{{IF_INIT_DONE}}
### Phase 0: SKIP (already initialized)
{{END_IF_INIT_DONE}}

{{IF_RESUME}}
### Resume from Phase {{RESUME_PHASE}}
Check `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — if exists, skip Phase 1 and proceed to Phase {{RESUME_PHASE}}.
{{END_IF_RESUME}}

### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/plan.md .prizmkit/specs/{{FEATURE_SLUG}}/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` and `.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md`.
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
> "Read {{REVIEWER_SUBAGENT_PATH}}. Review feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log': what Dev changed
> 2. Run prizmkit-code-review: verify all acceptance criteria, check code quality and correctness. Only read files mentioned in the Implementation Log.
> 3. Run the test suite and report results.
> 4. Append a 'Review Notes' section to `context-snapshot.md`: issues found (severity), test results, final verdict.
> 5. If review uncovers durable pitfalls or conventions, add corresponding TRAPS/RULES notes to relevant `.prizm-docs/` files.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 4.5: Prizm Doc Update (mandatory for feature sessions)

Run `/prizmkit-prizm-docs` and sync project docs before commit:
1. Use `git diff --cached --name-status` (fallback: `git diff --name-status`) to locate changed modules
2. Update affected `.prizm-docs/` files (L1/L2, changelog.prizm)
3. Stage documentation updates (`git add .prizm-docs/`) if changed

Doc maintenance pass condition (pipeline-enforced): `REGISTRY.md` **or** `.prizm-docs/` changed in the final commit.

### Phase 4.7: Retrospective (feature sessions only, before commit)

If this session is a feature (not a bug-fix-only commit), run `/prizmkit-retrospective` now — **before committing**.
Retrospective must update relevant `.prizm-docs/` sections (TRAPS/RULES/DECISIONS) when applicable, so those changes are included in the feature commit.
Stage any `.prizm-docs/` changes produced: `git add .prizm-docs/`

### Phase 5: Commit

- Run `/prizmkit-summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 {{VALIDATOR_SCRIPTS_DIR}}/update-feature-status.py \
    --feature-list "{{FEATURE_LIST_PATH}}" \
    --state-dir "{{PROJECT_ROOT}}/dev-pipeline/state" \
    --feature-id "{{FEATURE_ID}}" --session-id "{{SESSION_ID}}" --action complete
  ```
- Run `/prizmkit-committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.

---

## Step 3: Write Session Status

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "feature_id": "{{FEATURE_ID}}",
  "feature_slug": "{{FEATURE_SLUG}}",
  "exec_tier": 2,
  "status": "<success|partial|failed|commit_missing|docs_missing>",
  "completed_phases": [0, 1, 2, 3, 4, 5],
  "current_phase": 5,
  "checkpoint_reached": "CP-2",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "docs_maintained": true,
  "retrospective_done": true,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md",
    "plan_path": ".prizmkit/specs/{{FEATURE_SLUG}}/plan.md",
    "tasks_path": ".prizmkit/specs/{{FEATURE_SLUG}}/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

### Step 3.1: Final Clean Check (before exit)

After writing `session-status.json`, verify repository is clean:

```bash
git status --short
```

If any files remain, include them in the last commit:

```bash
git add -A
git commit --amend --no-edit
```

Re-check `git status --short` and ensure it is empty before exiting.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| Context Snapshot | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, `git status --short` must be empty
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
