/**
 * State Manager Unit Tests
 * Tests for src/pipeline-infra/state-manager.js
 *
 * F-004: Pipeline Process Controller - US-5 Status Query, US-6 Logs Query
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createStateManager } from '../../src/pipeline-infra/state-manager.js';

/**
 * Helper to create temp directory for test state
 */
function createTempStateDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-manager-test-'));
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

/**
 * Helper to create sample daemon meta
 */
function createSampleDaemonMeta() {
  return {
    pid: 12345,
    started_at: '2026-03-12T10:30:00Z',
    feature_list: '/path/to/feature-list.json',
    env_overrides: '',
    log_file: '/path/to/pipeline-daemon.log'
  };
}

/**
 * Helper to create sample pipeline state
 */
function createSamplePipelineState() {
  return {
    run_id: 'run-20260312-103000',
    status: 'running',
    feature_list_path: '/path/to/feature-list.json',
    created_at: '2026-03-12T10:30:00Z',
    total_features: 8,
    completed_features: 3
  };
}

test('createStateManager should be a factory function', () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });
    assert.equal(typeof manager.readDaemonMeta, 'function');
    assert.equal(typeof manager.readPipelineState, 'function');
    assert.equal(typeof manager.readCurrentSession, 'function');
    assert.equal(typeof manager.getLastResult, 'function');
    assert.equal(typeof manager.writeDaemonMeta, 'function');
    assert.equal(typeof manager.writeLastResult, 'function');
    assert.equal(typeof manager.isDaemonRunning, 'function');
    assert.equal(typeof manager.getDaemonPid, 'function');
    assert.equal(typeof manager.readLogs, 'function');
  } finally {
    cleanup();
  }
});

test('readDaemonMeta should return parsed daemon meta JSON', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write daemon meta
    const meta = createSampleDaemonMeta();
    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), JSON.stringify(meta));

    const result = await manager.readDaemonMeta('feature');
    assert.deepEqual(result, meta);
  } finally {
    cleanup();
  }
});

test('readDaemonMeta should return null if file does not exist', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.readDaemonMeta('feature');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('readPipelineState should return parsed pipeline state JSON', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write pipeline state
    const state = createSamplePipelineState();
    fs.writeFileSync(path.join(stateDir, 'pipeline.json'), JSON.stringify(state));

    const result = await manager.readPipelineState('feature');
    assert.deepEqual(result, state);
  } finally {
    cleanup();
  }
});

test('readPipelineState should return null if file does not exist', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.readPipelineState('feature');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('readCurrentSession should return current session info', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write current session
    const session = { feature_id: 'F-001', started_at: '2026-03-12T10:30:00Z' };
    fs.writeFileSync(path.join(stateDir, 'current-session.json'), JSON.stringify(session));

    const result = await manager.readCurrentSession('feature');
    assert.deepEqual(result, session);
  } finally {
    cleanup();
  }
});

test('getLastResult should return last result JSON', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write last result
    const lastResult = {
      runId: 'run-20260312-103000',
      completedAt: '2026-03-12T12:45:00Z',
      status: 'success',
      featuresTotal: 8,
      featuresCompleted: 8
    };
    fs.writeFileSync(path.join(stateDir, '.last-result.json'), JSON.stringify(lastResult));

    const result = await manager.getLastResult('feature');
    assert.deepEqual(result, lastResult);
  } finally {
    cleanup();
  }
});

test('getLastResult should return null if no last result exists', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.getLastResult('feature');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('writeDaemonMeta should write daemon meta to file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const meta = createSampleDaemonMeta();
    await manager.writeDaemonMeta('feature', meta);

    const filePath = path.join(stateDir, '.pipeline-meta.json');
    assert.ok(fs.existsSync(filePath));

    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepEqual(written, meta);
  } finally {
    cleanup();
  }
});

