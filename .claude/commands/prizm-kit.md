---
description: "Full-lifecycle dev toolkit. Covers spec-driven development, Prizm context docs, code quality, debugging, deployment, and knowledge management. Use this skill whenever the user asks about PrizmKit workflow, wants to know which command to use, or needs help choosing between full workflow and fast path. Trigger on: '/prizmkit', 'prizmkit help', 'which prizmkit command', 'how do I start a feature'. (project)"
---

# PrizmKit — Full-Lifecycle Development Toolkit

PrizmKit is a comprehensive, independent AI development toolkit that covers the complete development lifecycle from project inception to delivery and maintenance. It can take over any project and keep documentation in sync with code.

## Quick Start Command
```
/prizmkit-init          # Take over a project (scan, assess, generate docs)
/prizmkit-specify       # Create feature specification
/prizmkit-plan          # Generate implementation plan and task breakdown
/prizmkit-analyze       # Cross-document consistency check (recommended)
/prizmkit-implement     # Execute implementation
/prizmkit-committer     # Commit with auto doc update
```

## When to Use the Full Workflow

**Use full workflow (specify -> plan -> implement):**
- New features or user-facing capabilities
- Multi-file coordinated changes
- Architectural decisions
- Data model or API changes

The full workflow generates spec, plan, and task artifacts that create a traceable record of what was built and why — this matters for future maintainability and AI context loading.

**Use fast path (plan → implement → commit):**
- Bug fixes with clear root cause
- Single-file config or typo fixes
- Simple refactors (rename, extract)
- Documentation-only changes
- Test additions for existing code

The fast path skips specify and analyze but still generates a simplified plan.md (with Tasks section) so that implement has a task list to follow.

For fast-path changes, you can directly generate a simplified plan.md, then use implement and commit commands.

## Workflow Example

**Full workflow** for adding a user avatar upload feature:
```
/prizmkit-specify    → writes .prizmkit/specs/001-avatar-upload/spec.md
/prizmkit-plan       → writes plan.md with tasks (architecture, data model, API, UI)
/prizmkit-analyze    → checks spec↔plan consistency, finds gaps
/prizmkit-implement  → executes tasks in order, marks [x] as done
/prizmkit-code-review → reviews against spec, outputs PASS/NEEDS FIXES
/prizmkit-retrospective → syncs .prizm-docs/ with code changes
/prizmkit-committer  → commits feat(avatar): add upload
```

**Fast path** for fixing a null pointer bug:
```
/prizmkit-plan       → "fix null check in UserService.getAvatar()" (simplified plan.md)
/prizmkit-implement  → executes tasks from plan.md
/prizmkit-committer  → commits fix(user): handle null avatar gracefully
```

### Fast Path Commands
 `/prizmkit-plan` → `/prizmkit-implement` → `/prizmkit-committer`

### Bug Fix Documentation Policy

**Bug fixes MUST NOT create new documentation entries.** Bug fixes are refinements of incomplete existing features — they complete what was already planned, not introduce new functionality. Specifically:

- Run `/prizmkit-retrospective` with structural sync only (Job 1) for bug fix commits — skip knowledge injection unless genuinely new TRAP discovered
- Do NOT create new spec/plan/tasks under `.prizmkit/specs/` for bug fixes
- Do NOT update `.prizm-docs/` module docs for pure bug fixes (no interface/dependency change)
- Bug fix commits use `fix(<scope>):` prefix in Conventional Commits, not `feat:`

All documentation records are for: features, projects, code logic, and module indexes. Bug fixes do not alter the system's functional scope — they bring existing features to their intended state.

## Architecture

PrizmKit produces two complementary knowledge layers:

```
.prizm-docs/           → Architecture Index (structure, interfaces, dependencies, traps, rules, decisions)
.prizmkit/specs/       → Feature "what to do" (workflow: spec → plan → code(implement))
```

**Reading guide**:
- Need code structure/modules/interfaces/traps/decisions? → `.prizm-docs/`

## Skill Inventory

### Foundation (3)
- **prizm-kit** — Full-lifecycle dev toolkit entry point
- **prizmkit-init** — Project takeover: scan → assess → generate docs → initialize
- **prizmkit-prizm-docs** — Prizm documentation framework with 6 operations: init, update, status, rebuild, validate, migrate

