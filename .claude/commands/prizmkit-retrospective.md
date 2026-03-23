---
description: "Incremental .prizm-docs/ and project memory maintainer. Performs three jobs: (1) structural sync — update .prizm-docs/ KEY_FILES/INTERFACES/DEPENDENCIES, (2) architecture knowledge — inject TRAPS/RULES into .prizm-docs/, (3) memory sedimentation — sediment DECISIONS/interface conventions to platform memory files (CLAUDE.md or CODEBUDDY.md+memory/MEMORY.md). Run after code review passes and before committing. Trigger on: 'retrospective', 'retro', 'update docs', 'sync docs', 'wrap up', 'done with feature', 'feature complete'. (project)"
---

# PrizmKit Retrospective

Maintains two distinct knowledge stores with clear separation of concerns:

| Store | Location | Content | Purpose |
|-------|----------|---------|---------|
| **Architecture Index** | `.prizm-docs/` | MODULE, FILES, INTERFACES, DEPENDENCIES, TRAPS, RULES | AI quickly locates code structure, interfaces, and known pitfalls |
| **Project Memory** | `CLAUDE.md` or `CODEBUDDY.md` + `memory/MEMORY.md` | DECISIONS, interface conventions, project-level rules | Decisions and conventions that influence future development direction |

**Reading guide for other skills**:
- Need to understand code structure/modules/interfaces? → Read `.prizm-docs/`
- Need to understand past decisions/conventions/why? → Read platform memory file (`CLAUDE.md` for Claude Code, `CODEBUDDY.md` + `memory/MEMORY.md` for CodeBuddy)

**This skill performs three jobs in one pass:**

1. **Structural Sync** — reflect what changed in code → `.prizm-docs/` (KEY_FILES, INTERFACES, DEPENDENCIES, file counts)
2. **Architecture Knowledge** — inject TRAPS and module-level RULES → `.prizm-docs/`
3. **Memory Sedimentation** — sediment DECISIONS and interface conventions → platform memory files

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

Extract TRAPS and module-level RULES from development work and inject into `.prizm-docs/`. **DECISIONS do NOT go here** — they are sedimented to platform memory files in Job 3.

`.prizm-docs/` is the **architecture index**: it tells AI *what code exists, how it connects, and what pitfalls to avoid*. It does NOT store *why* a design choice was made — that belongs in project memory.

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

**QUALITY GATE**: Every item must answer: "If a new AI session reads only `.prizm-docs/` and this entry, does it gain actionable understanding that prevents mistakes?" If not, discard. DECISIONS (why we chose A over B) belong in project memory, not here.

**2c.** Inject into the correct `.prizm-docs/` file:
- Module-level TRAPS/RULES → the affected L1 or L2 `.prizm` file
- Project-level RULES/PATTERNS → `root.prizm`

**RULE**: Only add genuinely new information. Never duplicate existing entries. Never rewrite entire files.

---

## Job 3: Memory Sedimentation → Platform Memory Files

Sediment DECISIONS and interface conventions to platform memory files. This is where project-level knowledge lives — the "why" behind design choices, cross-module contracts, and conventions that affect future development.

**Project Memory** is distinct from `.prizm-docs/`:
- `.prizm-docs/` = architecture index (structure, interfaces, traps) — "what exists and what to watch out for"
- Memory files = development decisions and conventions — "why we chose this approach and what contracts to honor"

### When to run Job 3

- Feature completion with notable DECISIONS or interface conventions discovered
- **Skip for**: trivial fixes, config changes, bug fixes with no new conventions

### Write Decision Gate (mandatory before any write)

Before writing anything to memory files, apply this evaluation in order:

**Gate 1 — Importance**: Is the content worth recording? Only record:
- New feature implementations with non-obvious design choices
- Critical logic changes with lasting impact
- Interface conventions that future sessions must honor
- **Skip**: simple queries, trivial fixes, one-off config changes, content with no future impact

**Gate 2 — Dedup**: If Gate 1 passes, read the existing memory file(s) first. Compare against existing entries by core keywords, feature summary, or function signature. If a highly similar entry already exists, **skip or merge-update** it — never duplicate.

