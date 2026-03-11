---
name: prizmkit-committer
description: Commit workflow with automatic Prizm doc updates, changelog management, and learning capture. Invoke when user wants to commit, finish task, or ship changes. (project)
---

# PrizmKit Committer

Automated commit workflow that keeps Prizm documentation in sync, manages changelog entries, and captures learnings from each commit.

### When to Use
- User says "commit", "提交", "finish", "done with this task", "ship it"
- After implementing a feature or fixing a bug
- CodeBuddy: the UserPromptSubmit hook will remind to use this skill
- Claude Code: the `.claude/rules/prizm-commit-workflow.md` rule will enforce this

### Workflow

Follow these steps STRICTLY in order:

#### Step 1: Status Check
```bash
git status
```
- If "nothing to commit, working tree clean": inform user and stop
- If there are changes: proceed

#### Step 2: Prizm Documentation Update (CRITICAL — must complete before commit)

2a. Get changed files:
```bash
git diff --cached --name-status
```
If nothing staged, also check:
```bash
git diff --name-status
```

2b. Read .prizm-docs/root.prizm to get MODULE_INDEX

2c. Map each changed file to its module using MODULE_INDEX paths

2d. For each affected module:
- IF L2 doc exists (.prizm-docs/<module>/<submodule>.prizm):
  - Update KEY_FILES (add new files, remove deleted, note modified)
  - Update INTERFACES (if public signatures changed)
  - Update DEPENDENCIES (if imports changed)
  - Append to module CHANGELOG section
  - Update UPDATED timestamp
- IF L1 doc exists (.prizm-docs/<module>.prizm):
  - Update FILES count
  - Update KEY_FILES (if major files added/removed)
  - Update UPDATED timestamp
- Update root.prizm:
  - Update MODULE_INDEX file counts (only if counts changed)
  - UPDATED timestamp (only if structural changes)

2e. Append to .prizm-docs/changelog.prizm:
Format: `- YYYY-MM-DD | <module-path> | <verb>: <one-line description>`
Verbs: add, update, fix, remove, refactor, rename, deprecate

2f. Stage prizm docs:
```bash
git add .prizm-docs/
```

SKIP CONDITIONS for doc update:
- Only internal implementation changed (no interface/dependency change)
- Only comments, whitespace, or formatting changed
- Only test files changed
- Only .prizm files changed (avoid circular updates)
- Bug fixes to existing features (bugs are incomplete features being refined, not new functionality — no new doc entries needed)

#### Step 3: Diff Analysis
```bash
git diff HEAD
```
Analyze:
- Type: feat, fix, refactor, docs, test, chore, perf, style, ci, build
- Scope: affected module name
- Description: imperative mood summary

#### Step 4: Update CHANGELOG.md
If CHANGELOG.md exists, append entry following Keep a Changelog format.
If manage_changelog.py exists in skill scripts:
```bash
python3 ${SKILL_DIR}/scripts/manage_changelog.py add --type <type> --message "<description>"
```

#### Step 5: Git Commit

5a. Safety check before staging:
```bash
git diff --name-only
git ls-files --others --exclude-standard
```
Review the output for sensitive files. If any file matches these patterns, **STOP and warn the user**:
- `.env`, `.env.*`
- `*.key`, `*.pem`, `*.p12`
- `credentials.*`, `*secret*`
- `*.sqlite`, `*.db` (database files)

5b. Stage and commit:
```bash
git add -A
git diff --cached --name-only
```
Review staged file list one final time, then:
```bash
git commit -m "<type>(<scope>): <description>"
```
Follow Conventional Commits format.

#### Step 6: Verification
```bash
git log -1 --stat
```
Confirm the commit was recorded.

Then verify working tree is clean:
```bash
git status
```
- If "nothing to commit, working tree clean": commit verified successfully, proceed
- If there are uncommitted changes remaining: **STOP** and report error — all changes must be captured in the commit. Run `git add -A && git commit --amend --no-edit` to include missed files, then re-verify

#### Step 7: Optional Push
Ask user: "Push to remote?"
- Yes: `git push`
- No: Stop

### Error Handling
- If git diff is empty but untracked files exist: run `git add -N .` first (respects .gitignore)
- If CHANGELOG.md script fails: update manually or ask user
- If .prizm-docs/ doesn't exist: skip Step 2 entirely (project not initialized)
- If sensitive files are detected during Step 5a safety check: warn user and do NOT stage them automatically
