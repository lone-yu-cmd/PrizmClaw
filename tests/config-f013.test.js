/**
 * Tests for F-013 config options
 * Task 1.1: Add config options for session management
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';

describe('F-013 Config Options', () => {
  describe('SESSION_TIMEOUT_MS', () => {
    test('should have default value of 1800000 (30 minutes)', () => {
      assert.equal(config.sessionTimeoutMs, 1800000);
    });

    test('should be a positive integer', () => {
      assert.ok(Number.isInteger(config.sessionTimeoutMs));
      assert.ok(config.sessionTimeoutMs > 0);
    });
  });

  describe('SESSION_HISTORY_MAX', () => {
    test('should have default value of 100', () => {
      assert.equal(config.sessionHistoryMax, 100);
    });

    test('should be a positive integer', () => {
      assert.ok(Number.isInteger(config.sessionHistoryMax));
      assert.ok(config.sessionHistoryMax > 0);
    });
  });

  describe('SESSION_PERSISTENCE_DIR', () => {
    test('should have default value of "data/sessions"', () => {
      assert.equal(config.sessionPersistenceDir, 'data/sessions');
    });

    test('should be a string', () => {
      assert.ok(typeof config.sessionPersistenceDir === 'string');
    });
  });

  describe('ALIAS_PERSISTENCE_PATH', () => {
    test('should have default value of "data/aliases.json"', () => {
      assert.equal(config.aliasPersistencePath, 'data/aliases.json');
    });

    test('should be a string', () => {
      assert.ok(typeof config.aliasPersistencePath === 'string');
    });
  });
});
