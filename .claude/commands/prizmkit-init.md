---
description: "Project takeover and bootstrap. Scans any project, generates Prizm docs, configures hooks. Use this skill whenever a user opens a new project for the first time, says 'initialize', 'set up PrizmKit', 'take over this project', 'bootstrap', 'scan this codebase', 'init', or when .prizm-docs/ doesn't exist yet. Also use when PrizmKit was just installed via npx but not yet initialized. (project)"
---

# PrizmKit Init

Project takeover and bootstrap skill. Scans any project (brownfield or greenfield), generates Prizm documentation, and configures platform-specific hooks for documentation sync. Supports CodeBuddy, Claude Code, and dual-platform installations.

### When to Use
- Taking over a new project (brownfield or greenfield)
- User says "initialize PrizmKit", "set up PrizmKit", "take over this project"
- First time using PrizmKit on a project
- After `npx prizmkit install` when project has no `.prizm-docs/`

### When NOT to Use
- `.prizm-docs/` already exists and is up to date → use `/prizmkit-prizm-docs` (Update) instead
- User just wants to update stale docs → use `/prizmkit-prizm-docs` (Update or Rebuild)
- User wants to start a feature → skip init if already initialized, go to `/prizmkit-specify`

### Error Handling
- If `.prizm-docs/` already exists: ask user if they want to reinitialize (overwrites) or update (preserves)
- If no source files found in any directory: fall back to greenfield mode
- If platform cannot be detected: ask user explicitly which platform(s) to configure
- If `.claude/command-assets/prizmkit-init/../../../assets/project-memory-template.md` is missing: generate inline PrizmKit section instead of failing

## Execution Steps

**PLATFORM DETECTION (before anything else):**
1. Check for platform indicators in the current environment:
   - CodeBuddy: `.codebuddy/` directory exists, or running inside `cbc` session
   - Claude Code: `.claude/` directory exists, or running inside `claude` session
   - Both: Both directories exist
   - Unknown: Neither exists — ask the user which platform(s) to configure
2. Store detected platform in `.prizmkit/config.json` as `"platform": "codebuddy" | "claude" | "both"`

MODE DETECTION:
- If `.prizm-docs/` exists: Ask user if they want to reinitialize or update
- If project has source code: brownfield mode
- If project is nearly empty: greenfield mode

BROWNFIELD WORKFLOW (existing project):

**Step 1: Project Scanning**
1. Detect tech stack from build files (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `Cargo.toml`, etc.)
2. Map directory structure using a TWO-TIER model — flat structures lose the nesting relationships that AI needs to navigate the codebase:
   - TOP-LEVEL modules: directories directly under project root that contain source files or sub-directories with source files (e.g. `dev-pipeline/`, `src/`, `internal/`)
   - SUB-MODULES: directories INSIDE a top-level module (e.g. `dev-pipeline/scripts/`, `dev-pipeline/lib/`)
   - A sub-module maps to `.prizm-docs/<M>/<S>.prizm`, never to `.prizm-docs/<S>.prizm` — flattening would create ambiguous paths when two modules have identically-named sub-modules
   - Exclude: `.git/`, `node_modules/`, `vendor/`, `build/`, `dist/`, `__pycache__/`, `.claude/`, `.codebuddy/`, `.prizmkit/`, `.prizm-docs/`
3. Identify entry points by language convention
4. Catalog dependencies (external packages)
5. Count source files per directory

**Step 2: Prizm Documentation Generation**
Invoke prizmkit-prizm-docs (Init operation), passing the two-tier module structure from Step 1:
  - Create `.prizm-docs/` directory structure mirroring the source tree (sub-module dirs become subdirectories under `.prizm-docs/<top-level>/`)
  - Generate `root.prizm` (L0) with project meta and MODULE_INDEX listing only top-level modules
  - Generate L1 docs for top-level modules at `.prizm-docs/<M>.prizm` and for sub-modules at `.prizm-docs/<M>/<S>.prizm`
  - Create `changelog.prizm`
  - Skip L2 (lazy generation) — L2 is generated on first file modification, saving tokens upfront

