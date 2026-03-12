# F-001: Project Infrastructure Setup — Plan

## Architecture Overview

F-001 strengthens the existing `src/pipeline-infra/` module and project-level tooling configs. No new top-level modules are introduced. Changes are confined to:

1. **Config layer** — enhance `config-loader.js` with batch validation
2. **Path layer** — extend `path-policy.js` with directory convention constant + plans path resolver
3. **CLI layer** — new `cli-entry.js` wrapper for standardized script entry points
4. **Error layer** — extend `error-codes.js` with exit code constants
5. **Tooling layer** — expand `tsconfig.json` and `eslint.config.js`

```
src/pipeline-infra/
├── config-loader.js    ← MODIFY (add loadAndValidateConfig, batch errors)
├── path-policy.js      ← MODIFY (add DIRECTORY_CONVENTION, resolvePlansPaths)
├── error-codes.js      ← MODIFY (add EXIT_CODES constant)
├── cli-entry.js        ← NEW (reusable CLI entry wrapper)
├── index.js            ← MODIFY (re-export new symbols)
├── script-runner.js    ← NO CHANGE
├── lock-manager.js     ← NO CHANGE
└── state-manager.js    ← NO CHANGE

dev-pipeline/scripts/
└── path_policy.py      ← MODIFY (add DIRECTORY_CONVENTION, resolve_plans_paths)

Root:
├── tsconfig.json       ← MODIFY (expand include)
├── eslint.config.js    ← MODIFY (add rule baseline)
└── src/config.js       ← MODIFY (use enhanced loader, startup log)
```

## Component Design

### C-1: Enhanced Config Loader (US-1)

**File:** `src/pipeline-infra/config-loader.js`

**Changes:**
- Add `loadAndValidateConfig(input)` — wraps existing `loadPipelineInfraConfig` but collects ALL validation errors before throwing
- Existing `loadPipelineInfraConfig` remains as-is for backward compatibility
- New function returns `{ ok: true, config }` or `{ ok: false, errors: ConfigError[] }`

**Interface:**

```js
/**
 * @typedef {Object} ConfigError
 * @property {string} field - Config field name
 * @property {string} message - Human-readable error description
 * @property {string} [hint] - Resolution suggestion
 * @property {string} code - Error code from INFRA_ERROR_CODES
 */

/**
 * @typedef {Object} ConfigValidationResult
 * @property {boolean} ok
 * @property {import('./config-loader.js').PipelineInfraConfig} [config] - Present when ok=true
 * @property {ConfigError[]} [errors] - Present when ok=false
 */

/** @returns {ConfigValidationResult} */
export function loadAndValidateConfig(input = {}) {}
```

**Strategy:** Wrap each field validation in try/catch, accumulate errors, return batch result. Does NOT replace the existing `loadPipelineInfraConfig` (which keeps fail-fast behavior for callers that prefer it).

### C-2: Directory Convention & Plans Paths (US-2)

**File:** `src/pipeline-infra/path-policy.js`

**New exports:**

```js
/**
 * Canonical directory layout relative to projectRoot.
 * @type {Readonly<Record<string, string>>}
 */
export const DIRECTORY_CONVENTION = Object.freeze({
  pipelineDir:      'dev-pipeline',
  featureStateDir:  'dev-pipeline/state',
  bugfixStateDir:   'dev-pipeline/bugfix-state',
  featureListFile:  'feature-list.json',
  bugFixListFile:   'bug-fix-list.json',
  plansDir:         'plans',
  specsDir:         '.prizmkit/specs',
  logsDir:          'logs',
  sessionLogsDir:   'dev-pipeline/state/features/{featureId}/sessions/{sessionId}/logs',
  daemonLogFile:    'dev-pipeline/state/pipeline-daemon.log',
});

/**
 * Resolve plans directory path.
 * @param {string} projectRoot
 * @returns {{ plansDir: string }}
 */
export function resolvePlansPaths(projectRoot) {}
```

**File:** `dev-pipeline/scripts/path_policy.py`

Add matching `DIRECTORY_CONVENTION` dict and `resolve_plans_paths(project_root)` function.

### C-3: CLI Entry Wrapper (US-3)

**File:** `src/pipeline-infra/cli-entry.js` (NEW)

```js
/**
 * @typedef {Object} CliEntryOptions
 * @property {string} name - Script name (for --help and error messages)
 * @property {string} [description] - Script description
 * @property {string[]} [requiredArgs] - Required positional arg names
 * @property {Record<string, {type: 'string'|'boolean'|'number', default?: any, description?: string}>} [flags]
 */

/**
 * @typedef {Object} CliEntryContext
 * @property {Function} run - Execute the main function with error handling
 * @property {object} config - Loaded pipeline infra config
 * @property {object} logger - Pino logger instance
 * @property {Map<string, any>} flags - Parsed flags
 * @property {string[]} positionalArgs - Remaining positional arguments
 */

/**
 * Creates a CLI entry point with standardized behavior.
 * @param {CliEntryOptions} options
 * @returns {CliEntryContext}
 */
export function createCliEntry(options) {}
```

