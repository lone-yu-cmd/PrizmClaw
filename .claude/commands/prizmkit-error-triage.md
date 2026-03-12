---
description: [Tier 2] Error categorization and root cause analysis via pattern matching. Checks Prizm TRAPS for known issues; no runtime debugger. (project)
---

# PrizmKit Error Triage

Systematically categorize errors, perform root cause analysis, and check Prizm docs TRAPS for known patterns.

## Commands

### `/prizmkit-error`-triage \<error-description-or-log\>

Triage an error by classifying it, identifying root cause, and suggesting fixes.

**STEPS:**

1. Parse error input (stack trace, error message, log snippet, or user description)
2. Classify error category:
   - **Runtime**: null reference, type error, out of bounds, division by zero
   - **Network**: timeout, DNS resolution, connection refused, SSL/TLS handshake
   - **Auth**: 401/403 responses, token expired, permission denied, CORS
   - **Data**: validation failure, serialization error, encoding mismatch, corruption
   - **Resource**: OOM, disk full, connection pool exhausted, file handle leak
   - **Logic**: incorrect output, race condition, deadlock, infinite loop
   - **Config**: missing env var, wrong endpoint, version mismatch, malformed config
   - **External**: third-party API failure, dependency bug, upstream service degradation
3. Check `.prizm-docs/` for known issues:
   - Read TRAPS sections of affected modules for documented pitfalls
   - Check DECISIONS sections for prior choices that may relate to the error
4. If known trap matches:
   - Suggest documented solution from TRAPS
   - Reference the specific `.prizm-docs/` file and entry
5. If no match: analyze root cause from first principles:
   a. Identify the error origin (file, line, function) from stack trace or context
   b. Trace the call chain to find the triggering condition
   c. Identify the most likely root cause
   d. Suggest fix approach with specific code pointers
6. Generate structured triage report:
   - **Category and subcategory**: e.g., Runtime > NullReference
   - **Root cause**: confirmed or suspected, with reasoning
   - **Affected files/modules**: list of files involved in the error path
   - **Suggested fix**: concrete steps or code changes to resolve
   - **Prevention**: what check, test, or guard would have caught this earlier
7. Suggest updating `.prizm-docs/` TRAPS section with newly discovered pitfalls to prevent recurrence

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-error-triage` placeholder for cross-IDE compatibility.

## Output

- Structured triage report printed to console
- Suggestion to update `.prizm-docs/` TRAPS with new findings
