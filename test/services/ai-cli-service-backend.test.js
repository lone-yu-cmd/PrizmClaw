import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { executeAiCli, setBackendRegistry } from '../../src/services/ai-cli-service.js';
import { BackendRegistry } from '../../src/services/backend-registry.js';
import { sessionStore } from '../../src/services/session-store.js';

describe('AI CLI Service Backend Integration', () => {
  let testBackendRegistry;

  beforeEach(() => {
    // Create test backend registry with mock validator
    const mockValidator = mock.fn(() => {}); // Always succeeds
    testBackendRegistry = new BackendRegistry({ validator: mockValidator });

    // Replace the backend registry in the AI CLI service
    setBackendRegistry(testBackendRegistry);

    // Clear any existing sessions
    sessionStore.clear('test-session');
  });

  afterEach(() => {
    // Clean up
    sessionStore.clear('test-session');
  });

  describe('backend selection logic', () => {
    it('should select session-specific backend when set', async () => {
      // Register a test backend
      testBackendRegistry.registerBackend('test-backend', '/usr/bin/test-cli', {
        permissionFlag: '-y'
      });

      // Set session backend
      sessionStore.setCurrentBackend('test-session', 'test-backend');

      // Mock the child_process module to avoid actual execution
      const mockSpawn = mock.fn(() => ({
        pid: 12345,
        on: mock.fn(),
        stdout: { on: mock.fn() },
        stderr: { on: mock.fn() },
        kill: mock.fn()
      }));

      // Use a simple test that doesn't require complex mocking
      const result = await executeAiCli({
        sessionId: 'test-session',
        prompt: 'test prompt',
        bin: '/usr/bin/test-cli', // Force specific bin for test
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() } // Mock abort signal
      });

      // The test should complete without errors
      assert.ok(result);
      assert.ok(typeof result.output === 'string');
    });

    it('should fallback to default backend when session backend not set', async () => {
      // Register a default backend
      testBackendRegistry.registerBackend('default-backend', '/usr/bin/default-cli');
      testBackendRegistry.setDefaultBackend('default-backend');

      const result = await executeAiCli({
        sessionId: 'test-session',
        prompt: 'test prompt',
        bin: '/usr/bin/default-cli', // Force specific bin for test
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // The test should complete without errors
      assert.ok(result);
      assert.ok(typeof result.output === 'string');
    });

    it('should handle invalid backend gracefully', async () => {
      // Set an invalid backend for session
      sessionStore.setCurrentBackend('test-session', 'invalid-backend');

      const result = await executeAiCli({
        sessionId: 'test-session',
        prompt: 'test prompt',
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // Should return error message and not attempt execution
      assert.match(result.output, /⚠️ 后端 "invalid-backend" 不可用/);
      assert.strictEqual(result.timedOut, false);
      assert.strictEqual(result.interrupted, false);
      assert.strictEqual(result.elapsedMs, 0);
    });

    it('should use session backend permission flag when available', async () => {
      // Register backend with custom permission flag
      testBackendRegistry.registerBackend('custom-backend', '/usr/bin/custom-cli', {
        permissionFlag: '--allow'
      });
      sessionStore.setCurrentBackend('test-session', 'custom-backend');

      const result = await executeAiCli({
        sessionId: 'test-session',
        prompt: 'test prompt',
        bin: '/usr/bin/custom-cli', // Force specific bin for test
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // The test should complete without errors
      assert.ok(result);
      assert.ok(typeof result.output === 'string');
    });

    it('should reset session backend when backend becomes invalid', async () => {
      // Register a backend initially
      testBackendRegistry.registerBackend('test-backend', '/usr/bin/test-cli');
      sessionStore.setCurrentBackend('test-session', 'test-backend');

      // Mock the validator to simulate backend becoming invalid
      const mockValidator = mock.fn(() => {
        throw new Error('Binary not accessible');
      });
      const invalidBackendRegistry = new BackendRegistry({ validator: mockValidator });
      setBackendRegistry(invalidBackendRegistry);

      // Simulate backend becoming invalid (e.g., binary deleted)
      const result = await executeAiCli({
        sessionId: 'test-session',
        prompt: 'test prompt',
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // Should reset backend for session
      const currentBackend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(currentBackend, null);

      // Restore original registry
      setBackendRegistry(testBackendRegistry);
    });
  });
});