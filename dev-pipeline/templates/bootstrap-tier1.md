# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}} tasks={{HAS_TASKS}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written.

**Tier 1 — Single Agent**: You handle everything directly. No subagents, no TeamCreate.

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
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md
.prizmkit/specs/{{FEATURE_SLUG}}/tasks.md
.prizmkit/specs/REGISTRY.md
```

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
Check `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — if it exists, skip Phase 1 and use it directly.
{{END_IF_RESUME}}

### Phase 1: Build Context Snapshot

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: output of relevant `ls src/` calls
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

If plan.md or tasks.md missing, write them directly (no PM needed):
- `plan.md`: key components, data flow, files to create/modify (under 80 lines)
- `tasks.md`: checklist with `[ ]` checkboxes, each task = one implementable unit

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement

For each task in tasks.md:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task
4. Mark task `[x]` in tasks.md immediately

After all tasks complete, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

### Phase 4: Self-Review

1. Re-read acceptance criteria from Section 1 of context-snapshot.md
2. Run the full test suite
3. Check error handling and edge cases
4. Fix any issues found

**CP-2**: All acceptance criteria met, tests pass.

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
  "exec_tier": 1,
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
| Session Status Output | {{SESSION_STATUS_PATH}} |
| Project Root | {{PROJECT_ROOT}} |

## Reminders

- Tier 1: you do everything — no subagents, no TeamCreate
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Before exiting, `git status --short` must be empty
