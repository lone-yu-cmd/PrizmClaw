---
name: prizmkit-perf-profiler
tier: 2
description: [Tier 2] Static analysis for potential performance issues with profiling tool recommendations. Does not measure actual runtime performance. (project)
---

# PrizmKit Performance Profiler

Identify performance bottlenecks through static code analysis and profiling guidance. Suggests targeted optimizations with expected impact.

## Commands

### prizmkit.perf-profile [module-or-file]

Analyze code for performance bottlenecks and generate optimization recommendations.

**STEPS:**

1. Read `.prizm-docs/` for architecture and module relationships (dependencies, data flow, hot paths)
2. If specific file/module given: focus analysis on that scope; otherwise analyze project-wide critical paths
3. Analyze for common bottleneck patterns:
   - **N+1 queries**: ORM/database calls inside loops
   - **Missing indexes**: queries filtering or sorting on unindexed columns
   - **Synchronous blocking in async code**: blocking I/O in async handlers, missing await
   - **Unnecessary serialization/deserialization**: repeated JSON parse/stringify, redundant marshaling
   - **Memory leaks**: growing collections without bounds, unclosed resources, event listener accumulation
   - **Inefficient algorithms**: O(n^2) where O(n) or O(n log n) is possible, nested loops over large datasets
   - **Missing caching opportunities**: repeated expensive computations or external calls with stable inputs
   - **Excessive logging in hot paths**: string formatting and I/O in tight loops
   - **Large payload transfers**: over-fetching from database, sending unnecessary fields to client
   - **Connection management**: not reusing connections, missing connection pooling
4. Generate profiling recommendations:
   - Suggest profiling tools appropriate for the project's tech stack:
     - Node.js: `--prof`, `clinic.js`, `0x`
     - Python: `cProfile`, `py-spy`, `line_profiler`
     - Java: JFR, async-profiler, VisualVM
     - Go: `pprof`, `trace`
     - Rust: `perf`, `flamegraph`, `criterion`
   - Provide specific commands to run the profiler against the identified hot paths
   - Identify measurement baselines to establish before optimizing
5. Output performance report:
   - **Suspected bottlenecks**: ranked by likely impact (HIGH / MEDIUM / LOW)
   - **Suggested optimizations**: for each bottleneck, concrete code changes or architectural adjustments
   - **Profiling commands**: copy-paste ready commands to validate each suspicion
   - **Expected impact**: qualitative assessment of improvement (e.g., "Eliminates N+1, expect ~10x query reduction for list endpoints")
6. Suggest updating `.prizm-docs/` TRAPS section with discovered performance pitfalls for future reference

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- Performance analysis report printed to console
- Profiling command suggestions ready to execute
