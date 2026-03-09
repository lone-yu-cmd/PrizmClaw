import path from 'node:path';

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
