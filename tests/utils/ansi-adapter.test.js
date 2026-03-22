/**
 * Tests for F-020 ANSI Adapter
 * src/utils/ansi-adapter.js
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi, collapseCarriageReturns, processChunk } from '../../src/utils/ansi-adapter.js';

describe('ansi-adapter', () => {
  describe('stripAnsi', () => {
    test('should remove basic color codes', () => {
      const input = '\u001b[31mRed text\u001b[0m';
      assert.equal(stripAnsi(input), 'Red text');
    });

    test('should remove bold/italic escape codes', () => {
      const input = '\u001b[1mBold\u001b[0m and \u001b[3mitalic\u001b[0m';
      assert.equal(stripAnsi(input), 'Bold and italic');
    });

    test('should remove cursor movement codes', () => {
      const input = '\u001b[2J\u001b[1;1H Hello';
      assert.equal(stripAnsi(input), ' Hello');
    });

    test('should remove 256-color codes', () => {
      const input = '\u001b[38;5;196mRed\u001b[0m';
      assert.equal(stripAnsi(input), 'Red');
    });

    test('should remove RGB color codes', () => {
      const input = '\u001b[38;2;255;0;0mRed\u001b[0m';
      assert.equal(stripAnsi(input), 'Red');
    });

    test('should handle text with no ANSI codes', () => {
      const input = 'Plain text without any codes';
      assert.equal(stripAnsi(input), input);
    });

    test('should handle empty string', () => {
      assert.equal(stripAnsi(''), '');
    });

    test('should handle null/undefined gracefully', () => {
      assert.equal(stripAnsi(null), '');
      assert.equal(stripAnsi(undefined), '');
    });

    test('should strip multiple consecutive escape codes', () => {
      const input = '\u001b[1m\u001b[31m\u001b[4mStyled text\u001b[0m';
      assert.equal(stripAnsi(input), 'Styled text');
    });

    test('should preserve newlines', () => {
      const input = '\u001b[32mLine 1\u001b[0m\nLine 2\n\u001b[33mLine 3\u001b[0m';
      assert.equal(stripAnsi(input), 'Line 1\nLine 2\nLine 3');
    });

    test('should handle OSC sequences', () => {
      const input = '\u001b]0;Window Title\u0007Some text';
      assert.equal(stripAnsi(input), 'Some text');
    });
  });

  describe('collapseCarriageReturns', () => {
    test('should collapse simple carriage return progress lines', () => {
      // Simulate a progress bar that overwrites itself
      const input = 'Progress: 10%\rProgress: 50%\rProgress: 100%';
      assert.equal(collapseCarriageReturns(input), 'Progress: 100%');
    });

    test('should keep newline-terminated lines', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      assert.equal(collapseCarriageReturns(input), 'Line 1\nLine 2\nLine 3');
    });

    test('should handle mixed CR and CRLF', () => {
      // Some terminals use \r\n
      const input = 'Step 1\r\nStep 2\r\nStep 3';
      const result = collapseCarriageReturns(input);
      assert.ok(result.includes('Step 1'));
      assert.ok(result.includes('Step 2'));
      assert.ok(result.includes('Step 3'));
    });

    test('should collapse multiple \\r overwrites within a logical line', () => {
      // e.g. "Downloading... 0%\rDownloading... 50%\rDownloading... 100%\n"
      const input = 'Downloading... 0%\rDownloading... 50%\rDownloading... 100%\nDone.';
      const result = collapseCarriageReturns(input);
      assert.ok(result.includes('Downloading... 100%'));
      assert.ok(result.includes('Done.'));
      // Should not include the intermediate states
      assert.ok(!result.includes('Downloading... 0%'));
      assert.ok(!result.includes('Downloading... 50%'));
    });

    test('should handle empty string', () => {
      assert.equal(collapseCarriageReturns(''), '');
    });

    test('should handle text with no carriage returns', () => {
      const input = 'Normal\nMultiline\nText';
      assert.equal(collapseCarriageReturns(input), 'Normal\nMultiline\nText');
    });

    test('should handle string ending with \\r', () => {
      const input = 'Loading...\rDone\r';
      const result = collapseCarriageReturns(input);
      // The last \r with empty after it means the last state is 'Done'
      // Result should keep 'Done' as it's the last content before \r
      assert.ok(result === 'Done' || result === 'Done\r');
    });
  });

  describe('processChunk', () => {
    test('should strip ANSI codes from a chunk', () => {
      const input = '\u001b[32m[ OK ]\u001b[0m Service started';
      const result = processChunk(input);
      assert.ok(!result.includes('\u001b['));
      assert.ok(result.includes('[ OK ]'));
      assert.ok(result.includes('Service started'));
    });

    test('should collapse carriage returns in a chunk', () => {
      const input = '\u001b[34mProgress\u001b[0m: 10%\rProgress: 100%';
      const result = processChunk(input);
      assert.ok(!result.includes('\u001b['));
      assert.ok(result.includes('Progress: 100%'));
      assert.ok(!result.includes('Progress: 10%'));
    });

    test('should handle empty string', () => {
      assert.equal(processChunk(''), '');
    });

    test('should handle null/undefined', () => {
      assert.equal(processChunk(null), '');
      assert.equal(processChunk(undefined), '');
    });

    test('should handle plain text unchanged', () => {
      const input = 'Normal text output\nSecond line';
      assert.equal(processChunk(input), input);
    });

    test('should handle real-world ANSI colored output', () => {
      // Simulates npm install output style
      const input = '\u001b[32m+\u001b[0m lodash@4.17.21\n\u001b[33mwarning\u001b[0m: peer dep issue';
      const result = processChunk(input);
      assert.ok(!result.includes('\u001b['));
      assert.ok(result.includes('+ lodash@4.17.21'));
      assert.ok(result.includes('warning: peer dep issue'));
    });
  });
});
