---
name: app-planner
description: Interactive planning for both new apps and incremental features on existing apps. This skill should be used whenever users discuss app planning, feature scoping/re-prioritization, continuing a feature plan, or preparing a validated feature-list.json for dev-pipeline execution.
---

# App Planner

Plan deliverable features for dev-pipeline in two modes:
- **New App Planning**: create a plan from scratch
- **Incremental Feature Planning**: append new features to an existing app/plan

Always produce a validated `feature-list.json` that conforms to `dev-pipeline-feature-list`.

## When to Use

Trigger this skill for requests like:
- "规划应用", "设计项目", "Plan an app", "Design a new application"
- "给现有系统加功能", "继续规划", "Add features", "Continue planning"
- "准备 feature-list.json", "Prepare dev-pipeline input"
- "重排优先级", "拆分功能", "reprioritize/scope features"

Do NOT use this skill when:
- user only wants to run pipeline now (invoke `dev-pipeline-launcher`)
- user is debugging/refactoring unrelated to feature planning

## Resource Loading Rules (Mandatory)

`SKILL_DIR` definition:
- `SKILL_DIR` is the absolute path of this skill directory.
1. **Choose scenario reference before planning**:
   - New app → read `references/new-app-planning.md`
   - Existing app incremental features → read `references/incremental-feature-planning.md`

2. **Use shared quality examples as needed**:
   - read `assets/planning-guide.md` for decomposition and acceptance criteria patterns

3. **Always validate output via script**:
   - run:
     ```bash
     python3 ${SKILL_DIR}/scripts/validate-and-generate.py validate --input <output-path> --mode <new|incremental>
     ```

4. **Use script output as source of truth**:
   - if validation fails, fix and re-run until pass

## Prerequisites

Before questions, check optional context files (never block if absent):
- `.prizm-docs/root.prizm` (architecture/project context)
- `.prizmkit/config.json` (existing stack preferences)
- existing `feature-list.json` (required for incremental mode)

Note:
- This skill **reads** `.prizmkit/config.json` if present.
- This skill does **not** create `.prizmkit/config.json` directly.
- Creation/update is handled by bootstrap/init flows (e.g., `prizmkit-init`, `dev-pipeline/scripts/init-dev-team.py`).

## Scenario Routing

Classify user intent first:

### Route A: New App Planning
Use when user starts from idea/blank slate or asks for initial end-to-end plan.

Actions:
1. Load `references/new-app-planning.md`
2. Run interactive planning phases
3. Generate initial `feature-list.json`

### Route B: Incremental Feature Planning
Use when user already has app/code/plan and asks to add or adjust features.

Actions:
1. Load `references/incremental-feature-planning.md`
2. Read existing `feature-list.json` first (if missing, ask whether to start new plan)
3. Append features with next sequential `F-NNN` IDs
4. Preserve style/language/detail consistency with existing plan

## Core Workflow

Execute the selected scenario workflow in conversation mode with mandatory checkpoints:

### Interactive Phases
1. clarify business goal and scope
2. confirm constraints and tech assumptions
3. propose feature set with dependencies
4. refine descriptions and acceptance criteria
5. verify DAG/order/priorities
6. build or append `feature-list.json`
7. validate and fix until pass
8. summarize final feature table

### Checkpoints (Mandatory Gates)

Checkpoints catch cascading errors early — skipping one means the next phase builds on unvalidated assumptions, which compounds into much harder debugging later.

| Checkpoint | Artifact/State | Criteria | Phase |
|-----------|----------------|----------|-------|
| **CP-AP-1** | Vision Summary | Goal/users/differentiators confirmed by user | 1-2 |
| **CP-AP-2** | Feature Proposals | Feature set with titles+deps identified (pre-validation) | 3-5 |
| **CP-AP-3** | DAG Validity | No cycles, dependencies resolved (validation dry-run) | 6 |
| **CP-AP-4** | `feature-list.json` Generated | Schema validates, all required keys present | 6 |
| **CP-AP-5** | Final Validation Pass | Python script returns `"valid": true` with zero errors | 7 |

**Resume Detection**: See §Resume Support for checkpoint-based resumption.

## Fast Path — Incremental Shortcuts

For simple incremental planning, skip detailed Phase 2-3 analysis to accelerate delivery:

