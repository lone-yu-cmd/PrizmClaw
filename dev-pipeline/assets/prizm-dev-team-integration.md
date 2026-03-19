# prizm-dev-team Integration Guide

## Overview

dev-pipeline drives the prizm-dev-team multi-agent team through an outer shell loop. Each iteration spawns a new AI CLI session with a bootstrap prompt that instructs the agent to create and orchestrate the team for one feature.

## Architecture

```
dev-pipeline (outer loop)
    │
    ├── run.sh                    Shell runner — picks next feature, spawns CLI
    ├── scripts/                  Python state management scripts
    ├── templates/bootstrap-prompt.md  Session prompt template
    │
    └── [per session] AI CLI
            │
            ├── Phase 0: Init (Orchestrator)
            ├── Phase 1-2: Context snapshot + Specify + Plan (Orchestrator)
            ├── Phase 3: Analyze (Reviewer agent) [tier2] / Phase 4: Analyze [tier3]
            ├── Phase 4: Implement (Dev agent) [tier2] / Phase 5: Implement [tier3]
            ├── Phase 4.5/6: Review (Reviewer agent)
            └── Phase 5/7: Retrospective & Commit (Orchestrator)
            │
            └── Write session-status.json → exit
```

## Agent Definitions (Source of Truth)

| Agent | Definition Path | Type |
|-------|----------------|------|
| Dev | `core/agents/prizm-dev-team-dev.md` | prizm-dev-team-dev |
| Reviewer | `core/agents/prizm-dev-team-reviewer.md` | prizm-dev-team-reviewer |

Note: The Orchestrator role is handled by the main agent (session orchestrator) directly — no separate agent definition needed.

## Pipeline Scripts

Located at `dev-pipeline/scripts/`:

| Script | Purpose |
|--------|---------|
| `init-dev-team.py` | Initialize `.dev-team/` + `.prizmkit/` directories |
| `init-pipeline.py` | Initialize pipeline state directories and config |
| `init-bugfix-pipeline.py` | Initialize bugfix pipeline state |
| `generate-bootstrap-prompt.py` | Render tier-specific bootstrap prompt with feature context |
| `generate-bugfix-prompt.py` | Render bugfix bootstrap prompt with bug context |
| `update-feature-status.py` | Update feature status in feature-list.json after session |
| `update-bug-status.py` | Update bug status in bug-fix-list.json after session |
| `check-session-status.py` | Read and validate session-status.json output |
| `detect-stuck.py` | Detect stuck/hung pipeline sessions via heartbeat |
| `parse-stream-progress.py` | Parse AI CLI output stream for progress tracking |
| `cleanup-logs.py` | Clean up old pipeline logs and state files |
| `utils.py` | Shared utility functions for pipeline scripts |

## Artifact Mapping

### PrizmKit Artifacts (.prizmkit/)

| Phase | File | Content |
|-------|------|---------|
| 1 | `specs/spec.md` | Feature specification (WHAT/WHY) |
| 2 | `plans/plan.md` | Technical plan (architecture, API, tests) |
| 3 | `tasks/tasks.md` | Executable task list with `[ ]` / `[x]` (legacy — now part of plan.md Tasks section) |
| 4 | `analysis/analyze-report.md` | Consistency analysis |

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
- Execute phases directly as the session orchestrator
- Spawn Dev and Reviewer agents as subagents for implementation and review phases
- The orchestrator handles context building, planning, retrospective, and commit phases directly

### 2. Pipeline Execution

The Orchestrator drives the pipeline phases with checkpoints (CP-0 through CP-3). Each checkpoint validates artifacts.

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
    "plan_path": ".prizmkit/plans/plan.md"
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
