---
description: "Generate executable task breakdown from implementation plan. Creates tasks.md with dependency ordering, parallel markers, and file paths. Invoke after 'plan'. (project)"
---

# PrizmKit Tasks

Generate an executable task breakdown from an implementation plan. Produces tasks.md organized by phases with dependency ordering, parallel execution markers, and target file paths.

## Commands

### `/prizmkit-tasks`

Create a detailed task breakdown for implementation.

**PRECONDITION:** `spec.md` and `plan.md` exist in `.prizmkit/specs/###-feature-name/`

**STEPS:**

1. Read `spec.md`, `plan.md`, `data-model.md` (if exists), `contracts/` (if exists)
2. Generate `tasks.md` from template (`.claude/commands/prizmkit-tasks/assets/tasks-template.md`) organized by:
   - Phase: Setup → Foundational → User Stories (US1→US2→...) → Polish
   - Each task: `- [ ] [T-NNN] [P?] [US?] Description — file: path/to/file`
   - `[P]` marker for tasks that can run in parallel
   - Each user story section is independently implementable and testable
3. Implementation strategy selection (ask user):
   - **MVP-first**: core features → iterate
   - **Incremental**: story-by-story delivery
   - **Parallel**: independent stories in parallel
4. Include checkpoint tasks between phases for validation
5. Output: `tasks.md` path and task count summary

**KEY RULES:**
- Task IDs use zero-padded numbering: `[T-001]`, `[T-010]`, `[T-100]`
- Setup tasks start at T-001, Foundational at T-010, User Stories at T-100+, Polish at T-900
- Every task MUST reference a target file path
- `[P]` marker indicates tasks that can execute in parallel within their phase
- Checkpoint tasks MUST appear between phases
- Each user story section MUST be independently testable

**HANDOFF:** ``/prizmkit-implement``

## Template

The tasks template is located at `.claude/commands/prizmkit-tasks/assets/tasks-template.md`.

## Output

All outputs are written to `.prizmkit/specs/###-feature-name/`:
- `tasks.md` — The task breakdown