### Spec-Driven Workflow (8)
- **prizmkit-specify** — Create structured feature specifications from natural language
- **prizmkit-clarify** — Interactive requirement clarification
- **prizmkit-plan** — Generate technical plan with data model, API contracts, and executable task breakdown (all in one plan.md)
- **prizmkit-analyze** — Cross-document consistency analysis (spec ↔ plan ↔ tasks)
- **prizmkit-implement** — Execute tasks following TDD approach
- **prizmkit-code-review** — Review code against spec and plan
- **prizmkit-retrospective** — Sole .prizm-docs/ maintainer: structural sync + TRAPS/RULES/DECISIONS injection
- **prizmkit-committer** — Pure git commit: diff analysis, safety checks, Conventional Commits

### Quality Assurance (5)
- **prizmkit-tool-tech-debt-tracker** — [Tier 1] Technical debt identification and tracking via code pattern analysis
- **prizmkit-tool-bug-reproducer** — [Tier 1] Generate minimal reproduction scripts and test cases
- **prizmkit-tool-adr-manager** — [Tier 1] Architecture Decision Records management
- **prizmkit-tool-security-audit** — [Tier 2] AI-assisted security review checklist via static analysis
- **prizmkit-tool-dependency-health** — [Tier 2] Dependency review based on manifest files

### Operations & Deployment (4)
- **prizmkit-tool-ci-cd-generator** — [Tier 2] Generate CI/CD pipeline config templates
- **prizmkit-tool-deployment-strategy** — [Tier 2] Deployment planning with rollback procedures
- **prizmkit-tool-db-migration** — [Tier 2] Database migration script generation
- **prizmkit-tool-monitoring-setup** — [Tier 2] Generate monitoring config templates

### Debugging & Troubleshooting (3)
- **prizmkit-tool-error-triage** — [Tier 2] Error categorization and root cause analysis
- **prizmkit-tool-log-analyzer** — [Tier 2] Log pattern recognition via text analysis
- **prizmkit-tool-perf-profiler** — [Tier 2] Static analysis for performance issues

### Documentation (2)
- **prizmkit-tool-onboarding-generator** — [Tier 2] Generate developer onboarding guides
- **prizmkit-tool-api-doc-generator** — [Tier 2] Extract API documentation from source code

### Pipeline & Companion (7)
- **feature-workflow** — One-stop feature development: plan → launch pipeline → monitor
- **refactor-workflow** — End-to-end refactor: analyze → plan → implement → review → commit
- **app-planner** — Interactive app planning that produces feature-list.json for dev-pipeline
- **bug-planner** — Interactive bug planning that produces bug-fix-list.json for bugfix-pipeline
- **bug-fix-workflow** — Interactive single-bug fix in current session (triage → reproduce → fix → review → commit)
- **dev-pipeline-launcher** — Launch and manage the feature dev-pipeline (background daemon)
- **bugfix-pipeline-launcher** — Launch and manage the bugfix pipeline (background daemon)

### Scenario Decision Tree

Not sure which skill to use? Follow this:

| I want to... | Use this |
|---|---|
| Build a new app or batch of features from scratch | `feature-workflow` (one-stop) |
| Plan features first, then decide when to build | `app-planner` → `dev-pipeline-launcher` |
| Launch pipeline for an existing feature-list.json | `dev-pipeline-launcher` |
| Fix multiple bugs in batch | `bug-planner` → `bugfix-pipeline-launcher` |
| Fix one specific bug right now, interactively | `bug-fix-workflow` |
| Refactor/restructure code without changing behavior | `refactor-workflow` |
| Add a single small feature (spec → plan → implement) | `/prizmkit-specify` → `/prizmkit-plan` → `/prizmkit-implement` |
| Quick bug fix or config change | Fast path: `/prizmkit-plan` → `/prizmkit-implement` → `/prizmkit-committer` |

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
python3 .claude/command-assets/prizm-kit/scripts/install-`/prizmkit-py` --target <project-skills-dir>
```

## Hook / Rules Configuration

Both CodeBuddy and Claude Code use unified commands for automatic doc updates and commit enforcement.
Hooks and rules are configured automatically by `prizmkit-init`. See:
- `core/templates/hooks/commit-intent.json` for the commit hook template
- `assets/project-memory-template.md` for the project memory template
- The init skill creates `prizm-documentation.md` and `prizm-commit-workflow.md` rules
