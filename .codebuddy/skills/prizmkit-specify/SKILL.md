---
name: prizmkit-specify
description: "Create structured feature specifications from natural language. Use this skill whenever the user wants to define a new feature, describe what to build, or write requirements. Trigger on: 'specify', 'define feature', 'write requirements', 'new feature', 'what should we build', 'I want to add...', 'I want to build...', 'let's add', 'let's build', 'feature idea', or when the user describes a feature they want. This is the first step in the full dev workflow — always use before /prizmkit-plan. Skip for bug fixes, config tweaks, or simple refactors (use fast path). (project)"
---

# PrizmKit Specify

Create structured feature specifications from natural language descriptions. This skill transforms a feature idea into a well-structured spec with user stories, acceptance criteria, and scope boundaries.

### When to Use
- Starting a new feature — user says "specify", "define feature", "new feature", "I want to add..."
- Before `/prizmkit-plan` — to define WHAT will be built before deciding HOW
- When a feature idea needs to be formalized before implementation
- When multiple stakeholders need to agree on scope before coding starts

### When NOT to Use
- Bug fixes with clear root cause → use fast path (`/prizmkit-plan` simplified → `/prizmkit-implement` → `/prizmkit-committer`)
- Config tweaks, typo fixes, simple refactors → edit directly
- Documentation-only changes → no spec needed
- User already has a detailed spec → skip to /prizmkit-plan

## Execution Steps

1. Ask user for feature description (natural language)
2. Auto-generate 2-4 word feature slug from description
3. Determine next feature number by scanning `.prizmkit/specs/`:
   - List existing `###-*` directories and find the highest numeric prefix
   - Next number = highest + 1 (zero-padded to 3 digits)
   - Append a short timestamp suffix (`-MMDD`) to prevent collisions in concurrent sessions. Example: `004-user-avatar-0319/`
   - If `.prizmkit/specs/` is empty or doesn't exist, start at `001`
4. Create directory: `.prizmkit/specs/###-feature-name-MMDD/`
5. Load project context (use first available source):
   - If `.prizmkit/specs/###-feature-name/context-snapshot.md` exists → read Section 3 'Prizm Context' from it (do NOT re-read `.prizm-docs/` files)
   - Otherwise → read `.prizm-docs/root.prizm`
6. Generate `spec.md` from template (`${SKILL_DIR}/assets/spec-template.md`) focusing on:
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

## Writing Principles

- **Focus on WHAT and WHY, never HOW** — the spec describes the problem space; implementation choices belong in plan.md. Mixing in tech stack details couples the spec to a specific solution and makes it harder to explore alternatives during planning.
- **Every user story needs acceptance criteria** in Given/When/Then format — without them, the implementer has no way to verify the feature works correctly, and the code reviewer has no baseline to check against.
- **Scope boundaries must be explicit** — without "Out of scope" boundaries, implementers tend to gold-plate features with capabilities nobody asked for, wasting time and adding complexity.
- **Max 3 `[NEEDS CLARIFICATION]` markers** — more than 3 means the feature idea isn't mature enough to spec. Suggest the user think through the concept further and return, or use `/prizmkit-clarify` to resolve them interactively.
- **Feature numbers are zero-padded to 3 digits** (e.g., `001`, `012`) with a `-MMDD` timestamp suffix — ensures consistent sorting and prevents collisions when multiple sessions run concurrently.

## Handling Vague Inputs

When the user's feature description is vague:
1. Extract what IS clear and write that into the spec
2. Mark genuinely ambiguous parts with `[NEEDS CLARIFICATION]` and include a recommended default
3. Suggest running `/prizmkit-clarify` to resolve ambiguities interactively before proceeding to plan

The goal is to never block progress — always produce a usable spec, even if it has open questions.

## Example

**Input:** "I want users to upload avatars"

**Output:** `.prizmkit/specs/003-user-avatar/spec.md`
```markdown
# Feature: User Avatar Upload

## Overview
Allow users to upload and manage profile avatar images.

## User Stories

### US-1: Upload Avatar
As a registered user, I want to upload a profile picture,
so that other users can visually identify me.

**Acceptance Criteria:**
- Given I am on my profile page
- When I select an image file and click upload
- Then my avatar is updated and visible across the platform

### US-2: Remove Avatar
As a registered user, I want to remove my avatar,
so that I can revert to a default placeholder.

## Scope
- **In scope:** Upload, display, remove avatar; image format validation
- **Out of scope:** Image cropping/editing, avatar history

## Open Questions
- [NEEDS CLARIFICATION] Maximum file size limit? Recommended: 10MB
```

**HANDOFF:** `/prizmkit-plan` or `/prizmkit-clarify`

## Template

The spec template is located at `${SKILL_DIR}/assets/spec-template.md`.

## Output

All outputs are written to `.prizmkit/specs/###-feature-name/`:
- `spec.md` — The feature specification