### Eligibility Criteria (ALL must apply)
- **Incremental mode only** — not new app planning
- **Adding 1-2 features max** to existing plan
- **Each feature**: ≤5 acceptance criteria, <100 words description
- **Dependencies**: depends on ≤2 existing features (no chains)
- **Complexity**: "low" or "medium" only
- **No architectural changes** to existing tech stack

### Fast Path Workflow
1. Read existing `feature-list.json` and confirm scope
2. Generate next sequential feature IDs
3. Draft features (title + description + acceptance_criteria + dependencies)
4. Run validation script immediately
5. If valid → summarize and recommend next step
6. If invalid → apply fixes, re-validate (max 2 attempts, then escalate to full workflow)

### When NOT to Use Fast Path
- New app planning (always use full workflow)
- Adding >2 features in one session
- Features with complex interdependencies (>2 dependencies)
- High complexity features requiring architecture decisions
- Changes affecting >3 existing features

### Example Fast Path Session
```
User: "Add email verification to existing user module."
AI: [Detects incremental mode] 
AI: [Checks existing plan: found 8 features, user module exists]
AI: [Qualifies for fast path: 1 feature, low complexity, ≤2 deps]
AI: "Fast path available. Drafting F-009..."
AI: [Validates immediately]
AI: "Ready to proceed to dev-pipeline."
```

## Output Rules

`feature-list.json` must satisfy:
- `$schema` = `dev-pipeline-feature-list-v1`
- non-empty `features`
- sequential feature IDs (`F-001`, `F-002`, ...)
- valid dependency DAG
- new items default `status: "pending"`
- English feature titles for stable slug generation

## Next-Step Execution Policy (after planning)

Recommend these three options in this strict order:

1. **Preferred**: invoke `dev-pipeline-launcher` skill (natural-language handoff)
2. **Fallback A**: run daemon wrapper
   ```bash
   ./dev-pipeline/launch-daemon.sh start feature-list.json
   ./dev-pipeline/launch-daemon.sh status
   ```
3. **Fallback B**: run direct foreground script
   ```bash
   ./dev-pipeline/run.sh run
   ./dev-pipeline/run.sh status
   ```

When launcher is available, do not prioritize raw scripts.

## Error Recovery

Structured error handling for interrupted sessions and validation failures.

### Validation Failures

When `python3 scripts/validate-and-generate.py validate --input <file> --mode <mode>` returns errors:

#### Parse validation output
Script returns JSON with `"valid": false`, `"errors": [...]`, `"warnings": [...]`

#### Decision Tree

**if `error_count == 0` (warnings only):**
- Proceed with user approval
- Show warnings and ask: "Continue? (Y/n)"

**elif `error_count > 0` (critical errors):**

Group errors by type and apply targeted fixes:

| Error Type | Symptom | Fix Offered | Auto-Fix? |
|-----------|---------|------------|-----------|
| **Schema mismatch** | `$schema` invalid, missing `app_name`, wrong `features` type | "Set `$schema` to `dev-pipeline-feature-list-v1`, `app_name` to string" | Yes |
| **Feature ID issues** | Invalid format (not `F-NNN`), duplicate IDs, undefined refs | "Suggest corrected IDs, show duplicates" | Yes |
| **Dependency errors** | Circular dependency, undefined target features | "Show cycle chain (e.g., `F-003 → F-005 → F-003`), suggest break point" | No |
| **Missing fields** | Feature missing required keys (title, description, AC) | "List each feature + missing keys, guide patch" | Partial |
| **Insufficient AC** | Feature has <2 acceptance criteria | "Show feature, suggest AC examples" | No |
| **Invalid values** | complexity not in [low/medium/high], status not pending | "Show field, valid values" | Yes |

#### Execution

```
For auto-fixable errors:
  1. Show summary: "Found N schema/ID/format issues"
  2. Offer: auto-fix? (Y/n)
  3. Apply fix → regenerate file
  4. Re-run validation
  5. If new errors → loop (max 2 more attempts)

For manual fixes (dependencies, AC content):
  1. Show concise prompt: "Edit line X-Y in feature-list.json"
  2. Wait for user action
  3. Retry validation (max 2 more attempts)

if all_retries_exceeded:
  → Escalate: "After 3 attempts, validation still fails. 
              (a) Review file manually, OR
              (b) Restart planning from Phase 1"
```

