# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: F-019 | **Session**: F-019-20260322160504 | **Run**: run-20260322-013453
- **Complexity**: medium | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-019: "Web Chat Command Support".

**CRITICAL**: You MUST NOT exit until ALL work is complete and session-status.json is written.

**Tier 1 — Single Agent**: You handle everything directly. No subagents, no TeamCreate.

### Feature Description

Web 页面聊天框支持与 Telegram 相同的斜杠命令（/exec、/cli、/config 等）。用户在 Web 聊天输入框中输入 / 前缀命令时，走与 Telegram 相同的命令路由逻辑，命令执行结果实时展示在 Web 聊天区域。

实现要点：在 Web API 层（api-routes.js）的 /chat 端点增加命令检测与路由；复用 Telegram 的命令注册表和 handler；命令输出适配 Web 展示格式（HTML 而非 MarkdownV2）；Web 端展示命令自动补全提示（输入 / 时显示可用命令列表）。

### Acceptance Criteria

- Web 聊天框输入 /exec <cmd> 可执行系统命令并在聊天区显示结果
- Web 聊天框输入 /cli、/config 等命令均可正常执行
- 命令输出格式适配 Web 展示，代码块和格式化内容正确渲染
- 输入 / 时展示可用命令列表作为自动补全提示
- 命令执行过程中显示加载状态，长输出支持分段展示

### Dependencies (Already Completed)

- (no completed dependencies yet)

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
.prizmkit/specs/019-web-chat-command-support/context-snapshot.md
.prizmkit/specs/019-web-chat-command-support/plan.md              ← includes Tasks section
```

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot

```bash
ls .prizmkit/specs/019-web-chat-command-support/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/019-web-chat-command-support/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: output of relevant `ls src/` calls
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream phases read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/019-web-chat-command-support/ 2>/dev/null
```

If plan.md missing, write it directly:
- `plan.md`: key components, data flow, files to create/modify, and a Tasks section with `[ ]` checkboxes (each task = one implementable unit). Keep under 80 lines.

**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement

**Before starting implementation**, write a preliminary session-status.json to `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-019/sessions/F-019-20260322160504/session-status.json`:
```json
{
  "status": "partial",
  "current_phase": 3,
  "feature_id": "F-019",
  "session_id": "F-019-20260322160504",
  "started_at": "<current ISO timestamp>"
}
```
This ensures the pipeline sees a "partial" status even if the session crashes mid-implementation.

For each task in plan.md Tasks section:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task
3. Mark task `[x]` in plan.md Tasks section immediately

After all tasks complete, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

### Phase 4: Code Review (mandatory)

1. Re-read acceptance criteria from Section 1 of context-snapshot.md
2. Run `/prizmkit-code-review` — verify all acceptance criteria, check code quality and correctness
3. Run the full test suite
4. If review uncovers issues, fix them (max 2 fix rounds)

**CP-2**: All acceptance criteria met, tests pass, code review passed.

### Phase 4.5: Architecture Sync & Memory Sedimentation (mandatory before commit)

Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index) and platform memory files:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES from completed work into `.prizm-docs/`
3. **Memory sedimentation** (feature sessions only): Sediment DECISIONS and interface conventions to platform memory file (`CLAUDE.md` for Claude Code, BOTH `CODEBUDDY.md` AND `memory/MEMORY.md` for CodeBuddy)
4. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

### Phase 5: Session Status + Commit

**5a. Write preliminary session-status.json** (safety net — ensures pipeline sees a status file even if session terminates during commit):

Write to: `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-019/sessions/F-019-20260322160504/session-status.json`

```json
{
  "session_id": "F-019-20260322160504",
  "feature_id": "F-019",
  "feature_slug": "019-web-chat-command-support",
  "exec_tier": 1,
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
    "context_snapshot_path": ".prizmkit/specs/019-web-chat-command-support/context-snapshot.md",
    "plan_path": ".prizmkit/specs/019-web-chat-command-support/plan.md"
  },
  "git_commit": "",
  "timestamp": "<current ISO timestamp>"
}
```

**5b. Commit** — Run `/prizmkit-committer` → `feat(F-019): Web Chat Command Support`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**5c. Update session-status.json to success** — After commit succeeds, update `/Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-019/sessions/F-019-20260322160504/session-status.json`:
- Set `"status": "success"`
- Set `"completed_phases": [0, 1, 2, 3, 4, 5]`
- Set `"git_commit": "<actual commit hash from git log -1 --format=%H>"`
- Set `"timestamp": "<current ISO timestamp>"`

**5d. Final Clean Check** — Verify repository is clean:

```bash
git status --short
```

**Note**: The pipeline runner will auto-commit any remaining dirty files after your session exits. You do NOT need to manually commit pipeline state files (`dev-pipeline/state/`) or runtime logs — just focus on committing your feature code via `/prizmkit-committer`.

If any feature-related source files remain uncommitted, stage them **explicitly by name** (do NOT use `git add -A`) and create a follow-up commit:

```bash
git add <specific-file-1> <specific-file-2>
git commit -m "chore(F-019): include session artifacts"
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/019-web-chat-command-support/` |
| Context Snapshot | `.prizmkit/specs/019-web-chat-command-support/context-snapshot.md` |
| Session Status Output | /Users/loneyu/SelfProjects/PrizmClaw/dev-pipeline/state/features/F-019/sessions/F-019-20260322160504/session-status.json |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 1: you handle everything directly — invoke skills yourself (no subagents needed for simple tasks)
- MANDATORY skills: `/prizmkit-code-review`, `/prizmkit-retrospective`, `/prizmkit-committer` — never skip these
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- Session-status.json is written BEFORE commit (as partial), then updated to success AFTER commit — this prevents pipeline from treating a terminated session as crashed
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Before exiting, commit your feature code via `/prizmkit-committer` — the pipeline runner auto-commits any remaining files after session exit
- When staging leftover files in the final clean check, always use explicit file names — NEVER use `git add -A`
