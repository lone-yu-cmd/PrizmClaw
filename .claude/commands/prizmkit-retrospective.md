---
description: "Incremental .prizm-docs/ maintainer. Performs two jobs: (1) structural sync — update .prizm-docs/ KEY_FILES/INTERFACES/DEPENDENCIES, (2) architecture knowledge — inject TRAPS/RULES/DECISIONS into .prizm-docs/. All project knowledge lives in .prizm-docs/ — no writes to CLAUDE.md/CODEBUDDY.md/memory/MEMORY.md. Run after code review passes and before committing. Trigger on: 'retrospective', 'retro', 'update docs', 'sync docs', 'wrap up', 'done with feature', 'feature complete'. (project)"
---

# PrizmKit Retrospective

All project knowledge is maintained in a single store:

| Store | Location | Content | Purpose |
|-------|----------|---------|---------|
| **Architecture Index** | `.prizm-docs/` | MODULE, FILES, INTERFACES, DEPENDENCIES, TRAPS, RULES, DECISIONS | AI quickly locates code structure, interfaces, known pitfalls, and key design decisions |

**This skill performs two jobs in one pass:**

1. **Structural Sync** — reflect what changed in code → `.prizm-docs/` (KEY_FILES, INTERFACES, DEPENDENCIES, file counts)
2. **Architecture Knowledge** — inject TRAPS, RULES, and DECISIONS → `.prizm-docs/`

**Important**: This skill does NOT write to `CLAUDE.md`, `CODEBUDDY.md`, or `memory/MEMORY.md`. All knowledge is consolidated in `.prizm-docs/`.

No other skill writes to `.prizm-docs/`. This is the sole writer during ongoing development. For initial doc setup, validation, or migration, use `/prizmkit-prizm-docs` instead.

## When to Use

- **Before every commit** (mandatory in pipeline) — ensures docs and code are in sync
- After completing a feature (spec, plan, implementation all done)
- After code review passes (PASS or PASS WITH WARNINGS)
- User says "retrospective", "retro", "update docs", "sync docs", "wrap up"
- After refactoring or bugfix cycles (structural sync + optional TRAPS update)

## When NOT to Use

- Only comments, whitespace, or formatting changed — no structural/knowledge change
- Only test files changed — no module-level impact
- Only .prizm files changed — avoid circular updates
- User just wants to commit without doc update — use `/prizmkit-committer` directly (but pipeline will flag `docs_missing`)

---

## Job 1: Structural Sync

Reflect code changes in `.prizm-docs/` so the project map stays accurate.

### Steps

**1a.** Get changed files:
```bash
git diff --cached --name-status
```
If nothing staged, fallback:
```bash
git diff --name-status
```

**1b.** Read `.prizm-docs/root.prizm` to get MODULE_INDEX. Map each changed file to its module.

**1c.** Classify changes:
- `A` (added) → add to KEY_FILES, check for new INTERFACES
- `D` (deleted) → remove from KEY_FILES, update FILE count
- `M` (modified) → check if public interfaces or dependencies changed
- `R` (renamed) → update all path references

**1d.** Update affected docs (bottom-up: L2 → L1 → L0):

- **L2** (if exists): Update KEY_FILES, INTERFACES, DEPENDENCIES, CHANGELOG, UPDATED timestamp
- **L1**: Update FILES count, KEY_FILES (if major files added/removed), INTERFACES (if public API changed), UPDATED timestamp
- **L0 root.prizm**: Update MODULE_INDEX file counts only if counts changed. Update UPDATED only if structural change (module added/removed).

**1e.** If new directory with 3+ source files matches no existing module: create L1 doc immediately, add to MODULE_INDEX, defer L2.

**1f.** Enforce size limits:
- L0 > 4KB → consolidate MODULE_INDEX
- L1 > 3KB → move details to L2
- L2 > 5KB → archive old CHANGELOG entries

**SKIP structural sync if**: only internal implementation changed (no interface/dependency impact), only comments/whitespace, only test files, only .prizm files, bug fixes with no interface change.

