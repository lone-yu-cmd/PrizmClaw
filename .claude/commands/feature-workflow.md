---
description: One-stop entry point for feature development. Orchestrates app-planner → dev-pipeline-launcher → background execution. Handles multi-feature batch development from a single request. (project)
---

# Feature Workflow

One-stop entry point for feature development. Orchestrates the complete flow from requirements to committed code in a single invocation.

## When to Use

User says:
- "开发一个新应用", "构建 XXX 系统", "做一个项目"
- "一键完成这些特性", "批量实现这些需求"
- "从零开始做一个任务管理 App"
- "帮我实现用户登录、注册、头像上传这些功能"
- After receiving a batch of related feature requests

**Do NOT use this skill when:**
- User only wants to plan features (use `app-planner` directly)
- User only wants to launch pipeline for existing feature-list.json (use `dev-pipeline-launcher`)
- User wants to fix bugs (use `bug-planner` + `bugfix-pipeline-launcher`)
- User wants to refactor code (use `refactor-workflow`)

---

## Overview

```
`/prizmkit-feature` <需求描述>
   │
   ├── Phase 1: Plan → app-planner → feature-list.json
   │
   ├── Phase 2: Launch → dev-pipeline-launcher → background pipeline
   │
   └── Phase 3: Monitor → track progress → report results
```

### What This Skill Does

| Phase | Action | Result |
|-------|--------|--------|
| 1 | Call `app-planner` | `feature-list.json` with N features |
| 2 | Call `dev-pipeline-launcher` | Background pipeline started |
| 3 | Monitor progress | Status updates, completion report |

### Why This Skill Exists

Without this skill, users must:
1. Invoke `app-planner` → wait for feature-list.json
2. Invoke `dev-pipeline-launcher` → wait for pipeline start
3. Manually check progress

With this skill, users can:
1. Say "开发一个任务管理 App" and walk away
2. All planning + execution happens automatically

---

## Commands

### `/prizmkit-feature` \<需求描述\>

One-stop feature development from natural language requirements.

**INPUT**: Natural language description of the project or features. Can be:
- A project vision: "开发一个任务管理 App，支持用户登录、任务增删改查、任务分类"
- A batch of features: "实现用户注册、登录、找回密码这三个功能"
- An incremental request: "给现有系统追加用户头像上传和昵称修改功能"

**FLOW**:
1. Invoke `app-planner` with the description
2. After feature-list.json is generated, invoke `dev-pipeline-launcher`
3. Monitor and report progress

### `/prizmkit-feature` --from \<feature-list.json\>

Skip planning, directly launch pipeline from existing feature-list.json.

**USE WHEN**:
- feature-list.json already exists
- User wants to restart/resume pipeline execution

**FLOW**:
1. Skip `app-planner` (file already exists)
2. Invoke `dev-pipeline-launcher` directly
3. Monitor and report progress

### `/prizmkit-feature` \<需求描述\> --incremental

Add new features to an existing project (incremental mode).

**USE WHEN**:
- Project already has features implemented
- User wants to add new features to existing codebase

**FLOW**:
1. Invoke `app-planner` in incremental mode (reads existing feature-list.json)
2. Append new features to existing list
3. Invoke `dev-pipeline-launcher`
4. Monitor and report progress

---

## Phase 1: Plan

**Goal**: Generate structured feature-list.json from natural language requirements.

**STEPS**:

1. **run the `/app-planner` command** with the user's requirement description:
   - For new projects: standard planning mode
   - For existing projects with `--incremental`: incremental planning mode

2. **Interactive planning** (if app-planner requires clarification):
   - Pass through any questions to the user
   - Collect responses and continue planning

3. **Validate output**:
   - Confirm `feature-list.json` exists
   - Show summary: total features, complexity distribution, dependencies

**CHECKPOINT CP-FW-1**: `feature-list.json` generated and validated.

**If user says `--from <file>`**: Skip this phase entirely.

---

## Phase 2: Launch

**Goal**: Start the background development pipeline.

**STEPS**:

1. **Show feature summary** before launching:
   ```
   Ready to launch pipeline with N features:
     F-001: User authentication (high complexity)
     F-002: Task CRUD (medium complexity)
     F-003: Task categories (low complexity)

   Pipeline will run in background. Close this session will NOT stop it.
   Proceed? (Y/n)
   ```

2. **run the `/dev-pipeline-launcher` command**:
   - The launcher handles all prerequisites checks
   - Starts `launch-daemon.sh` in background
   - Returns PID and log file location

3. **Verify launch success**:
   - Confirm pipeline is running
   - Record PID and log path for Phase 3

**CHECKPOINT CP-FW-2**: Pipeline launched successfully in background.

---

## Phase 3: Monitor

**Goal**: Track pipeline progress and report to user.

**STEPS**:

1. **Initial status check**:
   ```bash
   dev-pipeline/launch-daemon.sh status
   ```

2. **Offer monitoring options**:
   - "I'll check progress periodically. Say 'status' anytime for an update."
   - "Say 'logs' to see recent activity."
   - "Say 'stop' to pause the pipeline."

3. **Periodic progress reports** (when user asks):
   ```bash
   python3 dev-pipeline/scripts/update-feature-status.py \
     --feature-list feature-list.json \
     --state-dir dev-pipeline/state \
     --action status
   ```

4. **Completion report** (when pipeline finishes all features):
   ```
   ✅ Pipeline completed: 3/3 features

   Summary:
   - F-001: User authentication → COMMITTED (feat: user auth)
   - F-002: Task CRUD → COMMITTED (feat: task crud)
   - F-003: Task categories → COMMITTED (feat: categories)

   Next steps:
   - Review changes: git log --oneline -5
   - Run tests: npm test
   - Push when ready: git push
   ```

**CHECKPOINT CP-FW-3**: All features completed or user stopped pipeline.

---

## Interaction During Pipeline

While the pipeline runs in background, the user can continue the conversation:

| User says | Action |
|-----------|--------|
| "status" / "进度" | Show current progress |
| "logs" / "日志" | Show recent log activity |
| "stop" / "停止" | Stop the pipeline (state preserved) |
| "show F-002 logs" | Show specific feature's session log |

---

## Error Handling

| Error | Action |
|-------|--------|
| `app-planner` cannot parse requirements | Ask user for clarification |
| `feature-list.json` generation failed | Show error, retry with refined input |
| Pipeline launch failed | Show daemon log, suggest manual start |
| All features blocked/failed | Show status, suggest retrying specific features |
| User wants to cancel mid-planning | Stop and save partial feature-list.json |

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| `app-planner` | **Called by Phase 1** — generates feature-list.json |
| `dev-pipeline-launcher` | **Called by Phase 2** — starts background pipeline |
| `bug-planner` | **Alternative** — for bug fix workflows |
| `bugfix-pipeline-launcher` | **Alternative** — for bug fix pipelines |
| `refactor-workflow` | **Alternative** — for code restructuring |

---

## Comparison with Alternative Workflows

| Dimension | feature-workflow | bug-fix-workflow | refactor-workflow |
|-----------|-----------------|------------------|-------------------|
| **Purpose** | New features (batch) | Bug fixes (batch) | Code restructuring |
| **Planning Skill** | `app-planner` | `bug-planner` | None (direct invocation) |
| **Launcher Skill** | `dev-pipeline-launcher` | `bugfix-pipeline-launcher` | None (in-session) |
| **Input** | Requirements description | Bug reports / logs | Module / code target |
| **Output** | Multiple `feat()` commits | Multiple `fix()` commits | Single `refactor()` commit |
| **Execution Mode** | Background daemon | Background daemon | In-session |

---

## Path References

All internal asset paths MUST use `.claude/command-assets/feature-workflow` placeholder for cross-IDE compatibility.

## Output

- `feature-list.json` (Phase 1 artifact)
- Background pipeline running (Phase 2)
- Progress updates (Phase 3)
- Multiple git commits with `feat(<scope>):` prefix
- Updated `REGISTRY.md` (via `/prizmkit-summarize` per feature)
