# Dev-Pipeline Session Bootstrap — Tier 3 (Full Team)

## Session Context

- **Feature ID**: F-010 | **Session**: F-010-20260313023945 | **Run**: run-20260312-123136
- **Complexity**: high | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false tasks=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-010: "File Manager".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false). Do NOT spawn agents in background and exit — that kills the session.

**Tier 3 — Full Team**: PM + Dev + Reviewer agents spawned directly via Task tool. Full 7-phase pipeline.

### Feature Description

文件系统操作能力，让用户通过 Telegram 完成文件浏览、查看、上传、下载和搜索。所有操作受安全沙箱限制（TELEGRAM_FILE_ALLOWED_ROOTS 配置），禁止访问配置外的敏感路径。

目录浏览：/ls [path] 列出目录内容，支持 /tree [path] 树形展示（限制深度和文件数）。文件查看：/cat <file> 查看文件内容，长文件自动分页，支持 /head 和 /tail。文件传输：用户可从 Telegram 上传文件到电脑指定路径（/upload <path>），也可通过 /download <file> 将电脑文件发送到 Telegram（受 Telegram 50MB 文件大小限制）。文件搜索：/find <pattern> 按文件名/扩展名/glob 模式搜索。

与现有 TELEGRAM_FILE_ALLOWED_ROOTS 和 TELEGRAM_FILE_CANDIDATE_DIRS 配置集成，所有路径操作需经过 path_policy 安全校验。

### Acceptance Criteria

- /ls 或 /dir 可浏览指定目录内容，默认为当前工作目录
- /tree 支持树形展示目录结构，限制最大深度（默认 3 层）和文件数
- /cat 可查看文件内容，长文件自动分页并支持 /head N 和 /tail N
- 用户可从 Telegram 上传文件到电脑指定路径，路径不存在时自动创建目录
- /download 可将电脑上的文件发送到 Telegram，超过 50MB 限制时提示
- /find 支持按文件名、扩展名或 glob 模式搜索，结果分页展示
- 所有文件操作受安全沙箱限制，访问 TELEGRAM_FILE_ALLOWED_ROOTS 外路径时拒绝并提示

### Dependencies (Already Completed)

