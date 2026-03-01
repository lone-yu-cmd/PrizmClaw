# App Planner Evaluation Guide

This guide is for maintainers who evaluate and iterate on the `app-planner` skill quality.

## Evaluation & Quality Gates (Optional but Recommended)

After multiple planning cycles or before committing refined skill logic, run standardized evaluation.

### One-Command Evaluation

Requires npm setup:

```bash
npm run skill:review -- \
  --workspace /.codebuddy/skill-evals/app-planner-workspace \
  --iteration iteration-N \
  --skill-name app-planner \
  --skill-path /core/skills/app-planner \
  --runs 3 \
  --grader-cmd "python3 /core/skills/app-planner/scripts/validate-and-generate.py grade --workspace {workspace} --iteration {iteration}"
```

Produces:
- `benchmark.json` — quantitative metrics (pass rate, feature quality, time)
- `benchmark.md` — human-readable summary
- `review.html` — interactive evaluation viewer

### Metrics Tracked

| Metric | Computation | Target | Interpretation |
|--------|-------------|--------|-----------------|
| `plan_validity` | % runs with validation pass | >95% | Higher = more robust planning |
| `avg_features_per_run` | avg feature count | ±20% consistency | Should be stable across runs |
| `avg_acceptance_criteria` | AC count per feature | 4-6 | Target sweet spot for test coverage |
| `dependency_complexity` | max DAG depth, cycle count | depth < 5 | Manageable dependency graph |
| `description_quality` | word count, keyword coverage | min 20 words | Sufficient AC detail |
| `latency_sec` | wall-clock execution time | <120s per run | UX acceptable |

### When to Run Evaluation

- After major SKILL.md revisions
- Before releasing new skill updates
- Quarterly quality assurance
- Post-optimization to measure improvement