---

## Job 2: Architecture Knowledge Injection → `.prizm-docs/`

Extract TRAPS, RULES, and DECISIONS from development work and inject into `.prizm-docs/`. All project knowledge lives in `.prizm-docs/` — no external memory files.

`.prizm-docs/` is the **single source of project knowledge**: it tells AI *what code exists, how it connects, what pitfalls to avoid, and why key design choices were made*.

### When to run Job 2

- Feature completion (spec + plan + implementation done)
- Bugfix with a genuinely new pitfall discovered
- Refactor that revealed structural insights
- **Skip for**: trivial fixes, config changes, dependency bumps

### Steps

**2a.** Gather context — read the **actual code that was changed** plus any available artifacts:

- `git diff HEAD` — the real source of truth for what happened
- `.prizmkit/specs/###-feature-name/context-snapshot.md` — read the '## Implementation Log' section (Dev's changes, decisions, discoveries) and '## Review Notes' section (Reviewer's findings). These are the **preferred source** for pre-categorized decisions and findings. If these sections exist, prefer them over re-extracting from git diff.
- `.prizmkit/specs/###-feature-name/plan.md` — if feature work, read planned vs actual
- `.prizmkit/bugfix/<id>/fix-report.md` — if bugfix, read what was discovered
- The relevant `.prizm-docs/` L1/L2 docs for affected modules

**2b.** Extract knowledge from what was **observed in code**, not invented:

**TRAPS** (highest priority) — things that look safe but break:
- Format: `- <what looks safe but is dangerous> | FIX: <correct approach>`
- Source: actual bugs hit, surprising behavior discovered in code, non-obvious coupling

**RULES** — conventions established or constraints discovered:
- Format: `- MUST/NEVER/PREFER: <rule>`
- Source: patterns that proved necessary during implementation

**DECISIONS** — key design choices that affect future development:
- Format: `- <what was decided> — <rationale>`
- Source: non-obvious design choices, interface conventions, cross-module contracts
- Only record decisions that a future AI session would benefit from knowing
- Do NOT record obvious implementation details that can be derived by reading the code

**QUALITY GATE**: Every item must answer: "If a new AI session reads only `.prizm-docs/` and this entry, does it gain actionable understanding?" If not, discard. Do not record trivially observable code patterns — the AI can read the code directly.

**2c.** Inject into the correct `.prizm-docs/` file:
- Module-level TRAPS/RULES/DECISIONS → the affected L1 or L2 `.prizm` file's corresponding section
- Project-level RULES/PATTERNS → `root.prizm`

**RULE**: Only add genuinely new information. Never duplicate existing entries. Never rewrite entire files.

---

## Final: Changelog + Stage

**3a.** Append to `.prizm-docs/changelog.prizm`:
- Format: `- YYYY-MM-DD | <module-path> | <verb>: <one-line description>`
- Verbs: add, update, fix, remove, refactor, rename, deprecate
- One entry per meaningful change, not one per file

**3b.** Stage all doc changes:
```bash
git add .prizm-docs/
```

**3c.** Handoff:
- `/prizmkit-committer` — proceed to commit

---

## Integration with Pipeline

In the dev-pipeline, this skill is the **single doc maintenance step** before commit:

```
implement → code-review → retrospective (architecture sync) → committer (pure commit)
```

The pipeline enforces a **docs pass condition**: `.prizm-docs/` must show changes in the final commit. This skill is the sole satisfier of that requirement.

## HANDOFF Chain

| From | To | Condition |
|------|----|-----------|
| `prizmkit-code-review` | **this skill** | Review passes or work is complete |
| **this skill** | `prizmkit-committer` | Architecture synced, ready to commit |
| `prizmkit-committer` | — | Committed |

## Output

- `.prizm-docs/*.prizm` — Structurally synced + TRAPS/RULES/DECISIONS enriched
- `.prizm-docs/changelog.prizm` — Appended entries
- All `.prizm-docs/` changes staged via `git add .prizm-docs/`