**Step 3: PrizmKit Workspace Initialization**
3a. Create `.prizmkit/` directory:
  - `.prizmkit/config.json` (adoption_mode, speckit_hooks_enabled, platform)
  - `.prizmkit/specs/` (empty)

**Step 4: Hook & Settings Configuration**

4a. Read or create platform settings file (`.codebuddy/settings.json` or `.claude/settings.json`)
4b. Add UserPromptSubmit and PostToolUse hooks for automatic prizm-docs reminders
4c. For Claude Code: also add `permissions` entries and `.claude/rules/` for documentation enforcement:
  - `.claude/rules/prizm-documentation.md` (glob-scoped source file rules)
  - `.claude/rules/prizm-commit-workflow.md` (commit workflow enforcement)
4d. Preserve any existing hooks and settings — never overwrite user's custom configuration

**Step 5: Project Memory Update**

5a. Read existing project memory file (`CODEBUDDY.md` or `CLAUDE.md`) or create if missing
5b. Append PrizmKit section from `.claude/command-assets/prizmkit-init/../../../assets/project-memory-template.md`
5c. Do not duplicate if PrizmKit section already present

**Step 6: Report**
Output summary: platform detected, tech stack detected, modules discovered, L1 docs generated, platform-specific configuration applied, next recommended steps.

Include platform-specific guidance:
- CodeBuddy: "Use `/prizmkit-specify` to start your first feature"
- Claude Code: "Use `/prizmkit-specify` to start your first feature"

GREENFIELD WORKFLOW (new project):
- Skip Step 1 (no code to scan)
- Step 2: Create minimal `.prizm-docs/` with just `root.prizm` skeleton
- Steps 3-5: Same as brownfield
- Step 6: Recommend starting with specify for first feature (platform-appropriate command format)

### Gradual Adoption Path
After init, PrizmKit operates in phases:
- **Passive** (default): Generates docs, doesn't enforce workflow
- **Advisory**: Suggests improvements, flags issues (enable in config)
- **Active**: Enforces spec-driven workflow for new features (enable in config)

User can change mode in `.prizmkit/config.json`: `"adoption_mode": "passive" | "advisory" | "active"`

### Platform Reference

| Concept | CodeBuddy | Claude Code |
|---------|-----------|-------------|
| Command invocation | `/prizmkit-xxx` | `/prizmkit-xxx` |
| Project memory | `CODEBUDDY.md` | `CLAUDE.md` |
| Settings | `.codebuddy/settings.json` | `.claude/settings.json` |
| Skills/Commands | `.codebuddy/skills/` | `.claude/commands/` |
| Agents | `.codebuddy/agents/` | `.claude/agents/` |
| Rules | hooks in settings.json | `.claude/rules/*.md` |
| CLI command | `cbc` | `claude` |

## Example

**Brownfield init on a Node.js project:**
```
$ /prizmkit-init

Platform detected: Claude Code
Tech stack: TypeScript, Node.js, Express
Mode: Brownfield (154 source files found)

Modules discovered:
  src/routes/     → .prizm-docs/routes.prizm (12 files)
  src/models/     → .prizm-docs/models.prizm (8 files)
  src/services/   → .prizm-docs/services.prizm (15 files)
  src/middleware/  → .prizm-docs/middleware.prizm (5 files)

Generated: root.prizm + 4 L1 docs + changelog.prizm
Configured: .claude/rules/ (2 files), hooks in settings.json
Updated: CLAUDE.md with PrizmKit section

Next: Use /prizmkit-specify to start your first feature
```

IMPORTANT: Use `.claude/command-assets/prizmkit-init` placeholder for all path references. Never hardcode absolute paths.
