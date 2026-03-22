/**
 * Tests for F-021 /cli command handler extensions (profiles, add, remove, use)
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../../../fixtures/cli-handler-f021');
const testProfilesPath = path.join(testFixturesDir, 'cli-profiles.json');

// Fake binary path for testing (use node itself which is always accessible)
const FAKE_BIN = process.execPath;

describe('F-021 /cli Command Handler Extensions', () => {
  let CliCommandHandler;
  let ProfileStore;
  let BackendRegistry;
  let handler;
  let store;
  let registry;

  function makeCtx(userId = 123) {
    return { from: { id: userId } };
  }

  beforeEach(async () => {
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testFixturesDir, { recursive: true });

    const projectRoot = process.cwd();
    const cliMod = await import(`file://${projectRoot}/src/bot/commands/handlers/cli.js`);
    const profileMod = await import(`file://${projectRoot}/src/services/profile-store.js`);
    const registryMod = await import(`file://${projectRoot}/src/services/backend-registry.js`);

    CliCommandHandler = cliMod.CliCommandHandler;
    ProfileStore = profileMod.ProfileStore;
    BackendRegistry = registryMod.BackendRegistry;

    // Create isolated instances with no-op binary validator
    store = new ProfileStore({ persistencePath: testProfilesPath });
    registry = new BackendRegistry({ validator: () => {} }); // no-op validator

    handler = new CliCommandHandler({
      backendRegistry: registry,
      profileStore: store
    });
  });

  afterEach(async () => {
    try {
      await rm(testFixturesDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  // ─── /cli profiles ────────────────────────────────────────────────────────

  describe('/cli profiles', () => {
    test('should show empty message when no profiles', async () => {
      const result = await handler.handle(makeCtx(), ['profiles']);
      assert.ok(result.includes('No profiles saved'), `Got: ${result}`);
    });

    test('should list profiles with details', async () => {
      store.setDefaultProfileName('default');
      await store.addProfile({
        name: 'default',
        binPath: '/usr/bin/cb',
        permissionFlag: '-y',
        timeoutMs: null
      });
      await store.addProfile({
        name: 'claude',
        binPath: '/usr/bin/claude',
        permissionFlag: null,
        timeoutMs: 300000
      });

      const result = await handler.handle(makeCtx(), ['profiles']);
      assert.ok(result.includes('default'), `Got: ${result}`);
      assert.ok(result.includes('claude'), `Got: ${result}`);
      assert.ok(result.includes('[default]'), `Got: ${result}`);
      assert.ok(result.includes('300000ms'), `Got: ${result}`);
      assert.ok(result.includes('-y'), `Got: ${result}`);
    });
  });

  // ─── /cli add ─────────────────────────────────────────────────────────────

  describe('/cli add', () => {
    test('should return usage error when no args', async () => {
      const result = await handler.handle(makeCtx(), ['add']);
      assert.ok(result.includes('Usage:'), `Got: ${result}`);
      assert.ok(result.includes('/cli add'), `Got: ${result}`);
    });

    test('should return usage error when missing bin', async () => {
      const result = await handler.handle(makeCtx(), ['add', 'myprofile']);
      assert.ok(result.includes('Usage:'), `Got: ${result}`);
    });

    test('should add a profile and register in backendRegistry', async () => {
      const result = await handler.handle(makeCtx(), ['add', 'myprofile', FAKE_BIN]);
      assert.ok(result.includes('✅'), `Got: ${result}`);
      assert.ok(result.includes('myprofile'), `Got: ${result}`);
      assert.ok(store.hasProfile('myprofile'));
      assert.ok(registry.getBackend('myprofile'));
    });

    test('should support --permission flag', async () => {
      const result = await handler.handle(makeCtx(), ['add', 'myprofile', FAKE_BIN, '--permission=-y']);
      assert.ok(result.includes('✅'), `Got: ${result}`);
      assert.ok(result.includes('-y'), `Got: ${result}`);
      assert.equal(store.getProfile('myprofile').permissionFlag, '-y');
    });

    test('should support --timeout flag', async () => {
      const result = await handler.handle(makeCtx(), ['add', 'myprofile', FAKE_BIN, '--timeout=300000']);
      assert.ok(result.includes('✅'), `Got: ${result}`);
      assert.ok(result.includes('300000ms'), `Got: ${result}`);
      assert.equal(store.getProfile('myprofile').timeoutMs, 300000);
    });

    test('should reject invalid --timeout value', async () => {
      const result = await handler.handle(makeCtx(), ['add', 'myprofile', FAKE_BIN, '--timeout=abc']);
      assert.ok(result.includes('❌'), `Got: ${result}`);
      assert.ok(result.includes('timeout'), `Got: ${result}`);
    });

    test('should update backendRegistry fields if backend already registered', async () => {
      registry.registerBackend('myprofile', FAKE_BIN, {});
      const result = await handler.handle(makeCtx(), ['add', 'myprofile', FAKE_BIN, '--permission=-y']);
      assert.ok(result.includes('✅'), `Got: ${result}`);
      assert.equal(registry.getBackend('myprofile').permissionFlag, '-y');
    });

    test('should warn when binary not accessible (registry with real validator)', async () => {
      // Use a real BackendRegistry to test binary validation failure
      const realRegistry = new BackendRegistry();
      const realHandler = new CliCommandHandler({
        backendRegistry: realRegistry,
        profileStore: store
      });
      const result = await realHandler.handle(makeCtx(), ['add', 'badprofile', '/nonexistent/path']);
      assert.ok(result.includes('⚠️') || result.includes('not accessible'), `Got: ${result}`);
      // Profile should still be persisted
      assert.ok(store.hasProfile('badprofile'));
    });
  });

  // ─── /cli remove ──────────────────────────────────────────────────────────

  describe('/cli remove', () => {
    test('should return usage error when no name', async () => {
      const result = await handler.handle(makeCtx(), ['remove']);
      assert.ok(result.includes('Usage:'), `Got: ${result}`);
    });

    test('should remove a profile', async () => {
      await store.addProfile({ name: 'claude', binPath: '/usr/bin/claude' });
      registry.registerBackend('claude', FAKE_BIN, {});

      const result = await handler.handle(makeCtx(), ['remove', 'claude']);
      assert.ok(result.includes('🗑️'), `Got: ${result}`);
      assert.ok(result.includes('claude'), `Got: ${result}`);
      assert.ok(!store.hasProfile('claude'));
      assert.equal(registry.getBackend('claude'), undefined);
    });

    test('should reject removal of default profile', async () => {
      store.setDefaultProfileName('default');
      await store.addProfile({ name: 'default', binPath: FAKE_BIN });

      const result = await handler.handle(makeCtx(), ['remove', 'default']);
      assert.ok(result.includes('❌'), `Got: ${result}`);
      assert.ok(result.includes('default'), `Got: ${result}`);
      assert.ok(store.hasProfile('default'));
    });

    test('should error when profile not found', async () => {
      const result = await handler.handle(makeCtx(), ['remove', 'nonexistent']);
      assert.ok(result.includes('❌'), `Got: ${result}`);
      assert.ok(result.includes('nonexistent'), `Got: ${result}`);
    });
  });

  // ─── /cli use ─────────────────────────────────────────────────────────────

  describe('/cli use', () => {
    test('should return usage error when no name', async () => {
      const result = await handler.handle(makeCtx(), ['use']);
      assert.ok(result.includes('Usage:'), `Got: ${result}`);
    });

    test('should switch to a registered backend', async () => {
      registry.registerBackend('myprofile', FAKE_BIN, {});

      const result = await handler.handle(makeCtx(), ['use', 'myprofile']);
      assert.ok(result.includes('✅'), `Got: ${result}`);
      assert.ok(result.includes('myprofile'), `Got: ${result}`);
    });

    test('should error when profile not in registry', async () => {
      const result = await handler.handle(makeCtx(), ['use', 'nothere']);
      assert.ok(result.includes('❌'), `Got: ${result}`);
    });

    test('should error when profile not in registry', async () => {
      // 'notinregistry' is not registered in the registry
      const result = await handler.handle(makeCtx(), ['use', 'notinregistry2']);
      assert.ok(result.includes('❌'), `Got: ${result}`);
    });
  });

  // ─── /cli (status with permissionFlag/timeoutMs shown) ───────────────────

  describe('/cli (status)', () => {
    test('should show current backend details including permissionFlag and timeoutMs', async () => {
      registry.registerBackend('testbe', FAKE_BIN, {
        permissionFlag: '-y',
        timeoutMs: 120000
      });

      // Use the handler to switch first
      await handler.handle(makeCtx(42), ['use', 'testbe']);
      const result = await handler.handle(makeCtx(42), []);
      assert.ok(result.includes('testbe'), `Got: ${result}`);
      assert.ok(result.includes('-y'), `Got: ${result}`);
      assert.ok(result.includes('120000ms'), `Got: ${result}`);
    });
  });

  // ─── cliMeta ──────────────────────────────────────────────────────────────

  describe('cliMeta', () => {
    test('should export cliMeta with updated usage', async () => {
      const projectRoot = process.cwd();
      const mod = await import(`file://${projectRoot}/src/bot/commands/handlers/cli.js`);
      assert.ok(mod.cliMeta);
      assert.equal(mod.cliMeta.name, 'cli');
      assert.ok(mod.cliMeta.usage.includes('profiles'), `Usage: ${mod.cliMeta.usage}`);
      assert.ok(mod.cliMeta.usage.includes('add'), `Usage: ${mod.cliMeta.usage}`);
      assert.ok(mod.cliMeta.usage.includes('remove'), `Usage: ${mod.cliMeta.usage}`);
      assert.ok(mod.cliMeta.usage.includes('use'), `Usage: ${mod.cliMeta.usage}`);
    });
  });
});
