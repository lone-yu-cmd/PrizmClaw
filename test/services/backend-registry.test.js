import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BackendRegistry } from '../../src/services/backend-registry.js';

describe('BackendRegistry', () => {
  let registry;
  let mockValidator;

  beforeEach(() => {
    // Create a mock validator that always succeeds
    mockValidator = mock.fn(() => {});
    registry = new BackendRegistry({ validator: mockValidator });
  });

  afterEach(() => {
    // Clean up any registered backends
    registry.clear();
  });

  describe('registerBackend', () => {
    it('should register a backend with name and binary path', () => {
      registry.registerBackend('claude', '/usr/local/bin/claude', {
        description: 'Claude CLI backend'
      });

      const backend = registry.getBackend('claude');
      assert.strictEqual(backend.name, 'claude');
      assert.strictEqual(backend.binPath, '/usr/local/bin/claude');
      assert.strictEqual(backend.description, 'Claude CLI backend');
    });

    it('should throw error when registering duplicate backend name', () => {
      registry.registerBackend('claude', '/usr/local/bin/claude');

      assert.throws(() => {
        registry.registerBackend('claude', '/another/path/claude');
      }, /Backend "claude" is already registered/);
    });

    it('should validate backend binary path on registration', () => {
      registry.registerBackend('valid-backend', '/valid/path/bin');

      // Verify that the validator was called with the correct path
      assert.strictEqual(mockValidator.mock.callCount(), 1);
      assert.deepStrictEqual(mockValidator.mock.calls[0].arguments, [
        '/valid/path/bin'
      ]);
    });
  });

  describe('getBackend', () => {
    it('should return undefined for unregistered backend', () => {
      const backend = registry.getBackend('nonexistent');
      assert.strictEqual(backend, undefined);
    });

    it('should return registered backend', () => {
      registry.registerBackend('codebuddy', '/usr/bin/codebuddy');
      const backend = registry.getBackend('codebuddy');
      assert.strictEqual(backend.name, 'codebuddy');
    });
  });

  describe('listBackends', () => {
    it('should return empty array when no backends registered', () => {
      const backends = registry.listBackends();
      assert.deepStrictEqual(backends, []);
    });

    it('should return all registered backends', () => {
      registry.registerBackend('claude', '/usr/bin/claude');
      registry.registerBackend('codebuddy', '/usr/bin/codebuddy');

      const backends = registry.listBackends();
      assert.strictEqual(backends.length, 2);
      assert.strictEqual(backends[0].name, 'claude');
      assert.strictEqual(backends[1].name, 'codebuddy');
    });
  });

  describe('validateBackend', () => {
    it('should return false for unregistered backend', () => {
      const isValid = registry.validateBackend('nonexistent');
      assert.strictEqual(isValid, false);
    });

    it('should validate backend binary existence', () => {
      registry.registerBackend('claude', '/usr/bin/claude');
      const isValid = registry.validateBackend('claude');
      assert.strictEqual(isValid, true);
    });
  });

  describe('default backend', () => {
    it('should set and get default backend', () => {
      registry.registerBackend('claude', '/usr/bin/claude');
      registry.setDefaultBackend('claude');

      const defaultBackend = registry.getDefaultBackend();
      assert.strictEqual(defaultBackend.name, 'claude');
    });

    it('should throw error when setting non-existent backend as default', () => {
      assert.throws(() => {
        registry.setDefaultBackend('nonexistent');
      }, /Backend "nonexistent" is not registered/);
    });
  });

  describe('unregisterBackend', () => {
    it('should remove registered backend', () => {
      registry.registerBackend('claude', '/usr/bin/claude');
      registry.unregisterBackend('claude');

      const backend = registry.getBackend('claude');
      assert.strictEqual(backend, undefined);
    });

    it('should handle unregistering non-existent backend gracefully', () => {
      assert.doesNotThrow(() => {
        registry.unregisterBackend('nonexistent');
      });
    });
  });
});