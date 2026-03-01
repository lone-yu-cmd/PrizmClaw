/**
 * Tests for F-009 session store extensions
 * T-1.2: Extend session-store.js for cwd and output pages
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

describe('F-009 SessionStore Extensions', () => {
  // Create a fresh instance for each test
  let SessionStore;
  let sessionStore;

  beforeEach(async () => {
    // Import fresh module
    const module = await import('../../src/services/session-store.js');
    sessionStore = module.sessionStore;
  });

  describe('getCwd', () => {
    test('should return null for session without cwd', () => {
      const cwd = sessionStore.getCwd('non-existent-session');
      assert.equal(cwd, null);
    });

    test('should return cwd after setCwd', () => {
      const testPath = '/tmp/test-dir';
      sessionStore.setCwd('test-session-1', testPath);
      const cwd = sessionStore.getCwd('test-session-1');
      assert.equal(cwd, testPath);
    });
  });

  describe('setCwd', () => {
    test('should set cwd for a session', () => {
      const testPath = '/home/user/project';
      sessionStore.setCwd('test-session-2', testPath);
      assert.equal(sessionStore.getCwd('test-session-2'), testPath);
    });

    test('should overwrite existing cwd', () => {
      const testPath1 = '/path/one';
      const testPath2 = '/path/two';
      sessionStore.setCwd('test-session-3', testPath1);
      sessionStore.setCwd('test-session-3', testPath2);
      assert.equal(sessionStore.getCwd('test-session-3'), testPath2);
    });
  });

  describe('getOutputPages', () => {
    test('should return null for session without output pages', () => {
      const pages = sessionStore.getOutputPages('non-existent-session');
      assert.equal(pages, null);
    });

    test('should return pages after setOutputPages', () => {
      const pages = ['page 1 content', 'page 2 content'];
      sessionStore.setOutputPages('test-session-4', pages);
      const result = sessionStore.getOutputPages('test-session-4');
      assert.deepEqual(result, pages);
    });
  });

  describe('setOutputPages', () => {
    test('should set output pages for a session', () => {
      const pages = ['output chunk 1', 'output chunk 2', 'output chunk 3'];
      sessionStore.setOutputPages('test-session-5', pages);
      assert.deepEqual(sessionStore.getOutputPages('test-session-5'), pages);
    });
  });

  describe('clearOutputPages', () => {
    test('should clear output pages for a session', () => {
      const pages = ['page 1', 'page 2'];
      sessionStore.setOutputPages('test-session-6', pages);
      sessionStore.clearOutputPages('test-session-6');
      const result = sessionStore.getOutputPages('test-session-6');
      assert.equal(result, null);
    });
  });

  describe('clear', () => {
    test('should clear cwd when session is cleared', () => {
      sessionStore.setCwd('test-session-7', '/some/path');
      sessionStore.clear('test-session-7');
      assert.equal(sessionStore.getCwd('test-session-7'), null);
    });

    test('should clear output pages when session is cleared', () => {
      sessionStore.setOutputPages('test-session-8', ['page 1']);
      sessionStore.clear('test-session-8');
      assert.equal(sessionStore.getOutputPages('test-session-8'), null);
    });
  });
});
