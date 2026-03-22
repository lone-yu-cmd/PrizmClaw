/**
 * Tests for F-018 Session Binding Service
 * Task 1.2: Unit tests for session-bind.js
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, 'fixtures/session-bind-f018');

describe('F-018 Session Binding Service', () => {
  let sessionBindingService;
  let SessionBindingService;

  beforeEach(async () => {
    // Clean up test fixtures directory
    await rm(testFixturesDir, { recursive: true, force: true });
    await mkdir(testFixturesDir, { recursive: true });

    // Import module after cleaning
    const module = await import('../../src/services/session-bind.js');
    SessionBindingService = module.SessionBindingService;

    // Create new instance with test persistence dir
    sessionBindingService = new SessionBindingService({
      persistenceDir: testFixturesDir
    });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testFixturesDir, { recursive: true, force: true });
  });

  describe('init', () => {
    test('should initialize and create empty bindings file', async () => {
      await sessionBindingService.init();

      const bindingsFile = path.join(testFixturesDir, 'session-bindings.json');
      const data = await readFile(bindingsFile, 'utf-8');
      const parsed = JSON.parse(data);

      assert.ok(parsed.bindings);
      assert.strictEqual(Object.keys(parsed.bindings).length, 0);
      assert.ok(parsed.updatedAt);
    });

    test('should load existing bindings from persistence', async () => {
      // Pre-create bindings file
      const existingData = {
        bindings: {
          'web-session-1': '123456789',
          'web-session-2': '987654321'
        },
        updatedAt: new Date().toISOString()
      };
      const bindingsFile = path.join(testFixturesDir, 'session-bindings.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(bindingsFile, JSON.stringify(existingData));

      await sessionBindingService.init();

      assert.strictEqual(sessionBindingService.getBoundChatId('web-session-1'), '123456789');
      assert.strictEqual(sessionBindingService.getBoundChatId('web-session-2'), '987654321');
    });
  });

  describe('bindSession', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.bindSession('web-1', '123456'),
        /not initialized/
      );
    });

    test('should throw error if webSessionId is empty', async () => {
      await sessionBindingService.init();

      assert.rejects(
        () => sessionBindingService.bindSession('', '123456'),
        /webSessionId cannot be empty/
      );

      assert.rejects(
        () => sessionBindingService.bindSession('  ', '123456'),
        /webSessionId cannot be empty/
      );
    });

    test('should throw error if telegramChatId is empty', async () => {
      await sessionBindingService.init();

      assert.rejects(
        () => sessionBindingService.bindSession('web-1', ''),
        /telegramChatId cannot be empty/
      );
    });

    test('should bind session to Telegram chat', async () => {
      await sessionBindingService.init();

      const result = sessionBindingService.bindSession('web-session-1', '123456789');

      assert.strictEqual(result.ok, true);
      assert.strictEqual(sessionBindingService.getBoundChatId('web-session-1'), '123456789');
    });

    test('should persist binding to file', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-session-1', '123456789');

      // Create new instance to verify persistence
      const newService = new SessionBindingService({
        persistenceDir: testFixturesDir
      });
      await newService.init();

      assert.strictEqual(newService.getBoundChatId('web-session-1'), '123456789');
    });

    test('should overwrite existing binding for same web session', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-session-1', '123456789');
      sessionBindingService.bindSession('web-session-1', '987654321');

      assert.strictEqual(sessionBindingService.getBoundChatId('web-session-1'), '987654321');
      assert.deepStrictEqual(sessionBindingService.getBoundWebSessions('123456789'), []);
    });
  });

  describe('unbindSession', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.unbindSession('web-1'),
        /not initialized/
      );
    });

    test('should return error if no binding exists', async () => {
      await sessionBindingService.init();

      const result = sessionBindingService.unbindSession('non-existent');
      assert.strictEqual(result.ok, false);
      assert.ok(result.error.includes('No binding found'));
    });

    test('should unbind existing session', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-session-1', '123456789');

      const result = sessionBindingService.unbindSession('web-session-1');

      assert.strictEqual(result.ok, true);
      assert.strictEqual(sessionBindingService.getBoundChatId('web-session-1'), null);
    });

    test('should update reverse bindings on unbind', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-1', '123456');
      sessionBindingService.bindSession('web-2', '123456');

      assert.deepStrictEqual(
        new Set(sessionBindingService.getBoundWebSessions('123456')),
        new Set(['web-1', 'web-2'])
      );

      sessionBindingService.unbindSession('web-1');

      assert.deepStrictEqual(
        sessionBindingService.getBoundWebSessions('123456'),
        ['web-2']
      );
    });
  });

  describe('getBoundChatId', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.getBoundChatId('web-1'),
        /not initialized/
      );
    });

    test('should return null for non-existent binding', async () => {
      await sessionBindingService.init();

      assert.strictEqual(sessionBindingService.getBoundChatId('non-existent'), null);
    });

    test('should return correct chat ID for bound session', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-1', '123456');

      assert.strictEqual(sessionBindingService.getBoundChatId('web-1'), '123456');
    });
  });

  describe('getBoundWebSessions', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.getBoundWebSessions('123456'),
        /not initialized/
      );
    });

    test('should return empty array for chat with no bindings', async () => {
      await sessionBindingService.init();

      assert.deepStrictEqual(sessionBindingService.getBoundWebSessions('123456'), []);
    });

    test('should return all web sessions bound to a chat ID', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-1', '123456');
      sessionBindingService.bindSession('web-2', '123456');
      sessionBindingService.bindSession('web-3', '789012');

      const sessions = sessionBindingService.getBoundWebSessions('123456');
      assert.ok(sessions.includes('web-1'));
      assert.ok(sessions.includes('web-2'));
      assert.strictEqual(sessions.length, 2);
    });
  });

  describe('getAllBindings', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.getAllBindings(),
        /not initialized/
      );
    });

    test('should return all bindings as object', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-1', '123456');
      sessionBindingService.bindSession('web-2', '789012');

      const all = sessionBindingService.getAllBindings();

      assert.strictEqual(all['web-1'], '123456');
      assert.strictEqual(all['web-2'], '789012');
      assert.strictEqual(Object.keys(all).length, 2);
    });
  });

  describe('clearAllBindings', () => {
    test('should throw error if not initialized', async () => {
      assert.rejects(
        () => sessionBindingService.clearAllBindings(),
        /not initialized/
      );
    });

    test('should clear all bindings', async () => {
      await sessionBindingService.init();
      sessionBindingService.bindSession('web-1', '123456');
      sessionBindingService.bindSession('web-2', '789012');

      const result = sessionBindingService.clearAllBindings();

      assert.strictEqual(result.ok, true);
      assert.strictEqual(sessionBindingService.getBoundChatId('web-1'), null);
      assert.strictEqual(sessionBindingService.getBoundChatId('web-2'), null);
    });
  });
});
