/**
 * Test State Manager Helper
 * F-007: Test and Validation Suite
 *
 * Manages temporary state files for integration tests.
 */

import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary directory for test state
 * @param {string} [prefix='test-state-'] - Prefix for the temp directory
 * @returns {Promise<{ path: string, cleanup: Function }>} Temp directory path and cleanup function
 */
export async function createTestStateDir(prefix = 'test-state-') {
  const tempPath = await mkdtemp(join(tmpdir(), prefix));

  return {
    path: tempPath,
    cleanup: async () => {
      await rm(tempPath, { recursive: true, force: true });
    }
  };
}

/**
 * Create a full test pipeline state directory structure
 * @param {Object} options - Configuration options
 * @param {string} [options.prefix='pipeline-test-'] - Prefix for temp directory
 * @returns {Promise<{ tempDir: string, stateDir: string, bugfixStateDir: string, plansDir: string, cleanup: Function }>}
 */
export async function createTestPipelineDirs(options = {}) {
  const prefix = options.prefix || 'pipeline-test-';
  const tempDir = await mkdtemp(join(tmpdir(), prefix));

  const stateDir = join(tempDir, 'dev-pipeline', 'state');
  const bugfixStateDir = join(tempDir, 'dev-pipeline', 'bugfix-state');
  const plansDir = join(tempDir, 'plans');
  const featureListDir = join(plansDir, 'feature-list');
  const bugFixListDir = join(plansDir, 'bug-fix-list');

  await mkdir(stateDir, { recursive: true });
  await mkdir(bugfixStateDir, { recursive: true });
  await mkdir(featureListDir, { recursive: true });
  await mkdir(bugFixListDir, { recursive: true });

  return {
    tempDir,
    stateDir,
    bugfixStateDir,
    plansDir,
    featureListDir,
    bugFixListDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Write test state to a file
 * @param {string} filePath - Path to write to
 * @param {Object} data - Data to write
 * @returns {Promise<void>}
 */
export async function writeTestState(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Read test state from a file
 * @template T
 * @param {string} filePath - Path to read from
 * @returns {Promise<T|null>} Parsed JSON or null if file doesn't exist
 */
export async function readTestState(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create a mock state file for pipeline
 * @param {string} stateDir - State directory path
 * @param {Object} state - State object
 * @param {string} [type='feature'] - Pipeline type
 * @returns {Promise<string>} Path to the state file
 */
export async function createPipelineState(stateDir, state, type = 'feature') {
  const stateFile = join(stateDir, 'pipeline-state.json');
  await writeTestState(stateFile, state);
  return stateFile;
}

/**
 * Create a mock daemon meta file
 * @param {string} stateDir - State directory path
 * @param {Object} meta - Daemon metadata
 * @param {string} [type='feature'] - Pipeline type
 * @returns {Promise<string>} Path to the meta file
 */
export async function createDaemonMeta(stateDir, meta, type = 'feature') {
  const metaFile = join(stateDir, 'daemon-meta.json');
  await writeTestState(metaFile, meta);
  return metaFile;
}

/**
 * Create a mock lock file
 * @param {string} stateDir - State directory path
 * @param {number} pid - PID to lock with
 * @param {string} [type='feature'] - Pipeline type
 * @returns {Promise<string>} Path to the lock file
 */
export async function createLockFile(stateDir, pid, type = 'feature') {
  const lockFile = join(stateDir, 'pipeline.lock');
  await writeTestState(lockFile, {
    pid,
    createdAt: new Date().toISOString()
  });
  return lockFile;
}

/**
 * Create a test plan file
 * @param {string} plansDir - Plans directory
 * @param {string} type - Plan type ('feature-list' or 'bug-fix-list')
 * @param {Object} content - Plan content
 * @param {string} [version='current'] - Version identifier
 * @returns {Promise<string>} Path to the plan file
 */
export async function createTestPlan(plansDir, type, content, version = 'current') {
  const planDir = join(plansDir, type);
  await mkdir(planDir, { recursive: true });

  const planFile = join(planDir, `${version}.json`);
  await writeTestState(planFile, content);
  return planFile;
}

/**
 * Synchronous cleanup helper for afterEach/afterAll hooks
 * @param {string} path - Path to clean up
 * @returns {Function} Cleanup function
 */
export function cleanupOnExit(path) {
  return async () => {
    try {
      await rm(path, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };
}

export default {
  createTestStateDir,
  createTestPipelineDirs,
  writeTestState,
  readTestState,
  createPipelineState,
  createDaemonMeta,
  createLockFile,
  createTestPlan,
  cleanupOnExit
};
