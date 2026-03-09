import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPipelineControlService,
  startPipeline,
  getPipelineStatus,
  stopPipeline,
  retryTarget,
  getPipelineLogs,
  resetTarget
} from '../../src/services/pipeline-control-service.js';

test('createPipelineControlService should map methods to runner actions', async () => {
  const calls = [];
  const service = createPipelineControlService({
    runner: async (req) => {
      calls.push(req);
      return { ok: true, normalizedStatus: 'success', exitCode: 0, stdout: '', stderr: '' };
    }
  });

  await service.startPipeline({ pipelineType: 'feature', targetId: 'F-001' });
  await service.getPipelineStatus({ pipelineType: 'feature' });
  await service.stopPipeline({ pipelineType: 'feature' });
  await service.retryTarget({ pipelineType: 'feature', targetId: 'F-001' });
  await service.getPipelineLogs({ pipelineType: 'feature' });
  await service.resetTarget({ pipelineType: 'feature', targetId: 'F-001' });

  assert.deepEqual(
    calls.map((item) => item.action),
    ['run', 'status', 'stop', 'retry', 'logs', 'reset']
  );
});

test('exported pipeline-control-service helpers should remain callable', async () => {
  const calls = [];
  const service = createPipelineControlService({
    runner: async (req) => {
      calls.push(req);
      return { ok: true, normalizedStatus: 'success', exitCode: 0, stdout: '', stderr: '' };
    }
  });

  await startPipeline({ pipelineType: 'bugfix', targetId: 'B-001', runner: service.runner });
  await getPipelineStatus({ pipelineType: 'bugfix', runner: service.runner });
  await stopPipeline({ pipelineType: 'bugfix', runner: service.runner });
  await retryTarget({ pipelineType: 'bugfix', targetId: 'B-001', runner: service.runner });
  await getPipelineLogs({ pipelineType: 'bugfix', runner: service.runner });
  await resetTarget({ pipelineType: 'bugfix', targetId: 'B-001', runner: service.runner });

  assert.deepEqual(
    calls.map((item) => [item.pipelineType, item.action]),
    [
      ['bugfix', 'run'],
      ['bugfix', 'status'],
      ['bugfix', 'stop'],
      ['bugfix', 'retry'],
      ['bugfix', 'logs'],
      ['bugfix', 'reset']
    ]
  );
});
