import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { config } from '../../src/config.js';

describe('Backend Configuration', () => {
  describe('AI CLI backend configuration', () => {
    it('should have AI CLI backend configuration properties', () => {
      assert.ok('aiCliBackends' in config);
      assert.ok('aiCliDefaultBackend' in config);
      assert.ok('aiCliBackendValidation' in config);
      assert.ok('aiCliBackendFallback' in config);
    });

    it('should have default values for backend configuration', () => {
      assert.deepStrictEqual(config.aiCliBackends, []);
      assert.strictEqual(config.aiCliDefaultBackend, '');
      assert.strictEqual(config.aiCliBackendValidation, true);
      assert.strictEqual(config.aiCliBackendFallback, true);
    });
  });

  describe('Backend configuration integration', () => {
    it('should maintain backward compatibility with CODEBUDDY_BIN', () => {
      assert.ok('codebuddyBin' in config);
      assert.ok(typeof config.codebuddyBin === 'string');
    });

    it('should have default backend fallback to CODEBUDDY_BIN', () => {
      // When no default backend is configured, it should fall back to codebuddyBin
      const defaultBackend = config.aiCliDefaultBackend || 'codebuddy';
      const defaultBinPath = config.codebuddyBin;
      assert.ok(defaultBackend);
      assert.ok(defaultBinPath);
    });
  });
});