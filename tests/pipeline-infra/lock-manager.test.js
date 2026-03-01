/**
 * Lock Manager Unit Tests
 * Tests for src/pipeline-infra/lock-manager.js
 *
 * F-004: Pipeline Process Controller - US-7 Concurrency Protection
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createLockManager } from '../../src/pipeline-infra/lock-manager.js';

/**
 * Helper to create temp directory for test state
 */
function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-manager-test-'));
  const stateDir = path.join(tempDir, 'dev-pipeline', 'state');
  const bugfixStateDir = path.join(tempDir, 'dev-pipeline', 'bugfix-state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(bugfixStateDir, { recursive: true });
  return {
    tempDir,
    stateDir,
    bugfixStateDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Helper to create a mock config
 */
function createMockConfig(stateDir, bugfixStateDir) {
  const projectRoot = path.dirname(path.dirname(stateDir));
  return {
    projectRoot,
    stateDir,
    bugfixStateDir
  };
}

test('createLockManager should be a factory function', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });
    assert.equal(typeof manager.acquireLock, 'function');
    assert.equal(typeof manager.releaseLock, 'function');
    assert.equal(typeof manager.isLocked, 'function');
    assert.equal(typeof manager.validateLock, 'function');
    assert.equal(typeof manager.forceUnlock, 'function');
    assert.equal(typeof manager.getLockInfo, 'function');
  } finally {
    cleanup();
  }
});

test('acquireLock should create lock file with PID and timestamp', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    const result = await manager.acquireLock('feature', 12345);

    assert.equal(result.ok, true);
    assert.ok(result.lockPath.endsWith('.pipeline.lock'));

    // Verify lock file contents
    const lockContent = JSON.parse(fs.readFileSync(result.lockPath, 'utf8'));
    assert.equal(lockContent.pid, 12345);
    assert.ok(lockContent.acquiredAt);
    assert.equal(lockContent.type, 'feature');
    assert.ok(lockContent.hostname);
  } finally {
    cleanup();
  }
});

test('acquireLock should fail if lock already held by live process', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // First acquire with current process PID (guaranteed alive)
    const result1 = await manager.acquireLock('feature', process.pid);
    assert.equal(result1.ok, true);

    // Try to acquire again with different PID
    const result2 = await manager.acquireLock('feature', 99999);
    assert.equal(result2.ok, false);
    assert.equal(result2.errorCode, 'LOCK_ACQUISITION_FAILED');
    assert.ok(result2.currentHolder);
    assert.equal(result2.currentHolder.pid, process.pid);
  } finally {
    cleanup();
  }
});

test('acquireLock should succeed if lock held by dead process (stale lock)', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Create a stale lock with a non-existent PID
    const lockPath = path.join(stateDir, '.pipeline.lock');
    const staleLock = {
      pid: 99999999, // Very unlikely to exist
      acquiredAt: new Date().toISOString(),
      type: 'feature',
      hostname: 'test'
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleLock));

    // Should succeed because stale lock
    const result = await manager.acquireLock('feature', process.pid);
    assert.equal(result.ok, true);
  } finally {
    cleanup();
  }
});

test('releaseLock should remove lock file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Acquire lock
    await manager.acquireLock('feature', process.pid);
    const lockPath = path.join(stateDir, '.pipeline.lock');
    assert.ok(fs.existsSync(lockPath));

    // Release lock
    await manager.releaseLock('feature', process.pid);
    assert.ok(!fs.existsSync(lockPath));
  } finally {
    cleanup();
  }
});

test('releaseLock should only release lock owned by current PID', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Acquire lock with specific PID
    await manager.acquireLock('feature', process.pid);

    // Try to release with different PID
    await manager.releaseLock('feature', 99999);

    // Lock should still exist
    const lockPath = path.join(stateDir, '.pipeline.lock');
    assert.ok(fs.existsSync(lockPath));
  } finally {
    cleanup();
  }
});

test('isLocked should return true when lock exists and holder is alive', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    await manager.acquireLock('feature', process.pid);
    const locked = await manager.isLocked('feature');
    assert.equal(locked, true);
  } finally {
    cleanup();
  }
});

test('isLocked should return false when no lock exists', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    const locked = await manager.isLocked('feature');
    assert.equal(locked, false);
  } finally {
    cleanup();
  }
});

test('isLocked should return false when lock held by dead process', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Create a stale lock
    const lockPath = path.join(stateDir, '.pipeline.lock');
    const staleLock = {
      pid: 99999999,
      acquiredAt: new Date().toISOString(),
      type: 'feature',
      hostname: 'test'
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleLock));

    const locked = await manager.isLocked('feature');
    assert.equal(locked, false);
  } finally {
    cleanup();
  }
});

test('validateLock should return lock info if valid', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    await manager.acquireLock('feature', process.pid);
    const lockInfo = await manager.validateLock('feature');

    assert.ok(lockInfo);
    assert.equal(lockInfo.pid, process.pid);
    assert.ok(lockInfo.acquiredAt);
    assert.equal(lockInfo.type, 'feature');
  } finally {
    cleanup();
  }
});

test('validateLock should return null if lock invalid or missing', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    const lockInfo = await manager.validateLock('feature');
    assert.equal(lockInfo, null);
  } finally {
    cleanup();
  }
});

test('forceUnlock should remove lock regardless of owner', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Create a lock with a different PID
    const lockPath = path.join(stateDir, '.pipeline.lock');
    const lock = {
      pid: 88888,
      acquiredAt: new Date().toISOString(),
      type: 'feature',
      hostname: 'test'
    };
    fs.writeFileSync(lockPath, JSON.stringify(lock));

    // Force unlock
    const result = await manager.forceUnlock('feature');
    assert.equal(result.ok, true);
    assert.equal(result.previousPid, 88888);
    assert.ok(!fs.existsSync(lockPath));
  } finally {
    cleanup();
  }
});

test('getLockInfo should return lock details', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    await manager.acquireLock('feature', process.pid);
    const lockInfo = await manager.getLockInfo('feature');

    assert.ok(lockInfo);
    assert.equal(lockInfo.pid, process.pid);
    assert.ok(lockInfo.acquiredAt);
    assert.equal(lockInfo.type, 'feature');
    assert.ok(lockInfo.hostname);
  } finally {
    cleanup();
  }
});

test('lock operations should work for both feature and bugfix types', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    // Acquire both locks
    const featureResult = await manager.acquireLock('feature', process.pid);
    const bugfixResult = await manager.acquireLock('bugfix', process.pid);

    assert.equal(featureResult.ok, true);
    assert.equal(bugfixResult.ok, true);

    // Both should be locked
    assert.equal(await manager.isLocked('feature'), true);
    assert.equal(await manager.isLocked('bugfix'), true);

    // Release one should not affect the other
    await manager.releaseLock('feature', process.pid);
    assert.equal(await manager.isLocked('feature'), false);
    assert.equal(await manager.isLocked('bugfix'), true);
  } finally {
    cleanup();
  }
});

test('lock file should be written atomically', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    const result = await manager.acquireLock('feature', process.pid);
    assert.equal(result.ok, true);

    // Verify no temp files left
    const lockDir = stateDir;
    const files = fs.readdirSync(lockDir);
    const tempFiles = files.filter(f => f.includes('.tmp'));
    assert.equal(tempFiles.length, 0);
  } finally {
    cleanup();
  }
});

test('lock file should include hostname for debugging', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createLockManager({ config });

    await manager.acquireLock('feature', process.pid);
    const lockInfo = await manager.getLockInfo('feature');

    assert.equal(lockInfo.hostname, os.hostname());
  } finally {
    cleanup();
  }
});
