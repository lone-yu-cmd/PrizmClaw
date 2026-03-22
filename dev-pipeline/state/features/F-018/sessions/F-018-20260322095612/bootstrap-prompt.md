# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: F-018 | **Session**: F-018-20260322095612 | **Run**: run-20260322-013453
- **Complexity**: high | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-018: "Web-Telegram Bidirectional Sync".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. Spawn Dev and Reviewer agents via the Agent tool.

### Feature Description

Web 页面与 Telegram 共享同一会话，消息双向实时同步。当前 Web 端使用独立的 chat-service.js + codebuddy adapter，Telegram 端使用 ai-cli-service.js，两套系统完全隔离。

统一架构：将 Web 端和 Telegram 端的消息路由统一到同一个 session store 和 AI CLI 执行引擎（ai-cli-service.js）；废弃或重构 chat-service.js + codebuddy adapter，使 Web 端也通过 ai-cli-service 执行；统一 session key 映射策略，让 Web 和 Telegram 可以关联到同一个会话。

实时同步：Telegram 端收到的消息和回复实时通过 SSE 推送到 Web 页面；Web 端发送的消息同步转发到 Telegram 对话并在 Bot 中执行；双端同时在线时，两边都能看到完整的对话流。

会话绑定：提供会话绑定机制（如 Web 页面输入 Telegram chat ID 或扫码绑定），确保 Web 连接到正确的 Telegram 会话。

### Acceptance Criteria

- Web 端和 Telegram 端使用同一个 AI CLI 执行引擎，废弃独立的 codebuddy adapter
- Web 端发送消息后，Telegram 端和 Web 端同时收到 AI 回复
- Telegram 端对话内容实时推送到已绑定的 Web 页面
- Web 页面支持输入 Telegram chat ID 绑定到指定会话
- 双端同时在线时，对话历史完全一致，无消息丢失
- Web 端断线重连后自动同步离线期间的消息

### Dependencies (Already Completed)

- F-011 - AI CLI Proxy (completed)
- F-013 - Session and Context Manager (completed)

### App Global Context

- **design_system**: Telegram command UX with structured message templates
- **framework**: Express.js (auto-detected)
- **language**: TypeScript
- **tech_stack**: Node.js + Express + Telegraf + JSON state files + Shell/Python dev-pipeline
- **testing_strategy**: Jest (unit + integration)

## ⚠️ Context Budget Rules (CRITICAL — read before any phase)

You are running in headless mode with a FINITE context window. Exceeding it will crash the session and lose all work. Follow these rules strictly:

1. **context-snapshot.md is your single source of truth** — After Phase 1 builds it, ALWAYS read context-snapshot.md instead of re-reading individual source files
2. **Never re-read your own writes** — After you create/modify a file, do NOT read it back to verify. Trust your write was correct.
3. **Stay focused** — Do NOT explore code unrelated to this feature. No curiosity-driven reads.
4. **One task at a time** — In Phase 3 (implement), complete and test one task before starting the next.
5. **Minimize tool output** — When running commands, use `| head -20` or `| tail -20` to limit output. Never dump entire test suites or logs.
6. **Write session-status.json early** — Write a preliminary status file at the START of Phase 3, not just at the end.
7. **Incremental commits when possible** — If a feature has multiple independent tasks, commit after each completed task rather than one big commit at the end.

---

## PrizmKit Directory Convention

```
.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md  ← written by you, read by Dev + Reviewer
.prizmkit/specs/018-web-telegram-bidirectional-sync/plan.md              ← includes Tasks section
```

**`context-snapshot.md`** is the shared knowledge base. You write it once; Dev and Reviewer read it instead of re-scanning individual files.

---

## Subagent Timeout Recovery

If a subagent times out:
1. `ls .prizmkit/specs/018-web-telegram-bidirectional-sync/` — check what exists
2. Re-spawn with: `"Read .prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md for full context. Also read .prizmkit/specs/018-web-telegram-bidirectional-sync/agents/*.md for knowledge from previous agents. Do NOT re-read individual source files."` + only remaining steps + `model: "lite"`
3. Max 2 retries. After 2 failures, complete the work yourself.

---

## Execution

### Phase 0.5: Agent Knowledge Setup

Create the agent knowledge directory and initialize your own knowledge doc:
```bash
mkdir -p .prizmkit/specs/018-web-telegram-bidirectional-sync/agents
```

Write `.prizmkit/specs/018-web-telegram-bidirectional-sync/agents/orchestrator.md`:
```markdown
# Orchestrator

## FINDINGS

## DECISIONS

## INTERFACES_DISCOVERED

## CONTEXT_BUILT
```

After each phase, append notable DECISIONS/FINDINGS to your `agents/orchestrator.md`.

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream subagents read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code blocks

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/018-web-telegram-bidirectional-sync/plan.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach, and a Tasks section with `[ ]` checkboxes ordered by dependency
**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement — Dev Subagent

**Before spawning Dev**, write a preliminary session-status.json to `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-018/sessions/F-018-20260322095612/session-status.json`:
```json
{
  "status": "partial",
  "current_phase": 3,
  "feature_id": "F-018",
  "session_id": "F-018-20260322095612",
  "started_at": "<current ISO timestamp>"
}
```
This ensures the pipeline sees a "partial" status even if the session crashes mid-implementation.