**Gate 3 — Write only if both pass**: Write to memory files only when content is both important AND non-duplicate. Do NOT write by default after every feature. Skipping is the correct outcome for routine work.

**File size monitor**: After each write, check the file's line count. If it exceeds 500 lines, trigger the compaction flow below.

### Compaction Flow (triggered at >500 lines)

Goal: reduce file size while preserving all valuable knowledge.

Allowed operations (lossless):
- **Merge similar entries**: combine multiple updates about the same feature/topic into one comprehensive record
- **Remove stale content**: delete entries explicitly superseded, replaced, or marked as deprecated
- **Distill verbose logs**: compress long narrative descriptions into concise bullet points, preserving key code snippets, config changes, and decision rationale
- **Restructure**: reorganize headers and sections for clarity

Principle: compaction must be lossless — no valuable operational history or decision rationale may be lost.

### Sedimentation Rules

1. **Max 3-5 entries per feature**: Only keep DECISIONS and interface conventions that genuinely affect future development
2. **Dedup first**: Before appending, read the target memory file(s). If a similar entry already exists, skip or merge-update it
3. **TRAPS → `.prizm-docs/` only** (handled by Job 2 above)
4. **DECISIONS + key interface conventions → platform memory files**

### Steps

**2b-1.** Detect platform from `.prizmkit/config.json` `"platform"` field (or auto-detect from directory structure):
- `claude` → target: `CLAUDE.md` in project root
- `codebuddy` → targets: BOTH `CODEBUDDY.md` in project root AND `memory/MEMORY.md` (dual-write required)

**2b-2.** Apply the Write Decision Gate (Importance → Dedup → Write). If gate fails at any step, skip Job 3 entirely.

**2b-3.** Collect sedimentation candidates (only if gate passes):
- From context-snapshot.md '## Implementation Log': DECISIONS and notable discoveries
- From context-snapshot.md '## Review Notes': quality patterns, architectural observations
- From git diff analysis: any project-level conventions established
- Filter: only entries that answer "Would a new session benefit from knowing this decision/convention?"

**2b-4.** Read existing memory file(s) content. Check for duplicates or near-duplicates.
- For Claude Code: read `CLAUDE.md`
- For CodeBuddy: read BOTH `CODEBUDDY.md` AND `memory/MEMORY.md`

**2b-5.** Append to memory file(s) using this format:
```markdown
### F-XXX: <feature-title>
- DECISION: <decision content> — <rationale>
- INTERFACE: <module.function>: <convention>
```

**2b-6.** For CodeBuddy platform: write identical content to BOTH `CODEBUDDY.md` AND `memory/MEMORY.md` (dual-write, both must be updated).

**2b-7.** After writing, check file line count. If >500 lines, run the Compaction Flow before proceeding.

**2b-8.** If no Implementation Log or Review Notes sections exist in context-snapshot.md, still attempt to extract DECISIONS from git diff and plan.md. Skip only if no meaningful decisions were made.

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
implement → code-review → retrospective (architecture sync + memory sedimentation) → committer (pure commit)
```

The pipeline enforces a **docs pass condition**: `.prizm-docs/` must show changes in the final commit. This skill is the sole satisfier of that requirement.

## HANDOFF Chain

| From | To | Condition |
|------|----|-----------|
| `prizmkit-code-review` | **this skill** | Review passes or work is complete |
| **this skill** | `prizmkit-committer` | Architecture synced + memory sedimented, ready to commit |
| `prizmkit-committer` | — | Committed |

## Output

- `.prizm-docs/*.prizm` — Structurally synced + TRAPS/RULES enriched (architecture index)
- `.prizm-docs/changelog.prizm` — Appended entries
- Platform memory file(s) — DECISIONS + interface conventions sedimented (project memory)
  - Claude Code: `CLAUDE.md`
  - CodeBuddy: BOTH `CODEBUDDY.md` AND `memory/MEMORY.md`
- All `.prizm-docs/` changes staged via `git add .prizm-docs/`
