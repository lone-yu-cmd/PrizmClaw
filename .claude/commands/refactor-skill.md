---
description: "Intelligent refactor review for existing skills: evaluates quality, proposes in-place upgrade, and enforces eval + graphical review after changes. (project) by using the newest skill-creator standard"
---

# Refactor Skill

Specialized workflow for reviewing and upgrading existing skills with measurable quality gates.

## When to Use

Use this skill when user says:
- "重构这个 skill", "优化技能设计", "评审并升级技能"
- "review this skill and improve it"
- "keep the same skill but improve quality"
- "原地升级这个 skill" / "in-place upgrade this skill"

Do NOT use when user only wants to run a pipeline immediately without changing skill design.

## Core Goals

1. Review current skill comprehensively and find concrete improvement points.
2. **Default and preferred mode: in-place upgrade** of the existing skill.
3. New-version fork (e.g., `-v2`) is **exception-only** and must be explicitly requested by user.
4. After any modification, **must** run standardized evaluation and graphical review.

## Context Readiness Gate (Mandatory)

Before any refactor action, verify whether conversation context already contains:
- target skill name/path
- current project/workspace path
- refactor objective and constraints (quality, speed, compatibility)
- whether user explicitly requests a new-version fork (default is in-place upgrade)

If any item is missing, do not block; gather context proactively:
1. Read `/core/skills/_metadata.json` to locate target skill and related neighbors.
2. Read target `SKILL.md` plus key assets/scripts under that skill.
3. Check recent evaluation artifacts under `/.codebuddy/skill-evals/` if present.
4. Ask only the minimum unresolved question(s).

## Review Dimensions (Mandatory Rubric)

Assess and score each dimension (1-5):

1. **功能性 (Functionality)**
   - Trigger clarity and routing correctness
   - Workflow completeness and error recovery
   - Output contract correctness (schema/format compatibility)

2. **效率性 (Efficiency)**
   - Unnecessary steps, token/time overhead
   - Reusability of scripts/assets
   - Fast-path design and fallback strategy

3. **可维护性 (Maintainability)**
   - Instruction structure/readability
   - Coupling to environment and path robustness
   - Testability and observability (artifacts, checkpoints)

Output a concise review summary with:
- strengths
- prioritized issues (P0/P1/P2)
- expected impact for each fix

## Optimization Strategy Selection

After review, apply **in-place upgrade** by default.

### Default Mode — In-Place Upgrade (Required Unless Explicitly Overridden)
Use in almost all cases:
- skill naming and contract remain stable
- change scope is moderate or large but compatible
- backward compatibility is required

Actions:
1. edit existing skill files in place
2. preserve skill name/frontmatter compatibility
3. keep migration notes minimal

### Exception Mode — New Version via `skill-creator` (Explicit User Request Only)
Only use when user clearly asks to fork a new version (e.g., `create <skill>-v2`).

Additional required checks before using exception mode:
- user confirms they need side-by-side old/new variants
- user accepts added maintenance cost for two versions

Actions:
1. copy current skill as baseline snapshot
2. create `<skill-name>-v2` and apply redesign
3. run evaluation against old version baseline

## Mandatory Post-Change Validation, Review, and Optimization Loop

Run this full loop after **every** refactor (default: in-place; exception: new-version fork). Do not skip.

### Step 0: Freeze Refactor Scope (Input Gate)
Capture and freeze:
- target skill path
- iteration id (`iteration-N`)
- baseline type (`old-snapshot` preferred, fallback `without_skill`)
- optimization goal for this round (quality, token, latency, or compatibility)

Expected output:
- one-line run plan: `skill + baseline + iteration + goal`

### Step 1: Structural Validation (Pre-Eval)
Validate skill structure/frontmatter and required files first.

Expected output:
- validation pass/fail result
- blocking fix list if failed

### Step 2: Execute Standardized Eval Runs (Mandatory)
Create iteration workspace:
- `/.codebuddy/skill-evals/<skill-name>-workspace/iteration-N/`

Run both configurations for the same eval set in the same iteration:
- `with_skill` (updated skill)
- `baseline` (old snapshot or `without_skill`)

