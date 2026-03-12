---
description: "Interactive requirement clarification. Resolves ambiguities in feature specs by asking sequential questions. Invoke after 'specify' or when spec has NEEDS CLARIFICATION markers. (project)"
---

# PrizmKit Clarify

Interactive requirement clarification that resolves ambiguities in feature specifications. Asks focused questions one at a time, updating the spec atomically after each answer.

## Commands

### `/prizmkit-clarify`

Resolve ambiguities and underspecified areas in a feature specification.

**PRECONDITION:** `spec.md` exists in current feature directory (`.prizmkit/specs/###-feature-name/`)

**STEPS:**

1. Read `spec.md` from `.prizmkit/specs/###-feature-name/`
2. Scan for `[NEEDS CLARIFICATION]` markers and underspecified areas
3. Categorize ambiguities by dimension:
   - Functional scope
   - Data model
   - UX flow
   - Non-functional requirements
   - Error handling
   - Edge cases
   - Integration points
   - Security
   - Performance
   - Accessibility
4. Ask questions ONE AT A TIME (not all at once), max 5 questions
5. For each question: provide a recommended answer with rationale
6. After each answer: immediately update `spec.md` atomically (not batch)
7. Support early termination: user says "done" or "stop"
8. Remove resolved `[NEEDS CLARIFICATION]` markers
9. After all questions resolved or user terminates: output summary of changes made

**KEY RULES:**
- NEVER ask all questions at once — sequential, one at a time
- ALWAYS provide a recommended answer with rationale for each question
- Updates to `spec.md` MUST be atomic (after each answer, not batched)
- Max 5 questions per session
- Respect early termination — "done" or "stop" ends the session immediately
- Do NOT introduce implementation details — keep spec at WHAT/WHY level

**HANDOFF:** ``/prizmkit-plan``

## Output

Updates are made directly to `.prizmkit/specs/###-feature-name/spec.md`. No new files are created.
