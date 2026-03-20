# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-015 | **Session**: F-015-20260320010546 | **Run**: run-20260312-123136
- **Complexity**: medium | **Retry**: 1 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-015: "Universal Command Natural-Language Routing".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. Spawn Dev and Reviewer agents via the Agent tool.

### Feature Description

为 Telegram 命令系统新增统一自然语言路由层：不仅 `/p`，而是所有命令入口都支持“命令 + 自然语言补充”与“纯自然语言意图”两种输入。系统需先进行意图识别，再映射到对应命令 handler（如 pipeline/planner/bugfix/file/system），避免被固定子命令解析器误判。

该能力需要与现有严格命令协议兼容：显式结构化参数优先、自然语言作为增强层；当语义冲突或置信度不足时，返回候选动作与确认提示，保证可控与可解释。

### Acceptance Criteria

- 所有核心命令入口（如 /pipeline、/planner、/bugfix、文件与系统命令）都可接受自然语言补充输入
- 用户发送纯自然语言请求时，系统可识别意图并路由到正确命令链路（或要求确认）
- 显式结构化参数优先于自然语言推断，现有严格子命令行为不回归
- 语义冲突或低置信度场景会返回候选动作与修正建议，而非直接报未知子命令
- 新增意图路由测试矩阵，覆盖多命令类别、歧义输入与回退路径

### Dependencies (Already Completed)

- F-002 - Telegram Pipeline Command Router (completed)
- F-011 - AI CLI Proxy (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## PrizmKit Directory Convention

```
.prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/015-universal-command-natural-language-routing/plan.md              ← includes Tasks section
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/015-universal-command-natural-language-routing/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md for full context. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream subagents read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/015-universal-command-natural-language-routing/plan.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach, and a Tasks section with `[ ]` checkboxes ordered by dependency
**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Agent tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md. Implement feature F-015 (slug: 015-universal-command-natural-language-routing).
>
> 1. Read `.prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md` FIRST — all project context, source files, and tests are embedded there. Do NOT re-read individual source files.
> 2. Read `.prizmkit/specs/015-universal-command-natural-language-routing/plan.md` (including Tasks section).
> 3. Implement task-by-task using TDD. Mark each task `[x]` in plan.md Tasks section immediately after completion.
> 4. After ALL tasks complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Agent tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md. Review feature F-015 (slug: 015-universal-command-natural-language-routing).
>
> 1. Read `.prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md` FIRST:
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

### Phase 4.5: Memory Maintenance (mandatory before commit)

Run `/prizmkit-retrospective` — the **sole maintainer** of `.prizm-docs/`:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Knowledge injection** (feature sessions only): Extract TRAPS/RULES/DECISIONS from completed work into `.prizm-docs/`
3. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

### Phase 5: Commit

- Run `/prizmkit-committer` → `feat(F-015): Universal Command Natural-Language Routing`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

---

## Step 3: Write Session Status

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-015/sessions/F-015-20260320010546/session-status.json`

```json
{
  "session_id": "F-015-20260320010546",
  "feature_id": "F-015",
  "feature_slug": "015-universal-command-natural-language-routing",
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
    "context_snapshot_path": ".prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md",
    "plan_path": ".prizmkit/specs/015-universal-command-natural-language-routing/plan.md"
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

If any files remain (e.g. session-status.json), stage and create a follow-up commit:

```bash
git add -A
git commit -m "chore(F-015): include session artifacts"
```

Re-check `git status --short` and ensure it is empty before exiting.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/015-universal-command-natural-language-routing/` |
| Context Snapshot | `.prizmkit/specs/015-universal-command-natural-language-routing/context-snapshot.md` |
| Dev Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/loneyu/SelfProjects/PrizmClaw/.codebuddy/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-015/sessions/F-015-20260320010546/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — use direct Agent spawn for agents
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- ALWAYS write session-status.json before exiting
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, `git status --short` must be empty
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