Use multi-run strategy:
- default: 3 runs (fast feedback)
- release gate: 5 runs (stability check)

Required artifacts per run:
- `outputs/`
- `timing.json`
- `grading.json`
- `eval_metadata.json` (per eval directory)

Expected output:
- complete run tree with paired `with_skill` vs `baseline` runs
- no missing required artifact files

### Step 3: Score, Aggregate, and Build Benchmark
Run grading and aggregation using standardized scripts. Keep metrics comparable across iterations.

Required outputs:
- `benchmark.json`
- `benchmark.md`

Required metrics:
- pass rate
- duration
- token usage
- with_skill vs baseline delta
- variance (`stddev`) for stability judgment

Expected output:
- benchmark summary with clear win/lose/neutral conclusion per metric

### Step 4: Graphical Review (Mandatory via `generate_review`)
Generate review UI using official `generate_review.py` (no custom viewer).

Preferred modes:
1. server mode for interactive inspection
2. static HTML mode (`--static`) for headless fallback

Expected output:
- review entry recorded (URL or HTML path)
- quick notes on representative good/bad runs linked to evidence

### Step 5: Analyze Results and Derive Optimization Actions
Translate benchmark + viewer evidence into prioritized actions:
- **P0**: contract/validation breakages
- **P1**: quality instability or high variance
- **P2**: token/time inefficiencies

For each action define:
- root cause hypothesis
- exact file/section to modify
- expected metric impact
- rollback condition

Expected output:
- actionable optimization list (not generic advice)

### Step 6: Implement Targeted Improvements
Apply only the selected actions for this iteration.
Avoid mixing unrelated changes to keep causal attribution clear.

Expected output:
- focused diff scoped to the chosen actions

### Step 7: Re-Run Evaluation and Compare Iterations
Re-run Step 2–4 on the updated skill and compare against previous iteration.

Decision rule:
- if goals met and no regression: accept iteration
- if partial improvement: keep gains, open next iteration with narrowed scope
- if regression: rollback or revise hypothesis and repeat

Expected output:
- iteration verdict (`accepted` / `needs-next-iteration` / `rollback`)
- before/after comparison table

### Step 8: Close the Loop (Mandatory Delivery)
Return:
1. what changed
2. measured impact (pass/time/tokens/variance deltas)
3. viewer entry
4. remaining risks
5. next iteration plan (if needed)

This closes the loop from **test review → evidence analysis → skill optimization → re-validation**.

### Standard Command Blueprint (Project-level)
Use the one-command review pipeline with optional grader hook:

```bash
npm run skill:review -- \
  --workspace /abs/.codebuddy/skill-evals/<skill-name>-workspace \
  --iteration iteration-N \
  --skill-name <skill-name> \
  --skill-path /abs/core/skills/<skill-name> \
  --runs 3 \
  --grader-cmd "python3 /abs/scripts/skill-evals/grade-eval-runs.py --workspace {workspace} --iteration {iteration} --validator /abs/core/skills/<skill-name>/scripts/validate-and-generate.py --baseline-input /abs/.codebuddy/skill-evals/<skill-name>-workspace/inputs/feature-list-existing.json"
```

Minimum expected deliverables per iteration:
- `<workspace>/<iteration>/benchmark.json`
- `<workspace>/<iteration>/benchmark.md`
- `<workspace>/<iteration>/review.html`
- optimization action list with priority and owner

## Execution Notes for `skill-creator` Integration

When available, follow latest `skill-creator` evaluation/viewer workflow as source of truth:
- parallelized run spawning (with_skill + baseline)
- assertion-based grading format compatibility
- benchmark aggregation via official script
- viewer generation via official script

## Output Contract of This Skill

After completion, return:
1. selected mode (`in-place` by default, or `new-version` if explicitly requested) and why
2. files changed/created
3. review rubric scores before vs after
4. benchmark summary (pass/time/tokens delta)
5. graphical review entry (URL or static HTML path)
6. remaining risks and next iteration suggestions

## Error Handling

