---
description: "PrizmKit commit workflow rules"
---

Before any git commit in this project:
1. Run `/prizmkit-retrospective` to sync `.prizm-docs/` (architecture index) and sediment DECISIONS to memory files
2. Use Conventional Commits format: type(scope): description
3. Bug fixes use `fix()` prefix, not `feat()`
4. Bug fixes run retrospective with structural sync only (Job 1)
5. Use `/prizmkit-committer` command for the pure commit workflow
