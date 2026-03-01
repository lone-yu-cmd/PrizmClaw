---
description: "Generate technical implementation plan and executable task breakdown from feature spec. Produces plan.md with architecture, data model, API contracts, and a Tasks section. Use this skill whenever the user wants to design how a feature will be built, break work into tasks, or think through architecture. Trigger on: 'plan', 'architect', 'how to build', 'design', 'break it down', 'break this into tasks', 'create tasks', 'implementation strategy', 'how should we implement'. Always use after /prizmkit-specify and before /prizmkit-implement. (project)"
---

# PrizmKit Plan

Generate a comprehensive technical implementation plan from a feature specification. Produces plan.md with architecture approach, component design, data model, API contracts, testing strategy, risk assessment, and an executable Tasks section.

### When to Use
- After `/prizmkit-specify` when ready to plan the implementation
- User says "plan", "architect", "how to build", "design", "break it down", "create tasks"
- Before `/prizmkit-implement` to create the task breakdown
- When user wants to understand the full implementation approach before coding

### When NOT to Use
- No input document exists yet (no spec.md, no refactor-analysis.md, no fix-plan.md) → run `/prizmkit-specify` or the appropriate upstream skill first
- Simple bug fix or config change → use fast path (`/prizmkit-plan` with simplified output → `/prizmkit-implement` → `/prizmkit-committer`)
- User just wants to explore/research → answer directly, no plan artifact needed

**PRECONDITION (multi-mode):**
- **Feature mode** (default): `spec.md` exists in `.prizmkit/specs/###-feature-name/`, `.prizm-docs/root.prizm` exists. If spec.md is missing, prompt the user: "No spec found — want me to run /prizmkit-specify first?"
- **Refactor mode**: `refactor-analysis.md` exists in `.prizmkit/refactor/<refactor-slug>/`. Use refactor-analysis.md as the input document in place of spec.md. Output plan.md to the same `.prizmkit/refactor/<refactor-slug>/` directory, NOT to `.prizmkit/specs/`.
- **Bugfix mode**: Bug description provided by caller or `fix-plan.md` exists in `.prizmkit/bugfix/<BUG_ID>/`. Output plan.md to the same directory.
- **Auto-detect**: If the calling workflow passes an explicit artifact directory, use that. Otherwise check which input document type exists.

## Execution Steps

**Phase 0 — Research:**
1. Read the input document for requirements:
   - **Feature mode**: Read `spec.md` for feature requirements
   - **Refactor mode**: Read `refactor-analysis.md` for refactoring goals, scope boundary, and baseline tests
   - **Bugfix mode**: Read bug description / `fix-plan.md` for reproduction steps and expected fix
2. Load project context (use first available source):
   - If `.prizmkit/specs/###-feature-name/context-snapshot.md` exists → read it for all context (Section 3 'Prizm Context' for docs, Section 4 'File Manifest' for code structure and interfaces). The context-snapshot consolidates project context into one read, saving significant tokens.
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
6. Cross-check plan against spec: every user story should map to plan components — unmapped stories mean the plan has coverage gaps that will surface during implementation
7. Check alignment with project rules from `.prizm-docs/root.prizm` RULES section — violating project rules causes CRITICAL findings in the analyze phase

**Phase 2 — Task Generation:**
8. Ask user for implementation strategy (or infer from context): MVP-first / Incremental / Parallel
9. Append `## Tasks` section to `plan.md` using the tasks template at the end of `.claude/command-assets/prizmkit-plan/assets/plan-template.md`:
   - Organized by phases: Setup(T-001~T-009) → Foundational(T-010~T-099) → User Stories(T-100+) → Polish(T-900+)
   - Each task: `- [ ] [T-NNN] [P?] [US?] Description — file: path/to/file`
   - `[P]` marker for tasks that can run in parallel within their phase
   - Checkpoint tasks between phases for validation
10. Verify coverage and traceability:
    - Every user story maps to at least one task — orphan stories become orphan features
    - Every task references a target file path — pathless tasks leave implementers guessing where to write code
    - Risk assessment includes at least one risk with mitigation — helps the implementer prepare for known challenges
11. Output: `plan.md` path, summary of design decisions, and task count

**Task ID Conventions:**
- Task IDs use zero-padded numbering: `[T-001]`, `[T-010]`, `[T-100]` — this ensures consistent sorting and visual alignment
- Each user story section should be independently testable — this enables incremental verification during implementation

**HANDOFF:** `/prizmkit-analyze` or `/prizmkit-implement`

## Example

**Input:** spec.md for "User Avatar Upload" feature

**Output:** plan.md excerpt:
```markdown
## Architecture Approach
Extend existing user profile module. Add S3 integration for file storage.
Reuse existing auth middleware for upload endpoint protection.

## Tasks

### Phase 1: Data Layer (T-010~T-019)
- [ ] [T-010] [US-1] Add avatar_url field to User model — file: src/models/user.ts
- [ ] [T-011] [US-1] Create S3 upload utility — file: src/lib/s3.ts
- [ ] [T-012] CP: Data layer checkpoint — run migrations + unit tests

### Phase 2: API [P] (T-100~T-109)
- [ ] [T-100] [P] [US-1] POST /api/avatar upload endpoint — file: src/routes/avatar.ts
- [ ] [T-101] [P] [US-2] DELETE /api/avatar endpoint — file: src/routes/avatar.ts
- [ ] [T-102] CP: API checkpoint — integration tests pass
```

## Template

The plan template is located at `.claude/command-assets/prizmkit-plan/assets/plan-template.md`.

## Output

Output directory depends on mode:
- **Feature mode**: `.prizmkit/specs/###-feature-name/plan.md`
- **Refactor mode**: `.prizmkit/refactor/<refactor-slug>/plan.md`
- **Bugfix mode**: `.prizmkit/bugfix/<BUG_ID>/plan.md`

The plan.md includes architecture, component design, data model, interface design, testing strategy, risk assessment, and Tasks section.
