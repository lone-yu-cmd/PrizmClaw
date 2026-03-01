import path from 'node:path';

/**
 * Canonical directory layout relative to projectRoot.
 * @type {Readonly<Record<string, string>>}
 */
export const DIRECTORY_CONVENTION = Object.freeze({
  pipelineDir:      'dev-pipeline',
  featureStateDir:  'dev-pipeline/state',
  bugfixStateDir:   'dev-pipeline/bugfix-state',
  featureListFile:  'feature-list.json',
  bugFixListFile:   'bug-fix-list.json',
  plansDir:         'plans',
  specsDir:         '.prizmkit/specs',
  logsDir:          'logs',
  sessionLogsDir:   'dev-pipeline/state/features/{featureId}/sessions/{sessionId}/logs',
  daemonLogFile:    'dev-pipeline/state/pipeline-daemon.log',
});

/**
 * Resolve plans directory path.
 * @param {string} projectRoot
 * @returns {{ plansDir: string }}
 */
export function resolvePlansPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));
  return {
    plansDir: path.join(resolvedRoot, DIRECTORY_CONVENTION.plansDir),
  };
}

const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

function assertSafeSegment(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized || !SAFE_SEGMENT_PATTERN.test(normalized) || normalized.includes('..')) {
    throw new Error(`Invalid path segment for ${label}: ${value}`);
  }

  return normalized;
}

export function computeFeatureSlug(featureId, title) {
  const normalizedFeatureId = assertSafeSegment(featureId, 'featureId');
  const numeric = normalizedFeatureId.replace(/^F-/i, '').replace(/^0+/, '').padStart(3, '0');

  const rawTitle = String(title ?? '').toLowerCase();
  const cleanedTitle = rawTitle
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');

  const safeTitle = cleanedTitle || 'feature';
  return `${numeric}-${safeTitle}`;
}

export function resolveFeaturePaths(input) {
  const projectRoot = path.resolve(String(input?.projectRoot ?? ''));
  const featureId = assertSafeSegment(input?.featureId, 'featureId');
  const sessionId = assertSafeSegment(input?.sessionId, 'sessionId');
  const featureSlug = computeFeatureSlug(featureId, input?.title ?? '');

  const specsDir = path.join(projectRoot, '.prizmkit/specs', featureSlug);
  const sessionDir = path.join(projectRoot, 'dev-pipeline/state/features', featureId, 'sessions', sessionId);

  return {
    featureSlug,
    specsDir,
    sessionDir,
    sessionLog: path.join(sessionDir, 'logs/session.log'),
    sessionStatus: path.join(sessionDir, 'session-status.json')
  };
}

export function resolveBugPaths(input) {
  const projectRoot = path.resolve(String(input?.projectRoot ?? ''));
  const bugId = assertSafeSegment(input?.bugId, 'bugId');
  const sessionId = assertSafeSegment(input?.sessionId, 'sessionId');

  const bugDir = path.join(projectRoot, 'dev-pipeline/bugfix-state/bugs', bugId);
  const sessionDir = path.join(bugDir, 'sessions', sessionId);

  return {
    bugDir,
    sessionDir,
    sessionLog: path.join(sessionDir, 'logs/session.log'),
    sessionStatus: path.join(sessionDir, 'session-status.json')
  };
}

export function resolveDaemonLogPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featureDaemonLog: path.join(resolvedRoot, 'dev-pipeline/state/pipeline-daemon.log'),
    bugfixDaemonLog: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/pipeline-daemon.log')
  };
}

/**
 * F-004: Resolve lock file paths for pipeline types.
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Lock file paths for each pipeline type
 */
export function resolveLockPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featureLock: path.join(resolvedRoot, 'dev-pipeline/state/.pipeline.lock'),
    bugfixLock: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/.pipeline.lock')
  };
}

/**
 * F-004: Resolve last result file paths for pipeline types.
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Last result file paths for each pipeline type
 */
export function resolveLastResultPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featureLastResult: path.join(resolvedRoot, 'dev-pipeline/state/.last-result.json'),
    bugfixLastResult: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/.last-result.json')
  };
}

/**
 * F-004: Resolve daemon meta file paths for pipeline types.
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Daemon meta file paths for each pipeline type
 */
export function resolveDaemonMetaPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featureDaemonMeta: path.join(resolvedRoot, 'dev-pipeline/state/.pipeline-meta.json'),
    bugfixDaemonMeta: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/.pipeline-meta.json')
  };
}

/**
 * F-004: Resolve pipeline state file paths for pipeline types.
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Pipeline state file paths for each pipeline type
 */
export function resolvePipelineStatePaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featurePipelineState: path.join(resolvedRoot, 'dev-pipeline/state/pipeline.json'),
    bugfixPipelineState: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/pipeline.json')
  };
}

/**
 * F-004: Resolve current session file paths for pipeline types.
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Current session file paths for each pipeline type
 */
export function resolveCurrentSessionPaths(projectRoot) {
  const resolvedRoot = path.resolve(String(projectRoot ?? ''));

  return {
    featureCurrentSession: path.join(resolvedRoot, 'dev-pipeline/state/current-session.json'),
    bugfixCurrentSession: path.join(resolvedRoot, 'dev-pipeline/bugfix-state/current-session.json')
  };
}

/**
 * F-004: Get all state file paths for a pipeline type.
 * @param {string} projectRoot - Project root directory
 * @param {'feature' | 'bugfix'} type - Pipeline type
 * @returns {Object} All state file paths for the pipeline type
 */
export function getStatePaths(projectRoot, type) {
  const lockPaths = resolveLockPaths(projectRoot);
  const lastResultPaths = resolveLastResultPaths(projectRoot);
  const daemonMetaPaths = resolveDaemonMetaPaths(projectRoot);
  const pipelineStatePaths = resolvePipelineStatePaths(projectRoot);
  const currentSessionPaths = resolveCurrentSessionPaths(projectRoot);
  const daemonLogPaths = resolveDaemonLogPaths(projectRoot);

  const prefix = type === 'feature' ? 'feature' : 'bugfix';

  return {
    lockFile: lockPaths[`${prefix}Lock`],
    lastResultFile: lastResultPaths[`${prefix}LastResult`],
    daemonMetaFile: daemonMetaPaths[`${prefix}DaemonMeta`],
    pipelineStateFile: pipelineStatePaths[`${prefix}PipelineState`],
    currentSessionFile: currentSessionPaths[`${prefix}CurrentSession`],
    daemonLogFile: daemonLogPaths[`${prefix}DaemonLog`]
  };
}
