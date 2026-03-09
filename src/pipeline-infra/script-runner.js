import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { INFRA_ERROR_CODES } from './error-codes.js';
import { loadPipelineInfraConfig } from './config-loader.js';

const PIPELINE_TYPES = new Set(['feature', 'bugfix']);
const PIPELINE_ACTIONS = new Set(['run', 'status', 'stop', 'logs', 'retry', 'reset']);

function ensureValidRequest(req) {
  if (!PIPELINE_TYPES.has(req?.pipelineType)) {
    throw new Error(`Invalid pipelineType: ${req?.pipelineType}`);
  }
  if (!PIPELINE_ACTIONS.has(req?.action)) {
    throw new Error(`Invalid action: ${req?.action}`);
  }
}

function ensureTargetId(targetId, action) {
  const normalized = String(targetId ?? '').trim();
  if (!normalized) {
    throw new Error(`targetId is required for action '${action}'`);
  }
  return normalized;
}

function withOptionalList(args, listPath) {
  if (listPath) {
    args.push(listPath);
  }
  return args;
}

export function buildPipelineCommand(req, config) {
  ensureValidRequest(req);

  const pipelineDir = config.pipelineDir;
  const featureListPath = req.listPath || config.featureListPath;
  const bugFixListPath = req.listPath || config.bugFixListPath;

  if (req.pipelineType === 'feature') {
    switch (req.action) {
      case 'run': {
        const args = ['run'];
        if (req.targetId) {
          args.push(req.targetId);
        }
        return { command: path.join(pipelineDir, 'run.sh'), args: withOptionalList(args, featureListPath) };
      }
      case 'status':
        return {
          command: path.join(pipelineDir, 'run.sh'),
          args: withOptionalList(['status'], featureListPath)
        };
      case 'stop':
        return { command: path.join(pipelineDir, 'launch-daemon.sh'), args: ['stop'] };
      case 'logs':
        return { command: path.join(pipelineDir, 'launch-daemon.sh'), args: ['logs'] };
      case 'retry': {
        const targetId = ensureTargetId(req.targetId, req.action);
        return {
          command: path.join(pipelineDir, 'retry-feature.sh'),
          args: withOptionalList([targetId], featureListPath)
        };
      }
      case 'reset': {
        if (req.targetId) {
          const targetId = ensureTargetId(req.targetId, req.action);
          return {
            command: path.join(pipelineDir, 'reset-feature.sh'),
            args: withOptionalList([targetId, '--clean'], featureListPath)
          };
        }

        return { command: path.join(pipelineDir, 'run.sh'), args: ['reset'] };
      }
      default:
        throw new Error(`Unsupported feature action: ${req.action}`);
    }
  }

  switch (req.action) {
    case 'run': {
      const args = ['run'];
      if (req.targetId) {
        args.push(req.targetId);
      }
      return { command: path.join(pipelineDir, 'run-bugfix.sh'), args: withOptionalList(args, bugFixListPath) };
    }
    case 'status':
      return {
        command: path.join(pipelineDir, 'run-bugfix.sh'),
        args: withOptionalList(['status'], bugFixListPath)
      };
    case 'stop':
      return { command: path.join(pipelineDir, 'launch-bugfix-daemon.sh'), args: ['stop'] };
    case 'logs':
      return { command: path.join(pipelineDir, 'launch-bugfix-daemon.sh'), args: ['logs'] };
    case 'retry': {
      const targetId = ensureTargetId(req.targetId, req.action);
      return {
        command: path.join(pipelineDir, 'retry-bug.sh'),
        args: withOptionalList([targetId], bugFixListPath)
      };
    }
    case 'reset': {
      if (req.targetId) {
        const targetId = ensureTargetId(req.targetId, req.action);
        const listPath = req.listPath || config.bugFixListPath;
        return {
          command: path.join(pipelineDir, 'scripts/update-bug-status.py'),
          args: [
            '--bug-list',
            listPath,
            '--state-dir',
            path.join(pipelineDir, 'bugfix-state'),
            '--bug-id',
            targetId,
            '--project-root',
            config.projectRoot,
            '--action',
            'clean'
          ]
        };
      }

      return { command: path.join(pipelineDir, 'run-bugfix.sh'), args: ['reset'] };
    }
    default:
      throw new Error(`Unsupported bugfix action: ${req.action}`);
  }
}

export function normalizePipelineResult({ exitCode, signal, stdout, stderr, timedOut = false }) {
  let normalizedStatus = 'failed';
  let errorCode;

  if (timedOut || exitCode === 124) {
    normalizedStatus = 'timed_out';
    errorCode = INFRA_ERROR_CODES.EXEC_TIMEOUT;
  } else if (signal) {
    normalizedStatus = 'crashed';
    errorCode = INFRA_ERROR_CODES.EXEC_FAILED;
  } else if (exitCode === 0) {
    normalizedStatus = 'success';
  } else {
    normalizedStatus = 'failed';
    errorCode = INFRA_ERROR_CODES.EXEC_FAILED;
  }

  return {
    ok: normalizedStatus === 'success',
    exitCode: Number.isInteger(exitCode) ? exitCode : 1,
    signal: signal || undefined,
    stdout: stdout ?? '',
    stderr: stderr ?? '',
    normalizedStatus,
    errorCode
  };
}

function runCommand({ command, args, env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = timeoutMs && timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    });

    child.on('close', (exitCode, signal) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ exitCode: exitCode ?? (timedOut ? 124 : 1), signal, stdout, stderr, timedOut });
    });
  });
}

function scriptExists(commandPath) {
  if (commandPath === 'python3' || commandPath === 'node') {
    return true;
  }
  return fs.existsSync(commandPath);
}

export async function executePipelineCommand(req) {
  const config = loadPipelineInfraConfig();
  const commandRequest = {
    ...req,
    listPath:
      req.listPath || (req.pipelineType === 'feature' ? config.featureListPath : config.bugFixListPath)
  };

  let command;
  let args;

  try {
    ({ command, args } = buildPipelineCommand(commandRequest, config));
  } catch (error) {
    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      normalizedStatus: 'failed',
      errorCode: INFRA_ERROR_CODES.EXEC_FAILED
    };
  }

  if (!scriptExists(command)) {
    return {
      ok: false,
      exitCode: 127,
      stdout: '',
      stderr: `Command not found: ${command}`,
      normalizedStatus: 'failed',
      errorCode: INFRA_ERROR_CODES.SCRIPT_NOT_FOUND
    };
  }

  try {
    const raw = await runCommand({
      command,
      args,
      timeoutMs: req.timeoutMs,
      env: {
        ...process.env,
        ...(req.envOverrides ?? {})
      }
    });

    return normalizePipelineResult(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error && error.code === 'ENOENT') {
      return {
        ok: false,
        exitCode: 127,
        stdout: '',
        stderr: message,
        normalizedStatus: 'failed',
        errorCode: INFRA_ERROR_CODES.SCRIPT_NOT_FOUND
      };
    }

    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: message,
      normalizedStatus: 'failed',
      errorCode: INFRA_ERROR_CODES.EXEC_FAILED
    };
  }
}
