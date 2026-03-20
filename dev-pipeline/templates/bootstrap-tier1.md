# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}}

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
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md              ← includes Tasks section
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
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream phases read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/ 2>/dev/null
```

If plan.md missing, write it directly:
- `plan.md`: key components, data flow, files to create/modify, and a Tasks section with `[ ]` checkboxes (each task = one implementable unit). Keep under 80 lines.

**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement

For each task in plan.md Tasks section:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task
3. Mark task `[x]` in plan.md Tasks section immediately

After all tasks complete, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

### Phase 4: Code Review (mandatory)

1. Re-read acceptance criteria from Section 1 of context-snapshot.md
2. Run `/prizmkit-code-review` — verify all acceptance criteria, check code quality and correctness
3. Run the full test suite
4. If review uncovers issues, fix them (max 2 fix rounds)

**CP-2**: All acceptance criteria met, tests pass, code review passed.

### Phase 4.5: Memory Maintenance (mandatory before commit)

Run `/prizmkit-retrospective` — the **sole maintainer** of `.prizm-docs/`:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Knowledge injection** (feature sessions only): Extract TRAPS/RULES/DECISIONS from completed work into `.prizm-docs/`
3. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

### Phase 5: Commit

- Run `/prizmkit-committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

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
    "plan_path": ".prizmkit/specs/{{FEATURE_SLUG}}/plan.md"
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

If any files remain (e.g. session-status.json), stage and create a follow-up commit:

```bash
git add -A
git commit -m "chore({{FEATURE_ID}}): include session artifacts"
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

- Tier 1: you handle everything directly — invoke skills yourself (no subagents needed for simple tasks)
- MANDATORY skills: `/prizmkit-code-review`, `/prizmkit-retrospective`, `/prizmkit-committer` — never skip these
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Before exiting, `git status --short` must be empty
