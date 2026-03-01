import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { SessionStore } from '../../src/services/session-store.js';

describe('SessionStore Backend Extensions', () => {
  let sessionStore;

  beforeEach(() => {
    sessionStore = new SessionStore();
  });

  afterEach(() => {
    // Clean up test sessions
    sessionStore.clear('test-session');
  });

  describe('getCurrentBackend', () => {
    it('should return null when no backend is set', () => {
      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, null);
    });

    it('should return the set backend name', () => {
      sessionStore.setCurrentBackend('test-session', 'claude');
      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, 'claude');
    });
  });

  describe('setCurrentBackend', () => {
    it('should set backend for a session', () => {
      sessionStore.setCurrentBackend('test-session', 'codebuddy');
      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, 'codebuddy');
    });

    it('should override existing backend', () => {
      sessionStore.setCurrentBackend('test-session', 'claude');
      sessionStore.setCurrentBackend('test-session', 'codebuddy');
      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, 'codebuddy');
    });

    it('should maintain separate backends for different sessions', () => {
      sessionStore.setCurrentBackend('session-1', 'claude');
      sessionStore.setCurrentBackend('session-2', 'codebuddy');

      const backend1 = sessionStore.getCurrentBackend('session-1');
      const backend2 = sessionStore.getCurrentBackend('session-2');

      assert.strictEqual(backend1, 'claude');
      assert.strictEqual(backend2, 'codebuddy');
    });
  });

  describe('resetBackend', () => {
    it('should remove backend setting for session', () => {
      sessionStore.setCurrentBackend('test-session', 'claude');
      sessionStore.resetBackend('test-session');

      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, null);
    });

    it('should handle resetting non-existent backend gracefully', () => {
      assert.doesNotThrow(() => {
        sessionStore.resetBackend('test-session');
      });
    });
  });

  describe('clear', () => {
    it('should clear backend setting when clearing session', () => {
      sessionStore.setCurrentBackend('test-session', 'claude');
      sessionStore.clear('test-session');

      const backend = sessionStore.getCurrentBackend('test-session');
      assert.strictEqual(backend, null);
    });
  });

  describe('getSessionInfo', () => {
    it('should include backend information in session info', () => {
      sessionStore.setCurrentBackend('test-session', 'codebuddy');
      sessionStore.touchSession('test-session', 'user123');

      const sessionInfo = sessionStore.getSessionInfo('test-session');
      assert.strictEqual(sessionInfo.currentBackend, 'codebuddy');
    });

    it('should return null for backend when not set', () => {
      sessionStore.touchSession('test-session', 'user123');

      const sessionInfo = sessionStore.getSessionInfo('test-session');
      assert.strictEqual(sessionInfo.currentBackend, null);
    });
  });
});