---
description: "Prefer Linux/Unix commands for shell operations"
---

When writing or suggesting shell commands:
1. Prefer standard Linux/Unix commands (ls, grep, find, cat, sed, awk, etc.)
2. Avoid PowerShell, Windows CMD, or macOS-specific commands unless the target is explicitly Windows
3. Use POSIX-compliant syntax when possible for cross-platform compatibility
4. For file operations, prefer: cp, mv, rm, mkdir, chmod over GUI or platform-specific tools
