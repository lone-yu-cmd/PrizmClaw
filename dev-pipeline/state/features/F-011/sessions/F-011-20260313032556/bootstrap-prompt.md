# Dev-Pipeline Session Bootstrap — Tier 3 (Full Team)

## Session Context

- **Feature ID**: F-011 | **Session**: F-011-20260313032556 | **Run**: run-20260312-123136
- **Complexity**: high | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-011: "AI CLI Proxy".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false). Do NOT spawn agents in background and exit — that kills the session.

**Tier 3 — Full Team**: PM + Dev + Reviewer agents spawned directly via Task tool. Full 7-phase pipeline.

### Feature Description

将 AI CLI（cbc/codebuddy）作为智能代理层，用户用自然语言描述意图，Bot 调用 AI CLI 来理解并执行复杂任务。这是 PrizmClaw 区别于普通远程 shell 工具的核心差异化能力。

交互模式：用户发送自然语言消息（如'帮我重构 src/utils.js 里的 parseDate 函数'），Bot 将消息作为 prompt 传给 AI CLI，AI CLI 执行后将结果流式回传到 Telegram。支持多轮会话上下文保持（基于现有 CODEBUDDY_ECHO_STDIO 和会话管理机制），用户可以连续追问或补充指令。

长任务支持：AI CLI 执行可能耗时较长，需要心跳进度推送（CODEBUDDY_HEARTBEAT_MS 配置），用户可通过 /stop 中断正在执行的 AI CLI 任务。输出格式化：AI CLI 的 Markdown 输出需适配 Telegram MarkdownV2 格式，代码块、链接等元素正确渲染。

与现有 CodeBuddy CLI 配置集成：CODEBUDDY_BIN、CODEBUDDY_PERMISSION_FLAG 等。

### Acceptance Criteria

- 用户发送自然语言指令，Bot 调用 AI CLI 执行并将结果回传到 Telegram
- AI CLI 会话上下文在多轮对话中保持，用户可连续追问
- 支持通过 /stop 中断正在执行的 AI CLI 任务
- 长时间运行的 AI CLI 任务有心跳进度推送，用户不会感觉卡住
- AI CLI 的 Markdown 输出正确适配 Telegram MarkdownV2 格式
- AI CLI 进程异常退出或超时时返回可理解的错误信息与建议操作

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md  ← PM writes, all agents read
.prizmkit/specs/011-ai-cli-proxy/spec.md
.prizmkit/specs/011-ai-cli-proxy/plan.md
.prizmkit/specs/011-ai-cli-proxy/tasks.md
.prizmkit/specs/REGISTRY.md
```

**`context-snapshot.md`** is the shared knowledge base. PM writes it once; Dev and Reviewer read it instead of re-scanning source files. This eliminates redundant I/O across all agents.

### Agent Files
- PM Agent: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md`
- Dev Agent: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md`
- Reviewer Agent: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md`

---

## Subagent Timeout Recovery

If any agent times out:
1. `ls .prizmkit/specs/011-ai-cli-proxy/` — check what exists
2. If `context-snapshot.md` exists: open recovery prompt with `"Read .prizmkit/specs/011-ai-cli-proxy/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries per phase. After 2 failures, orchestrator completes the work directly and appends a Recovery Note to context-snapshot.md.

---

## Execution

### Phase 0: Record Test Baseline & Detect Test Command

**Step 1 — Detect the correct test command** (run once, save as `TEST_CMD`):
```bash
# Try in order, use the first one that exits 0
node --test tests/**/*.test.js 2>&1 | tail -3   # Node built-in
npm test 2>&1 | tail -3                          # npm script fallback
```
Record the working command as `TEST_CMD`. If both fail, record `TEST_CMD="npm test"` as default.

**Step 2 — Record pre-existing failure baseline**:
```bash
$TEST_CMD 2>&1 | tail -20
```
Save the list of **pre-existing failing tests** (if any) as `BASELINE_FAILURES`. These are known failures that existed before this session — Dev must NOT be blamed for them, but must list them in COMPLETION_SIGNAL.

### Step 1: Team Setup

No TeamCreate required. Agents are spawned directly via the `Task` tool using `subagent_type`.

1. Run init script:
   `python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-011 --feature-slug 011-ai-cli-proxy`

2. Check for existing artifacts:
   `ls .prizmkit/specs/011-ai-cli-proxy/ 2>/dev/null`

Agent files are at:
- PM: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md`
- Dev: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md`
- Reviewer: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md`

```bash
python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-011 --feature-slug 011-ai-cli-proxy
```


### Phase 1-3: Specify + Plan + Tasks — PM Agent