Spawn Dev subagent (Agent tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-dev.md. Implement feature F-018 (slug: 018-web-telegram-bidirectional-sync).
>
> **IMPORTANT**: Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md` FIRST.
> This file contains ALL source code and context. Do NOT re-read individual source files.
> 1. Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md` — all project context, source files, and tests are embedded there.
> 2. Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/plan.md` (including Tasks section).
> 3. Implement task-by-task using TDD. Mark each task `[x]` in plan.md Tasks section immediately after completion.
> 4. **Agent Knowledge Doc**: Maintain `.prizmkit/specs/018-web-telegram-bidirectional-sync/agents/dev-1.md`. After each task, append FINDINGS/DECISIONS/INTERFACES_DISCOVERED if you discovered anything notable. If context-snapshot.md was MISSING, write CONTEXT_BUILT entries after scanning source files.
> 5. After ALL tasks complete, append an 'Implementation Log' section to `context-snapshot.md`:
>    - Files created/modified (with paths)
>    - Key implementation decisions
>    - Any deviations from plan.md
> Do NOT exit until all tasks are [x] and the Implementation Log is written."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

### Phase 4: Review — Reviewer Subagent

Spawn Reviewer subagent (Agent tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-reviewer.md. Review feature F-018 (slug: 018-web-telegram-bidirectional-sync).
>
> **IMPORTANT**: Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md` FIRST.
> This file contains ALL source code and context. Do NOT re-read individual source files.
> 1. Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md`:
>    - Section 1: acceptance criteria to verify against
>    - Section 4: original source files (before changes)
>    - 'Implementation Log': what Dev changed
> 2. Read `.prizmkit/specs/018-web-telegram-bidirectional-sync/agents/dev-*.md` (if exists) — understand Dev's implementation decisions and trade-offs.
> 3. Run prizmkit-code-review: verify all acceptance criteria, check code quality and correctness. Only read files mentioned in the Implementation Log.
> 4. Run the test suite and report results.
> 5. Append a 'Review Notes' section to `context-snapshot.md`: issues found (severity), test results, final verdict.
> 6. **Agent Knowledge Doc**: Maintain `.prizmkit/specs/018-web-telegram-bidirectional-sync/agents/reviewer.md`. Write FINDINGS/DECISIONS after review (e.g., patterns discovered, quality issues, architectural observations).
> 7. If review uncovers durable pitfalls or conventions, add corresponding TRAPS/RULES notes to relevant `.prizm-docs/` files.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.
- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 4.5: Architecture Sync & Memory Sedimentation (mandatory before commit)

Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index) and platform memory files:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES from completed work into `.prizm-docs/`
3. **Memory sedimentation** (feature sessions only): Sediment DECISIONS and interface conventions to platform memory file (`CLAUDE.md` for Claude Code, BOTH `CODEBUDDY.md` AND `memory/MEMORY.md` for CodeBuddy)
4. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

### Phase 5: Session Status + Commit

**5a. Write preliminary session-status.json** (safety net — ensures pipeline sees a status file even if session terminates during commit):

Write to: `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-018/sessions/F-018-20260322095612/session-status.json`

```json
{
  "session_id": "F-018-20260322095612",
  "feature_id": "F-018",
  "feature_slug": "018-web-telegram-bidirectional-sync",
  "exec_tier": 2,
  "status": "partial",
  "completed_phases": [0, 1, 2, 3, 4],
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
    "context_snapshot_path": ".prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md",
    "plan_path": ".prizmkit/specs/018-web-telegram-bidirectional-sync/plan.md"
  },
  "git_commit": "",
  "timestamp": "<current ISO timestamp>"
}
```

**5b. Commit** — Run `/prizmkit-committer` → `feat(F-018): Web-Telegram Bidirectional Sync`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**5c. Update session-status.json to success** — After commit succeeds, update `/Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-018/sessions/F-018-20260322095612/session-status.json`:
- Set `"status": "success"`
- Set `"completed_phases": [0, 1, 2, 3, 4, 5]`
- Set `"git_commit": "<actual commit hash from git log -1 --format=%H>"`
- Set `"timestamp": "<current ISO timestamp>"`

**5d. Final Clean Check** — Verify repository is clean:

```bash
git status --short
```

If any files remain, stage them **explicitly by name** (do NOT use `git add -A`) and create a follow-up commit:

```bash
git add <specific-file-1> <specific-file-2>
git commit -m "chore(F-018): include session artifacts"
```

Re-check `git status --short` and ensure it is empty before exiting.

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/018-web-telegram-bidirectional-sync/` |
| Context Snapshot | `.prizmkit/specs/018-web-telegram-bidirectional-sync/context-snapshot.md` |
| Dev Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-dev.md |
| Reviewer Agent Def | /Users/wylonyu/selfProjects/PrizmClaw/.claude/agents/prizm-dev-team-reviewer.md |
| Session Status Output | /Users/wylonyu/selfProjects/PrizmClaw/dev-pipeline/state/features/F-018/sessions/F-018-20260322095612/session-status.json |
| Project Root | /Users/wylonyu/selfProjects/PrizmClaw |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews — use direct Agent spawn for agents
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- Do NOT use `run_in_background=true` when spawning subagents
- Session-status.json is written BEFORE commit (as partial), then updated to success AFTER commit — this prevents pipeline from treating a terminated session as crashed
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, `git status --short` must be empty
- When staging leftover files in the final clean check, always use explicit file names — NEVER use `git add -A`
- On timeout: check snapshot → model:lite → remaining steps only → max 2 retries → orchestrator fallback
