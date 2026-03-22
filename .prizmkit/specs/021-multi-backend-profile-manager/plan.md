# Plan: F-021 Multi-Backend Profile Manager

## Key Components

1. **ProfileStore** (`src/services/profile-store.js`) — new service
   - Persists profiles to JSON file (data/cli-profiles.json by default)
   - CRUD: add, remove, get, list, load on startup
   - Profile shape: { name, binPath, permissionFlag?, timeoutMs?, description? }
   - Default profile (from CODEBUDDY_BIN) is protected (cannot be removed)

2. **BackendRegistry** — extend existing
   - Add `permissionFlag` and `timeoutMs` to backend object on `registerBackend()`
   - Already reads `sessionBackend.permissionFlag` in ai-cli-service.js
   - `updateBackend(name, fields)` — allow overriding params after registration

3. **cli.js handler** — extend existing
   - Add subcommands: `profiles`, `add`, `remove`, `use`
   - `profiles` → list all saved profiles with full params
   - `add <name> <bin> [--permission=<flag>] [--timeout=<ms>]` → create profile + persist
   - `remove <name>` → delete non-default profile + persist
   - `use <name>` → switch session to named profile (existing #handleSwitch enhanced)
   - Keep existing `list`, `reset`, `<backend>` for backward compatibility

4. **config.js** — add `CLI_PROFILES_PATH` env var

5. **telegram.js** — load profiles from store on startup, register in backendRegistry

## Data Flow

```
/cli add claude /usr/bin/claude --permission=-y --timeout=300000
  → ProfileStore.addProfile({name, binPath, permissionFlag, timeoutMs})
  → backendRegistry.registerBackend(name, binPath, {permissionFlag, timeoutMs})
  → persist to JSON

/cli use claude
  → backendRegistry.getBackend('claude') → validate → sessionStore.setCurrentBackend

/cli remove claude
  → check not default → profileStore.removeProfile → backendRegistry.unregisterBackend

Bot restart:
  → ProfileStore.loadProfiles() → backendRegistry.registerBackend() for each
```

## Files to Create
- `src/services/profile-store.js` — new profile persistence service
- `tests/services/profile-store.test.js` — unit tests
- `tests/bot/commands/handlers/cli.test.js` — handler tests

## Files to Modify
- `src/services/backend-registry.js` — add permissionFlag/timeoutMs fields
- `src/bot/commands/handlers/cli.js` — add profiles/add/remove/use subcommands
- `src/config.js` — add CLI_PROFILES_PATH env var
- `src/bot/telegram.js` — load profiles on startup

## Tasks

- [ ] Task 1: Create ProfileStore service with CRUD + persistence
- [ ] Task 2: Extend BackendRegistry to support permissionFlag/timeoutMs fields
- [ ] Task 3: Add CLI_PROFILES_PATH to config.js
- [ ] Task 4: Extend cli.js handler with profiles/add/remove/use subcommands
- [ ] Task 5: Load profiles on startup in telegram.js
- [ ] Task 6: Write tests for ProfileStore
- [ ] Task 7: Write tests for cli.js handler new subcommands
