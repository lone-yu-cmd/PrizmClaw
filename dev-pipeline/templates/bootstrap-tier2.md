# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. Spawn Dev and Reviewer agents via the Agent tool.

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
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md              ← includes Tasks section
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/{{FEATURE_SLUG}}/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for full context. Also read .prizmkit/specs/{{FEATURE_SLUG}}/agents/*.md for knowledge from previous agents. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0.5: Agent Knowledge Setup

Create the agent knowledge directory and initialize your own knowledge doc:
```bash
mkdir -p .prizmkit/specs/{{FEATURE_SLUG}}/agents
```

Write `.prizmkit/specs/{{FEATURE_SLUG}}/agents/orchestrator.md`:
```markdown
# Orchestrator

## FINDINGS

## DECISIONS

## INTERFACES_DISCOVERED

## CONTEXT_BUILT
```

After each phase, append notable DECISIONS/FINDINGS to your `agents/orchestrator.md`.

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
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream subagents read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/plan.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach, and a Tasks section with `[ ]` checkboxes ordered by dependency
**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Agent tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> **IMPORTANT**: Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST.
> This file contains ALL source code and context. Do NOT re-read individual source files.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — all project context, source files, and tests are embedded there.
> 2. Read `.prizmkit/specs/{{FEATURE_SLUG}}/plan.md` (including Tasks section).
> 3. Implement task-by-task using TDD. Mark each task `[x]` in plan.md Tasks section immediately after completion.
> 4. **Agent Knowledge Doc**: Maintain `.prizmkit/specs/{{FEATURE_SLUG}}/agents/dev-1.md`. After each task, append FINDINGS/DECISIONS/INTERFACES_DISCOVERED if you discovered anything notable. If context-snapshot.md was MISSING, write CONTEXT_BUILT entries after scanning source files.
> 5. After ALL tasks complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Agent tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. Review feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}).
>
> **IMPORTANT**: Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST.
> This file contains ALL source code and context. Do NOT re-read individual source files.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log': what Dev changed
> 2. Read `.prizmkit/specs/{{FEATURE_SLUG}}/agents/dev-*.md` (if exists) — understand Dev's implementation decisions and trade-offs.
> 3. Run prizmkit-code-review: verify all acceptance criteria, check code quality and correctness. Only read files mentioned in the Implementation Log.
> 4. Run the test suite and report results.
> 5. Append a 'Review Notes' section to `context-snapshot.md`: issues found (severity), test results, final verdict.
> 6. **Agent Knowledge Doc**: Maintain `.prizmkit/specs/{{FEATURE_SLUG}}/agents/reviewer.md`. Write FINDINGS/DECISIONS after review (e.g., patterns discovered, quality issues, architectural observations).
> 7. If review uncovers durable pitfalls or conventions, add corresponding TRAPS/RULES notes to relevant `.prizm-docs/` files.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 4.5: Architecture Sync & Memory Sedimentation (mandatory before commit)

Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index) and platform memory files:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES from completed work into `.prizm-docs/`
3. **Memory sedimentation** (feature sessions only): Sediment DECISIONS and interface conventions to platform memory file (`CLAUDE.md` for Claude Code, BOTH `CODEBUDDY.md` AND `memory/MEMORY.md` for CodeBuddy)
4. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

### Phase 5: Session Status + Commit

**5a. Write preliminary session-status.json** (safety net — ensures pipeline sees a status file even if session terminates during commit):

Write to: `{{SESSION_STATUS_PATH}}`

```json
{
  "session_id": "{{SESSION_ID}}",
  "feature_id": "{{FEATURE_ID}}",
  "feature_slug": "{{FEATURE_SLUG}}",
  "exec_tier": 2,
  "status": "partial",
  "completed_phases": [0, 1, 2, 3, 4],
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
  "git_commit": "",
  "timestamp": "<current ISO timestamp>"
}
```

**5b. Commit** — Run `/prizmkit-committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**5c. Update session-status.json to success** — After commit succeeds, update `{{SESSION_STATUS_PATH}}`:
- Set `"status": "success"`
- Set `"completed_phases": [0, 1, 2, 3, 4, 5]`
- Set `"git_commit": "<actual commit hash from git log -1 --format=%H>"`
- Set `"timestamp": "<current ISO timestamp>"`

**5d. Final Clean Check** — Verify repository is clean:

```bash
git status --short
```

If any files remain, stage them **explicitly by name** (do NOT use `git add -A`) and create a follow-up commit:

```bash
git add <specific-file-1> <specific-file-2>
git commit -m "chore({{FEATURE_ID}}): include session artifacts"
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

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — use direct Agent spawn for agents
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- Session-status.json is written BEFORE commit (as partial), then updated to success AFTER commit — this prevents pipeline from treating a terminated session as crashed
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, `git status --short` must be empty
- When staging leftover files in the final clean check, always use explicit file names — NEVER use `git add -A`
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
