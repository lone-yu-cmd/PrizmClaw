---
name: prizmkit-prizm-docs
description: "Project documentation specification and standard for AI-optimized progressive context loading. Defines the .prizm-docs/ 3-level hierarchy (L0/L1/L2), format rules, size limits, and loading protocol. Use this skill to: bootstrap docs for new projects (init), check doc freshness (status), regenerate stale modules (rebuild), validate format compliance (validate), or migrate existing docs (migrate). For incremental doc updates after code changes, use /prizmkit-retrospective instead — it is the sole writer of .prizm-docs/ during development. Trigger on: 'initialize docs', 'check doc status', 'rebuild docs', 'validate docs', 'migrate docs', 'docs are stale', 'prizm docs'. (project)"
---

# Prizm Docs - AI Documentation Framework

Full specification: ${SKILL_DIR}/assets/PRIZM-SPEC.md

## Intent Routing

This skill handles 6 operations. When invoked, determine the user's intent and execute the matching operation:

| User Intent | Operation | Trigger Phrases |
|---|---|---|
| Bootstrap new project docs | **Init** | "initialize docs", "set up prizm docs", "bootstrap documentation" |
| Sync docs after code changes | **Update** | "update docs", "sync documentation", "docs are stale" |
| Check doc freshness | **Status** | "check docs", "are docs up to date", "doc status" |
| Regenerate module docs | **Rebuild** | "rebuild docs for X", "regenerate module docs" |
| Check format compliance | **Validate** | "validate docs", "check doc format", "docs valid?" |
| Convert existing docs | **Migrate** | "migrate docs", "convert docs to prizm format" |

---

## Role Clarification

**This skill vs `/prizmkit-retrospective`**:

| Aspect | `/prizmkit-prizm-docs` | `/prizmkit-retrospective` |
|--------|----------------------|--------------------------|
| **Role** | Documentation SPECIFICATION + BOOTSTRAP | Incremental WRITER during development |
| **When** | Project setup, health checks, migrations | After feature completion, before commit |
| **Writes** | Initial .prizm-docs/ structure (init, rebuild, migrate) | Incremental updates to existing .prizm-docs/ |
| **Reads** | Source code structure (for init/rebuild) | git diff + code changes (for sync) |
| **Knowledge** | Defines format rules, size limits, loading protocol | Extracts TRAPS/RULES/DECISIONS from work done |

**Key principle**: `/prizmkit-prizm-docs` defines WHAT the docs should look like and bootstraps them. `/prizmkit-retrospective` is the SOLE WRITER that keeps docs in sync with code during ongoing development.

## Operation: Init

Bootstrap .prizm-docs/ for the current project.

PRECONDITION: No .prizm-docs/ directory exists, or user confirms overwrite.

STEPS:
1. Detect project type by scanning for build system files (go.mod, package.json, requirements.txt, Cargo.toml, pom.xml, *.csproj). Identify primary language, framework, build command, test command, and entry points.
2. Discover modules in TWO tiers — flat structures lose nesting relationships, and when two modules share an identically-named sub-module (e.g., `utils/`), flattening creates ambiguous paths:
   - TOP-LEVEL modules: directories directly under project root (or under src/ for src-based layouts) that contain 3+ source files OR contain sub-directories with 3+ source files. These go into MODULE_INDEX.
   - SUB-MODULES: directories INSIDE a top-level module that contain 3+ source files. Listed in the parent L1 doc's SUBDIRS section only.
   - HIERARCHY RULE: directory X inside top-level module M maps to .prizm-docs/<M>/<X>.prizm, never to .prizm-docs/<X>.prizm.
   - Exclude vendor/, node_modules/, .git/, build/, dist/, __pycache__/, target/, bin/. If top-level module count > 30, ask user for include/exclude patterns.
3. Create .prizm-docs/ directory structure mirroring the source tree exactly. For each top-level module M that has sub-modules, create the subdirectory .prizm-docs/<M>/.
4. Generate root.prizm (L0) with PROJECT, LANG, FRAMEWORK, BUILD, TEST, ENTRY, MODULE_INDEX listing only top-level modules with arrow pointers to .prizm-docs/<M>.prizm (sub-modules stay out of MODULE_INDEX to keep L0 compact and within the 4KB limit), RULES extracted from CODEBUDDY.md/CLAUDE.md/README/linter configs, and PATTERNS. Set PRIZM_VERSION: 2, UPDATED: today's date. Max 4KB.
5. Generate L1 .prizm files for ALL modules (top-level and sub-modules), each at its correct mirrored path:
   - Top-level module M → write .prizm-docs/<M>.prizm (include SUBDIRS section with pointers to sub-module docs)
   - Sub-module S inside M → write .prizm-docs/<M>/<S>.prizm
   Each L1 includes MODULE (full relative path), FILES count, RESPONSIBILITY, SUBDIRS with pointers (for top-level only), KEY_FILES (5-10 most important), INTERFACES (public/exported only), DEPENDENCIES (imports, imported-by, external), RULES, DATA_FLOW. Max 3KB each.