### Interrupted Planning Resume

| Scenario | Detection | Action |
|----------|-----------|--------|
| Partial `feature-list.json` exists | File found in working dir | Read file, show summary, ask: "Resume from checkpoint or restart?" |
| Checkpoint CP-AP-4 passed | File generates valid schema | Offer: "Jump to Phase 7 (final validation)" |
| Checkpoint CP-AP-5 passed | Full validation passes | Offer: "Feature plan complete, proceed to dev-pipeline" |
| User restarts mid-session | User says "restart" | Return to Phase 1 Vision, or load previous checkpoint if requested |
| Max validation retries exceeded | 3 failed validation loops | Offer: (a) manual review, (b) restart from Phase 1 |

### Incremental Mode Abort

If in Incremental mode but existing `feature-list.json` not found:
- Ask: "Start new plan or provide existing file?"
- If new plan chosen → switch to Route A (New App Planning)
- If existing file uploaded → continue Route B

## Incremental Feature Planning — Style Matching

When appending features to an existing plan, preserve style and detail level automatically.

### Style Detection (Automatic)

Before drafting new features, analyze existing plan:

1. **Language Detection**
   - Scan `title` and `description` fields
   - If >70% English titles → default to English
   - If >70% Chinese titles → suggest Chinese (or allow bilingual)

2. **Description Density**
   - Calculate avg word count per description
   - If avg <30 words → draft concise descriptions
   - If avg 30-80 words → draft standard detail
   - If avg >80 words → draft detailed descriptions

3. **Acceptance Criteria Patterns**
   - Count avg AC per feature
   - Identify dominant format (Given/When/Then Gherkin, BDD, or loose)
   - Draft new AC in same format

4. **Complexity Distribution**
   - Count low/medium/high distribution in existing features
   - Alert if new features deviate significantly (>20 percentile points)
   - Suggest rebalancing if needed

### Style Consistency Prompt

If new features deviate significantly from detected style:

```
"Your new features use avg X words/description, but existing features use Y. 
Current ratio: low:M%, medium:N%, high:O%. 
Adjust new features to match? (Y/n)"
```

Accept user choice, then adjust draft accordingly before Phase 6 (JSON generation).

## Resume Support

App-planner sessions can be resumed from the last completed checkpoint without losing context.

### Detection Logic

Check for artifact files in working directory:

| Artifacts Found | Last Completed Checkpoint | Next Phase | Resume Action |
|-----------------|--------------------------|-----------|----------------|
| None | (new session) | Phase 1: Vision | Start fresh planning |
| `feature-list.json` exists | CP-AP-4 (file generated) | Phase 7: Final validation | Offer to validate or extend |
| `feature-list.json` + validation passed | CP-AP-5 (validation pass) | Handoff: dev-pipeline | Offer: execute pipeline now |
| Partial state (incomplete file) | CP-AP-2 or CP-AP-3 | Next phase after last checkpoint | Resume interactive planning |

### Resume Command (Project Structure)

For projects using `.prizmkit/` structure:

```bash
# Explicit resume (if file is not in current directory):
app-planner --resume-from <path-to-existing-feature-list.json>
```

AI detects existing file → suggests:
```
"Existing plan found with N features, M newly added. 
Resume incremental planning? (Y/n)"
```

### Artifact Path Convention

The primary output `feature-list.json` is always written to the **project root** — this is where `dev-pipeline-launcher` and all pipeline scripts expect it.

```
<project-root>/
  ├── feature-list.json              # Primary output (always here, at project root)
  └── .prizmkit/planning/            # Optional organization for backups
      ├── feature-list.validated.json    # Checkpoint backup after CP-AP-5
      └── <ISO-timestamp>.backup.json    # Optional incremental backups
```

The pipeline reads `feature-list.json` from the project root by default. If the user specifies a custom path, the launcher accepts it as an argument.

Maintainer note: evaluation workflow moved to `assets/evaluation-guide.md`.

## Handoff Message Template

After successful validation, report:
1. output file path
2. total features + newly added features
3. dependency and priority highlights
4. recommended next action: `dev-pipeline-launcher`
