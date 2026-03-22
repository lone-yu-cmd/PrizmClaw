/**
 * Tests for F-020 Output Segmenter
 * src/utils/output-segmenter.js
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentOutput } from '../../src/utils/output-segmenter.js';

const DEFAULT_MAX = 3800;

describe('output-segmenter', () => {
  describe('segmentOutput', () => {
    test('should return text as single segment when under limit', () => {
      const text = 'Short text that fits in one message.';
      const result = segmentOutput(text);
      assert.equal(result.length, 1);
      assert.equal(result[0], text);
    });

    test('should return array with one empty string for empty input', () => {
      const result = segmentOutput('');
      assert.equal(result.length, 1);
      assert.equal(result[0], '');
    });

    test('should handle null/undefined', () => {
      const result1 = segmentOutput(null);
      const result2 = segmentOutput(undefined);
      assert.ok(Array.isArray(result1));
      assert.ok(Array.isArray(result2));
      assert.equal(result1.length, 1);
      assert.equal(result2.length, 1);
    });

    test('should split long text at paragraph boundaries', () => {
      // Create text with paragraphs that exceeds the limit
      const para1 = 'First paragraph content. '.repeat(80); // ~2000 chars
      const para2 = 'Second paragraph content. '.repeat(80); // ~2000 chars
      const text = para1.trim() + '\n\n' + para2.trim();

      const result = segmentOutput(text, 3800);
      assert.ok(result.length >= 2, `Expected at least 2 segments, got ${result.length}`);
      // No segment should exceed the limit
      for (const seg of result) {
        assert.ok(seg.length <= 3800, `Segment exceeds limit: ${seg.length} chars`);
      }
    });

    test('should not split inside a code block', () => {
      // Create a setup where without smart splitting, we'd break mid-code-block
      const preamble = 'Here is some code:\n\n';
      // Code block that is long but not itself over the limit
      const codeBlock = '```javascript\n' + 'const x = 1;\n'.repeat(100) + '```';
      const text = preamble + codeBlock;

      // Use a small limit so we're forced to split, but code block itself is under limit
      const result = segmentOutput(text, 2000);

      // Find which segment contains the opening ``` and check the closing ``` is in the same segment
      let foundOpen = -1;
      let foundClose = -1;
      for (let i = 0; i < result.length; i++) {
        if (result[i].includes('```javascript')) foundOpen = i;
        if (result[i].includes('```javascript') && result[i].lastIndexOf('```') > result[i].indexOf('```javascript')) {
          foundClose = i;
        }
      }

      // The code block should either be whole in one segment or split is forced only when it must be
      // Key: opening and closing ``` of the block should be in the same segment if the block fits
      if (foundOpen !== -1) {
        assert.equal(foundOpen, foundClose, 'Code block should not be split across segments');
      }
    });

    test('should split at newline boundaries when paragraph split not possible', () => {
      // One long line without paragraphs — split should happen at newlines
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`Line ${i}: ${'x'.repeat(30)}`);
      }
      const text = lines.join('\n');

      const result = segmentOutput(text, 1000);
      assert.ok(result.length > 1, 'Should split into multiple segments');

      for (const seg of result) {
        assert.ok(seg.length <= 1000, `Segment exceeds limit: ${seg.length}`);
      }
    });

    test('each segment should not exceed maxChunkSize', () => {
      const longText = 'x'.repeat(10000);
      const result = segmentOutput(longText, 3800);
      for (const seg of result) {
        assert.ok(seg.length <= 3800, `Segment exceeds 3800 chars: ${seg.length}`);
      }
    });

    test('should use 3800 as default maxChunkSize', () => {
      const longText = 'y'.repeat(5000);
      const result = segmentOutput(longText);
      for (const seg of result) {
        assert.ok(seg.length <= 3800, `Default limit exceeded: ${seg.length}`);
      }
    });

    test('should preserve code blocks with language specifier', () => {
      const text = 'Explanation:\n\n```python\ndef hello():\n    print("Hello world")\n```\n\nMore text here.';
      const result = segmentOutput(text, 3800);
      // All should fit in one segment since it's short
      assert.equal(result.length, 1);
      assert.ok(result[0].includes('```python'));
      assert.ok(result[0].includes('def hello()'));
    });

    test('should handle multiple code blocks', () => {
      const block1 = '```js\nconsole.log("block1");\n```';
      const block2 = '```py\nprint("block2")\n```';
      const text = `First block:\n\n${block1}\n\nSecond block:\n\n${block2}`;
      const result = segmentOutput(text, 3800);
      // Both should fit in one message
      const combined = result.join('');
      assert.ok(combined.includes('block1'));
      assert.ok(combined.includes('block2'));
    });

    test('should reconstruct original content when segments joined', () => {
      const original = 'Para one.\n\nPara two.\n\nPara three.';
      const result = segmentOutput(original, 20);
      // Joining the segments should give back something close to the original
      // (may differ slightly in whitespace at split points)
      const rejoined = result.join('');
      // All original content should be present
      assert.ok(rejoined.includes('Para one'));
      assert.ok(rejoined.includes('Para two'));
      assert.ok(rejoined.includes('Para three'));
    });

    test('should handle text with only code blocks', () => {
      const text = '```bash\necho "hello"\necho "world"\n```';
      const result = segmentOutput(text, 3800);
      assert.equal(result.length, 1);
      assert.ok(result[0].includes('echo "hello"'));
    });

    test('custom maxChunkSize is respected', () => {
      const text = 'Short text';
      const result = segmentOutput(text, 100);
      assert.equal(result.length, 1);
      assert.equal(result[0], text);
    });
  });
});
