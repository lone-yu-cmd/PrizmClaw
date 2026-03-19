---
name: prizmkit-clarify
description: "Interactive requirement clarification. Resolves ambiguities in feature specs by asking sequential questions with recommended answers. Use when spec has unclear parts or you're unsure about requirements before planning. Use this skill whenever a spec has [NEEDS CLARIFICATION] markers, vague requirements, or the user wants to refine their feature definition before planning. Trigger on: 'clarify', 'refine spec', 'resolve ambiguities', 'spec has questions', 'unsure about requirements', 'spec is unclear'. (project)"
---

# PrizmKit Clarify

Interactive requirement clarification that resolves ambiguities in feature specifications. Asks focused questions one at a time, updating the spec atomically after each answer.

### When to Use
- After `/prizmkit-specify` when spec has `[NEEDS CLARIFICATION]` markers
- User says "clarify", "resolve ambiguities", "refine spec"
- Before `/prizmkit-plan` to ensure spec is unambiguous

**PRECONDITION:** `spec.md` exists in current feature directory (`.prizmkit/specs/###-feature-name/`)

## Execution Steps

1. Read `spec.md` from `.prizmkit/specs/###-feature-name/`
2. Scan for `[NEEDS CLARIFICATION]` markers and underspecified areas
3. Categorize ambiguities by dimension and prioritize — address the ones that would most affect architecture and data model first, since those are hardest to change later:
   - Functional scope (what does it do?)
   - Data model (what entities, relationships?)
   - UX flow (what does the user see?)
   - Error handling (what happens when things fail?)
   - Non-functional requirements (performance, security)
   - Edge cases, integration points, accessibility
4. Ask questions one at a time (max 5 per session) — batch questions overwhelm users and produce lower-quality answers because they rush through without thinking deeply about each one
5. For each question: provide a recommended answer with rationale. The recommendation gives users a concrete starting point to accept, modify, or reject — this is much faster than open-ended questions
6. After each answer: immediately update `spec.md` (not batched at the end). Atomic updates mean the spec is always in a consistent state, even if the session is interrupted
7. Support early termination: user says "done" or "stop" — end immediately
8. Remove resolved `[NEEDS CLARIFICATION]` markers
9. After all questions resolved or user terminates: output summary of changes made

## Example Session

**Question 1:**
> spec.md §3.2 says "User can upload files" but doesn't specify which file types or size limits.
>
> **Recommended answer:** Accept JPEG, PNG, and PDF up to 10MB. These are the most common user upload types, and 10MB covers high-res photos without straining storage.
>
> Do you agree, or would you like different constraints?

**User:** "Also allow SVG, and make it 25MB"

**Action:** Update spec.md §3.2:
```
File upload: accepts JPEG, PNG, PDF, SVG. Max size: 25MB per file.
```
Remove `[NEEDS CLARIFICATION]` marker from §3.2.

## Guidelines

- Keep questions at the WHAT/WHY level — do not introduce implementation details (HOW). The spec describes the problem space; implementation choices belong in plan.md
- 5-question limit per session keeps clarification focused. If more questions remain, tell the user and suggest running clarify again after they've had time to think
- If the user's answer contradicts an existing requirement, point out the conflict and ask which one should change

**HANDOFF:** `/prizmkit-plan`

## Output

Updates are made directly to `.prizmkit/specs/###-feature-name/spec.md`. No new files are created.
