---
description: "Full-lifecycle dev toolkit. Covers spec-driven development, Prizm context docs, code quality, debugging, deployment, and knowledge management. Use 'prizmkit.*' for help. (project)"
---

# PrizmKit — Full-Lifecycle Development Toolkit

PrizmKit is a comprehensive, independent AI development toolkit that covers the complete development lifecycle from project inception to delivery and maintenance. It can take over any project and keep documentation in sync with code.

## Quick Start

**CodeBuddy:**
```
`/prizmkit-init`          # Take over a project (scan, assess, generate docs)
`/prizmkit-specify`       # Create feature specification
`/prizmkit-plan`          # Generate implementation plan
`/prizmkit-tasks`         # Break down into executable tasks
`/prizmkit-analyze`       # Cross-document consistency check (recommended)
`/prizmkit-implement`     # Execute implementation
`/prizmkit-commit`        # Commit with auto doc update
```

**Claude Code:**
```
/prizmkit-init          # Take over a project (scan, assess, generate docs)
/prizmkit-specify       # Create feature specification
/prizmkit-plan          # Generate implementation plan
/prizmkit-tasks         # Break down into executable tasks
/prizmkit-analyze       # Cross-document consistency check (recommended)
/prizmkit-implement     # Execute implementation
/prizmkit-committer     # Commit with auto doc update
```

## When to Use the Full Workflow

**Use full workflow (specify -> plan -> tasks -> implement):**
- New features or user-facing capabilities
- Multi-file coordinated changes
- Architectural decisions
- Data model or API changes

**Use fast path (implement -> commit directly):**
- Bug fixes with clear root cause
- Single-file config or typo fixes
- Simple refactors (rename, extract)
- Documentation-only changes
- Test additions for existing code

For fast-path changes, you can directly use the implement command with inline task description, then the commit command.
- CodeBuddy: ``/prizmkit-implement`` → ``/prizmkit-commit``
- Claude Code: `/prizmkit-implement` → `/prizmkit-committer`

### Bug Fix Documentation Policy

**Bug fixes MUST NOT create new documentation entries.** Bug fixes are refinements of incomplete existing features — they complete what was already planned, not introduce new functionality. Specifically:

- Do NOT run ``/prizmkit-summarize`` for bug fix commits (no new REGISTRY.md entries)
- Do NOT create new spec/plan/tasks under `.prizmkit/specs/` for bug fixes
- Do NOT update `.prizm-docs/` module docs for pure bug fixes (no interface/dependency change)
- Bug fix commits use `fix(<scope>):` prefix in Conventional Commits, not `feat:`

All documentation records are for: features, projects, code logic, and module indexes. Bug fixes do not alter the system's functional scope — they bring existing features to their intended state.

## Architecture

PrizmKit produces two complementary knowledge layers:

```
.prizm-docs/           → Project "what is" (static: structure, interfaces, rules, traps, decisions)
.prizmkit/specs/       → Feature "what to do" (workflow: spec → plan → tasks → code)
```

## Skill Inventory (34 skills)

### Foundation (3)
- **prizm-kit** — Full-lifecycle dev toolkit entry point
- **prizmkit-init** — Project takeover: scan → assess → generate docs → initialize
- **prizmkit-prizm-docs** — Prizm documentation framework: ``/prizmkit-doc`.init`, ``/prizmkit-doc`.update`, ``/prizmkit-doc`.status`, ``/prizmkit-doc`.rebuild`, ``/prizmkit-doc`.validate`, ``/prizmkit-doc`.migrate`

### Spec-Driven Workflow (10)
- **prizmkit-specify** — Create structured feature specifications from natural language
- **prizmkit-clarify** — Interactive requirement clarification
- **prizmkit-plan** — Generate technical plan (with data model & API contracts as inline sections)
- **prizmkit-tasks** — Break plan into executable task list
- **prizmkit-analyze** — Cross-document consistency analysis (spec ↔ plan ↔ tasks)
- **prizmkit-implement** — Execute tasks following TDD approach
- **prizmkit-code-review** — Review code against spec and plan
- **prizmkit-summarize** — Archive completed features to REGISTRY.md
- **prizmkit-committer** — Commit workflow with automatic Prizm doc update
- **prizmkit-retrospective** — Post-feature learning: extract lessons → update Prizm docs

