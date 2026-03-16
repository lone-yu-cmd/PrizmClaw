---
description: "Generate technical implementation plan and executable task breakdown from feature spec. Produces plan.md with architecture, data model, API contracts, and a Tasks section. Invoke after 'specify' when ready to plan. (project)"
---

# PrizmKit Plan

Generate a comprehensive technical implementation plan from a feature specification. Produces plan.md with architecture approach, component design, data model, API contracts, testing strategy, risk assessment, and an executable Tasks section.

## Commands

### `/prizmkit-plan`

Create a technical implementation plan and task breakdown for a specified feature.

**PRECONDITION:** `spec.md` exists in `.prizmkit/specs/###-feature-name/`, `.prizm-docs/root.prizm` exists

**STEPS:**

**Phase 0 — Research:**
1. Read `spec.md` for feature requirements
2. Load project context (use first available source):
   - If `.prizmkit/specs/###-feature-name/context-snapshot.md` exists → read it for all context (Section 3 'Prizm Context' for docs, Section 4 'Existing Source Files' for code). Do NOT re-read `.prizm-docs/` or individual source files.
   - Otherwise → read `.prizm-docs/root.prizm` and relevant `.prizm-docs/` L1/L2 docs for affected modules
3. Resolve any remaining `[NEEDS CLARIFICATION]` by proposing solutions
4. Research technical approach based on project's tech stack

**Phase 1 — Design:**
5. Generate `plan.md` from template (`.claude/command-assets/prizmkit-plan/assets/plan-template.md`):
   - Architecture approach (how feature fits into existing structure)
   - Component design (new/modified components)
   - Data model changes (new entities, modified schemas)
   - Interface design (API endpoints, request/response formats, module interfaces)
   - Integration points (external services, internal modules)
   - Testing strategy (unit, integration, e2e)
   - Risk assessment
6. Cross-check plan against spec: every user story MUST map to plan components
7. Check alignment with project rules from `.prizm-docs/root.prizm` RULES section

**Phase 2 — Task Generation:**
8. Ask user for implementation strategy (or infer from context): MVP-first / Incremental / Parallel
9. Append `## Tasks` section to `plan.md` using the tasks template at the end of `.claude/command-assets/prizmkit-plan/assets/plan-template.md`:
   - Organized by phases: Setup(T-001~T-009) → Foundational(T-010~T-099) → User Stories(T-100+) → Polish(T-900+)
   - Each task: `- [ ] [T-NNN] [P?] [US?] Description — file: path/to/file`
   - `[P]` marker for tasks that can run in parallel within their phase
   - Checkpoint tasks between phases for validation
10. Verify: every user story maps to at least one task; every task references a target file path
11. Output: `plan.md` path, summary of design decisions, and task count

**KEY RULES:**
- Every user story in spec.md MUST have a corresponding component AND task in the plan
- Architecture decisions MUST align with existing project patterns from `.prizm-docs/`
- Risk assessment MUST include at least one risk with mitigation strategy
- Supporting details (data model, interface design) are included as sections within plan.md, not as separate files
- Task IDs use zero-padded numbering: `[T-001]`, `[T-010]`, `[T-100]`
- Every task MUST reference a target file path
- Each user story section MUST be independently testable

**HANDOFF:** ``/prizmkit-analyze`` or ``/prizmkit-implement``

## Template

The plan template is located at `.claude/command-assets/prizmkit-plan/assets/plan-template.md`.

## Output

All outputs are written to `.prizmkit/specs/###-feature-name/`:
- `plan.md` — The implementation plan (includes architecture, component design, data model, interface design, testing strategy, risk assessment, and Tasks section)
