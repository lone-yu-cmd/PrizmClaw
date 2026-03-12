---
name: prizmkit-plan
description: "Generate technical implementation plan from feature spec. Creates plan.md, data-model.md, API contracts, and research docs. Invoke after 'specify' when ready to plan. (project)"
---

# PrizmKit Plan

Generate a comprehensive technical implementation plan from a feature specification. Produces plan.md with architecture approach, component design, data model, API contracts, testing strategy, and risk assessment.

## Commands

### prizmkit.plan

Create a technical implementation plan for a specified feature.

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
5. Generate `plan.md` from template (`${SKILL_DIR}/assets/plan-template.md`):
   - Architecture approach (how feature fits into existing structure)
   - Component design (new/modified components)
   - Data model changes (new entities, modified schemas)
   - Interface design (API endpoints, request/response formats, module interfaces)
   - Integration points (external services, internal modules)
   - Testing strategy (unit, integration, e2e)
   - Risk assessment
6. Cross-check plan against spec: every user story MUST map to plan components
7. Check alignment with project rules from `.prizm-docs/root.prizm` RULES section
8. Output: `plan.md` path and summary of design decisions

**KEY RULES:**
- Every user story in spec.md MUST have a corresponding component or task in the plan
- Architecture decisions MUST align with existing project patterns from `.prizm-docs/`
- Risk assessment MUST include at least one risk with mitigation strategy
- Supporting details (data model, interface design) are included as sections within plan.md, not as separate files

**HANDOFF:** `prizmkit.tasks` or `prizmkit.code-review`

## Template

The plan template is located at `${SKILL_DIR}/assets/plan-template.md`.

## Output

All outputs are written to `.prizmkit/specs/###-feature-name/`:
- `plan.md` — The implementation plan (includes architecture, component design, data model, interface design, testing strategy, risk assessment)
