import { executePipelineCommand } from '../pipeline-infra/script-runner.js';
import { createPlanIngestionService } from './plan-ingestion-service.js';
import { loadPipelineInfraConfig } from '../pipeline-infra/config-loader.js';

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

/**
 * T-015: Resolve list path for plan type and optional version.
 * @param {Object} options - Options
 * @param {string} options.planType - 'feature-list' or 'bug-fix-list'
 * @param {string} [options.version] - Optional version string
 * @param {Object} [options.config] - Optional config (will load if not provided)
 * @param {Object} [options.planService] - Optional plan service instance
 * @returns {Promise<string|null>} Resolved path or null
 */
export async function resolvePlanListPath({ planType, version, config, planService }) {
  const actualConfig = config ?? loadPipelineInfraConfig();
  const service = planService ?? createPlanIngestionService({ plansDir: actualConfig.plansDir });

  // If version is specified, get that specific version
  if (version) {
    return service.getVersion(planType, version).then(content => {
      if (!content) return null;
      // Return the path to the version file
      const plansDir = actualConfig.plansDir;
      return `${plansDir}/${planType}/v${version.replace(/^v/, '')}.json`;
    });
  }

  // Otherwise, use the active path from registry
  return service.getActivePath(planType);
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
