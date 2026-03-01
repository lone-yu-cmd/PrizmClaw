---
description: "Cross-document consistency analysis for spec.md and plan.md (including Tasks section). Detects duplications, ambiguities, gaps, and rule conflicts. Read-only. Use this skill to check if spec and plan are aligned, validate documents before coding, or as a quality gate after planning. Trigger on: 'analyze', 'check consistency', 'validate spec', 'review plan', 'is the spec ready', 'check if spec and plan are aligned', 'validate documents before coding'. (project)"
---

# PrizmKit Analyze

Perform a non-destructive cross-artifact consistency and quality analysis across spec.md and plan.md (including Tasks section) before implementation. Identifies duplications, ambiguities, underspecified items, rule conflicts, and coverage gaps.

### When to Use
- After `/prizmkit-plan` to validate spec-plan-tasks alignment before implementation
- User says "analyze", "check consistency", "validate spec", "review plan"
- Before `/prizmkit-implement` as a quality gate

**PRECONDITION:** `spec.md` and `plan.md` exist in `.prizmkit/specs/###-feature-name/`. `plan.md` must include a Tasks section.

## Operating Constraints

**Read-only analysis**: Do not modify any files. The analysis output goes to conversation only, with an optional remediation plan the user must explicitly approve. This separation matters because the user needs to understand what's wrong before deciding what to change — auto-fixing consistency issues often introduces new ones.

**Prizm Rules take precedence**: The project rules in `.prizm-docs/root.prizm` RULES section are the source of truth. If a spec or plan element conflicts with a MUST/NEVER directive, the spec/plan needs to change, not the rule. This prevents well-intentioned features from silently violating project-wide constraints. If a rule itself is wrong, that's a separate conversation via prizmkit-prizm-docs (Update operation).

## Execution Steps

### Step 1: Initialize Analysis Context

Locate the current feature directory in `.prizmkit/specs/###-feature-name/` by checking the current Git branch name or scanning `.prizmkit/specs/` for the most recent feature directory.

Derive absolute paths:
- SPEC = `.prizmkit/specs/###-feature-name/spec.md`
- PLAN = `.prizmkit/specs/###-feature-name/plan.md` (must include a Tasks section)

Abort with an error message if spec.md or plan.md is missing — instruct the user to run the missing prerequisite command (`/prizmkit-specify` or `/prizmkit-plan`).

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

- If CRITICAL issues exist: **Recommend resolving before `/prizmkit-implement`**
- If only LOW/MEDIUM: User may proceed, but provide improvement suggestions
- Provide explicit command suggestions:
  - "Run `/prizmkit-specify` to refine requirements"
  - "Run `/prizmkit-plan` to adjust architecture or tasks"
  - "Edit plan.md Tasks section to add coverage for requirement X"
  - "Proceed to `/prizmkit-implement`" (if clean)

### Step 8: Offer Remediation

Ask the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)

## Operating Principles

### Context Efficiency
- Focus on actionable findings, not exhaustive documentation — the goal is to surface problems, not prove you read everything
- Load artifacts incrementally; reading all content upfront wastes tokens on sections irrelevant to the feature
- Cap findings at 50 rows to keep the report scannable; summarize overflow with counts
- Rerunning without changes should produce consistent IDs and counts (deterministic)

### Analysis Approach
- Do not modify files — read-only analysis ensures artifacts remain stable for the implement phase
- If a section is absent, report it accurately rather than guessing what it might contain
- Prizm Rules violations are always CRITICAL — they represent project-wide constraints that outrank individual feature decisions
- Cite specific instances rather than generic patterns — "spec §2.1 says REST but plan §Architecture says GraphQL" is more useful than "terminology inconsistency found"
- If zero issues found, report success with coverage statistics — a clean report is valuable confirmation

## Example Finding

```
| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| D1 | Rules Alignment | CRITICAL | plan.md §Architecture | Plan specifies SQLite but root.prizm RULES has "MUST: use PostgreSQL for all persistent storage" | Change plan to use PostgreSQL or request rule amendment via prizmkit-prizm-docs |
| E1 | Coverage Gap | HIGH | spec.md §FR-3 | "User can export reports as PDF" has no corresponding task in plan.md Tasks section | Add export task to Phase 3 of plan.md |
```

**HANDOFF:** `/prizmkit-implement` (if clean) or `/prizmkit-specify` / `/prizmkit-plan` (if issues found)

## Loop Protection

In unattended pipeline mode, the analyze→fix→analyze cycle can loop indefinitely if issues keep reappearing. To prevent this:

- Track an `analyze_iteration` counter starting at 1. Each re-run of this skill after remediation increments the counter.
- **max_iterations = 5**: If `analyze_iteration >= 5`, you MUST proceed to `/prizmkit-implement` regardless of remaining findings. Log a warning: "Loop protection triggered — proceeding to implement with N unresolved findings (iterations: 5/5)."
- Unresolved findings from the final iteration should be noted in the handoff so that `/prizmkit-code-review` can catch them downstream.
- This guard exists because some findings oscillate (fixing one re-introduces another) and blocking forever is worse than proceeding with known issues.

## Output

Analysis report is output to conversation only. No files are created or modified.
