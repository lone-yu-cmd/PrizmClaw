// Pipeline Infrastructure Module
// F-004: Pipeline Process Controller

export { loadPipelineInfraConfig } from './config-loader.js';
export { executePipelineCommand, buildPipelineCommand, normalizePipelineResult } from './script-runner.js';
export { INFRA_ERROR_CODES, createInfraError, isInfraErrorCode } from './error-codes.js';
export {
  computeFeatureSlug,
  resolveFeaturePaths,
  resolveBugPaths,
  resolveDaemonLogPaths,
  resolveLockPaths,
  resolveLastResultPaths,
  resolveDaemonMetaPaths,
  resolvePipelineStatePaths,
  resolveCurrentSessionPaths,
  getStatePaths
} from './path-policy.js';
export { createLockManager, getDefaultLockManager } from './lock-manager.js';
export { createStateManager, getDefaultStateManager } from './state-manager.js';

export const PIPELINE_INFRA_ENTRYPOINT = 'pipeline-infra';
