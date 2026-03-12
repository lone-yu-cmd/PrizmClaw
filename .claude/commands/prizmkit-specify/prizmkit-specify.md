---
description: "Create structured feature specifications from natural language. Invoke when starting a new feature, user says 'specify', 'define feature', or 'write requirements'. (project)"
---

# PrizmKit Specify

Create structured feature specifications from natural language descriptions. This skill transforms a feature idea into a well-structured spec with user stories, acceptance criteria, and scope boundaries.

## Commands

### `/prizmkit-specify`

Create a new feature specification.

**STEPS:**

1. Ask user for feature description (natural language)
2. Auto-generate 2-4 word feature slug from description
3. Determine next feature number by scanning `.prizmkit/specs/`
4. Create directory: `.prizmkit/specs/###-feature-name/`
5. Read Prizm docs (`.prizm-docs/root.prizm`) for project context
6. Generate `spec.md` from template (`.claude/commands/prizmkit-specify/assets/spec-template.md`) focusing on:
   - Feature title and description
   - User stories (As a... I want... So that...)
   - Acceptance criteria (Given/When/Then)
   - Scope boundaries (In scope / Out of scope)
   - Dependencies and constraints
   - `[NEEDS CLARIFICATION]` markers for ambiguous items (max 3)
7. Run internal quality validation loop (max 3 iterations):
   - Check: All user stories have acceptance criteria?
   - Check: Scope boundaries clearly defined?
   - Check: No more than 3 `[NEEDS CLARIFICATION]` markers?
8. Output: `spec.md` path and summary

**KEY RULES:**
- Focus on WHAT and WHY, never HOW (no tech stack details)
- Max 3 `[NEEDS CLARIFICATION]` markers
- Every user story MUST have at least one acceptance criterion in Given/When/Then format
- Scope boundaries MUST be explicitly defined
- Feature numbers are zero-padded to 3 digits (e.g., `001`, `012`)

**HANDOFF:** ``/prizmkit-plan`` or ``/prizmkit-clarify``

## Template

The spec template is located at `.claude/commands/prizmkit-specify/assets/spec-template.md`.

## Output

All outputs are written to `.prizmkit/specs/###-feature-name/`:
- `spec.md` — The feature specification
