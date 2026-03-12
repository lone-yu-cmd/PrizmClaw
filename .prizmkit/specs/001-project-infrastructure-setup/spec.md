# F-001: Project Infrastructure Setup — Spec

## Overview

Establish a unified engineering baseline for the Telegram pipeline project: formalize configuration layering, directory conventions, log/state file locations, script entry points, and exit code standards. Ensure subsequent command-routing and pipeline-control features have a stable runtime foundation while maintaining compatibility with existing dev-pipeline scripts.

## User Stories

### US-1: Unified Configuration Validation with Human-Readable Errors

**As a** developer or operator,
**I want** a single config validation entry point that produces clear, actionable error messages when required config is missing or invalid,
**So that** I can quickly diagnose startup failures.

**Acceptance Criteria:**
- AC-1.1: `loadAndValidateConfig()` in `src/pipeline-infra/config-loader.js` returns a structured error object listing ALL missing/invalid fields at once (not fail-fast on first error)
- AC-1.2: Error messages include field name, expected format, and hint for resolution
- AC-1.3: When config is valid, returns the frozen config object (existing behavior preserved)
- AC-1.4: `src/config.js` uses the enhanced loader and surfaces a startup summary log at `info` level

### US-2: Standardized Directory Structure Convention

**As a** developer,
**I want** documented and enforced directory conventions for plan files, state files, session logs, and feature/bugfix input lists,
**So that** all modules reference paths consistently.

**Acceptance Criteria:**
- AC-2.1: `src/pipeline-infra/path-policy.js` exports a `DIRECTORY_CONVENTION` constant documenting canonical paths
- AC-2.2: `resolvePlansPaths()` added for plans directory resolution
- AC-2.3: All existing path functions remain backward-compatible
- AC-2.4: Python `path_policy.py` updated to mirror any new JS path functions

### US-3: Reusable Script Entry Wrapper

**As a** developer building new commands,
**I want** a reusable entry wrapper that standardizes argument parsing, config loading, logging setup, and exit codes for Node.js CLI scripts,
**So that** all script entry points behave consistently.

**Acceptance Criteria:**
- AC-3.1: `src/pipeline-infra/cli-entry.js` exports `createCliEntry(options)` returning `{ run, config, logger }`
- AC-3.2: Wrapper handles `--help`, unknown args (exit code 2), unhandled errors (exit code 1)
- AC-3.3: Exit codes follow convention: 0=success, 1=runtime error, 2=usage error, 124=timeout
- AC-3.4: Exit codes documented in `src/pipeline-infra/error-codes.js`

### US-4: TypeScript Build and Lint Baseline

**As a** developer adopting TypeScript incrementally,
**I want** `tsconfig.json` and `eslint.config.js` configured to support progressive migration,
**So that** `npm run typecheck` and `npm run lint` pass on the current codebase and catch regressions.

**Acceptance Criteria:**
- AC-4.1: `tsconfig.json` `include` expanded to cover all `src/**/*.js` files (not just pipeline-infra)
- AC-4.2: `eslint.config.js` adds recommended rules baseline without breaking existing code
- AC-4.3: `npm run typecheck` passes with zero errors
- AC-4.4: `npm run lint` passes with zero warnings
- AC-4.5: No existing Telegram bot or HTTP server functionality broken

## Scope Boundary

### In Scope
- Config validation enhancement (batch error collection)
- Directory convention documentation in code constants
- CLI entry wrapper for Node scripts
- Exit code standardization
- `tsconfig.json` / `eslint.config.js` baseline expansion
- Python path_policy.py parity update

### Out of Scope
- Full TypeScript migration of existing `.js` files
- Changes to dev-pipeline shell scripts themselves
- New Telegram bot commands
- Database or external service integration
- CI/CD pipeline configuration

## Non-Functional Requirements

- NFR-1: Startup time must not increase by more than 50ms from config validation changes
- NFR-2: All changes must be backward-compatible with existing `src/config.js` consumers
- NFR-3: Zero test regressions — all existing `npm run test:unit` must pass