- Missing target skill path: auto-discover under `/core/skills/` then confirm.
- Missing baseline snapshot: create one before modifications.
- Eval incomplete: mark status as blocked and list missing artifacts.
- Viewer runtime incompatibility: switch to `--static` mode and continue.

## Skill Registry Modification Guide

When adding or removing skills from the framework, follow this reference checklist.

### Adding a New Skill

**Step 1: Create skill definition**
```
core/skills/<skill-name>/SKILL.md    # Required: skill definition with frontmatter
core/skills/<skill-name>/assets/     # Optional: templates, configs, etc.
core/skills/<skill-name>/scripts/    # Optional: executable scripts
```

**Step 2: Register in metadata**

Edit `core/skills/_metadata.json`:
```json
{
  "skills": {
    "<skill-name>": {
      "description": "Brief description of the skill",
      "tier": "1",              // "foundation", "1", "2", or "companion"
      "category": "core",       // "core", "quality", "devops", "debugging", "documentation", "pipeline"
      "hasAssets": false,       // true if assets/ directory exists
      "hasScripts": false       // true if scripts/ directory exists
    }
  }
}
```

**Step 3: (Optional) Add to suite**

If the skill belongs to `core` or `minimal` suite, add to `suites` section in `_metadata.json`:
```json
{
  "suites": {
    "core": {
      "skills": ["<skill-name>", ...]
    }
  }
}
```

**Step 4: Regenerate derived artifacts**
```bash
# Update bundled directory for npm package
node scripts/bundle.js
```

**Step 5: Validate**
```bash
npm test
# or
node tests/validate-all.js
```

### Removing a Skill

**Step 1: Delete skill directory**
```bash
rm -rf core/skills/<skill-name>/
```

**Step 2: Remove from metadata**

Edit `core/skills/_metadata.json`:
- Remove entry from `skills` object
- Remove from any `suites` that reference it

**Step 3: Regenerate derived artifacts**
```bash
node scripts/bundle.js
```

**Step 4: Validate**
```bash
npm test
```

### Modification Checklist Summary

| File | Action | Required |
|------|--------|----------|
| `core/skills/<name>/SKILL.md` | Create/Delete | **Always** |
| `core/skills/_metadata.json` → `skills` | Add/Remove entry | **Always** |
| `core/skills/_metadata.json` → `suites` | Add/Remove from suite | If belongs to suite |
| `core/skills/<name>/assets/` | Create/Delete | If has resources |
| `core/skills/<name>/scripts/` | Create/Delete | If has scripts |
| `create-prizmkit/bundled/` | Regenerate via script | Auto |

### Documents That May Need Number Updates

**Recommendation: Avoid hardcoding skill counts.** Use relative descriptions instead:
- ✅ "All skills" instead of "34 skills"
- ✅ "Core Tier 1 skills" instead of "Core Tier 1 skills (17 skills)"
- ✅ "symlink (skills)" instead of "symlink (35 skills)"

If you must include counts, maintain them in one place (`_metadata.json`) and update all references together.

Files that currently contain hardcoded skill counts:

| File | Current Pattern | Suggested Fix |
|------|-----------------|---------------|
| `README.md` | "**N Skills** covering..." | Remove number or use "Skills" |
| `CODEBUDDY.md` | "**N Skills** — ..." | Remove number |
| `PK-Construct-Guide.md` | "N skills — 每个 skill..." | Remove number |
| `PK-Evolving-User-Guide.md` | "symlink (N skills)" | Use "symlink (skills)" |
| `core/skills/prizm-kit/SKILL.md` | "## Skill Inventory (N skills)" | Use "## Skill Inventory" |
| `core/skills/_metadata.json` | `"description": "All N skills"` | Use `"description": "All skills"` |

To find hardcoded numbers:
```bash
grep -rn "[0-9]\+ skills\|[0-9]\+ Skills" --include="*.md" --include="*.json" .
```

## Path Rules

- Prefer absolute paths in execution commands.
- Keep path references portable in instructions when possible (e.g., `.claude/command-assets/refactor-skill` for intra-skill files).
- Never delete `.codebuddy` directory.
