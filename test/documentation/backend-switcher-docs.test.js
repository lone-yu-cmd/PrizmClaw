import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

describe('Backend Switcher Documentation', () => {
  it('should have feature documentation file', () => {
    const docsPath = './docs/features/015-ai-cli-backend-switcher.md';
    const docsContent = readFileSync(docsPath, 'utf8');

    assert.ok(docsContent.length > 0, 'Documentation file should not be empty');
    assert.match(docsContent, /AI CLI Backend Switcher/, 'Should contain feature title');
    assert.match(docsContent, /## Overview/, 'Should have overview section');
    assert.match(docsContent, /## Usage/, 'Should have usage section');
    assert.match(docsContent, /## Configuration/, 'Should have configuration section');
  });

  it('should document all major features', () => {
    const docsPath = './docs/features/015-ai-cli-backend-switcher.md';
    const docsContent = readFileSync(docsPath, 'utf8');

    assert.match(docsContent, /Dynamic Backend Switching/, 'Should document dynamic switching');
    assert.match(docsContent, /Session-Specific Backends/, 'Should document session management');
    assert.match(docsContent, /Backend Validation/, 'Should document validation');
    assert.match(docsContent, /Backward Compatibility/, 'Should document compatibility');
  });

  it('should include usage examples', () => {
    const docsPath = './docs/features/015-ai-cli-backend-switcher.md';
    const docsContent = readFileSync(docsPath, 'utf8');

    assert.match(docsContent, /\/cli\s+list/, 'Should include list command example');
    assert.match(docsContent, /\/cli\s+reset/, 'Should include reset command example');
    assert.match(docsContent, /\/cli\s+<backend>/, 'Should include switch command example');
  });

  it('should document configuration options', () => {
    const docsPath = './docs/features/015-ai-cli-backend-switcher.md';
    const docsContent = readFileSync(docsPath, 'utf8');

    assert.match(docsContent, /AI_CLI_BACKENDS/, 'Should document backend configuration');
    assert.match(docsContent, /AI_CLI_DEFAULT_BACKEND/, 'Should document default backend');
    assert.match(docsContent, /CODEBUDDY_BIN/, 'Should document backward compatibility');
  });
});