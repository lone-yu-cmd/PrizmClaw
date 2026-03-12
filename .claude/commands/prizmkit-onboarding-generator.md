---
description: [Tier 2] Generate onboarding documentation from Prizm docs context. Quality depends on existing .prizm-docs/ completeness. (project)
---

# PrizmKit Onboarding Generator

Generate a comprehensive developer onboarding guide from project context, covering everything a new team member needs to be productive.

## Commands

### `/prizmkit-onboarding`

Generate a complete onboarding guide for new developers.

**STEPS:**

1. Read `.prizm-docs/root.prizm` for complete project overview (tech stack, architecture, conventions)
2. Read `.prizm-docs/` L1 module docs for detailed module information
3. Read existing `README.md`, `CONTRIBUTING.md` if present (avoid duplicating existing docs; reference them instead)
4. Generate `ONBOARDING.md` covering:
   - **Environment Setup**:
     - Prerequisites (language runtimes, tools, accounts)
     - Step-by-step install commands (copy-paste ready)
     - Configuration files to create or modify
     - Verification commands to confirm setup works
   - **Architecture Overview**:
     - High-level system description (from root.prizm ARCHITECTURE and LAYERS)
     - Key services/modules and their responsibilities
     - Data flow between components
     - External dependencies and integrations
   - **Key Directories**:
     - What each top-level directory contains
     - Where to find specific types of code (models, controllers, tests, configs)
   - **Build and Test Commands**:
     - How to build the project
     - How to run the full test suite
     - How to run specific tests
     - How to run linters and formatters
   - **Development Workflow**:
     - Branch naming convention
     - Development cycle: branch, develop, test, commit, PR
     - Code review expectations
     - CI/CD pipeline overview
   - **Key Concepts and Domain Terminology**:
     - Domain-specific terms and their meanings
     - Acronyms used in the codebase
   - **Common Tasks** (step-by-step guides):
     - Adding a new API endpoint
     - Adding a new database migration
     - Creating a new test
     - Deploying to staging
   - **Debugging Tips and Common Pitfalls**:
     - Known gotchas from TRAPS sections
     - Common setup issues and solutions
     - Useful debugging commands
   - **Where to Find Help**:
     - Documentation locations
     - Team contacts or channels
     - Issue tracker and how to file bugs
5. Write to `ONBOARDING.md` in project root

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-onboarding-generator` placeholder for cross-IDE compatibility.

## Output

- `ONBOARDING.md` in project root: complete onboarding guide for new developers
