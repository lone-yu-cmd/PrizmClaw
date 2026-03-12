---
description: [Tier 1] Generate minimal reproduction scripts and test cases from bug descriptions. AI strength in test/script generation. (project)
---

# PrizmKit Bug Reproducer

Generate minimal reproduction scripts and test cases from bug descriptions to isolate, confirm, and verify fixes.

## Commands

### `/prizmkit-bug`-reproduce \<bug-description\>

Generate a minimal reproduction for a reported bug.

**STEPS:**

1. Parse bug description: extract expected vs actual behavior, steps to reproduce (if given), environment details
2. Read `.prizm-docs/` for relevant module context, paying special attention to TRAPS sections that may document known pitfalls
3. Identify affected code path from description:
   - Map user-facing behavior to source code modules
   - Identify entry points and data flow
4. Generate minimal reproduction based on bug type:
   a. **For API bugs**: Generate curl/HTTP request sequence
      - Include headers, authentication, request body
      - Show expected vs actual response
      - Add assertions on status code and response body
   b. **For UI bugs**: Generate step-by-step user interaction guide
      - Numbered steps with specific UI elements to interact with
      - Screenshot annotation points (where to look)
      - Browser/device requirements if relevant
   c. **For logic bugs**: Generate unit test that demonstrates the failure
      - Minimal test case with clear arrange/act/assert
      - Test name describes the expected behavior
      - Comments explaining why this should pass
   d. **For data bugs**: Generate seed data + query sequence
      - Minimal dataset that triggers the issue
      - Query or operation sequence to reproduce
      - Expected vs actual result comparison
5. Write reproduction script/test to a temporary file:
   - Use project's existing test framework and conventions
   - Include setup and teardown
   - Make it self-contained and runnable
6. Include assertions that:
   - FAIL with current (buggy) behavior
   - PASS with expected (correct) behavior
   - Serve as regression test after fix is applied
7. Output:
   - Reproduction file path
   - Minimal steps document describing how to run
   - Suggested fix investigation starting points

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-bug-reproducer` placeholder for cross-IDE compatibility.

## Output

- Reproduction script or test file written to project's test directory
- Minimal steps document printed to console
- Investigation pointers for the fix
