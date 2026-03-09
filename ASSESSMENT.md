# PrizmKit Brownfield Assessment

## Scope
- Project: `PrizmClaw`
- Date: 2026-03-09
- Mode: brownfield
- Platform: CodeBuddy

## Tech Stack
- Runtime: Node.js (ESM)
- Backend: Express 4 (`src/http/server.js`)
- Bot: Telegraf (`src/bot/telegram.js`)
- Validation: Zod (`src/config.js`)
- Logging: Pino (`src/utils/logger.js`)
- Process integration: CodeBuddy CLI adapter (`src/adapters/codebuddy.js`)

## Structure Summary
- Entry point: `src/index.js`
- Source directories:
  - `src/` (15 source files)
  - `dev-pipeline/` (16 source files)
  - `dev-team/` (5 source files)
  - `public/` (1 source file)
- Test directories detected: none
- Coverage config detected: none

## Dependency Health
- Manifest: `package.json`, lockfile: `package-lock.json`
- Outdated dependencies (major updates available):
  - `dotenv` 16.6.1 -> 17.3.1
  - `express` 4.22.1 -> 5.2.1
  - `zod` 3.25.76 -> 4.3.6
- `npm audit --omit=dev`: 0 vulnerabilities

## Technical Debt Indicators
- TODO/FIXME/HACK/XXX count (first-party dirs): 30
  - `dev-pipeline/`: 10
  - `dev-team/`: 20
- Large files (>500 lines):
  - `dev-pipeline/scripts/update-feature-status.py` (1076)
  - `dev-pipeline/run.sh` (845)
  - `dev-pipeline/scripts/update-bug-status.py` (748)
  - `dev-team/skills/self-improving-agent/SKILL.md` (647)
  - `dev-pipeline/run-bugfix.sh` (638)
  - `src/bot/telegram.js` (549)

## Notes
- `.prizm-docs/` did not exist before this init.
- `docs/AI_CONTEXT/` was not found (no migration needed).