- F-009 - General Command Executor (completed)
- F-006 - Safety and Permission Guard (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/010-file-manager/context-snapshot.md  ← PM writes, all agents read
.prizmkit/specs/010-file-manager/spec.md
.prizmkit/specs/010-file-manager/plan.md
.prizmkit/specs/010-file-manager/tasks.md
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
1. `ls .prizmkit/specs/010-file-manager/` — check what exists
2. If `context-snapshot.md` exists: open recovery prompt with `"Read .prizmkit/specs/010-file-manager/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
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
   `python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-010 --feature-slug 010-file-manager`

2. Check for existing artifacts:
   `ls .prizmkit/specs/010-file-manager/ 2>/dev/null`

Agent files are at:
- PM: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md`
- Dev: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md`
- Reviewer: `/Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md`

```bash
python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/init-dev-team.py --project-root /Users/loneyu/SelfProjects/PrizmClaw --feature-id F-010 --feature-slug 010-file-manager
```


### Phase 1-3: Specify + Plan + Tasks — PM Agent

Check existing artifacts first:
```bash
ls .prizmkit/specs/010-file-manager/ 2>/dev/null
```

- All three (spec.md, plan.md, tasks.md) exist → **SKIP to CP-1**
- `context-snapshot.md` exists → PM reads it instead of re-scanning source files
- Some missing → PM generates only missing files

Before spawning PM, check whether feature code already exists in the project:
```bash
grep -r "010-file-manager" src/ --include="*.js" --include="*.ts" -l 2>/dev/null | head -20
```

Record result as `EXISTING_CODE` (list of files, or empty). Pass this to PM prompt below.

Spawn PM agent (Task tool, subagent_type="prizm-dev-team-pm", run_in_background=false).

**Construct prompt dynamically** — always prefix with:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. For feature F-010 (slug: 010-file-manager), complete the following IN THIS SINGLE SESSION — do NOT exit until ALL listed steps are done and files are written to disk:"

If `EXISTING_CODE` is non-empty, append to prefix:
> "NOTE: The following files related to this feature already exist in the codebase: `<EXISTING_CODE list>`. Your spec/plan/tasks must reflect this existing implementation — document what exists, identify gaps, do NOT re-implement what is already done."

**Step A — Build Context Snapshot** (include only if `context-snapshot.md` does NOT exist):
> "Step A: Write `.prizmkit/specs/010-file-manager/context-snapshot.md`. This is the team knowledge base — complete it before anything else. Include:
> - Section 1 'Feature Brief': feature description and acceptance criteria
> - Section 2 'Project Structure': output of `ls src/` and relevant subdirectories
> - Section 3 'Prizm Context': full content of `.prizm-docs/root.prizm` and relevant L1/L2 docs
> - Section 4 'Existing Source Files': full content of every related source file as a code block
> - Section 5 'Existing Tests': full content of related test files as code blocks
> Confirm with `ls .prizmkit/specs/010-file-manager/context-snapshot.md`."

**Step B — Planning Artifacts** (include only missing files):
- spec.md missing: "Run prizmkit-specify → generate spec.md. Resolve any `[NEEDS CLARIFICATION]` markers using the feature description — do NOT pause for interactive input."
- plan.md missing: "Run prizmkit-plan → generate plan.md (architecture, components, interface design, data model, testing strategy, risk assessment — all in one file)"
- tasks.md missing: "Run prizmkit-tasks → generate tasks.md with `[ ]` checkboxes"

> "All files go under `.prizmkit/specs/010-file-manager/`. Confirm each with `ls` after writing."

Wait for PM to return. **CP-1**: All three files exist. If missing, diagnose from PM output — do NOT spawn another PM blindly.

### Phase 4: Analyze — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-010 (slug: 010-file-manager):
> 1. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` FIRST — all source files and project context are there. Do NOT re-read individual source files.
> 2. Run prizmkit-analyze: cross-check `spec.md`, `plan.md`, and `tasks.md` for consistency.
> 3. Before flagging CRITICAL or HIGH issues, verify each against Section 4 of the snapshot. Do NOT report based on incomplete information.
> Report: CRITICAL, HIGH, MEDIUM issues found (or 'No issues found')."

Wait for Reviewer to return.
- If CRITICAL issues found: spawn PM to fix — use this prompt:
  > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` FIRST for full project context. Do NOT re-read individual source files. Fix ONLY the following CRITICAL issues in spec.md/plan.md/tasks.md: `<list issues>`. Do NOT exit until all files are updated."
  Then re-run analyze (max 1 round).

**CP-2**: No CRITICAL issues.

### Phase 5: Implement — Dev Agent

Before spawning Dev, check tasks.md:
```bash
grep -c '^\- \[ \]' .prizmkit/specs/010-file-manager/tasks.md 2>/dev/null || echo 0
```
- If result is `0` (all tasks already `[x]`) → **SKIP Phase 5**, go directly to Phase 6. Do NOT spawn Dev.
- If result is non-zero → spawn Dev agent below.

Spawn Dev agent (Task tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-010 (slug: 010-file-manager) using TDD.
> 1. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` FIRST — all source files and context are there. Do NOT re-read individual source files.
> 2. Read `plan.md` and `tasks.md` from `.prizmkit/specs/010-file-manager/`.
> 3. Implement task-by-task. Mark each `[x]` in tasks.md **immediately** after completion (do NOT batch).
> 4. Use `TEST_CMD=<TEST_CMD>` to run tests — do NOT explore alternative test commands.
> 5. After ALL tasks done, append 'Implementation Log' to context-snapshot.md: files changed/created, key decisions, deviations from plan.
> 6. Do NOT execute any git commands (no git add/commit/reset/push).
> 7. If `<TEST_CMD>` shows failures, check against BASELINE_FAILURES=`<BASELINE_FAILURES>`. Failures present in the baseline are pre-existing — list them explicitly in your COMPLETION_SIGNAL.
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. **If Dev times out before all tasks are `[x]`**:
1. Check progress: `grep -c '^\- \[ \]' .prizmkit/specs/010-file-manager/tasks.md`
2. If any tasks remain: re-spawn Dev with this recovery prompt:
   > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. You are resuming implementation of feature F-010 (slug: 010-file-manager).
   > 1. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` — Section 4 has original source, 'Implementation Log' (if present) has what was already done. Do NOT re-read individual source files.
   > 2. Read `tasks.md` — complete ONLY the remaining `[ ]` tasks. Do NOT redo completed `[x]` tasks.
   > 3. Use `TEST_CMD=<TEST_CMD>` to run tests.
   > 4. Append progress to 'Implementation Log' in context-snapshot.md.
   > 5. Do NOT execute any git commands."
3. Max 2 recovery retries. After 2 failures, orchestrator implements remaining tasks directly.

All tasks `[x]`, tests pass.

### Phase 6: Review — Reviewer Agent

Spawn Reviewer agent (Task tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. For feature F-010 (slug: 010-file-manager):
> 1. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` FIRST — Section 4 has original source files, 'Implementation Log' section lists exactly what Dev changed. Do NOT re-read source files that are NOT mentioned in the Implementation Log.
> 2. Run prizmkit-code-review: spec compliance (against spec.md), code quality, correctness. Read ONLY files listed in Implementation Log.
> 3. Write and execute integration tests covering all user stories from spec.md. Use `TEST_CMD=<TEST_CMD>` — do NOT try alternative test commands.
> 4. Append 'Review Notes' to context-snapshot.md: issues (severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix with this prompt:
  > "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Fix NEEDS_FIXES issues for feature F-010 (slug: 010-file-manager).
  > 1. Read `.prizmkit/specs/010-file-manager/context-snapshot.md` — 'Review Notes' section lists the exact issues to fix. Do NOT re-read source files not mentioned there.
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
git log --oneline | grep "F-010" | head -3
```
- If a commit for `F-010` already exists → **skip 7c** (do NOT run prizmkit.committer, do NOT run git reset, do NOT stage or unstage anything). Proceed directly to Step 3.
- If no existing commit → proceed normally with 7a–7c.

**7b.** Run `prizmkit.summarize` → archive to REGISTRY.md

**7c.** Mark feature complete:
```bash
python3 /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/scripts/update-feature-status.py \
  --feature-list "/Users/loneyu/SelfProjects/PrizmClaw/feature-list.json" \
  --state-dir "/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state" \
  --feature-id "F-010" --session-id "F-010-20260313023945" --action complete
```

**7d.** Run `prizmkit.committer` → `feat(F-010): File Manager`, do NOT push

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-010/sessions/F-010-20260313023945/session-status.json`

```json
{
  "session_id": "F-010-20260313023945",
  "feature_id": "F-010",
  "feature_slug": "010-file-manager",
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
    "context_snapshot_path": ".prizmkit/specs/010-file-manager/context-snapshot.md",
    "spec_path": ".prizmkit/specs/010-file-manager/spec.md",
    "plan_path": ".prizmkit/specs/010-file-manager/plan.md",
    "tasks_path": ".prizmkit/specs/010-file-manager/tasks.md"
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
| Feature Artifacts Dir | `.prizmkit/specs/010-file-manager/` |
| Context Snapshot | `.prizmkit/specs/010-file-manager/context-snapshot.md` |
| Team Config | `/Users/loneyu/.codebuddy/teams/prizm-dev-team/config.json` |
| PM Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-pm.md |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-010/sessions/F-010-20260313023945/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |
| Feature List Path | /Users/loneyu/SelfProjects/PrizmClaw/feature-list.json |

## Reminders

- Tier 3: full team — PM (planning) → Dev (implementation) → Reviewer (review) — agents spawned directly via Task tool (no TeamCreate needed)
- context-snapshot.md is the team knowledge base: PM writes it once, all agents read it
- Do NOT use `run_in_background=true` when spawning agents
- ALWAYS write session-status.json before exiting
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
