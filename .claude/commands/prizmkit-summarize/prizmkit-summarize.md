---
description: Archive completed features to REGISTRY.md. Extracts metadata from specs, scans code, updates feature index. Invoke after code review passes or feature is done. (project)
---

# PrizmKit Summarize

Archive completed features to the feature registry. Extracts metadata from specs and code, generates a registry entry, and appends a changelog record. Idempotent — re-running produces the same output.

## Commands

### `/prizmkit-summarize`

Archive a completed feature to the registry.

**PRECONDITION:** `spec.md`, `plan.md`, `tasks.md` exist in `.prizmkit/specs/###-feature-name/`

**STEPS:**

1. Read `spec.md`, `plan.md`, `tasks.md`
2. Analyze `tasks.md` completion rate — warn if < 100%
3. Scan actual code directories for core file paths
4. Generate REGISTRY entry:
   - Feature number and name
   - Branch name
   - Status (complete/partial)
   - Key files and directories
   - API endpoints added/modified
   - Data model changes
   - Completion date
5. Append to `.prizmkit/specs/REGISTRY.md` (create from template `.claude/commands/prizmkit-summarize/assets/registry-template.md` if not exists)
6. Append changelog entry
7. Output: registry entry summary

**KEY RULES:**
- Idempotent: same input MUST produce same output on re-run
- If `tasks.md` completion < 100%, status is "Partial" with warning
- REGISTRY.md is append-only — never modify existing entries
- Changelog entries use format: `YYYY-MM-DD | [###] [Feature Name] | [Status]`
- If REGISTRY.md does not exist, create it from template before appending
- **Bug fixes MUST NOT create new REGISTRY.md entries.** Bugs are refinements of incomplete existing features, not new functionality. Bug fix commits should only update the original feature's changelog, not generate a new registry entry. Do NOT run the `/this` command for bug fix commits.

**HANDOFF:** ``/prizmkit-specify`` (start next feature) or ``/prizmkit-retrospective`` (extract lessons)

## Template

The registry template is located at `.claude/commands/prizmkit-summarize/assets/registry-template.md`.

## Output

- `.prizmkit/specs/REGISTRY.md` — Updated with new feature entry and changelog record
