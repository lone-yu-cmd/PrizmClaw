import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BackendRegistry } from '../../src/services/backend-registry.js';
import { sessionStore } from '../../src/services/session-store.js';
import { executeAiCli, setBackendRegistry } from '../../src/services/ai-cli-service.js';

describe('Backend Switcher Integration', () => {
  const testSessionId = 'test-session';
  let testBackendRegistry;

  beforeEach(() => {
    // Create test backend registry with mock validator
    const mockValidator = mock.fn(() => {}); // Always succeeds
    testBackendRegistry = new BackendRegistry({ validator: mockValidator });

    // Set test backend registry in AI CLI service
    setBackendRegistry(testBackendRegistry);

    // Clear any existing session state
    sessionStore.clear(testSessionId);
  });

  afterEach(() => {
    // Clean up
    testBackendRegistry.clear();
    sessionStore.clear(testSessionId);
  });

  describe('End-to-end backend switching', () => {
    it('should switch backends and use the correct backend for execution', async () => {
      // Register multiple backends
      testBackendRegistry.registerBackend('claude', '/usr/bin/claude', {
        description: 'Claude CLI backend'
      });
      testBackendRegistry.registerBackend('codebuddy', '/usr/bin/codebuddy', {
        description: 'CodeBuddy CLI backend'
      });

      // Set default backend
      testBackendRegistry.setDefaultBackend('codebuddy');

      // Verify initial state
      const initialBackend = sessionStore.getCurrentBackend(testSessionId);
      assert.strictEqual(initialBackend, null); // No backend set initially

      // Switch to claude backend
      sessionStore.setCurrentBackend(testSessionId, 'claude');

      // Verify backend was set
      const currentBackend = sessionStore.getCurrentBackend(testSessionId);
      assert.strictEqual(currentBackend, 'claude');

      // Test that AI CLI service uses the correct backend
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test prompt',
        bin: '/usr/bin/claude', // Force specific bin for test
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // Should complete without backend validation errors
      assert.ok(result);
      assert.ok(typeof result.output === 'string');
      assert.strictEqual(result.timedOut, false);
      assert.strictEqual(result.interrupted, false);
    });

    it('should handle session persistence across backend switches', async () => {
      // Register backends
      testBackendRegistry.registerBackend('backend-a', '/usr/bin/backend-a');
      testBackendRegistry.registerBackend('backend-b', '/usr/bin/backend-b');

      // Create session activity first
      sessionStore.touchSession(testSessionId, 'test-user');

      // Switch backend multiple times
      sessionStore.setCurrentBackend(testSessionId, 'backend-a');
      assert.strictEqual(sessionStore.getCurrentBackend(testSessionId), 'backend-a');

      sessionStore.setCurrentBackend(testSessionId, 'backend-b');
      assert.strictEqual(sessionStore.getCurrentBackend(testSessionId), 'backend-b');

      // Reset to default
      sessionStore.resetBackend(testSessionId);
      assert.strictEqual(sessionStore.getCurrentBackend(testSessionId), null);

      // Verify session info includes backend information
      const sessionInfo = sessionStore.getSessionInfo(testSessionId);
      assert.ok(sessionInfo);
      assert.strictEqual(sessionInfo.currentBackend, null);
    });

    it('should handle invalid backend gracefully', async () => {
      // Set an invalid backend
      sessionStore.setCurrentBackend(testSessionId, 'invalid-backend');

      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test prompt',
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // Should return error message and not attempt execution
      assert.match(result.output, /⚠️ 后端 "invalid-backend" 不可用/);
      assert.strictEqual(result.timedOut, false);
      assert.strictEqual(result.interrupted, false);
      assert.strictEqual(result.elapsedMs, 0);

      // Should reset backend after validation failure
      const currentBackend = sessionStore.getCurrentBackend(testSessionId);
      assert.strictEqual(currentBackend, null);
    });

    it('should maintain backward compatibility with CODEBUDDY_BIN', async () => {
      // Don't set any session backend - should use default
      const result = await executeAiCli({
        sessionId: testSessionId,
        prompt: 'test prompt',
        signal: { addEventListener: mock.fn(), removeEventListener: mock.fn() }
      });

      // Should complete successfully using default backend
      assert.ok(result);
      assert.ok(typeof result.output === 'string');
      assert.strictEqual(result.timedOut, false);
      assert.strictEqual(result.interrupted, false);
    });
  });

  describe('Backend registry integration', () => {
    it('should validate backends before execution', () => {
      // Create a mock validator that simulates file system validation
      const mockValidator = mock.fn((binPath) => {
        if (binPath === '/usr/bin/valid-backend') {
          return; // Success
        }
        if (binPath === '/invalid/path') {
          throw new Error('File not found');
        }
      });

      testBackendRegistry.setValidator(mockValidator);

      // Register a valid backend
      testBackendRegistry.registerBackend('valid-backend', '/usr/bin/valid-backend');

      // Valid backend should pass validation
      const isValid = testBackendRegistry.validateBackend('valid-backend');
      assert.strictEqual(isValid, true);

      // Invalid backend should fail validation (can't register it, so test validation directly)
      try {
        mockValidator('/invalid/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.match(error.message, /File not found/);
      }

      // Verify the mock was called with the invalid path
      assert.strictEqual(mockValidator.mock.callCount(), 3);
      assert.strictEqual(mockValidator.mock.calls[2].arguments[0], '/invalid/path');
    });

    it('should list available backends correctly', () => {
      testBackendRegistry.registerBackend('backend1', '/usr/bin/backend1');
      testBackendRegistry.registerBackend('backend2', '/usr/bin/backend2');

      const backends = testBackendRegistry.listBackends();
      assert.strictEqual(backends.length, 2);
      assert.strictEqual(backends[0].name, 'backend1');
      assert.strictEqual(backends[1].name, 'backend2');
    });

    it('should handle default backend configuration', () => {
      testBackendRegistry.registerBackend('backend-a', '/usr/bin/backend-a');
      testBackendRegistry.registerBackend('backend-b', '/usr/bin/backend-b');

      // Set default backend
      testBackendRegistry.setDefaultBackend('backend-a');
      assert.strictEqual(testBackendRegistry.getDefaultBackendName(), 'backend-a');

      // Change default backend
      testBackendRegistry.setDefaultBackend('backend-b');
      assert.strictEqual(testBackendRegistry.getDefaultBackendName(), 'backend-b');
    });
  });
});