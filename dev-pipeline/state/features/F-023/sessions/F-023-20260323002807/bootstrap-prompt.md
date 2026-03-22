# Dev-Pipeline Session Bootstrap — Tier 1 (Single Agent)

## Session Context

- **Feature ID**: F-023 | **Session**: F-023-20260323002807 | **Run**: run-20260322-013453
- **Complexity**: low | **Retry**: 0 / 3
- **Previous Status**: N/A (first run) | **Resume From**: null
- **Init**: true | Artifacts: spec=false plan=false

## Your Mission

You are the **session orchestrator**. Implement Feature F-023: "Web Button Hover Animation".

**CRITICAL**: You MUST NOT exit until ALL work is complete and committed.

**Tier 1 — Single Agent**: You handle everything directly. No subagents, no TeamCreate.

### Feature Description

为 Web 管理台所有按钮添加鼠标悬停时的动画过渡效果。在 public/styles.css 中为 .btn 添加 transition 和 :hover 状态的 transform/brightness 变化，提升按钮交互的视觉反馈。无后端变更。

### Acceptance Criteria

- Given 用户将鼠标悬停在任意按钮上，When 鼠标进入按钮区域，Then 按钮显示可见的过渡动画效果
- Given 按钮处于悬停状态，When 鼠标离开按钮，Then 动画还原至默认样式
- Given 按钮处于 disabled 状态，When 鼠标悬停，Then 不显示悬停动画

### Dependencies (Already Completed)

- F-018 - Web-Telegram Bidirectional Sync (completed)

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
6. **Incremental commits when possible** — If a feature has multiple independent tasks, commit after each completed task rather than one big commit at the end.
7. **Capture test output once** — When running the test suite, always use `$TEST_CMD 2>&1 | tee /tmp/test-out.txt | tail -20`. Then grep `/tmp/test-out.txt` for details. Never re-run the suite just to apply a different filter.

---

## PrizmKit Directory Convention

```
.prizmkit/specs/023-web-button-hover-animation/context-snapshot.md
.prizmkit/specs/023-web-button-hover-animation/plan.md              ← includes Tasks section
```

---

## Execution

### Phase 0: SKIP (already initialized)


### Phase 1: Build Context Snapshot

```bash
ls .prizmkit/specs/023-web-button-hover-animation/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/023-web-button-hover-animation/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: output of relevant `ls src/` calls
   - **Section 3 — Prizm Context**: content of root.prizm and relevant L1/L2 docs
   - **Section 4 — Existing Source Files**: **full verbatim content** of each related file in fenced code blocks (with `### path/to/file` heading and line count). Include ALL files needed for implementation and review — downstream phases read this section instead of re-reading individual source files
   - **Section 5 — Existing Tests**: full content of related test files as code block

### Phase 2: Plan & Tasks

```bash
ls .prizmkit/specs/023-web-button-hover-animation/ 2>/dev/null
```

If plan.md missing, write it directly:
- `plan.md`: key components, data flow, files to create/modify, and a Tasks section with `[ ]` checkboxes (each task = one implementable unit). Keep under 80 lines.

**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement + Test

**Before starting**: detect the test command and record baseline:
```bash
# Try in order, use first that exits 0
node --test tests/**/*.test.js 2>&1 | tail -3   # Node built-in
npm test 2>&1 | tail -3                          # npm fallback
```
Record the working command as `TEST_CMD`. Then record baseline failures (if any):
```bash
$TEST_CMD 2>&1 | tee /tmp/test-baseline.txt | tail -20
```

For each task in plan.md Tasks section:
1. Read the relevant section from `context-snapshot.md` (no need to re-read individual files)
2. Write/edit the code
3. Run tests after each task: `$TEST_CMD 2>&1 | tee /tmp/test-out.txt | tail -20` — then grep `/tmp/test-out.txt` for failure details; never re-run just to apply a different filter
4. Mark task `[x]` in plan.md Tasks section immediately

After all tasks complete:
1. Run the full test suite to ensure nothing is broken
2. Verify each acceptance criterion from Section 1 of context-snapshot.md is met — check mentally, do NOT re-read files you already wrote
3. If any criterion is not met, fix it now (max 2 fix rounds)

**CP-2**: All acceptance criteria met, all tests pass.

After verification, append to `context-snapshot.md`:
```
## Implementation Log
Files changed/created: [list]
Key decisions: [list]
```

### Phase 4: Architecture Sync & Commit

**4a.** Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index) and platform memory files:
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES from completed work into `.prizm-docs/`
3. **Memory sedimentation** (feature sessions only): Sediment DECISIONS and interface conventions to platform memory file (`CLAUDE.md` for Claude Code, BOTH `CODEBUDDY.md` AND `memory/MEMORY.md` for CodeBuddy)
4. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

**4b. Commit** — Run `/prizmkit-committer` → `feat(F-023): Web Button Hover Animation`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**4c. Final Clean Check** — Verify repository is clean:

```bash
git status --short
```

**Note**: The pipeline runner will auto-commit any remaining dirty files after your session exits. You do NOT need to manually commit pipeline state files (`dev-pipeline/state/`) or runtime logs — just focus on committing your feature code via `/prizmkit-committer`.

If any feature-related source files remain uncommitted, stage them **explicitly by name** (do NOT use `git add -A`) and create a follow-up commit:

```bash
git add <specific-file-1> <specific-file-2>
git commit -m "chore(F-023): include session artifacts"
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/023-web-button-hover-animation/` |
| Context Snapshot | `.prizmkit/specs/023-web-button-hover-animation/context-snapshot.md` |
| Project Root | /Users/loneyu/SelfProjects/PrizmClaw |

## Reminders

- Tier 1: you handle everything directly — no subagents needed
- MANDATORY skills: `/prizmkit-retrospective`, `/prizmkit-committer` — never skip these
- Build context-snapshot.md FIRST; use it throughout instead of re-reading files
- `/prizmkit-committer` is mandatory — do NOT skip the commit phase, and do NOT replace it with manual git commit commands
- Before exiting, commit your feature code via `/prizmkit-committer` — the pipeline runner auto-commits any remaining files after session exit
- When staging leftover files in the final clean check, always use explicit file names — NEVER use `git add -A`
