# PrizmClaw Test Suite

## Overview

This document describes the test infrastructure for PrizmClaw, providing information about test organization, coverage targets, and best practices.

## Test Organization

```
tests/
├── fixtures/                    # Shared test data
│   ├── plans/                   # Sample plan files
│   │   ├── valid-feature-list.json
│   │   ├── valid-bug-fix-list.json
│   │   ├── invalid-missing-schema.json
│   │   ├── invalid-bad-json.json
│   │   ├── invalid-missing-fields.json
│   │   └── invalid-type-errors.json
│   └── states/                  # Sample state files
│       ├── pipeline-idle.json
│       ├── pipeline-running.json
│       ├── pipeline-completed.json
│       └── pipeline-failed.json
│
├── helpers/                     # Test utilities
│   ├── fixture-loader.js        # Lazy loading utility for fixtures
│   ├── mock-runner.js           # Mock script runner with state tracking
│   ├── mock-telegram.js         # Mock Telegraf context
│   ├── test-state.js            # Temporary state management
│   └── helpers.test.js          # Tests for helpers
│
├── bot/commands/                # Command parsing & routing tests
│   ├── parser.test.js           # Command parser tests
│   ├── registry.test.js         # Command registry tests
│   ├── validator.test.js        # Parameter validator tests
│   ├── formatter.test.js        # Error formatter tests
│   └── handlers/
│       ├── handlers.test.js     # Command handler tests
│       └── plan.test.js         # Plan command tests
│
├── services/                    # Service layer tests
│   ├── pipeline-control-service.test.js
│   ├── pipeline-controller.test.js
│   ├── plan-ingestion-service.test.js
│   ├── plan-version.test.js
│   ├── status-aggregator.test.js
│   ├── log-pager.test.js
│   ├── telegram-pusher.test.js
│   ├── audit-log-service.test.js
│   └── error-paths.test.js
│
├── security/                    # Security tests
│   ├── permission-guard.test.js
│   ├── param-sanitizer.test.js
│   └── confirmation-manager.test.js
│
├── pipeline-infra/             # Infrastructure tests
│   ├── lock-manager.test.js
│   ├── state-manager.test.js
│   ├── script-runner.test.js
│   ├── error-codes.test.js
│   └── ...
│
├── integration/                 # Integration tests
│   ├── e2e-main-chain.test.js   # E2E pipeline lifecycle
│   ├── plan-version-flow.test.js # Plan version flow
│   ├── security-flow.test.js    # Security flow
│   └── ...
│
└── runtime/                     # Runtime tests
    └── config.test.js
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### With Coverage
```bash
npm run test:coverage
```

## Coverage Targets

| Module | Target | Current |
|--------|--------|---------|
| bot/commands/parser.js | 90% | ~85% |
| bot/commands/validator.js | 85% | ~80% |
| bot/commands/registry.js | 85% | ~85% |
| services/pipeline-controller.js | 90% | ~85% |
| services/plan-ingestion-service.js | 90% | ~85% |
| security/permission-guard.js | 95% | ~90% |
| security/param-sanitizer.js | 90% | ~85% |
| security/confirmation-manager.js | 85% | ~80% |

## Test Strategies

### Layer 1: Pure Unit Tests
- No I/O dependencies
- Function injection for mocking
- Fast execution (< 10ms per test)

### Layer 2: Unit Tests with Mock I/O
- Mock fs, child_process, external APIs
- Use `createMockRunner()` and `createMockContext()`

### Layer 3: Integration Tests
- Multiple components working together
- Use temporary directories via `createTestPipelineDirs()`
- Clean up after tests

## Test Helpers

### fixture-loader.js
```javascript
import { loadJsonFixture, getFixturePath } from '../helpers/fixture-loader.js';

const plan = loadJsonFixture('plans/valid-feature-list.json');
```

### mock-runner.js
```javascript
import { createMockRunner, createStatefulMockRunner } from '../helpers/mock-runner.js';

// Static responses
const runner = createMockRunner({
  run: { ok: true, pid: 12345 },
  status: { ok: true, isRunning: true }
});

// Stateful runner with transitions
const statefulRunner = createStatefulMockRunner();
```

### mock-telegram.js
```javascript
import { createMockContext, createAdminContext } from '../helpers/mock-telegram.js';

const ctx = createMockContext({ message: { text: '/start' } });
const adminCtx = createAdminContext();
```

### test-state.js
```javascript
import { createTestPipelineDirs, writeTestState, readTestState } from '../helpers/test-state.js';

const { tempDir, stateDir, cleanup } = await createTestPipelineDirs();
try {
  await writeTestState(join(stateDir, 'test.json'), { foo: 'bar' });
  const data = await readTestState(join(stateDir, 'test.json'));
} finally {
  await cleanup();
}
```

## Best Practices

1. **Isolation**: Each test should be independent. Use `beforeEach` to reset state.
2. **Cleanup**: Always clean up temporary files and directories.
3. **Descriptive Names**: Test names should describe the expected behavior.
4. **One Assertion Per Test**: Keep tests focused on a single behavior.
5. **Mock External Dependencies**: Never hit real APIs or file systems in unit tests.

## Feature Test Coverage

| Feature | Test File | Status |
|---------|-----------|--------|
| F-001: Pipeline Commands | integration/f001-*.test.js | ✅ |
| F-002: Command Router | bot/commands/*.test.js | ✅ |
| F-003: Plan Ingestion | services/plan-ingestion-service.test.js | ✅ |
| F-004: Pipeline Controller | services/pipeline-controller.test.js | ✅ |
| F-005: Status & Logs | services/status-aggregator.test.js | ✅ |
| F-006: Safety Guard | security/*.test.js | ✅ |
| F-007: Test Suite | helpers/*.test.js | ✅ |

## Known Gaps

1. **Edge Cases**: Some edge cases in error handling need additional coverage
2. **Concurrency**: More tests needed for concurrent access scenarios
3. **Performance**: Add performance regression tests

## Contributing

When adding new features:
1. Create corresponding test file in appropriate directory
2. Use existing helpers for mocking
3. Follow the naming convention: `*.test.js`
4. Ensure all tests pass before submitting
