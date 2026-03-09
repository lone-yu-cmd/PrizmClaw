## PrizmKit Documentation Framework

This project uses PrizmKit with the Prizm documentation system for AI-optimized progressive context loading.

### Progressive Loading Protocol
- ON SESSION START: Always read `.prizm-docs/root.prizm` first (L0 — project map)
- ON TASK: Read L1 (`.prizm-docs/<module>.prizm`) for relevant modules referenced in MODULE_INDEX
- ON FILE EDIT: Read L2 (`.prizm-docs/<module>/<submodule>.prizm`) before modifying files. Pay attention to TRAPS and DECISIONS.
- NEVER load all .prizm docs at once. Load only what is needed for the current task.

### Auto-Update Protocol
- BEFORE EVERY COMMIT: Update affected `.prizm-docs/` files
- The `.claude/rules/` files will enforce this automatically
- Use `/prizmkit-committer` command for the complete commit workflow

### Doc Format Rules
- All `.prizm` files use KEY: value format, not prose
- Size limits: L0 = 4KB, L1 = 3KB, L2 = 5KB
- Arrow notation (->) indicates load pointers to other .prizm docs
- DECISIONS and CHANGELOG are append-only (never delete entries)

### Creating New L2 Docs
- When you first modify files in a sub-module that has no L2 doc:
  1. Read the source files in that sub-module
  2. Generate a new L2 `.prizm` file following Prizm specification
  3. Add a pointer in the parent L1 doc's SUBDIRS section

### Available Commands
Run `/prizm-kit` to see all available PrizmKit commands.

### Fast Path for Simple Changes
Not every change needs the full spec -> plan -> tasks workflow. Use fast path for:
- Bug fixes with clear root cause, config tweaks, typo fixes, simple refactors
- Documentation-only changes, test additions for existing code
- Directly use `/prizmkit-implement` with inline task description, then `/prizmkit-committer`

Use the full workflow (/prizmkit-specify -> /prizmkit-plan -> /prizmkit-tasks -> /prizmkit-analyze -> /prizmkit-implement) for:
- New features, multi-file coordinated changes, architectural decisions, data model or API changes
