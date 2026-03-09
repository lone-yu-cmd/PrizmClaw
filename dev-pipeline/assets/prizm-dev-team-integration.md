# prizm-dev-team Integration Guide

## Overview

dev-pipeline drives the prizm-dev-team multi-agent team through an outer shell loop. Each iteration spawns a new CodeBuddy CLI session with a bootstrap prompt that instructs the agent to create and orchestrate the team for one feature.

## Architecture

```
dev-pipeline (outer loop)
    │
    ├── run.sh                    Shell runner — picks next feature, spawns CLI
    ├── scripts/                  Python state management scripts
    ├── templates/bootstrap-prompt.md  Session prompt template
    │
    └── [per session] CodeBuddy CLI
            │
            ├── TeamCreate("prizm-dev-team-F-NNN")
            ├── Spawn Coordinator agent
            │       │
            │       ├── Phase 0: Init
            │       ├── Phase 1-4: PM (specify/plan/tasks/analyze)
            │       ├── Phase 5: Schedule & Assign
            │       ├── Phase 6: Dev x N (parallel implement)
            │       ├── Phase 7: QA + Review (parallel)
            │       ├── Phase 8: Fix Loop (max 3 rounds)
            │       └── Phase 9: Summarize & Commit
            │
            └── Write session-status.json → exit
```

## Agent Definitions (Source of Truth)

| Agent | Definition Path | Type |
|-------|----------------|------|
| Coordinator | `agent-team-master/prizm-dev-team/prizm-dev-team-coordinator/subagent.md` | prizm-dev-team-coordinator |
| PM | `agent-team-master/prizm-dev-team/prizm-dev-team-pm/subagent.md` | prizm-dev-team-pm |
| Dev | `agent-team-master/prizm-dev-team/prizm-dev-team-dev/subagent.md` | prizm-dev-team-dev |
| QA | `agent-team-master/prizm-dev-team/prizm-dev-team-qa/subagent.md` | prizm-dev-team-qa |
| Review | `agent-team-master/prizm-dev-team/prizm-dev-team-review/subagent.md` | prizm-dev-team-review |
| Doc-Reader | `agent-team-master/prizm-dev-team/prizm-dev-team-doc-reader/subagent.md` | prizm-dev-team-doc-reader |

## Validator Scripts

Located at `agent-team-master/prizm-dev-team/prizm-dev-team-coordinator/scripts/`:

| Script | Checkpoint | Purpose |
|--------|-----------|---------|
| `init-dev-team.py` | CP-0 | Initialize `.dev-team/` + `.prizmkit/` directories |
| `validate-json-schema.py` | CP-1,2,3 | Validate JSON artifacts against schemas |
| `validate-dag.py` | CP-3 | Verify dependency graph has no cycles |
| `validate-report-format.py` | CP-6,7 | Check Markdown reports have required sections |
| `check-contract-integrity.py` | CP-3,6,7 | SHA-256 hash verification for contracts |

## Artifact Mapping

### PrizmKit Artifacts (.prizmkit/)

| Phase | File | Content |
|-------|------|---------|
| 1 | `specs/spec.md` | Feature specification (WHAT/WHY) |
| 2 | `plans/plan.md` | Technical plan (architecture, API, tests) |
| 3 | `tasks/tasks.md` | Executable task list with `[ ]` / `[x]` |
| 4 | `analysis/analyze-report.md` | Consistency analysis |
| 9 | `specs/REGISTRY.md` | Completed features archive |

### Dev-Team Artifacts (.dev-team/)

| Phase | File | Content |
|-------|------|---------|
| 1 | `specs/requirements.md` | Requirements with REQ-NNN IDs |
| 2 | `contracts/*.contract.json` | Interface contracts |
| 2 | `contracts/data-models.json` | Data entity definitions |
| 3 | `tasks/task-manifest.json` | Structured tasks with T-NNN IDs |
| 3 | `tasks/dependency-graph.json` | Task DAG |
| 6 | `reports/dev/self-test-*.md` | Dev self-test reports |
| 7 | `reports/qa/integration-test.md` | QA integration test report |
| 7 | `reports/review/code-review.md` | Review report |

## Session Lifecycle

### 1. Session Start

The bootstrap prompt instructs the agent to:
- Create a team named `prizm-dev-team-{FEATURE_ID}`
- Spawn the Coordinator with the full subagent.md prompt
- Coordinator then spawns PM, Dev, QA, Review as needed

### 2. Pipeline Execution

The Coordinator drives the 10-phase pipeline with 8 checkpoints (CP-0 through CP-7). Each checkpoint validates artifacts using the validator scripts.

### 3. Session End

The agent MUST write `session-status.json` before exiting:

```json
{
  "session_id": "F-001-20260304100000",
  "feature_id": "F-001",
  "status": "success",
  "completed_phases": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  "current_phase": 9,
  "checkpoint_reached": "CP-7",
  "tasks_completed": 12,
  "tasks_total": 12,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "spec_path": ".prizmkit/specs/spec.md",
    "plan_path": ".prizmkit/plans/plan.md",
    "tasks_path": ".prizmkit/tasks/tasks.md"
  },
  "timestamp": "2026-03-04T11:30:00Z"
}
```

## Failure Recovery

| Session Outcome | Pipeline Action |
|-----------------|-----------------|
| `status: "success"` | Mark feature completed, pick next |
| `status: "partial"`, `can_resume: true` | Resume from `resume_from_phase` |
| `status: "partial"`, `can_resume: false` | Retry from scratch |
| `status: "failed"` | Retry (up to MAX_RETRIES) |
| No status file (crash) | Treat as failed, retry |
| Timeout (exit 124) | Treat as timed_out, retry |

## Team Naming Convention

Each feature gets its own team instance: `prizm-dev-team-{FEATURE_ID}`

Examples:
- `prizm-dev-team-F-001` — User Authentication
- `prizm-dev-team-F-002` — Dashboard

This ensures clean isolation between features and allows multiple features to have separate artifact histories.
