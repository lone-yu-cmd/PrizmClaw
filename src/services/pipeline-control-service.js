import { executePipelineCommand } from '../pipeline-infra/script-runner.js';

function buildRequest(params = {}, action) {
  return {
    pipelineType: params.pipelineType ?? 'feature',
    action,
    ...(params.targetId ? { targetId: params.targetId } : {}),
    ...(params.listPath ? { listPath: params.listPath } : {}),
    ...(params.envOverrides ? { envOverrides: params.envOverrides } : {}),
    ...(params.timeoutMs ? { timeoutMs: params.timeoutMs } : {})
  };
}

export function createPipelineControlService({ runner = executePipelineCommand } = {}) {
  return {
    runner,
    async startPipeline(params) {
      return runner(buildRequest(params, 'run'));
    },
    async getPipelineStatus(params) {
      return runner(buildRequest(params, 'status'));
    },
    async stopPipeline(params) {
      return runner(buildRequest(params, 'stop'));
    },
    async retryTarget(params) {
      return runner(buildRequest(params, 'retry'));
    },
    async getPipelineLogs(params) {
      return runner(buildRequest(params, 'logs'));
    },
    async resetTarget(params) {
      return runner(buildRequest(params, 'reset'));
    }
  };
}

const defaultService = createPipelineControlService();

export async function startPipeline(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.startPipeline(params);
}

export async function getPipelineStatus(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.getPipelineStatus(params);
}

export async function stopPipeline(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.stopPipeline(params);
}

export async function retryTarget(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.retryTarget(params);
}

export async function getPipelineLogs(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.getPipelineLogs(params);
}

export async function resetTarget(params) {
  const service = createPipelineControlService({ runner: params?.runner ?? defaultService.runner });
  return service.resetTarget(params);
}