Check existing artifacts first:
```bash
ls .prizmkit/specs/011-ai-cli-proxy/ 2>/dev/null
```

- All three (spec.md, plan.md, tasks.md) exist → **SKIP to CP-1**
- `context-snapshot.md` exists → PM reads it instead of re-scanning source files
- Some missing → PM generates only missing files

Before spawning PM, check whether feature code already exists in the project:
```bash
grep -r "011-ai-cli-proxy" src/ --include="*.js" --include="*.ts" -l 2>/dev/null | head -20
```

Record result as `EXISTING_CODE` (list of files, or empty). Pass this to PM prompt below.

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false).

**Construct prompt dynamically** — always prefix with:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. For feature F-011 (slug: 011-ai-cli-proxy), complete the following IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

If `EXISTING_CODE` is non-empty, append to prefix:
> "NOTE: The following files related to this feature already exist in the codebase: `<EXISTING_CODE list>`. Your spec/plan/tasks must reflect this existing implementation — document what exists, identify gaps, do NOT re-implement what is already done."

**Step A — Build Context Snapshot** (include only if `context-snapshot.md` does NOT exist):
> "Step A: Write `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md`. This is the team knowledge base — complete it before anything else. Include:
> - Section 1 'Feature Brief': feature description and acceptance criteria
> - Section 2 'Project Structure': output of `ls src/` and relevant subdirectories
> - Section 3 'Prizm Context': full content of `.prizm-docs/root.prizm` and relevant L1/L2 docs
> - Section 4 'Existing Source Files': full content of every related source file as a code block
> - Section 5 'Existing Tests': full content of related test files as code blocks
> Confirm with `ls .prizmkit/specs/011-ai-cli-proxy/context-snapshot.md`."

**Step B — Planning Artifacts** (include only missing files):
- spec.md missing: "Run prizmkit-specify → generate spec.md. Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input."
- plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy, risk assessment — all in one file)"
- tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/011-ai-cli-proxy/`. Confirm each with `ls` after writing."

Wait for PM to return. **CP-1**: All three files exist. If missing, diagnose from PM output — do NOT spawn another PM blindly.

### Phase 4: Analyze — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-011 (slug: 011-ai-cli-proxy):
> 1. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` FIRST — all source files and project context are there. Do NOT re-read individual source files.
> 2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency.
> 3. Before flagging CRITICAL or HIGH issues, verify each against Section 4 of the snapshot. Do NOT report based on incomplete information.
> Report: CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."

