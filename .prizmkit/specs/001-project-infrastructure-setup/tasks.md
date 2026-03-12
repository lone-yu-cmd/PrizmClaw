# F-001: Project Infrastructure Setup — Tasks

> Feature: F-001 | Spec: spec.md | Plan: plan.md
> Legend: `[P]` = parallelizable, `[US-N]` = maps to user story N

---

## Phase: Setup (T-001 ~ T-009)

- [x] [T-001] [US-4] Expand tsconfig.json include to `src/**/*.js` and fix blocking type errors — file: `tsconfig.json`
  - **Goal:** Enable `npm run typecheck` across full `src/` tree
  - **Input:** Current `tsconfig.json` (only covers `src/pipeline-infra/` + 1 service)
  - **Output:** Updated `tsconfig.json` with `"include": ["src/**/*.js"]`; zero typecheck errors
  - **AC:** `npm run typecheck` exits 0. No functional behavior change.
  - **Notes:** Keep `strict: false`, `allowJs: true`, `checkJs: true`. Add `@ts-ignore` or JSDoc only where needed to suppress non-blocking errors. Do NOT migrate `.js` to `.ts`.
  - **Complexity:** Medium (unknown number of type errors to triage)

- [x] [T-002] [P] [US-4] Add ESLint recommended rules baseline — file: `eslint.config.js`
  - **Goal:** Establish lint rules that catch real bugs without breaking existing code
  - **Input:** Current `eslint.config.js` (zero rules)
  - **Output:** Config with warn-level rules; `npm run lint` exits 0
  - **AC:** `npm run lint` exits 0 with zero warnings. Rules include at minimum: `no-undef`, `no-debugger`, `no-duplicate-case`, `eqeqeq`.
  - **Notes:** Use `warn` severity for stylistic rules, `error` for definite bugs. Fix any existing violations surfaced. Add `sourceType: 'module'` and `ecmaVersion: 'latest'` globals for Node.
  - **Complexity:** Medium (may need to fix existing lint violations)

---

## Phase: Foundational (T-010 ~ T-099)

- [x] [T-010] [P] [US-3] Add EXIT_CODES constant to error-codes.js — file: `src/pipeline-infra/error-codes.js`
  - **Goal:** Define standardized process exit codes
  - **Input:** Current error-codes.js (has INFRA_ERROR_CODES only)
  - **Output:** New `EXIT_CODES` export: `{ SUCCESS: 0, RUNTIME_ERROR: 1, USAGE_ERROR: 2, TIMEOUT: 124 }`
  - **AC:** Export is importable; existing `INFRA_ERROR_CODES` unchanged; `tests/pipeline-infra/error-codes.test.js` extended with EXIT_CODES tests
  - **Complexity:** Low

- [x] [T-011] [P] [US-2] Add DIRECTORY_CONVENTION constant and resolvePlansPaths to path-policy.js — file: `src/pipeline-infra/path-policy.js`
  - **Goal:** Document canonical directory layout as code; add plans path resolver
  - **Input:** Current path-policy.js (feature/bug/daemon/lock/state path resolvers)
  - **Output:** New `DIRECTORY_CONVENTION` frozen object + `resolvePlansPaths(projectRoot)` function
  - **AC:** `DIRECTORY_CONVENTION` includes keys for pipelineDir, featureStateDir, bugfixStateDir, featureListFile, bugFixListFile, plansDir, specsDir, logsDir. `resolvePlansPaths` returns `{ plansDir: string }`. Existing functions unchanged. Tests extended in `tests/pipeline-infra/path-policy.test.js`.
  - **Complexity:** Low

- [x] [T-012] [P] [US-2] Mirror DIRECTORY_CONVENTION and resolve_plans_paths in Python path_policy.py — file: `dev-pipeline/scripts/path_policy.py`
  - **Goal:** Maintain JS/Python parity for path conventions
  - **Input:** Current path_policy.py (feature/bug/daemon path resolvers)
  - **Output:** New `DIRECTORY_CONVENTION` dict + `resolve_plans_paths(project_root)` function
  - **AC:** Keys and values match JS version exactly. `tests/pipeline-infra/path-policy-python-compat.test.js` extended to verify parity.
  - **Complexity:** Low

- [x] [T-020] [US-1] Add loadAndValidateConfig batch validation to config-loader.js — file: `src/pipeline-infra/config-loader.js`
  - **Goal:** Provide batch config validation that reports ALL errors at once
  - **Input:** Current `loadPipelineInfraConfig` (fail-fast on first error)
  - **Output:** New `loadAndValidateConfig(input)` → `{ ok, config?, errors? }`
  - **AC:** Returns `{ ok: true, config }` when all fields valid. Returns `{ ok: false, errors: [{field, message, hint, code}] }` when any field invalid, listing ALL errors. Existing `loadPipelineInfraConfig` unchanged. Tests added to `tests/pipeline-infra/config-loader.test.js`.
  - **Notes:** Wrap each field's validation in try/catch to accumulate. Reuse existing `parseInteger`, `ensureDirectoryExists`, `toAbsolutePath` helpers internally.
  - **Complexity:** Medium
  - **Depends on:** T-010 (uses EXIT_CODES if integrating with error reporting)

