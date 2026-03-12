---
description: "Project takeover and bootstrap. Scans any project, generates Prizm docs, configures hooks. Use '/prizmkit-init' to start. (project)"
---

# PrizmKit Init

Project takeover and bootstrap skill. Scans any project (brownfield or greenfield), generates Prizm documentation, and configures platform-specific hooks for documentation sync. Supports CodeBuddy, Claude Code, and dual-platform installations.

### When to Use
- Taking over a new project (brownfield or greenfield)
- User says "initialize PrizmKit", "set up PrizmKit", "take over this project"
- First time using PrizmKit on a project

### Commands

#### `/prizmkit-init`
Full project initialization.

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
2. Map directory structure — identify source directories, test directories, config files
3. Identify entry points by language convention
4. Catalog dependencies (external packages)
5. Count source files per directory

**Step 2: State Assessment**
2a. Run dependency analysis:
  - Count outdated dependencies (if lockfile exists)
  - Note any known vulnerability patterns

2b. Scan for technical debt indicators:
  - Count TODO/FIXME/HACK/XXX comments
  - Identify large files (>500 lines)
  - Check for test directories and coverage config

2c. Generate `ASSESSMENT.md` in project root with findings

**Step 3: Prizm Documentation Generation**
3a. Invoke prizmkit-prizm-docs ``/prizmkit-doc`.init` algorithm:
  - Create `.prizm-docs/` directory structure
  - Generate `root.prizm` (L0) with project meta and module index
  - Generate L1 docs for all discovered modules
  - Create `changelog.prizm`
  - Skip L2 (lazy generation)

3b. If project has existing `docs/AI_CONTEXT/`: suggest running ``/prizmkit-doc`.migrate`

**Step 4: PrizmKit Workspace Initialization**
4a. Create `.prizmkit/` directory:
  - `.prizmkit/config.json` (adoption_mode, speckit_hooks_enabled, platform)
  - `.prizmkit/specs/` (empty)

**Step 5: Hook & Settings Configuration (Platform-Specific)**

**If platform is CodeBuddy (or both):**
5a-cb. Read or create `.codebuddy/settings.json`
5b-cb. Add UserPromptSubmit hook from `.claude/commands/prizmkit-init/../../../assets/hooks/prizm-commit-hook.json`
5c-cb. Preserve any existing hooks

**If platform is Claude Code (or both):**
5a-cl. Read or create `.claude/settings.json`
5b-cl. Add `permissions` and `allowedTools` entries if needed
5c-cl. Create `.claude/rules/prizm-documentation.md` with glob-scoped rules:
  ```yaml
  ---
  description: PrizmKit documentation rules
  globs:
    - "**/*.ts"
    - "**/*.js"
    - "**/*.py"
    - "**/*.go"
  ---
  When modifying source files:
  1. Read `.prizm-docs/root.prizm` to understand project structure
  2. After changes, update affected `.prizm-docs/` files
  3. Follow Prizm doc format (KEY: value, not prose)
  ```
5d-cl. Create `.claude/rules/prizm-commit-workflow.md` with commit-scoped rules:
  ```yaml
  ---
  description: PrizmKit commit workflow enforcement
  globs:
    - "**/*"
  ---
  Before any git commit:
  1. Run git diff --cached --name-status
  2. Map changed files to modules via root.prizm MODULE_INDEX
  3. Update affected .prizm-docs/ files
  4. Stage .prizm-docs/ changes
  5. Use /prizmkit-committer for the complete workflow
  ```
5e-cl. Preserve any existing Claude settings and rules

**Step 6: Project Memory Update (Platform-Specific)**

**If platform is CodeBuddy (or both):**
6a-cb. Read existing `CODEBUDDY.md` (or create if missing)
6b-cb. Append PrizmKit section from `.claude/commands/prizmkit-init/../../../assets/codebuddy-md-template.md`
6c-cb. Do not duplicate if already present

**If platform is Claude Code (or both):**
6a-cl. Read existing `CLAUDE.md` (or create if missing)
6b-cl. Append PrizmKit section from `.claude/commands/prizmkit-init/../../../assets/claude-md-template.md`
6c-cl. Adjust command references to use `/command-name` format (not ``/prizmkit-xxx``)
6d-cl. Do not duplicate if already present

**Step 7: Report**
Output summary: platform detected, tech stack detected, modules discovered, L1 docs generated, assessment highlights, platform-specific configuration applied, next recommended steps.

Include platform-specific guidance:
- CodeBuddy: "Use ``/prizmkit-specify`` to start your first feature"
- Claude Code: "Use `/prizmkit-specify` to start your first feature"

GREENFIELD WORKFLOW (new project):
- Skip Steps 1-2 (no code to scan)
- Step 3: Create minimal `.prizm-docs/` with just `root.prizm` skeleton
- Steps 4-6: Same as brownfield
- Step 7: Recommend starting with specify for first feature (platform-appropriate command format)

### Gradual Adoption Path
After init, PrizmKit operates in phases:
- **Passive** (default): Generates docs, doesn't enforce workflow
- **Advisory**: Suggests improvements, flags issues (enable in config)
- **Active**: Enforces spec-driven workflow for new features (enable in config)

User can change mode in `.prizmkit/config.json`: `"adoption_mode": "passive" | "advisory" | "active"`

### Platform Reference

| Concept | CodeBuddy | Claude Code |
|---------|-----------|-------------|
| Command invocation | ``/prizmkit-xxx`` | `/prizmkit-xxx` |
| Project memory | `CODEBUDDY.md` | `CLAUDE.md` |
| Settings | `.codebuddy/settings.json` | `.claude/settings.json` |
| Skills/Commands | `.codebuddy/skills/` | `.claude/commands/` |
| Agents | `.codebuddy/agents/` | `.claude/agents/` |
| Rules | hooks in settings.json | `.claude/rules/*.md` |
| CLI command | `cbc` | `claude` |

IMPORTANT: Use `.claude/commands/prizmkit-init` placeholder for all path references. Never hardcode absolute paths.