Wait for Reviewer to return.
- If CRITICAL issues found: spawn PM to fix — use this prompt:
  > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` FIRST for full project context. Do NOT re-read individual source files. Fix ONLY the following CRITICAL issues in spec.md/plan.md/tasks.md: `<list issues>`. Do NOT exit until all files are updated."
  Then re-run analyze (max 1 round).

**CP-2**: No CRITICAL issues.

### Phase 5: Implement — Dev Agent

Before spawning Dev, check tasks.md:
```bash
grep -c '^\- \[ \]' .prizmkit/specs/011-ai-cli-proxy/tasks.md 2>/dev/null || echo 0
```
- If result is `0` (all tasks already `[x]`) → **SKIP Phase 5**, go directly to Phase 6. Do NOT spawn Dev.
- If result is non-zero → spawn Dev agent below.

Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-011 (slug: 011-ai-cli-proxy) using TDD.
> 1. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` FIRST — all source files and context are there. Do NOT re-read individual source files.
> 2. Read `plan.md` and `tasks.md` from `.prizmkit/specs/011-ai-cli-proxy/`.
> 3. Implement task-by-task. Mark each `[x]` in tasks.md **immediately** after completion (do NOT batch).
> 4. Use `TEST_CMD=<TEST_CMD>` to run tests — do NOT explore alternative test commands.
> 5. After ALL tasks done, append 'Implementation Log' to context-snapshot.md: files changed/created, key decisions, deviations from plan.
> 6. Do NOT execute any git commands (no git add/commit/reset/push).
> 7. If `<TEST_CMD>` shows failures, check against BASELINE_FAILURES=`<BASELINE_FAILURES>`. Failures present in the baseline are pre-existing — list them explicitly in your COMPLETION_SIGNAL.
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. **If Dev times out before all tasks are `[x]`**:
1. Check progress: `grep -c '^\- \[ \]' .prizmkit/specs/011-ai-cli-proxy/tasks.md`
2. If any tasks remain: re-spawn Dev with this recovery prompt:
   > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. You are resuming implementation of feature F-011 (slug: 011-ai-cli-proxy).
   > 1. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` — Section 4 has original source, 'Implementation Log' (if present) has what was already done. Do NOT re-read individual source files.
   > 2. Read `tasks.md` — complete ONLY the remaining `[ ]` tasks. Do NOT redo completed `[x]` tasks.
   > 3. Use `TEST_CMD=<TEST_CMD>` to run tests.
   > 4. Append progress to 'Implementation Log' in context-snapshot.md.
   > 5. Do NOT execute any git commands."
3. Max 2 recovery retries. After 2 failures, orchestrator implements remaining tasks directly.

All tasks `[x]`, tests pass.

### Phase 6: Review — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-011 (slug: 011-ai-cli-proxy):
> 1. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` FIRST — Section 4 has original source files, 'Implementation Log' section lists exactly what Dev changed. Do NOT re-read source files that are NOT mentioned in the Implementation Log.
> 2. Run prizmkit-code-review: spec compliance (against spec.md), code quality, correctness. Read ONLY files listed in Implementation Log.
> 3. Write and execute integration tests covering all user stories from spec.md. Use `TEST_CMD=<TEST_CMD>` — do NOT try alternative test commands.
> 4. Append 'Review Notes' to context-snapshot.md: issues (severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix with this prompt:
  > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Fix NEEDS_FIXES issues for feature F-011 (slug: 011-ai-cli-proxy).
  > 1. Read `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` — 'Review Notes' section lists the exact issues to fix. Do NOT re-read source files not mentioned there.
  > 2. Fix ONLY the issues listed in 'Review Notes'. Do NOT refactor unrelated code.
  > 3. Use `TEST_CMD=<TEST_CMD>` to verify fixes.
  > 4. Append fix summary to 'Implementation Log' in context-snapshot.md.
  > 5. Do NOT execute any git commands."
  Then re-run Review (max 3 rounds).

**CP-3**: Integration tests pass, verdict is not NEEDS_FIXES.

### Phase 7: Summarize & Commit — DO NOT SKIP

**For bug fixes**: skip `prizmkit.summarize`, use `fix(<scope>):` commit prefix.

**7a.** Check if feature already committed:
```bash
git log --oneline | grep "F-011" | head -3
```
- If a commit for `F-011` already exists → **skip 7c** (do NOT run prizmkit.committer, do NOT run git reset, do NOT stage or unstage anything). Proceed directly to Step 3.
- If no existing commit → proceed normally with 7a–7c.

**7b.** Run `prizmkit.summarize` → archive to REGISTRY.md

**7c.** Mark feature complete:
```bash
python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/update-feature-status.py \
  --feature-list "/Users/loneyu/SelfProjects/PrizmClaw/feature-list.json" \
  --state-dir "/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state" \
  --feature-id "F-011" --session-id "F-011-20260313032556" --action complete
```

**7d.** Run `prizmkit.committer` → `feat(F-011): AI CLI Proxy`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-011/sessions/F-011-20260313032556/session-status.json`

```json
{
  "session_id": "F-011-20260313032556",
  "feature_id": "F-011",
  "feature_slug": "011-ai-cli-proxy",
  "exec_tier": 3,
  "status": "<success|partial|failed>",
  "completed_phases": [0, 1, 2, 3, 4, 5, 6, 7],
  "current_phase": 7,
  "checkpoint_reached": "CP-3",
  "tasks_completed": 0,
  "tasks_total": 0,
  "errors": [],
  "can_resume": false,
  "resume_from_phase": null,
  "artifacts": {
    "context_snapshot_path": ".prizmkit/specs/011-ai-cli-proxy/context-snapshot.md",
    "spec_path": ".prizmkit/specs/011-ai-cli-proxy/spec.md",
    "plan_path": ".prizmkit/specs/011-ai-cli-proxy/plan.md",
    "tasks_path": ".prizmkit/specs/011-ai-cli-proxy/tasks.md"
  },
  "git_commit": "<commit hash>",
  "timestamp": "2026-03-04T10:00:00Z"
}
```

## Step 4: Team Cleanup

No team cleanup needed — agents were spawned directly without TeamCreate.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/011-ai-cli-proxy/` |
| Context Snapshot | `.prizmkit/specs/011-ai-cli-proxy/context-snapshot.md` |
| Team Config | `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json` |
| PM Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-011/sessions/F-011-20260313032556/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |
| Feature List Path | /Users/loneyu/SelfProjects/PrizmClaw/feature-list.json |

## Reminders

- Tier 3: full team — PM (planning) → Dev (implementation) → Reviewer (review) — agents spawned directly via Task tool (no TeamCreate needed)
- context-snapshot.md is the team knowledge base: PM writes it once, all agents read it
- Do NOT use `run_in_background=true` when spawning agents
- ALWAYS write session-status.json before exiting
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
