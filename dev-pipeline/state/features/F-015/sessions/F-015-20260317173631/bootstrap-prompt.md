# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-015 | **Session**: F-015-20260317173631 | **Run**: run-20260317-091756
- **Complexity**: medium | **Retry**: 2 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-015: "AI CLI Backend Switcher".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. No TeamCreate required.

### Feature Description

通过 /cli 命令动态切换 AI 后端，无需重启 Bot。当前系统硬编码使用 CODEBUDDY_BIN 配置的单一后端，用户无法在运行时切换到其他 AI CLI（如 claude-internal、claude、cbc 等）。

命令设计：/cli 查看当前使用的 AI 后端名称和路径；/cli <backend> 切换到指定后端（如 /cli claude-internal），切换后当前会话立即使用新后端执行后续对话；/cli list 列出所有可用的后端。

实现要点：修改 ai-cli-service.js 的 executeAiCli 使其支持运行时可变的 bin 路径；在 session store 中记录每个会话的当前后端选择；Web 端 chat-service.js 中的 codebuddy adapter 同样需要支持动态后端；提供后端可用性检测（which/command -v 验证二进制是否存在）。

### Acceptance Criteria

- /cli 返回当前会话使用的 AI 后端名称与 bin 路径
- /cli <backend> 切换后端，切换后下一条消息立即使用新后端
- /cli list 列出所有已配置的可用后端
- 切换前自动检测目标后端二进制是否存在，不存在时拒绝并提示
- 每个会话独立维护后端选择，不同用户可以使用不同后端
- Bot 重启后恢复为默认后端（CODEBUDDY_BIN 配置值）

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)
- F-011 - AI CLI Proxy (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/015-ai-cli-backend-switcher/plan.md
.prizmkit/specs/015-ai-cli-backend-switcher/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/015-ai-cli-backend-switcher/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: full content of each related file as code block
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/015-ai-cli-backend-switcher/plan.md .prizmkit/specs/015-ai-cli-backend-switcher/tasks.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach
- `tasks.md`: checklist with `[ ]` checkboxes ordered by dependency

**CP-1**: plan.md and tasks.md exist.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-dev.md. Implement feature F-015 (slug: 015-ai-cli-backend-switcher).
>
> 1. Read `.prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/015-ai-cli-backend-switcher/plan.md` and `.prizmkit/specs/015-ai-cli-backend-switcher/tasks.md`.
> 3. Implement task-by-task using TDD. Mark each task `[x]` in tasks.md immediately after completion.
> 4. After ALL tasks complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-reviewer.md. Review feature F-015 (slug: 015-ai-cli-backend-switcher).
>
> 1. Read `.prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md` FIRST:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log': what Dev changed
> 2. Run prizmkit-code-review: verify all acceptance criteria, check code quality and correctness. Only read files mentioned in the Implementation Log.
> 3. Run the test suite and report results.
> 4. Append a 'Review Notes' section to `context-snapshot.md`: issues found (severity), test results, final verdict.
> 5. If review uncovers durable pitfalls or conventions, add corresponding TRAPS/RULES notes to relevant `.prizm-docs/` files.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 4.5: Prizm Doc Update (mandatory for feature sessions)

Run `/prizmkit-prizm-docs` and sync project docs before commit:
1. Use `git diff --cached --name-status` (fallback: `git diff --name-status`) to locate changed modules
2. Update affected `.prizm-docs/` files (L1/L2, changelog.prizm)
3. Stage documentation updates (`git add .prizm-docs/`) if changed

Doc maintenance pass condition (pipeline-enforced): `REGISTRY.md` **or** `.prizm-docs/` changed in the final commit.

### Phase 4.7: Retrospective (feature sessions only, before commit)

If this session is a feature (not a bug-fix-only commit), run `/prizmkit-retrospective` now — **before committing**.
Retrospective must update relevant `.prizm-docs/` sections (TRAPS/RULES/DECISIONS) when applicable, so those changes are included in the feature commit.
Stage any `.prizm-docs/` changes produced: `git add .prizm-docs/`

### Phase 5: Commit

- Run `/prizmkit-summarize` → archive to REGISTRY.md
- Mark feature complete:
  ```bash
  python3 /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/scripts/update-feature-status.py \
    --feature-list "/Users/wylonyu/selfProjects/PrizmClaw/feature-list.json" \
    --state-dir "/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state" \
    --feature-id "F-015" --session-id "F-015-20260317173631" --action complete
  ```
- Run `/prizmkit-committer` → `feat(F-015): AI CLI Backend Switcher`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.

---

## Step 3: Write Session Status

Write to: `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-015/sessions/F-015-20260317173631/session-status.json`

```json
{
  "session_id": "F-015-20260317173631",
  "feature_id": "F-015",
  "feature_slug": "015-ai-cli-backend-switcher",
  "exec_tier": 2,
  "status": "<success|partial|failed|commit_missing|docs_missing>",
  "completed_phases": [0, 1, 2, 3, 4, 5],
  "current_phase": 5,
  "checkpoint_reached": "CP-2",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "docs_maintained": true,
  "retrospective_done": true,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md",
    "plan_path": ".prizmkit/specs/015-ai-cli-backend-switcher/plan.md",
    "tasks_path": ".prizmkit/specs/015-ai-cli-backend-switcher/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

### Step 3.1: Final Clean Check (before exit)

After writing `session-status.json`, verify repository is clean:

```bash
git status --short
```

If any files remain, include them in the last commit:

```bash
git add -A
git commit --amend --no-edit
```

Re-check `git status --short` and ensure it is empty before exiting.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/015-ai-cli-backend-switcher/` |
| Context Snapshot | `.prizmkit/specs/015-ai-cli-backend-switcher/context-snapshot.md` |
| Dev Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-015/sessions/F-015-20260317173631/session-status.json |
| Project Root | /Users/wylonyu/selfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — no TeamCreate
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, `git status --short` must be empty
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
