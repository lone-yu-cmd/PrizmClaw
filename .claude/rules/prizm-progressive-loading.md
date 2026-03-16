---
description: "PrizmKit progressive context loading protocol"
---

This project uses PrizmKit's progressive loading protocol:
- ON SESSION START: Read `.prizm-docs/root.prizm` (L0 — project map)
- ON TASK: Read L1 (`.prizm-docs/<module>.prizm`) for relevant modules
- ON FILE EDIT: Read L2 (`.prizm-docs/<module>/<submodule>.prizm`) before modifying
- NEVER load all .prizm docs at once
- Arrow notation (->) in .prizm files indicates load pointers
- DECISIONS and CHANGELOG in .prizm files are append-only
