# Dev-Pipeline Session Bootstrap — Tier 2 (Dual Agent)

## Session Context

- **Feature ID**: {{FEATURE_ID}} | **Session**: {{SESSION_ID}} | **Run**: {{RUN_ID}}
- **Complexity**: {{COMPLEXITY}} | **Retry**: {{RETRY_COUNT}} / {{MAX_RETRIES}}
- **Previous Status**: {{PREV_SESSION_STATUS}} | **Resume From**: {{RESUME_PHASE}}
- **Init**: {{INIT_DONE}} | Artifacts: spec={{HAS_SPEC}} plan={{HAS_PLAN}}

## Your Mission

You are the **session orchestrator**. Implement Feature {{FEATURE_ID}}: "{{FEATURE_TITLE}}".

**CRITICAL**: You MUST NOT exit until ALL work is complete and committed. When you spawn subagents, wait for each to finish (run_in_background=false).

**Tier 2 — Dual Agent**: You handle context + planning directly. Then spawn Dev and Reviewer subagents. Spawn Dev and Reviewer agents via the Agent tool.

### Feature Description

{{FEATURE_DESCRIPTION}}

### Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

### Dependencies (Already Completed)

{{COMPLETED_DEPENDENCIES}}

### App Global Context

{{GLOBAL_CONTEXT}}

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
.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md  ← orchestrator writes Sections 1-4; Dev appends Implementation Log; Reviewer appends Review Notes
.prizmkit/specs/{{FEATURE_SLUG}}/plan.md              ← includes Tasks section
```

**`context-snapshot.md`** is the shared knowledge base. Orchestrator writes Sections 1-4; Dev appends Implementation Log; Reviewer appends Review Notes. Append-only after initial creation.

---

## Subagent Timeout Recovery

If any agent times out:
1. `ls .prizmkit/specs/{{FEATURE_SLUG}}/` — check what exists
2. If `context-snapshot.md` exists: open recovery prompt with `"Read .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md for project context and any Implementation Log/Review Notes from previous agents. Run git diff HEAD to see actual code changes already made. Do NOT re-read individual source files unless the File Manifest directs you to."` + only remaining steps + `model: "lite"`
3. Max 2 retries per phase. After 2 failures, orchestrator completes the work directly and appends a Recovery Note to context-snapshot.md.

---

## Execution

{{IF_INIT_NEEDED}}
### Phase 0: Project Bootstrap
- Run `/prizmkit-init` (invoke the prizmkit-init skill)
- Run `python3 {{INIT_SCRIPT_PATH}} --project-root {{PROJECT_ROOT}} --feature-id {{FEATURE_ID}} --feature-slug {{FEATURE_SLUG}}`
- **CP-0**: Verify `.prizm-docs/root.prizm`, `.prizmkit/config.json` exist
{{END_IF_INIT_NEEDED}}
{{IF_INIT_DONE}}
### Phase 0: SKIP (already initialized)
{{END_IF_INIT_DONE}}

{{IF_RESUME}}
### Resume from Phase {{RESUME_PHASE}}
Check `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — if exists, skip Phase 1 and proceed to Phase {{RESUME_PHASE}}.
{{END_IF_RESUME}}