6. Skip L2 docs during init — L2 is created lazily on first file modification or when AI needs deep understanding (ON_DEEP_READ trigger). This saves significant upfront token cost on large projects.
7. Create changelog.prizm with initial entry: `- YYYY-MM-DD | root | add: initialized prizm documentation framework`
8. Configure UserPromptSubmit hook in platform settings per ${SKILL_DIR}/assets/PRIZM-SPEC.md Section 11.
9. Append Prizm protocol section to project memory file (CODEBUDDY.md or CLAUDE.md) per ${SKILL_DIR}/assets/PRIZM-SPEC.md Section 12.
10. Validate all generated docs: size limits (L0 <= 4KB, L1 <= 3KB), pointer resolution (every -> reference resolves), no circular dependencies, UPDATED timestamps set, KEY: value format compliance, no anti-patterns (prose, code blocks, markdown headers).
11. Report summary: modules discovered, L1 docs generated, files excluded, warnings.

OUTPUT: List of generated files, module count, and validation results.

## Operation: Update

Update .prizm-docs/ to reflect recent code changes.

PRECONDITION: .prizm-docs/ exists with root.prizm.

STEPS:
1. Get changed files via `git diff --cached --name-status`. If nothing staged, use `git diff --name-status`. If no git changes at all, do full rescan comparing code against existing docs.
2. Map changed files to modules by matching against MODULE_INDEX in root.prizm. Group changes by module.
3. Classify each change: A (added) -> new KEY_FILES/INTERFACES entries. D (deleted) -> remove entries, update counts. M (modified) -> check interface/dependency changes. R (renamed) -> update all path references.
4. Update affected docs: L2 first (KEY_FILES, INTERFACES, DEPENDENCIES, CHANGELOG, UPDATED), then L1 (FILES count, KEY_FILES, INTERFACES, DEPENDENCIES, UPDATED), then L0 (MODULE_INDEX counts, UPDATED) only if structural change.
5. Skip updates if: only internal implementation changed (no interface/dependency change), only comments/whitespace/formatting, only test files changed, only .prizm files changed, bug fixes to existing features (bugs are incomplete features being refined — no new module/interface created, no doc update needed).
6. If new directory with 3+ source files appears and matches no module: create L1 immediately, add to MODULE_INDEX, defer L2.
7. Append entries to changelog.prizm using format: `- YYYY-MM-DD | <module-path> | <verb>: <description>`
8. Enforce size limits: L0 > 4KB -> consolidate. L1 > 3KB -> move details to L2. L2 > 5KB -> split or archive.
9. Stage updated .prizm files via `git add .prizm-docs/`

OUTPUT: List of updated/created/skipped docs with reasons.

## Operation: Status

Check freshness of all .prizm docs.

PRECONDITION: .prizm-docs/ exists with root.prizm.

STEPS:
1. Read root.prizm UPDATED timestamp.
2. Count commits since that timestamp via `git log --since="<timestamp>" --oneline | wc -l`.
3. For each L1/L2 doc, compare UPDATED timestamp against latest git modification of source files in that module via `git log -1 --format="%ai" -- <module-path>/`.
4. Classify each doc as: FRESH (updated after latest source change), STALE (source changed since last update), MISSING (module exists but no .prizm doc).
5. Flag any docs exceeding size limits.

OUTPUT: Freshness report table with columns: DOC_PATH | LEVEL | STATUS | LAST_UPDATED | SOURCE_LAST_MODIFIED.

## Operation: Rebuild

Regenerate docs for a specific module from scratch. Requires a module path argument.

PRECONDITION: .prizm-docs/ exists. Module path is valid.

STEPS:
1. Delete existing L1 and all L2 docs for the specified module.
2. Re-scan the module directory for files, interfaces, dependencies, subdirectories.
3. Generate fresh L1 doc with full module analysis.
4. Generate L2 docs for all sub-modules immediately (unlike init, rebuild generates L2 right away to capture current state).
5. Update MODULE_INDEX in root.prizm with new file counts and pointers.
6. Append rebuild entry to changelog.prizm: `- YYYY-MM-DD | <module-path> | refactor: rebuilt module documentation from scratch`
7. Validate regenerated docs against size limits and format rules.

OUTPUT: Regenerated doc summary with before/after comparison.

## Operation: Validate

Check format compliance and consistency of all .prizm docs.

PRECONDITION: .prizm-docs/ exists.