**Exit code convention:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Runtime error |
| 2 | Usage error (bad args, --help) |
| 124 | Timeout |

### C-4: Exit Code Constants (US-3)

**File:** `src/pipeline-infra/error-codes.js`

```js
export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  RUNTIME_ERROR: 1,
  USAGE_ERROR: 2,
  TIMEOUT: 124,
});
```

### C-5: TypeScript Config Expansion (US-4)

**File:** `tsconfig.json`

```json
{
  "include": [
    "src/**/*.js"
  ]
}
```

Strategy: Expand from partial include to full `src/**/*.js`. Keep `strict: false`, `allowJs: true`, `checkJs: true`, `noEmit: true`. Fix any resulting type errors by adding JSDoc annotations or `@ts-ignore` where needed (minimal, targeted fixes only).

### C-6: ESLint Rules Baseline (US-4)

**File:** `eslint.config.js`

Add a baseline ruleset that won't break existing code:

```js
rules: {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  'no-undef': 'error',
  'no-constant-condition': 'warn',
  'no-debugger': 'error',
  'no-duplicate-case': 'error',
  'no-empty': 'warn',
  'eqeqeq': ['warn', 'always'],
}
```

Strategy: Start with warnings (not errors) for stylistic rules. Run `npm run lint` and fix any issues that surface in existing code.

### C-7: Config.js Startup Summary (US-1)

**File:** `src/config.js`

After config loading, log a structured summary:
```js
logger.info({
  enableTelegram,
  webPort: parsed.WEB_PORT,
  pipelineDir: pipelineInfra.pipelineDir,
  platform: pipelineInfra.platform,
  logLevel: parsed.LOG_LEVEL,
}, 'Config loaded successfully');
```

Note: Logger import creates a circular dependency concern (`logger.js` imports `config.js`). Resolution: use `pino` directly in the startup summary, or defer the log to `index.js` (preferred — `index.js` already has the logger).

## Data Model

No new data models. This feature operates on configuration and path conventions only.

**Existing models referenced:**
- `PipelineInfraConfig` — frozen config object from `config-loader.js`
- `InfraError` — `{ code, message, hint?, context? }` from `error-codes.js`

**New type added:**
- `ConfigValidationResult` — `{ ok: boolean, config?: PipelineInfraConfig, errors?: ConfigError[] }`

## Module Dependencies

```
src/config.js
  → src/pipeline-infra/config-loader.js (loadPipelineInfraConfig / loadAndValidateConfig)
  → src/pipeline-infra/path-policy.js (resolveDaemonLogPaths)

src/pipeline-infra/cli-entry.js (NEW)
  → src/pipeline-infra/config-loader.js (loadPipelineInfraConfig)
  → src/pipeline-infra/error-codes.js (EXIT_CODES)
  → pino (direct import, no circular dependency)

src/pipeline-infra/index.js
  → re-exports from all pipeline-infra modules
```

No circular dependencies introduced. `cli-entry.js` imports `pino` directly (not `src/utils/logger.js`) to avoid config circular dependency.

## Testing Strategy

| Component | Test Type | File |
|-----------|-----------|------|
| C-1: loadAndValidateConfig | Unit | `tests/pipeline-infra/config-loader.test.js` (extend) |
| C-2: DIRECTORY_CONVENTION + resolvePlansPaths | Unit | `tests/pipeline-infra/path-policy.test.js` (extend) |
| C-2: Python parity | Unit | `tests/pipeline-infra/path-policy-python-compat.test.js` (extend) |
| C-3: createCliEntry | Unit | `tests/pipeline-infra/cli-entry.test.js` (NEW) |
| C-4: EXIT_CODES | Unit | `tests/pipeline-infra/error-codes.test.js` (extend) |
| C-5+C-6: typecheck + lint | Smoke | `npm run typecheck && npm run lint` (no new test file) |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `tsconfig.json` expansion reveals many type errors | Medium | Keep `strict: false`, fix only blocking errors, use `@ts-ignore` sparingly |
| ESLint rules break existing code | Low | Use `warn` severity, fix incrementally |
| Circular dependency from logger in config.js | Medium | Keep startup log in `index.js`, not `config.js` |
| `loadAndValidateConfig` changes break existing callers | High | Ship as NEW function, keep `loadPipelineInfraConfig` unchanged |

## US → Component Mapping

| User Story | Components |
|------------|------------|
| US-1 | C-1 (config-loader), C-7 (config.js startup log) |
| US-2 | C-2 (path-policy.js + path_policy.py) |
| US-3 | C-3 (cli-entry.js), C-4 (exit codes) |
| US-4 | C-5 (tsconfig), C-6 (eslint) |
