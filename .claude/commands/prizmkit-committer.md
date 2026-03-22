---
description: "Pure git commit workflow with safety checks. Stages files, analyzes diff, generates Conventional Commits message, and commits. Does NOT modify .prizm-docs/ or memory files — architecture sync and memory sedimentation are handled by /prizmkit-retrospective before this skill is invoked. Trigger on: 'commit', 'submit', 'finish', 'done', 'ship it', 'save my work'. (project)"
---

# PrizmKit Committer

Pure git commit workflow. Analyzes changes, generates a Conventional Commits message, performs safety checks, and commits.

**This skill is a pure git commit tool. It does NOT modify any project files — no `.prizm-docs/`, no memory files, no source code.** It only reads diffs, generates a commit message, and commits. For feature/refactor workflows, run `/prizmkit-retrospective` before this skill to sync `.prizm-docs/` (architecture index) and sediment DECISIONS to memory files. For bug fixes, skip retrospective entirely — bug fixes do not update `.prizm-docs/`.

### When to Use
- User says "commit", "submit", "finish", "done with this task", "ship it"
- After `/prizmkit-retrospective` has finished architecture sync and memory sedimentation
- The UserPromptSubmit hook will remind to use this skill when commit intent is detected

### Workflow

Follow these steps STRICTLY in order:

#### Step 1: Status Check
```bash
git status
```
- If "nothing to commit, working tree clean": inform user and stop
- If there are changes: proceed

#### Step 2: Condense Commit
By consulting the primary agent or based on the existing context, condense this commit message.

#### Step 3: Update CHANGELOG.md
If CHANGELOG.md exists in the project root, append an entry following Keep a Changelog format under the `[Unreleased]` section. Match the existing style in the file.

#### Step 4: Git Commit
```bash
git add .
```
```bash
git commit -m "<type>(<scope>): <description>"
```
Follow Conventional Commits format.

#### Step 5: Verification
```bash
git log -1 --stat
```
Confirm the commit was recorded.

Then verify working tree is clean:
```bash
git status
```
- If "nothing to commit, working tree clean": commit verified successfully, proceed

#### Step 6: Optional Push
Ask user: "Push to remote?"
- Yes: `git push`
- No: Stop

## Example

**Feature commit:**
```
git commit -m "feat(avatar): add user avatar upload with S3 storage"
```

**Bug fix commit:**
```
git commit -m "fix(auth): handle null token in refresh flow"
```