test('writeLastResult should write last result to file', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const lastResult = {
      runId: 'run-test',
      completedAt: '2026-03-12T12:45:00Z',
      status: 'success',
      featuresTotal: 8,
      featuresCompleted: 8
    };
    await manager.writeLastResult('feature', lastResult);

    const filePath = path.join(stateDir, '.last-result.json');
    assert.ok(fs.existsSync(filePath));

    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepEqual(written, lastResult);
  } finally {
    cleanup();
  }
});

test('isDaemonRunning should return true if PID is alive', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write daemon meta with current process PID (guaranteed alive)
    const meta = { ...createSampleDaemonMeta(), pid: process.pid };
    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), JSON.stringify(meta));

    const result = await manager.isDaemonRunning('feature');
    assert.equal(result, true);
  } finally {
    cleanup();
  }
});

test('isDaemonRunning should return false if PID is dead', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write daemon meta with non-existent PID
    const meta = { ...createSampleDaemonMeta(), pid: 99999999 };
    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), JSON.stringify(meta));

    const result = await manager.isDaemonRunning('feature');
    assert.equal(result, false);
  } finally {
    cleanup();
  }
});

test('isDaemonRunning should return false if no daemon meta exists', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.isDaemonRunning('feature');
    assert.equal(result, false);
  } finally {
    cleanup();
  }
});

test('getDaemonPid should return PID from daemon meta', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const meta = createSampleDaemonMeta();
    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), JSON.stringify(meta));

    const result = await manager.getDaemonPid('feature');
    assert.equal(result, 12345);
  } finally {
    cleanup();
  }
});

test('getDaemonPid should return null if no daemon meta exists', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.getDaemonPid('feature');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('state operations should work for both feature and bugfix types', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write different daemon metas
    const featureMeta = { ...createSampleDaemonMeta(), pid: 11111 };
    const bugfixMeta = { ...createSampleDaemonMeta(), pid: 22222 };

    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), JSON.stringify(featureMeta));
    fs.writeFileSync(path.join(bugfixStateDir, '.pipeline-meta.json'), JSON.stringify(bugfixMeta));

    const featurePid = await manager.getDaemonPid('feature');
    const bugfixPid = await manager.getDaemonPid('bugfix');

    assert.equal(featurePid, 11111);
    assert.equal(bugfixPid, 22222);
  } finally {
    cleanup();
  }
});

test('readDaemonMeta should handle corrupted JSON gracefully', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write invalid JSON
    fs.writeFileSync(path.join(stateDir, '.pipeline-meta.json'), 'not valid json {{{');

    const result = await manager.readDaemonMeta('feature');
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test('readLogs should return log content', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write log file
    const logContent = 'Line 1\nLine 2\nLine 3\n';
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), logContent);

    const result = await manager.readLogs('feature', 10);
    assert.ok(result.logs.includes('Line 1'));
    assert.ok(result.logs.includes('Line 2'));
    assert.ok(result.logs.includes('Line 3'));
    assert.ok(result.logPath.endsWith('pipeline-daemon.log'));
  } finally {
    cleanup();
  }
});

test('readLogs should limit lines', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    // Write log file with many lines
    const lines = [];
    for (let i = 1; i <= 200; i++) {
      lines.push(`Line ${i}`);
    }
    fs.writeFileSync(path.join(stateDir, 'pipeline-daemon.log'), lines.join('\n'));

    const result = await manager.readLogs('feature', 50);
    const resultLines = result.logs.split('\n').filter(l => l.trim());
    assert.ok(resultLines.length <= 50);
    assert.ok(result.logs.includes('Line 200')); // Should include last line
  } finally {
    cleanup();
  }
});

test('readLogs should handle missing log file gracefully', async () => {
  const { cleanup, stateDir, bugfixStateDir } = createTempStateDir();
  try {
    const config = createMockConfig(stateDir, bugfixStateDir);
    const manager = createStateManager({ config });

    const result = await manager.readLogs('feature');
    assert.equal(result.logs, '');
    assert.equal(result.lines, 0);
  } finally {
    cleanup();
  }
});