### Phase 1: Build Context Snapshot (you, the orchestrator)

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING — build it now:
1. Read `.prizm-docs/root.prizm` and relevant L1/L2 prizm docs
2. Scan `src/` for files related to this feature; read each one
3. Write `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
   - **Section 1 — Feature Brief**: feature description + acceptance criteria (copy from above)
   - **Section 2 — Project Structure**: relevant `ls src/` output
   - **Section 3 — Prizm Context**: full content of root.prizm and relevant L1/L2 docs
   - **Section 4 — File Manifest**: For each file relevant to this feature, list: file path, why it's needed (modify/reference/test), key interface signatures (function names + params + return types). Do NOT include full file content — agents read files on-demand. Format:
     ### Files to Modify
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `src/config.js` | Add runtime config layer | `config` (Zod object), `configSchema` |

     ### Files for Reference
     | File | Why Needed | Key Interfaces |
     |------|-----------|----------------|
     | `src/security/permission-guard.js` | Permission check integration | `checkCommandPermission(userId, cmd)` |

     ### Known TRAPS (from .prizm-docs/)
     - <trap entries extracted from L1/L2 docs>

### Phase 2: Plan & Tasks (you, the orchestrator)

```bash
ls .prizmkit/specs/{{FEATURE_SLUG}}/plan.md 2>/dev/null
```

If either missing, write them yourself:
- `plan.md`: architecture — components, interfaces, data flow, files to create/modify, testing approach, and a Tasks section with `[ ]` checkboxes ordered by dependency
**CP-1**: plan.md exists with Tasks section.

### Phase 3: Implement — Dev Subagent

Spawn Dev subagent (Agent tool, subagent_type="prizm-dev-team-dev", run_in_background=false).

Prompt:
> "Read {{DEV_SUBAGENT_PATH}}. Implement feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}) using TDD.
> **IMPORTANT**: Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` — Section 3 has Prizm Context (TRAPS/RULES), Section 4 has File Manifest with paths and interfaces.
>    **⚠️ DO NOT re-read source files that are already listed in Section 4 File Manifest.** Only read a source file directly if: (a) NOT in the manifest, (b) needing an implementation detail beyond the interface summary, or (c) needing a constant/enum/field-name value not captured in the interface column.
> 2. Read `plan.md` (including Tasks section) from `.prizmkit/specs/{{FEATURE_SLUG}}/`.
> 3. Implement task-by-task. Mark each `[x]` in plan.md Tasks section **immediately** after completion (do NOT batch).
> 4. Use `TEST_CMD=<TEST_CMD>` to run tests — do NOT explore alternative test commands. **When tests fail: run `$TEST_CMD 2>&1 | tee /tmp/test-out.txt` ONCE, then grep `/tmp/test-out.txt` for failure details. Never re-run the full suite just to apply a different filter.**
> 5. After ALL tasks done, append '## Implementation Log' to context-snapshot.md with:
>    - Files changed/created (with paths)
>    - Key implementation decisions and rationale
>    - Deviations from plan.md (if any)
>    - Notable discoveries (unexpected behavior, hidden dependencies, new TRAPS)
> 6. Do NOT execute any git commands (no git add/commit/reset/push).
> 7. If `<TEST_CMD>` shows failures, check against BASELINE_FAILURES=`<BASELINE_FAILURES>`. Failures present in the baseline are pre-existing — list them explicitly in your COMPLETION_SIGNAL.
> Do NOT exit until all tasks are [x] and the '## Implementation Log' section is written in context-snapshot.md."

Wait for Dev to return. All tasks must be `[x]`, tests pass.

**Gate Check — Implementation Log**:
After Dev agent returns, verify the Implementation Log was written:
```bash
grep -q "## Implementation Log" .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md && echo "GATE:PASS" || echo "GATE:MISSING"
```
If GATE:MISSING — send message to Dev (re-spawn if needed): "Write the '## Implementation Log' section to context-snapshot.md before I can proceed to review. Include: files changed/created, key decisions, deviations from plan, notable discoveries."

### Phase 4: Review + Test — Reviewer Subagent

Spawn Reviewer subagent (Agent tool, subagent_type="prizm-dev-team-reviewer", run_in_background=false).