- [x] [T-021] [US-1] Add startup config summary log to src/index.js — file: `src/index.js`
  - **Goal:** Log a structured config summary at startup for diagnostics
  - **Input:** Current `src/index.js` (logs web server address + pipeline dir)
  - **Output:** Enhanced startup log with enableTelegram, webPort, pipelineDir, platform, logLevel
  - **AC:** `logger.info(...)` call includes all key config fields. No circular dependency introduced. Existing startup logs preserved or enhanced.
  - **Complexity:** Low
  - **Depends on:** T-020

---

## Phase: User Stories (T-100+)

- [x] [T-100] [US-3] Create cli-entry.js reusable script entry wrapper — file: `src/pipeline-infra/cli-entry.js` (NEW)
  - **Goal:** Standardize CLI script entry points with argument parsing, config loading, error handling
  - **Input:** Plan C-3 interface specification
  - **Output:** New module exporting `createCliEntry(options)` → `{ run, config, logger, flags, positionalArgs }`
  - **AC:** `createCliEntry({ name: 'test' })` returns context object. `--help` prints usage and exits 2. Unknown flags exit 2. Unhandled errors in `run()` callback exit 1. Timeout exits 124. Logger is pino instance (direct import, no circular dep).
  - **Notes:** Import `pino` directly, not `src/utils/logger.js`, to avoid circular config dependency. Use `loadPipelineInfraConfig` (not loadAndValidateConfig) for config — keep the wrapper lightweight.
  - **Complexity:** Medium
  - **Depends on:** T-010 (EXIT_CODES)

- [x] [T-101] [US-3] Add cli-entry unit tests — file: `tests/pipeline-infra/cli-entry.test.js` (NEW)
  - **Goal:** Verify CLI entry wrapper behavior
  - **Input:** T-100 implementation
  - **Output:** Test file covering: help flag, unknown args, successful run, error handling, exit codes
  - **AC:** All tests pass with `npm run test:unit`. Covers at least 5 scenarios: help, unknown flag, success, runtime error, arg parsing.
  - **Complexity:** Medium
  - **Depends on:** T-100

- [x] [T-102] [US-1] [US-2] [US-3] Update pipeline-infra/index.js re-exports — file: `src/pipeline-infra/index.js`
  - **Goal:** Re-export all new symbols from the barrel file
  - **Input:** Current index.js exports
  - **Output:** Add exports: `loadAndValidateConfig`, `DIRECTORY_CONVENTION`, `resolvePlansPaths`, `EXIT_CODES`, `createCliEntry`
  - **AC:** All new symbols importable via `import { ... } from './pipeline-infra/index.js'`
  - **Complexity:** Low
  - **Depends on:** T-010, T-011, T-020, T-100

---

## Phase: Polish (T-900+)

- [x] [T-900] Verify all existing tests pass — no file change
  - **Goal:** Ensure zero regressions from all F-001 changes
  - **Input:** Complete F-001 implementation
  - **Output:** `npm run test:unit` exits 0; `npm run typecheck` exits 0; `npm run lint` exits 0
  - **AC:** All three commands exit 0. No test failures. No new lint warnings.
  - **Complexity:** Low
  - **Depends on:** T-001, T-002, T-010, T-011, T-012, T-020, T-021, T-100, T-101, T-102

---

## Dependency Graph

```
T-001 ──────────────────────────────────┐
T-002 (P) ──────────────────────────────┤
T-010 (P) ──┬──────────────┬────────────┤
T-011 (P) ──┤              │            │
T-012 (P) ──┤              │            │
             │              ▼            │
             │           T-020 ──► T-021 │
             │              │            │
             ▼              ▼            │
          T-100 ──► T-101               │
             │                           │
             ▼                           │
          T-102                          │
             │                           │
             ▼                           ▼
          T-900 ◄────────────────────────┘
```

## Parallelism Summary

**Wave 1 (all parallel):** T-001, T-002, T-010, T-011, T-012
**Wave 2:** T-020 (depends on T-010)
**Wave 3 (parallel):** T-021 (depends on T-020), T-100 (depends on T-010)
**Wave 4:** T-101 (depends on T-100), T-102 (depends on T-010, T-011, T-020, T-100)
**Wave 5:** T-900 (depends on all)
