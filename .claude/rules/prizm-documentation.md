---
description: "PrizmKit documentation rules"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.rs"
  - "**/*.java"
---

When modifying source files in this project:
1. Check if `.prizm-docs/root.prizm` exists
2. If it does, read it before making changes to understand project structure
3. After making changes, update affected `.prizm-docs/` files
4. Follow the Prizm doc format (KEY: value, not prose)
5. Size limits: L0 = 4KB, L1 = 3KB, L2 = 5KB
