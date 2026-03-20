---
description: "Execute implementation following plan.md tasks. Respects task ordering, dependencies, and TDD approach. Marks tasks complete as they finish. Use this skill whenever you're ready to write code for a planned feature, or for fast-path changes where the user describes a simple fix directly. Trigger on: 'implement', 'build', 'code it', 'start coding', '开发', 'write the code'. (project)"
---

# PrizmKit Implement

Execute implementation by following the task breakdown in plan.md. Respects task ordering, dependency constraints, and applies a TDD approach where applicable. Marks each task complete as it finishes.

### When to Use
- After `/prizmkit-plan` (or `/prizmkit-analyze`) when ready to write code
- User says "implement", "build", "code it", "start coding", "开发"
- For fast-path: user describes a simple change directly (fast-path skips specify, but still requires a simplified plan.md with Tasks section)

**PRECONDITION (multi-mode):**
- **Feature mode** (default): `plan.md` exists in `.prizmkit/specs/###-feature-name/` with a Tasks section containing unchecked tasks
- **Refactor mode**: `plan.md` exists in `.prizmkit/refactor/<refactor-slug>/` with a Tasks section containing unchecked tasks
- **Bugfix mode**: `plan.md` exists in `.prizmkit/bugfix/<BUG_ID>/` with a Tasks section containing unchecked tasks
- **Auto-detect**: If the calling workflow passes an explicit artifact directory, use that. Otherwise scan `.prizmkit/` subdirectories for the most recently modified `plan.md` with unchecked tasks.

## Execution Steps

1. **Detect mode and read context**:
   - Locate `plan.md` (check the artifact directory passed by the calling workflow, or auto-detect per PRECONDITION above)
   - Read `plan.md` (including Tasks section)
   - Read the companion input document for full context:
     - **Feature mode**: read `spec.md` in the same directory
     - **Refactor mode**: read `refactor-analysis.md` in the same directory — pay special attention to Scope Boundary (do not implement changes outside scope) and Baseline Tests (all must still pass)
     - **Bugfix mode**: read `fix-plan.md` in the same directory
2. Load project context — use the most efficient source available:
   - If `context-snapshot.md` exists in the feature directory → read it. Section 3 has Prizm docs + TRAPS, Section 4 has source files. This snapshot was built in Phase 1 of the pipeline to avoid re-reading dozens of individual files, saving significant tokens.
   - Otherwise → read relevant `.prizm-docs/` L1/L2 for affected modules. Pay special attention to TRAPS (gotchas, race conditions) and DECISIONS (past architectural choices you should respect).
3. Check if checkpoint tasks are complete before proceeding to next phase
4. For each unchecked task in order:
   a. If task has `[P]` marker, it can run in parallel with other `[P]` tasks in the same group
   b. Read L2 doc for target file's module (if exists) — TRAPS save you from repeating known mistakes
   c. Apply TDD where applicable: write a failing test first, then implement until it passes. For UI components or configuration changes where unit tests don't apply, skip the test-first step.
   d. Mark task as `[x]` in `plan.md` Tasks section immediately — not batched at the end. Immediate marking means the plan always reflects true progress, even if the session is interrupted.
   e. Error handling: sequential tasks stop on failure (later tasks may depend on this one). Parallel `[P]` tasks continue — report all failures at the end.
5. At each checkpoint: verify build passes and tests pass. Checkpoints catch integration errors early — skipping them means cascading failures in later phases that are much harder to debug.
6. After all tasks: run full test suite
7. Output implementation summary with pass/fail status

## Task Format in plan.md

Tasks in plan.md look like this:
```markdown
## Tasks

### Phase 1: Data Layer
- [ ] Create User model with avatar field in src/models/user.ts
- [ ] Add S3 upload utility in src/lib/s3.ts
- [x] ~~Set up database migration~~ (already done)

### Phase 2: API [P]
- [ ] [P] POST /api/avatar endpoint in src/routes/avatar.ts
- [ ] [P] DELETE /api/avatar endpoint in src/routes/avatar.ts

### Phase 3: UI
- [ ] Avatar upload component in src/components/AvatarUpload.tsx
- [ ] CP: Integration checkpoint — full test suite must pass
```

- `[ ]` / `[x]` — unchecked / completed
- `[P]` — can run in parallel with other `[P]` tasks in the same phase
- `CP:` — checkpoint where build + tests must pass before continuing

## Recovery

If a session is interrupted mid-implementation:
- Completed tasks are already marked `[x]` in plan.md (because we mark immediately)
- Resume by re-running `/prizmkit-implement` — it picks up from the first unchecked task
- context-snapshot.md persists across sessions for consistent context

**HANDOFF:** `/prizmkit-code-review`

## Output

- Code files created/modified as specified in plan.md Tasks section
- `plan.md` Tasks section updated with completion markers `[x]`
- Implementation summary output to conversation