STEPS:
1. FORMAT CHECK: Verify all .prizm files use KEY: value format. Flag any prose paragraphs, code blocks (```), markdown headers (##), emoji, ASCII art, or horizontal rules.
2. SIZE CHECK: Verify size limits: L0 <= 4KB, L1 <= 3KB, L2 <= 5KB. Report files exceeding limits with current size.
3. POINTER CHECK: Verify all arrow (->) references resolve to existing .prizm files. Report broken pointers.
4. TIMESTAMP CHECK: Verify all docs have UPDATED field. Flag docs with UPDATED older than 30 days as potentially stale.
5. COMPLETENESS CHECK: Verify root.prizm has all required fields (PRIZM_VERSION, PROJECT, LANG, MODULE_INDEX). Verify L1 docs have MODULE, FILES, RESPONSIBILITY, INTERFACES, DEPENDENCIES. Verify L2 docs have MODULE, FILES, KEY_FILES, DEPENDENCIES.
6. ANTI-PATTERN CHECK: Flag duplicate information across levels, implementation details in L0/L1, TODO items, session-specific context.
7. RULES HIERARCHY CHECK: Verify L1/L2 RULES do not contradict root.prizm RULES. L1/L2 may only supplement with module-specific exceptions.

OUTPUT: Validation report with PASS/FAIL per check, list of issues with file paths and suggested fixes.

## Operation: Migrate

Convert existing documentation to .prizm-docs/ format.

PRECONDITION: Existing docs/ or docs/AI_CONTEXT/ directory with documentation files. No .prizm-docs/ directory (or user confirms overwrite).

STEPS:
1. DISCOVER existing docs: Scan docs/, docs/AI_CONTEXT/, README.md, ARCHITECTURE.md, and any structured documentation files.
2. EXTRACT information from existing docs: project metadata, module descriptions, architecture patterns, rules, decisions, dependencies.
3. MAP existing doc content to Prizm levels: project-wide info -> L0 root.prizm, module-level info -> L1 docs, detailed module info -> L2 docs.
4. CONVERT prose content to KEY: value format. Strip markdown formatting, tables, diagrams. Condense explanatory text into single-line values.
5. GENERATE .prizm-docs/ structure following standard init procedure but seeded with extracted information instead of scanning source code alone.
6. VALIDATE migrated docs against Prizm format rules and size limits.
7. REPORT migration summary: files processed, content mapped, information that could not be automatically converted (requires manual review).

OUTPUT: Migration report with list of source docs processed, generated .prizm files, and any manual review items.

## Error Handling

- **root.prizm is corrupted or invalid format**: Back up the existing file, then run Rebuild on all modules to regenerate from source code.
- **Broken pointers (-> references to non-existent files)**: Create the missing .prizm file if the source module exists; remove the pointer if the source module was deleted.
- **Size limit exceeded**: For L0, consolidate MODULE_INDEX entries. For L1, move implementation details to L2. For L2, archive CHANGELOG entries older than 90 days.
- **No git history available**: Fall back to filesystem timestamps for freshness checks; warn user that accuracy may be reduced.

## Progressive Loading Protocol

When working in a project with .prizm-docs/:

- ON SESSION START: Always read .prizm-docs/root.prizm (L0). This is the project map.
- ON TASK: Read L1 docs for relevant modules referenced in MODULE_INDEX.
- ON FILE EDIT: Read L2 doc before modifying files. Check TRAPS and DECISIONS sections.
- ON DEEP READ: If you need deep understanding of a module without modifying it, generate L2 if it doesn't exist.
- NEVER load all .prizm docs at once. Progressive loading saves tokens.
- BUDGET: Typical task should consume 3000-5000 tokens of Prizm docs total.

## Auto-Update Protocol

- BEFORE EVERY COMMIT: Run `/prizmkit-retrospective` which is the **sole maintainer** of .prizm-docs/. It handles both structural sync and knowledge injection.
- The UserPromptSubmit hook will remind you automatically when commit intent is detected.
- `/prizmkit-committer` does NOT update .prizm-docs/ — it only commits what is already staged.
- NEVER rewrite entire .prizm files. Only update affected sections.

## RULES Hierarchy

- root.prizm RULES are authoritative and apply project-wide.
- L1/L2 RULES only supplement root.prizm with module-specific exceptions.
- If L1/L2 RULES contradict root.prizm RULES, root.prizm takes precedence.

## Examples

**Init output (Node.js project):**
```
Generated .prizm-docs/:
  root.prizm (L0) — 3 modules in MODULE_INDEX
  routes.prizm (L1) — 12 files, 4 interfaces
  models.prizm (L1) — 8 files, 3 interfaces
  services.prizm (L1) — 15 files, 6 interfaces
  changelog.prizm — initial entry
```

**Update after adding new API endpoint:**
```
Changed: src/routes/avatar.ts (A), src/models/user.ts (M)
Updated: .prizm-docs/routes.prizm — added avatar.ts to KEY_FILES, new POST /api/avatar interface
Updated: .prizm-docs/models.prizm — updated User interface with avatar_url field
Skipped: .prizm-docs/services.prizm — no changes in services module
Appended: changelog.prizm — "2026-03-18 | routes | add: avatar upload endpoint"
```
