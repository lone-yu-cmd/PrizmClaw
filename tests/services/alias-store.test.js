/**
 * Tests for F-013 Alias Store
 * Task 3.6: Unit tests for alias-store.js
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../fixtures/alias-store-f013');
const testAliasPath = path.join(testFixturesDir, 'aliases.json');

// Helper to check if file exists
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('F-013 Alias Store', () => {
  let aliasStore;

  beforeEach(async () => {
    // Clean up test fixtures directory
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testFixturesDir, { recursive: true });

    // Import module
    const module = await import('../../src/services/alias-store.js');
    aliasStore = module.aliasStore;
    // Note: aliasStore is a singleton, we reset it
    aliasStore.reset();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('initAliasStore', () => {
    test('should initialize with persistence path', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      // Should not throw
    });

    test('should load existing aliases on init', async () => {
      // Create a pre-existing aliases file
      const existingData = {
        '123456789': { ll: 'ls -la', gp: 'git pull' }
      };
      await writeFile(testAliasPath, JSON.stringify(existingData));

      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, 'ls -la');
    });

    test('should handle missing file on init', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      // Should not throw
    });
  });

  describe('setAlias', () => {
    test('should set an alias for a user', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, 'ls -la');
    });

    test('should persist alias to file', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      // Read file directly
      const content = await readFile(testAliasPath, 'utf-8');
      const data = JSON.parse(content);
      assert.equal(data['123456789'].ll, 'ls -la');
    });

    test('should reject invalid alias name with spaces', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      await assert.rejects(
        async () => aliasStore.setAlias('123456789', 'invalid name', 'ls'),
        /spaces/
      );
    });

    test('should reject invalid alias name with equals', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      await assert.rejects(
        async () => aliasStore.setAlias('123456789', 'invalid=name', 'ls'),
        /equals/
      );
    });

    test('should throw if not initialized', async () => {
      aliasStore.reset();
      await assert.rejects(
        async () => aliasStore.setAlias('123456789', 'll', 'ls -la'),
        /not initialized/
      );
    });
  });

  describe('getAlias', () => {
    test('should return null for non-existent alias', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const alias = aliasStore.getAlias('123456789', 'nonexistent');
      assert.equal(alias, null);
    });

    test('should return null for non-existent user', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const alias = aliasStore.getAlias('999999999', 'll');
      assert.equal(alias, null);
    });

    test('should return alias for existing user', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, 'ls -la');
    });
  });

  describe('getAllAliases', () => {
    test('should return empty object for user with no aliases', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const aliases = aliasStore.getAllAliases('123456789');
      assert.deepEqual(aliases, {});
    });

    test('should return all aliases for user', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');
      await aliasStore.setAlias('123456789', 'gp', 'git pull');

      const aliases = aliasStore.getAllAliases('123456789');
      assert.deepEqual(aliases, { ll: 'ls -la', gp: 'git pull' });
    });
  });

  describe('deleteAlias', () => {
    test('should delete an existing alias', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      const result = await aliasStore.deleteAlias('123456789', 'll');
      assert.equal(result, true);

      const alias = aliasStore.getAlias('123456789', 'll');
      assert.equal(alias, null);
    });

    test('should return false for non-existent alias', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const result = await aliasStore.deleteAlias('123456789', 'nonexistent');
      assert.equal(result, false);
    });

    test('should persist deletion to file', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');
      await aliasStore.setAlias('123456789', 'gp', 'git pull');

      await aliasStore.deleteAlias('123456789', 'll');

      const content = await readFile(testAliasPath, 'utf-8');
      const data = JSON.parse(content);
      assert.equal(data['123456789'].ll, undefined);
      assert.equal(data['123456789'].gp, 'git pull');
    });
  });

  describe('resolveAlias', () => {
    test('should return command for valid alias', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      const command = aliasStore.resolveAlias('123456789', 'll');
      assert.equal(command, 'ls -la');
    });

    test('should return null for non-existent alias', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      const command = aliasStore.resolveAlias('123456789', 'nonexistent');
      assert.equal(command, null);
    });
  });

  describe('loadAliases', () => {
    test('should load aliases from file', async () => {
      // Create file manually
      const data = {
        '123456789': { ll: 'ls -la' },
        '987654321': { d: 'docker' }
      };
      await writeFile(testAliasPath, JSON.stringify(data));

      await aliasStore.initAliasStore({ persistencePath: testAliasPath });

      assert.equal(aliasStore.getAlias('123456789', 'll'), 'ls -la');
      assert.equal(aliasStore.getAlias('987654321', 'd'), 'docker');
    });

    test('should handle corrupted JSON file', async () => {
      await writeFile(testAliasPath, 'not valid json');

      // Should not throw, just start fresh
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      // Should not throw
    });
  });

  describe('saveAliases', () => {
    test('should save aliases to file', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      // Verify file was created
      assert.ok(await fileExists(testAliasPath));
    });

    test('should create parent directory if needed', async () => {
      const nestedPath = path.join(testFixturesDir, 'nested', 'dir', 'aliases.json');
      await aliasStore.initAliasStore({ persistencePath: nestedPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');

      assert.ok(await fileExists(nestedPath));
    });
  });

  describe('user isolation', () => {
    test('should keep aliases separate per user', async () => {
      await aliasStore.initAliasStore({ persistencePath: testAliasPath });
      await aliasStore.setAlias('123456789', 'll', 'ls -la');
      await aliasStore.setAlias('987654321', 'll', 'ls -lh');

      assert.equal(aliasStore.getAlias('123456789', 'll'), 'ls -la');
      assert.equal(aliasStore.getAlias('987654321', 'll'), 'ls -lh');
    });
  });
});
