# Feature: AI CLI Backend Switcher

## Overview
PrizmClaw currently hardcodes a single AI CLI backend (CODEBUDDY_BIN) that cannot be changed without restarting the Bot. Users who have multiple AI CLI tools installed (e.g., claude-internal, claude, cbc) need the ability to switch between them at runtime from Telegram, per-session, without affecting other users or requiring a restart.

## User Stories

### US1: View Current Backend
**As a** Bot operator
**I want** to see which AI CLI backend my current session is using
**So that** I know where my next message will be routed

**Acceptance Criteria:**
- [ ] Given a session with no explicit override, When I send `/cli`, Then the response shows the default backend name and binary path
- [ ] Given a session where I previously switched backends, When I send `/cli`, Then the response shows my current override, not the default

### US2: List Available Backends
**As a** Bot operator
**I want** to see all configured AI CLI backends
**So that** I know which options are available to switch to

**Acceptance Criteria:**
- [ ] Given backends are configured via environment variable, When I send `/cli list`, Then all configured backends are listed with name and binary path
- [ ] Given I am currently using a specific backend, When I send `/cli list`, Then my current backend is visually marked in the list

### US3: Switch Backend
**As a** Bot operator
**I want** to switch to a different AI CLI backend by name
**So that** my subsequent messages use the chosen backend without restarting the Bot

**Acceptance Criteria:**
- [ ] Given a valid backend name that exists in configuration, When I send `/cli <name>`, Then the system validates the binary is available on the system, stores my choice for this session, and confirms the switch
- [ ] Given the binary does not exist on the system, When I send `/cli <name>`, Then the switch is rejected with a clear error message
- [ ] Given an unknown backend name not in configuration, When I send `/cli <name>`, Then the switch is rejected and available backends are listed

### US4: Session Isolation
**As a** multi-user Bot administrator
**I want** each user's backend choice to be independent
**So that** one user switching backends does not affect another user's session

**Acceptance Criteria:**
- [ ] Given User A switches to backend X, When User B sends `/cli`, Then User B still sees the default backend
- [ ] Given a user switches backends and the Bot restarts, When the user sends `/cli`, Then the session reverts to the default backend (non-persistent)

## Scope

### In Scope
- `/cli` command with subcommands: (none), `list`, `<backend-name>`
- Environment variable for configuring available backends map
- Per-session backend storage in session store
- Binary availability validation before switching
- Integration with both Telegram AI CLI path and Web chat path
- Cleanup of session backend on session clear/reset

### Out of Scope
- Persistent backend preference across Bot restarts (covered by future F-021)
- Per-backend custom arguments/flags/timeout (covered by future F-021)
- Adding/removing backends at runtime (covered by future F-021)
- Web UI for backend switching (covered by future F-019)

## Dependencies
- F-009 (General Command Executor): Command handler pattern, session store cwd pattern
- F-011 (AI CLI Proxy): `executeAiCli` function and `ai-cli-service.js` where the backend binary is resolved

## Constraints
- Must not break existing behavior when CLI_BACKENDS env var is not set (backward compatible)
- Must follow existing command handler pattern (one file per command in `src/bot/commands/handlers/`)
- Command requires `operator` minimum role (consistent with /cd)
- Binary validation must use POSIX-compatible check (project rule: POSIX shell commands preferred)

## Review Checklist
- [x] All user stories have acceptance criteria
- [x] Scope boundaries are clearly defined
- [x] Dependencies are identified
- [x] No implementation details (WHAT not HOW)
