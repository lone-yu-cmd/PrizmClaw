---
description: [Tier 1] Manage Architecture Decision Records. Create, list, and supersede ADRs with full context. AI excels at documentation tasks. (project)
---

# PrizmKit ADR Manager

Manage Architecture Decision Records (ADRs) to document and track architectural decisions with full context, alternatives, and consequences.

## Commands

### `/prizmkit-adr`.new \<title\>

Create a new Architecture Decision Record.

**STEPS:**

1. Determine next ADR number from `docs/adr/` directory (scan existing files, increment highest number)
2. Generate ADR from template (`.claude/commands/prizmkit-adr-manager/assets/adr-template.md`):
   - **Title**: Provided by user
   - **Date**: Current date
   - **Status**: Proposed
   - **Context**: Ask user what issue is motivating this decision
   - **Decision**: Ask user what change is being proposed
   - **Consequences**: Identify positive and negative consequences
   - **Alternatives considered**: Ask user about alternatives and why they were rejected
3. Write to `docs/adr/NNNN-title.md` (zero-padded number, kebab-case title)
4. Also record in `.prizm-docs/` DECISIONS section of relevant module doc

### `/prizmkit-adr`.list

Show all ADRs with their current status.

**STEPS:**

1. Scan `docs/adr/` directory for ADR files
2. Parse each file for number, title, and status
3. Display table:
   - Number | Title | Status | Date
   - Status values: Proposed, Accepted, Deprecated, Superseded
4. Highlight any ADRs in Proposed status that may need review

### `/prizmkit-adr`.supersede \<number\> \<new-title\>

Mark an existing ADR as superseded and create a replacement.

**STEPS:**

1. Read the existing ADR with the given number from `docs/adr/`
2. Update its status to "Superseded by [ADR-NNNN]" (the new ADR number)
3. Create a new ADR using the ``/prizmkit-adr`.new` flow:
   - Pre-populate context with reference to the superseded ADR
   - Include "Supersedes [ADR-NNNN]" in the new ADR
4. Write both updated files

## Template

The ADR template is located at `.claude/commands/prizmkit-adr-manager/assets/adr-template.md` and follows the standard ADR format with Context, Decision, Consequences, and Alternatives sections.

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-adr-manager` placeholder for cross-IDE compatibility.

## Output

- ADR files in `docs/adr/` directory
- Updated DECISIONS section in relevant `.prizm-docs/` module doc
