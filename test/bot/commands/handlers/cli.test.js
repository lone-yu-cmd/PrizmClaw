import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { CliCommandHandler } from '../../../../src/bot/commands/handlers/cli.js';
import { BackendRegistry } from '../../../../src/services/backend-registry.js';
import { sessionStore } from '../../../../src/services/session-store.js';

describe('CliCommandHandler', () => {
  let handler;
  let mockCtx;
  let testBackendRegistry;

  beforeEach(() => {
    // Create a test backend registry with a mock validator
    const mockValidator = mock.fn(() => {}); // Always succeeds
    testBackendRegistry = new BackendRegistry({ validator: mockValidator });

    // Create handler with test registry
    handler = new CliCommandHandler();
    handler.setBackendRegistry(testBackendRegistry);

    mockCtx = {
      from: { id: 12345 }
    };
  });

  afterEach(() => {
    // Clean up test sessions
    sessionStore.clear('user-12345');
  });

  describe('handle', () => {
    it('should handle /cli list command', async () => {
      testBackendRegistry.registerBackend('claude', '/usr/bin/claude', {
        description: 'Claude CLI backend'
      });

      const result = await handler.handle(mockCtx, ['list']);
      assert.match(result, /📋 Available Backends/);
      assert.match(result, /✅ claude - Claude CLI backend/);
    });

    it('should handle /cli status command', async () => {
      testBackendRegistry.registerBackend('codebuddy', '/usr/bin/codebuddy');
      testBackendRegistry.setDefaultBackend('codebuddy');

      const result = await handler.handle(mockCtx, []);
      assert.match(result, /🔧 Using default backend: codebuddy/);
    });

    it('should handle /cli <backend> switch command', async () => {
      testBackendRegistry.registerBackend('claude', '/usr/bin/claude');

      const result = await handler.handle(mockCtx, ['claude']);
      assert.match(result, /✅ Switched to backend: claude/);

      // Verify backend was set in session store
      const currentBackend = sessionStore.getCurrentBackend('user-12345');
      assert.strictEqual(currentBackend, 'claude');
    });

    it('should handle /cli reset command', async () => {
      testBackendRegistry.registerBackend('codebuddy', '/usr/bin/codebuddy');
      testBackendRegistry.setDefaultBackend('codebuddy');
      sessionStore.setCurrentBackend('user-12345', 'claude');

      const result = await handler.handle(mockCtx, ['reset']);
      assert.match(result, /🔄 Reset to default backend: codebuddy/);

      // Verify backend was reset
      const currentBackend = sessionStore.getCurrentBackend('user-12345');
      assert.strictEqual(currentBackend, null);
    });

    it('should handle unknown backend gracefully', async () => {
      const result = await handler.handle(mockCtx, ['unknown-backend']);
      assert.match(result, /❌ Backend "unknown-backend" not found/);
    });

    it('should handle backend alias lookup', async () => {
      testBackendRegistry.registerBackend('claude', '/usr/bin/claude', {
        aliases: ['claude-internal']
      });

      const result = await handler.handle(mockCtx, ['claude-internal']);
      assert.match(result, /✅ Switched to backend: claude/);
    });

    it('should handle session without user ID', async () => {
      const ctxWithoutUser = {};

      // Add a backend to ensure the list command returns content
      testBackendRegistry.registerBackend('test-backend', '/usr/bin/test', {
        description: 'Test backend'
      });

      const result = await handler.handle(ctxWithoutUser, ['list']);
      assert.match(result, /📋 Available Backends/);
    });
  });

  describe('error handling', () => {
    it('should handle registry errors gracefully', async () => {
      // Mock registry to throw error
      const mockRegistry = {
        listBackends: mock.fn(() => {
          throw new Error('Registry error');
        })
      };
      handler.setBackendRegistry(mockRegistry);

      const result = await handler.handle(mockCtx, ['list']);
      assert.match(result, /❌ Error: Registry error/);
    });
  });
});