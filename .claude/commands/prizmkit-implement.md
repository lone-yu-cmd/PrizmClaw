---
description: "Execute implementation following tasks.md. Respects task ordering, dependencies, and TDD approach. Marks tasks complete as they finish. Invoke with 'implement' or 'build'. (project)"
---

# PrizmKit Implement

Execute implementation by following the task breakdown in tasks.md. Respects task ordering, dependency constraints, and applies a TDD approach where applicable. Marks each task complete as it finishes.

## Commands

### `/prizmkit-implement`

Implement the feature by executing tasks from tasks.md.

**PRECONDITION:** `plan.md` exists in `.prizmkit/specs/###-feature-name/` with a Tasks section containing unchecked tasks

**STEPS:**

1. Read `plan.md` (including Tasks section), `spec.md` for full context
2. Read relevant `.prizm-docs/` L1/L2 for affected modules (check TRAPS and DECISIONS sections)
3. Check if checkpoint tasks are complete before proceeding to next phase
4. For each unchecked task in order:
   a. If task has `[P]` marker and previous parallel tasks are running, can proceed in parallel
   b. Read L2 doc for target file's module (if exists)
   c. Implement following TDD: write test first if applicable
   d. Mark task as `[x]` in `plan.md` Tasks section
   e. If error occurs: for sequential tasks, stop and report; for parallel tasks, continue others
5. At each checkpoint: verify build passes and tests pass
6. After all tasks: run full test suite
7. Output: implementation summary with pass/fail status

**KEY RULES:**
- NEVER skip a checkpoint — build and tests MUST pass before proceeding to next phase
- Sequential tasks MUST execute in order — stop on failure
- Parallel tasks (`[P]` marker) MAY continue if one fails, but report all failures
- TDD approach: write test first, then implement, then verify test passes
- Read `.prizm-docs/` TRAPS section before implementing to avoid known pitfalls
- Mark each task `[x]` in `plan.md` Tasks section immediately upon completion (not batched)

**HANDOFF:** ``/prizmkit-code`-review`

## Output

- Code files created/modified as specified in plan.md Tasks section
- `plan.md` Tasks section updated with completion markers `[x]`
- Implementation summary output to conversation
