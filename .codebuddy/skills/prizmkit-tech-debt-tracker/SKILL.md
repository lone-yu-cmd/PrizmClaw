---
name: prizmkit-tech-debt-tracker
tier: 1
description: [Tier 1] Identify and track technical debt via code pattern analysis. Scans TODOs, complexity hotspots, code smells. AI strength. (project)
---

# PrizmKit Tech Debt Tracker

Systematic technical debt identification and tracking. Scans the codebase for code smells, TODO markers, complexity hotspots, missing tests, and other debt indicators. Generates a prioritized report with actionable recommendations.

### When to Use
- User says "tech debt", "code quality", "what needs cleanup"
- During sprint planning to identify maintenance work
- Before major refactoring efforts
- Periodically as part of codebase health monitoring

### prizmkit.tech-debt

### Steps

#### Step 1: Load Project Context
Read .prizm-docs/ for:
- Project structure and module boundaries
- Tech stack and language conventions
- Existing architecture documentation

#### Step 2: Scan for Debt Indicators

**TODO/FIXME/HACK/XXX Markers**
- Search all source files for marker comments
- Categorize by file and module
- Extract context (the comment text and surrounding code)

**Complexity Hotspots**
- Files exceeding 500 lines of code
- Deeply nested logic (4+ levels of nesting)
- Functions/methods exceeding 100 lines
- High cyclomatic complexity (many branches/conditions)

**Code Duplication**
- Similar code blocks appearing across multiple files
- Copy-pasted logic with minor variations
- Repeated patterns that could be abstracted

**Missing Tests**
- Source files without corresponding test files
- Public APIs without test coverage
- Critical paths without integration tests

**Outdated Patterns**
- Deprecated API usage
- Old language syntax (var instead of let/const, callbacks instead of async/await)
- Legacy framework patterns

**Dead Code**
- Unused imports and variables
- Unreachable code blocks
- Commented-out code blocks (>5 lines)
- Exported functions with no consumers

**Poor Naming**
- Single-letter variables outside of loops/lambdas
- Misleading names (obvious cases only)
- Inconsistent naming conventions within a module

**Missing Documentation**
- Public APIs without doc comments
- Complex functions without explanatory comments
- Missing README in significant directories

#### Step 3: Calculate Debt Score
Per module:
- CRITICAL issues: weight x4 (security-adjacent, data-loss risk)
- HIGH issues: weight x3 (maintainability blockers)
- MEDIUM issues: weight x2 (code quality)
- LOW issues: weight x1 (best practices)

Normalize by module size (lines of code) to get debt density.

#### Step 4: Generate Prioritized Report
Write to .prizmkit/tech-debt.md (overwrite each run):

```markdown
# Technical Debt Report
Generated: YYYY-MM-DD

## Summary
- Total debt items: N
- Critical: N | High: N | Medium: N | Low: N
- Modules scanned: N

## Top 10 Hotspots (by debt score)
| Rank | Module/File | Score | Top Issues |
|------|-------------|-------|------------|
| 1    | path/file   | 42    | complexity, missing tests |

## Debt by Category
| Category | Count | Severity Breakdown |
|----------|-------|--------------------|
| TODO markers | N | H:N M:N L:N |
| Complexity | N | C:N H:N M:N |
| Missing tests | N | H:N M:N |
| Dead code | N | M:N L:N |
| Duplication | N | M:N L:N |
| Documentation | N | L:N |

## Trend
(If previous report exists in .prizmkit/):
- Previous total: N → Current: N (improving/degrading)
- Categories improving: ...
- Categories degrading: ...

## Detailed Findings

### Critical
- [File:Line] Description | Impact | Suggested Fix

### High
- [File:Line] Description | Impact | Suggested Fix

### Medium
...

### Low
...
```

#### Step 5: Output Summary
Display to conversation:
- Overall debt score and trend
- Top 3 highest-impact items to address first
- Estimated effort categories (quick fix / medium effort / large refactor)

#### Step 6: Suggest Action Items
Recommend top 3 highest-impact debt items to address first, considering:
- Severity (critical > high > medium > low)
- Blast radius (how many modules affected)
- Effort to fix (prefer quick wins)
- Risk if left unaddressed
