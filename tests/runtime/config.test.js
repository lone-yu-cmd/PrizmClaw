import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const configModuleUrl = pathToFileURL(path.resolve(process.cwd(), 'src/config.js')).href;

async function importConfigWithEnv(envPatch) {
  const backup = { ...process.env };
  Object.assign(process.env, envPatch);

  try {
    return await import(`${configModuleUrl}?t=${Date.now()}-${Math.random()}`);
  } finally {
    process.env = backup;
  }
}

test('config should expose pipelineInfra config for runtime integration', async () => {
  const { config } = await importConfigWithEnv({
    ENABLE_TELEGRAM: 'false',
    MAX_RETRIES: '5',
    HEARTBEAT_INTERVAL: '12',
    SESSION_TIMEOUT: '120'
  });

  assert.equal(config.pipelineInfra.maxRetries, 5);
  assert.equal(config.pipelineInfra.heartbeatIntervalSec, 12);
  assert.equal(config.pipelineInfra.sessionTimeoutSec, 120);
  assert.equal(config.pipelineInfra.pipelineDir.endsWith('dev-pipeline'), true);
});

test('config should fail fast with readable infra config errors', async () => {
  await assert.rejects(
    async () => {
      await importConfigWithEnv({
        ENABLE_TELEGRAM: 'false',
        MAX_RETRIES: '0'
      });
    },
    (error) => {
      assert.match(error.message, /MAX_RETRIES/);
      assert.equal(error.code, 'CONFIG_INVALID');
      return true;
    }
  );
});
