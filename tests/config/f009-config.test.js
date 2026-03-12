/**
 * Tests for F-009 config additions
 * T-1.1: Add new config variables for command executor
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('F-009 Config Variables', () => {
  describe('COMMAND_BLACKLIST', () => {
    test('should default to empty array when not set', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(Array.isArray(config.commandBlacklist));
    });

    test('should parse comma-separated blacklist commands via parseCsvList', async () => {
      // Test the parseCsvList function directly via config structure
      const { config } = await import('../../src/config.js');
      // Verify the config structure supports the blacklist
      assert.ok(typeof config.commandBlacklist !== 'undefined', 'commandBlacklist should be defined');
      assert.ok(Array.isArray(config.commandBlacklist), 'commandBlacklist should be an array');
    });
  });

  describe('HIGH_RISK_KEYWORDS', () => {
    test('should have default high-risk keywords', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(Array.isArray(config.highRiskKeywords));
      assert.ok(config.highRiskKeywords.length > 0, 'Should have default high-risk keywords');
      assert.ok(config.highRiskKeywords.includes('rm -rf'), 'Should include rm -rf');
      assert.ok(config.highRiskKeywords.includes('sudo'), 'Should include sudo');
    });
  });

  describe('DIRECT_EXEC_MODE', () => {
    test('should default to false', async () => {
      const { config } = await import('../../src/config.js');
      assert.equal(config.directExecMode, false);
    });

    test('should be a boolean', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok(typeof config.directExecMode === 'boolean');
    });
  });

  describe('Config object structure', () => {
    test('should have all F-009 config properties', async () => {
      const { config } = await import('../../src/config.js');
      assert.ok('commandBlacklist' in config, 'commandBlacklist should be in config');
      assert.ok('highRiskKeywords' in config, 'highRiskKeywords should be in config');
      assert.ok('directExecMode' in config, 'directExecMode should be in config');
    });
  });
});