### Quality Assurance (5)
- **prizmkit-tech-debt-tracker** — [Tier 1] Technical debt identification and tracking via code pattern analysis
- **prizmkit-bug-reproducer** — [Tier 1] Generate minimal reproduction scripts and test cases
- **prizmkit-adr-manager** — [Tier 1] Architecture Decision Records management
- **prizmkit-security-audit** — [Tier 2] AI-assisted security review checklist via static analysis
- **prizmkit-dependency-health** — [Tier 2] Dependency review based on manifest files

### Operations & Deployment (4)
- **prizmkit-ci-cd-generator** — [Tier 2] Generate CI/CD pipeline config templates
- **prizmkit-deployment-strategy** — [Tier 2] Deployment planning with rollback procedures
- **prizmkit-db-migration** — [Tier 2] Database migration script generation
- **prizmkit-monitoring-setup** — [Tier 2] Generate monitoring config templates

### Debugging & Troubleshooting (3)
- **prizmkit-error-triage** — [Tier 2] Error categorization and root cause analysis
- **prizmkit-log-analyzer** — [Tier 2] Log pattern recognition via text analysis
- **prizmkit-perf-profiler** — [Tier 2] Static analysis for performance issues

### Documentation (2)
- **prizmkit-onboarding-generator** — [Tier 2] Generate developer onboarding guides
- **prizmkit-api-doc-generator** — [Tier 2] Extract API documentation from source code

### Pipeline & Companion (7)
- **prizmkit-bug-fix-workflow** — [Tier 1] End-to-end bug fix workflow: triage → reproduce → fix → verify → commit
- **feature-workflow** — [Tier 1] End-to-end feature workflow: specify → plan → tasks → analyze → implement → review → commit
- **refactor-workflow** — [Tier 1] End-to-end refactor workflow: analyze → plan → tasks → implement → review → commit
- **app-planner** — Interactive app planning that produces feature-list.json for dev-pipeline
- **bug-planner** — Interactive bug planning that produces bug-fix-list.json for bugfix-pipeline
- **dev-pipeline-launcher** — Launch and manage the dev-pipeline from within a CLI session
- **bugfix-pipeline-launcher** — Launch and manage the bugfix pipeline from within a CLI session

### Tier Definitions

- **Tier 1**: AI can perform well independently — these tasks align with AI's core strengths (documentation, code pattern analysis, test generation)
- **Tier 2**: Useful as guidance/checklist — AI provides static analysis and recommendations, but lacks access to real external tools (scanners, profilers, package registries, runtime environments)
- **Core skills** (no tier label): The 12 foundational, documentation, spec-driven workflow, and commit skills that form PrizmKit's primary value

## Installation

**Option 1: npm CLI (recommended — works for both platforms)**
```bash
npx prizmkit init
```
Interactive installer auto-detects your platform and guides you through configuration.

**Option 2: Claude Code Plugin**
Install the `prizmkit` plugin via Claude Code's plugin system, then run `/prizmkit-init`.

**Option 3: Manual Install (CodeBuddy)**
```bash
python3 .claude/commands/prizm-kit/scripts/install-`/prizmkit-py` --target <project-skills-dir>
```

## Hook / Rules Configuration

**CodeBuddy:** Uses native `type: prompt` hooks for automatic doc updates before commits.
The hook is configured automatically by `prizmkit-init`. See `assets/hooks/prizm-commit-hook.json`.

**Claude Code:** Uses `.claude/rules/` glob-scoped markdown files for automatic enforcement.
Rules are created automatically by `prizmkit-init` (or `/prizmkit-init`). See:
- `assets/claude-md-template.md` for the project memory template
- The init skill creates `prizm-documentation.md` and `prizm-commit-workflow.md` rules
