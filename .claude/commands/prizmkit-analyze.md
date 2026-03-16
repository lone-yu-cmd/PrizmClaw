---
description: Cross-document consistency analysis for spec.md, plan.md, and tasks.md. Detects duplications, ambiguities, gaps, and rule conflicts. Read-only. (project)
---

# PrizmKit Analyze

Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md before implementation. Identifies duplications, ambiguities, underspecified items, rule conflicts, and coverage gaps.

### When to Use
- After ``/prizmkit-plan`` to validate spec-plan-tasks alignment before implementation
- User says "analyze", "check consistency", "validate spec", "review plan"
- Before ``/prizmkit-implement`` as a quality gate

## Commands

### `/prizmkit-analyze`

Cross-document consistency analysis.

**PRECONDITION:** `spec.md` and `plan.md` exist in `.prizmkit/specs/###-feature-name/`. `plan.md` must include a Tasks section.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report to conversation only. Offer an optional remediation plan (user must explicitly approve before any edits).

**Prizm Rules Authority**: The project rules in `.prizm-docs/root.prizm` RULES section are **non-negotiable** within this analysis scope. Rule conflicts are automatically CRITICAL severity and require adjustment of the spec, plan, or tasks — not dilution or silent ignoring of the rule. If a rule itself needs to change, that must occur via a separate ``/prizmkit-doc`.update`.

## Execution Steps

### Step 1: Initialize Analysis Context

Locate the current feature directory in `.prizmkit/specs/###-feature-name/` by checking the current Git branch name or scanning `.prizmkit/specs/` for the most recent feature directory.

Derive absolute paths:
- SPEC = `.prizmkit/specs/###-feature-name/spec.md`
- PLAN = `.prizmkit/specs/###-feature-name/plan.md`
- TASKS = `.prizmkit/specs/###-feature-name/tasks.md` (optional)

Abort with an error message if spec.md or plan.md is missing — instruct the user to run the missing prerequisite command (``/prizmkit-specify`` or ``/prizmkit-plan``).

### Step 2: Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md:**
- Overview/Context
- Functional Requirements
- Non-Functional Requirements
- User Stories and Acceptance Criteria
- Scope Boundaries
- Edge Cases (if present)

**From plan.md:**
- Architecture/stack choices
- Component Design
- Data Model references
- API Contracts
- Testing Strategy
- Risk Assessment
- Tasks section (task IDs, phase grouping, parallel markers, file paths)

**From .prizm-docs/root.prizm:**
- RULES section (MUST/NEVER/PREFER directives)
- PATTERNS section (project-wide code patterns)
- TECH_STACK section (for consistency checking)

### Step 3: Build Semantic Models

Create internal representations (do not include raw artifacts in output):

- **Requirements inventory**: Each functional + non-functional requirement with a stable key (derive slug from imperative phrase; e.g., "User can upload file" -> `user-can-upload-file`)
- **User story/action inventory**: Discrete user actions with acceptance criteria
- **Task coverage mapping**: Map each task (from plan.md Tasks section) to one or more requirements or stories (inference by keyword / explicit reference patterns like IDs or key phrases)
- **Prizm rule set**: Extract MUST/NEVER/PREFER normative statements from root.prizm RULES

### Step 4: Detection Passes

Focus on high-signal findings. Limit to **50 findings total**; aggregate remainder in overflow summary.

#### A. Duplication Detection
- Identify near-duplicate requirements across spec.md sections
- Mark lower-quality phrasing for consolidation

#### B. Ambiguity Detection
- Flag vague adjectives (fast, scalable, secure, intuitive, robust) lacking measurable criteria
- Flag unresolved placeholders (TODO, TBD, ???, `<placeholder>`, `[NEEDS CLARIFICATION]`)

#### C. Underspecification
- Requirements with verbs but missing object or measurable outcome
- User stories missing acceptance criteria alignment
- Tasks referencing files or components not defined in spec/plan
- Plan components with no corresponding spec requirement

#### D. Prizm Rules Alignment
- Any requirement or plan element conflicting with a MUST/NEVER directive
- Missing mandated patterns from PATTERNS section
- Tech stack inconsistencies between plan and root.prizm TECH_STACK

#### E. Coverage Gaps
- Requirements with zero associated tasks (from plan.md Tasks section)
- Tasks with no mapped requirement/story ("orphan tasks")
- Non-functional requirements not reflected in tasks (performance, security, etc.)
- User stories without corresponding plan components

#### F. Inconsistency
- Terminology drift (same concept named differently across files)
- Data entities referenced in plan but absent in spec (or vice versa)
- Task ordering contradictions (e.g., integration tasks before foundational setup without dependency note)
- Conflicting requirements (e.g., one requires REST while other specifies GraphQL)

### Step 5: Severity Assignment

Use this heuristic to prioritize findings:

- **CRITICAL**: Violates Prizm RULES MUST/NEVER directive, missing core artifact section, or requirement with zero coverage that blocks baseline functionality
- **HIGH**: Duplicate or conflicting requirement, ambiguous security/performance attribute, untestable acceptance criterion
- **MEDIUM**: Terminology drift, missing non-functional task coverage, underspecified edge case
- **LOW**: Style/wording improvements, minor redundancy not affecting execution order

### Step 6: Produce Compact Analysis Report

Output a Markdown report (**no file writes**) with the following structure:

```
## Consistency Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Duplication | HIGH | spec.md §2.1, §3.4 | Two similar requirements... | Merge phrasing; keep clearer version |
| D1 | Rules Alignment | CRITICAL | plan.md §Architecture | Conflicts with MUST rule... | Adjust plan to align with rule |

**Coverage Summary:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Prizm Rules Alignment Issues:** (if any)

**Unmapped Tasks:** (if any)

**Metrics:**
- Total Requirements: N
- Total Tasks: N
- Coverage %: N% (requirements with >=1 task)
- Ambiguity Count: N
- Duplication Count: N
- Critical Issues: N
```

### Step 7: Provide Next Actions

At end of report, output a concise Next Actions block:

- If CRITICAL issues exist: **Recommend resolving before ``/prizmkit-implement``**
- If only LOW/MEDIUM: User may proceed, but provide improvement suggestions
- Provide explicit command suggestions:
  - "Run ``/prizmkit-specify`` to refine requirements"
  - "Run ``/prizmkit-plan`` to adjust architecture or tasks"
  - "Edit tasks.md to add coverage for requirement X"
  - "Proceed to ``/prizmkit-implement``" (if clean)

### Step 8: Offer Remediation

Ask the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)

## Operating Principles

### Context Efficiency
- **Minimal high-signal tokens**: Focus on actionable findings, not exhaustive documentation
- **Progressive disclosure**: Load artifacts incrementally; don't dump all content into analysis
- **Token-efficient output**: Limit findings table to 50 rows; summarize overflow
- **Deterministic results**: Rerunning without changes should produce consistent IDs and counts

### Analysis Guidelines
- **NEVER modify files** (this is read-only analysis)
- **NEVER hallucinate missing sections** (if absent, report them accurately)
- **Prioritize Prizm Rules violations** (these are always CRITICAL)
- **Use examples over exhaustive rules** (cite specific instances, not generic patterns)
- **Report zero issues gracefully** (emit success report with coverage statistics)

**HANDOFF:** ``/prizmkit-implement`` (if clean) or ``/prizmkit-specify`` / ``/prizmkit-plan`` (if issues found)

## Output

Analysis report is output to conversation only. No files are created or modified.
