/**
 * Tests for F-021 ProfileStore
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../../fixtures/profile-store-f021');
const testProfilesPath = path.join(testFixturesDir, 'cli-profiles.json');

describe('F-021 ProfileStore', () => {
  let ProfileStore;
  let store;

  beforeEach(async () => {
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testFixturesDir, { recursive: true });

    const projectRoot = process.cwd();
    const mod = await import(`file://${projectRoot}/src/services/profile-store.js`);
    ProfileStore = mod.ProfileStore;
    store = new ProfileStore({ persistencePath: testProfilesPath });
  });

  afterEach(async () => {
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('init()', () => {
    test('should start empty when no file exists', async () => {
      await store.init();
      assert.deepEqual(store.listProfiles(), []);
    });

    test('should load profiles from existing file', async () => {
      // Pre-write a profiles file
      const data = {
        defaultProfileName: 'default',
        profiles: [
          { name: 'default', binPath: '/usr/bin/cb', permissionFlag: '-y', timeoutMs: null, description: 'Default' }
        ]
      };
      await mkdir(testFixturesDir, { recursive: true });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(testProfilesPath, JSON.stringify(data), 'utf8');

      await store.init();
      const profiles = store.listProfiles();
      assert.equal(profiles.length, 1);
      assert.equal(profiles[0].name, 'default');
      assert.equal(profiles[0].binPath, '/usr/bin/cb');
      assert.equal(store.getDefaultProfileName(), 'default');
    });

    test('should accept persistencePath override', async () => {
      const altPath = path.join(testFixturesDir, 'alt-profiles.json');
      await store.init({ persistencePath: altPath });
      assert.deepEqual(store.listProfiles(), []);
    });
  });

  describe('addProfile()', () => {
    test('should add a profile and return it', async () => {
      const p = await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude' });
      assert.equal(p.name, 'claude');
      assert.equal(p.binPath, '/usr/bin/claude');
      assert.equal(p.permissionFlag, null);
      assert.equal(p.timeoutMs, null);
    });

    test('should set default description when not provided', async () => {
      const p = await store.addProfile({ name: 'mybot', binPath: '/usr/bin/mybot' });
      assert.equal(p.description, 'mybot CLI backend');
    });

    test('should persist added profile to disk', async () => {
      await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude', permissionFlag: '-y', timeoutMs: 300000 });
      const raw = await readFile(testProfilesPath, 'utf8');
      const data = JSON.parse(raw);
      assert.ok(Array.isArray(data.profiles));
      const saved = data.profiles.find(p => p.name === 'claude');
      assert.ok(saved);
      assert.equal(saved.permissionFlag, '-y');
      assert.equal(saved.timeoutMs, 300000);
    });

    test('should overwrite existing profile with same name', async () => {
      await store.addProfile({ name: 'claude', binPath: '/old/path' });
      await store.addProfile({ name: 'claude', binPath: '/new/path' });
      assert.equal(store.getProfile('claude').binPath, '/new/path');
    });

    test('should throw when name is missing', async () => {
      await assert.rejects(
        () => store.addProfile({ binPath: '/usr/bin/claude' }),
        { message: 'Profile must have a name and binPath' }
      );
    });

    test('should throw when binPath is missing', async () => {
      await assert.rejects(
        () => store.addProfile({ name: 'claude' }),
        { message: 'Profile must have a name and binPath' }
      );
    });
  });

  describe('removeProfile()', () => {
    test('should remove an existing profile', async () => {
      await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude' });
      await store.removeProfile('claude');
      assert.equal(store.getProfile('claude'), undefined);
    });

    test('should throw when removing default profile', async () => {
      store.setDefaultProfileName('default');
      await store.addProfile({ name: 'default', binPath: '/usr/bin/cb' });
      await assert.rejects(
        () => store.removeProfile('default'),
        { message: 'Cannot remove the default profile "default"' }
      );
    });

    test('should throw when profile not found', async () => {
      await assert.rejects(
        () => store.removeProfile('nonexistent'),
        { message: 'Profile "nonexistent" not found' }
      );
    });

    test('should persist removal to disk', async () => {
      await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude' });
      await store.addProfile({ name: 'gpt', binPath: '/usr/bin/gpt' });
      await store.removeProfile('claude');
      const raw = await readFile(testProfilesPath, 'utf8');
      const data = JSON.parse(raw);
      const names = data.profiles.map(p => p.name);
      assert.ok(!names.includes('claude'));
      assert.ok(names.includes('gpt'));
    });
  });

  describe('getProfile()', () => {
    test('should return profile by name', async () => {
      await store.addProfile({ name: 'mybot', binPath: '/usr/bin/mybot' });
      const p = store.getProfile('mybot');
      assert.equal(p.name, 'mybot');
    });

    test('should return undefined for unknown name', () => {
      assert.equal(store.getProfile('unknown'), undefined);
    });
  });

  describe('listProfiles()', () => {
    test('should return empty array when no profiles', () => {
      assert.deepEqual(store.listProfiles(), []);
    });

    test('should return all added profiles', async () => {
      await store.addProfile({ name: 'a', binPath: '/bin/a' });
      await store.addProfile({ name: 'b', binPath: '/bin/b' });
      const list = store.listProfiles();
      assert.equal(list.length, 2);
      assert.ok(list.some(p => p.name === 'a'));
      assert.ok(list.some(p => p.name === 'b'));
    });
  });

  describe('hasProfile()', () => {
    test('should return true for existing profile', async () => {
      await store.addProfile({ name: 'x', binPath: '/bin/x' });
      assert.equal(store.hasProfile('x'), true);
    });

    test('should return false for missing profile', () => {
      assert.equal(store.hasProfile('nothere'), false);
    });
  });

  describe('setDefaultProfileName() / getDefaultProfileName()', () => {
    test('should set and get default profile name', () => {
      store.setDefaultProfileName('mydefault');
      assert.equal(store.getDefaultProfileName(), 'mydefault');
    });
  });

  describe('persistence round-trip', () => {
    test('should reload profiles from disk after re-init', async () => {
      await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude', permissionFlag: '-y' });
      await store.addProfile({ name: 'gpt', binPath: '/usr/bin/gpt', timeoutMs: 60000 });

      const store2 = new ProfileStore({ persistencePath: testProfilesPath });
      await store2.init();

      const profiles = store2.listProfiles();
      assert.equal(profiles.length, 2);
      const claude = store2.getProfile('claude');
      assert.equal(claude.permissionFlag, '-y');
      const gpt = store2.getProfile('gpt');
      assert.equal(gpt.timeoutMs, 60000);
    });
  });
});