Prompt:
> "Read {{REVIEWER_SUBAGENT_PATH}}. For feature {{FEATURE_ID}} (slug: {{FEATURE_SLUG}}):
> **IMPORTANT**: Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` FIRST.
> 1. Read `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md`:
>    - Section 3: Prizm Context (RULES, PATTERNS to check against)
>    - Section 4: File Manifest (original file structure)
>    - '## Implementation Log': what Dev changed, key decisions, discoveries
> 2. Run prizmkit-code-review: spec compliance (against spec.md), code quality, correctness. Read ONLY files listed in Implementation Log.
> 3. Run the full test suite — **ONLY if the Implementation Log does not already confirm all tests passing**. If the log states tests passed, trust it and skip the re-run. When running: `$TEST_CMD 2>&1 | tee /tmp/review-test-out.txt | tail -20`, then grep the file for details — do NOT re-run the suite multiple times. Write and execute integration tests covering all user stories.
> 4. Append '## Review Notes' to context-snapshot.md: issues found (with severity), test results, final verdict.
> Report verdict: PASS, PASS_WITH_WARNINGS, or NEEDS_FIXES."

Wait for Reviewer to return.

**Gate Check — Review Notes**:
After Reviewer agent returns, verify the Review Notes were written:
```bash
grep -q "## Review Notes" .prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md && echo "GATE:PASS" || echo "GATE:MISSING"
```
If GATE:MISSING — send message to Reviewer (re-spawn if needed): "Write the '## Review Notes' section to context-snapshot.md. Include: issues found (severity), test results, final verdict."

- If NEEDS_FIXES: spawn Dev to fix (Dev reads updated snapshot), re-run Review (max 3 rounds)

**CP-2**: Tests pass, verdict is not NEEDS_FIXES.

### Phase 5: Architecture Sync & Commit

**5a.** Run `/prizmkit-retrospective` — maintains `.prizm-docs/` (architecture index):
1. **Structural sync**: Use `git diff --cached --name-status` to locate changed modules, update KEY_FILES/INTERFACES/DEPENDENCIES/file counts in affected `.prizm-docs/` files
2. **Architecture knowledge** (feature sessions only): Extract TRAPS/RULES/DECISIONS from completed work into `.prizm-docs/`
3. Stage all doc changes: `git add .prizm-docs/`

Doc maintenance pass condition (pipeline-enforced): `.prizm-docs/` changed in the final commit.

**5b. Commit** — Run `/prizmkit-committer` → `feat({{FEATURE_ID}}): {{FEATURE_TITLE}}`, do NOT push
- MANDATORY: commit must be done via `/prizmkit-committer` skill. Do NOT run manual `git add`/`git commit` as a substitute.
- Do NOT run `update-feature-status.py` here — the pipeline runner handles feature-list.json updates automatically after session exit.

**5c. Final Clean Check** — Verify repository is clean:

```bash
git status --short
```

**Note**: The pipeline runner will auto-commit any remaining dirty files after your session exits. You do NOT need to manually commit pipeline state files (`dev-pipeline/state/`) or runtime logs — just focus on committing your feature code via `/prizmkit-committer`.

If any feature-related source files remain uncommitted, stage them **explicitly by name** (do NOT use `git add -A`) and create a follow-up commit:

```bash
git add <specific-file-1> <specific-file-2>
git commit -m "chore({{FEATURE_ID}}): include session artifacts"
```

## Critical Paths

| Resource | Path |
|----------|------|
| Feature Artifacts Dir | `.prizmkit/specs/{{FEATURE_SLUG}}/` |
| Context Snapshot | `.prizmkit/specs/{{FEATURE_SLUG}}/context-snapshot.md` |
| Dev Agent Def | {{DEV_SUBAGENT_PATH}} |
| Reviewer Agent Def | {{REVIEWER_SUBAGENT_PATH}} |
| Project Root | {{PROJECT_ROOT}} |

## Reminders

- Tier 2: orchestrator builds context+plan, Dev implements, Reviewer reviews+tests — use direct Agent spawn for agents
- Build context-snapshot.md FIRST; all subagents read it instead of re-reading source files
- context-snapshot.md is append-only: orchestrator writes Sections 1-4, Dev appends Implementation Log, Reviewer appends Review Notes
- Gate checks enforce Implementation Log and Review Notes are written before proceeding
- Do NOT use `run_in_background=true` when spawning subagents
- `/prizmkit-committer` is mandatory, and must not be replaced with manual git commit commands
- Before exiting, commit your feature code via `/prizmkit-committer` — the pipeline runner auto-commits any remaining files after session exit
- When staging leftover files in the final clean check, always use explicit file names — NEVER use `git add -A`
- On timeout: check snapshot + git diff HEAD → model:lite → remaining steps only → max 2 retries per phase → orchestrator fallback
