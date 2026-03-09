import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runPython(args, cwd) {
  const result = spawnSync('python3', args, {
    cwd,
    encoding: 'utf-8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `python3 failed with ${result.status}`);
  }

  return result.stdout;
}

test('init-dev-team should create specs directory via shared path policy', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-init-'));
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'tmp' }), 'utf-8');

  const scriptPath = path.resolve(process.cwd(), 'dev-pipeline/scripts/init-dev-team.py');
  runPython([scriptPath, '--project-root', projectRoot, '--feature-id', 'F-001', '--feature-slug', '001-demo'], projectRoot);

  assert.equal(fs.existsSync(path.join(projectRoot, '.prizmkit/specs/001-demo')), true);
});

test('generate-bugfix-prompt should render unified bug session status path', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prizmclaw-bugprompt-'));
  fs.mkdirSync(path.join(projectRoot, 'dev-pipeline/templates'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'dev-pipeline/scripts'), { recursive: true });

  const bugListPath = path.join(projectRoot, 'bug-fix-list.json');
  fs.writeFileSync(
    bugListPath,
    JSON.stringify({
      bugs: [
        {
          id: 'B-001',
          title: 'Demo Bug',
          description: 'x',
          severity: 'high',
          verification_type: 'automated',
          acceptance_criteria: []
        }
      ],
      global_context: {}
    }),
    'utf-8'
  );

  const templatePath = path.resolve(process.cwd(), 'dev-pipeline/templates/bugfix-bootstrap-prompt.md');
  const scriptPath = path.resolve(process.cwd(), 'dev-pipeline/scripts/generate-bugfix-prompt.py');
  const outputPath = path.join(projectRoot, 'prompt.md');

  runPython(
    [
      scriptPath,
      '--bug-list',
      bugListPath,
      '--bug-id',
      'B-001',
      '--session-id',
      'B-001-20260310030303',
      '--run-id',
      'RUN-1',
      '--retry-count',
      '0',
      '--resume-phase',
      'null',
      '--state-dir',
      path.join(projectRoot, 'dev-pipeline/bugfix-state'),
      '--output',
      outputPath,
      '--template',
      templatePath
    ],
    projectRoot
  );

  const rendered = fs.readFileSync(outputPath, 'utf-8');
  assert.match(
    rendered,
    /dev-pipeline\/bugfix-state\/bugs\/B-001\/sessions\/B-001-20260310030303\/session-status\.json/
  );
});
