/**
 * Tests for F-011 MarkdownV2 formatter utility
 * T-006: Create MarkdownV2 formatter utility
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('F-011 MarkdownV2 Formatter', () => {
  describe('escapeMarkdownV2', () => {
    test('should escape all special characters', async () => {
      const { escapeMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Hello _World_ *bold* [link](url) ~tilde~ `code` >quote #heading +plus -minus =equals |pipe {curly} .dot !exclaim';
      const result = escapeMarkdownV2(input);

      // All special chars should be escaped
      assert.ok(result.includes('\\_'));
      assert.ok(result.includes('\\*'));
      assert.ok(result.includes('\\['));
      assert.ok(result.includes('\\]'));
      assert.ok(result.includes('\\('));
      assert.ok(result.includes('\\)'));
      assert.ok(result.includes('\\~'));
      assert.ok(result.includes('\\`'));
      assert.ok(result.includes('\\>'));
      assert.ok(result.includes('\\#'));
      assert.ok(result.includes('\\+'));
      assert.ok(result.includes('\\-'));
      assert.ok(result.includes('\\='));
      assert.ok(result.includes('\\|'));
      assert.ok(result.includes('\\{'));
      assert.ok(result.includes('\\}'));
      assert.ok(result.includes('\\.'));
      assert.ok(result.includes('\\!'));
    });

    test('should handle empty string', async () => {
      const { escapeMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');
      const result = escapeMarkdownV2('');
      assert.equal(result, '');
    });

    test('should handle text with no special chars', async () => {
      const { escapeMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');
      const result = escapeMarkdownV2('Hello World 123');
      assert.equal(result, 'Hello World 123');
    });
  });

  describe('formatCodeBlock', () => {
    test('should format code block without language', async () => {
      const { formatCodeBlock } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatCodeBlock('const x = 1;');

      assert.ok(result.startsWith('```'));
      assert.ok(result.endsWith('```'));
      assert.ok(result.includes('const x = 1;'));
    });

    test('should format code block with language', async () => {
      const { formatCodeBlock } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatCodeBlock('const x = 1;', 'javascript');

      assert.ok(result.startsWith('```javascript'));
      assert.ok(result.endsWith('```'));
    });

    test('should escape backticks inside code', async () => {
      const { formatCodeBlock } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatCodeBlock('const `x` = 1;');

      // Backticks inside code should be escaped
      assert.ok(result.includes('\\`'));
    });

    test('should handle empty code', async () => {
      const { formatCodeBlock } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatCodeBlock('');

      assert.equal(result, '```\n```');
    });
  });

  describe('formatInlineCode', () => {
    test('should format inline code', async () => {
      const { formatInlineCode } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatInlineCode('x = 1');

      assert.equal(result, '`x = 1`');
    });

    test('should escape backticks inside inline code', async () => {
      const { formatInlineCode } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = formatInlineCode('const `x`');

      assert.ok(result.includes('\\`'));
    });
  });

  describe('convertToMarkdownV2', () => {
    test('should convert code blocks', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = '```\ncode\n```';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('```'));
      assert.ok(result.includes('code'));
    });

    test('should convert code blocks with language', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = '```javascript\nconst x = 1;\n```';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('```javascript'));
    });

    test('should convert inline code', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Use `code` here';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('`code`'));
    });

    test('should convert bold text', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'This is **bold** text';
      const result = convertToMarkdownV2(input);

      // Bold is converted to *text* (single asterisks), escaped content between
      assert.ok(result.includes('*bold*'));
      // Plain text should be escaped
      assert.ok(result.includes('This is'));
    });

    test('should convert italic text', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'This is _italic_ text';
      const result = convertToMarkdownV2(input);

      // Italic is kept as _text_, content escaped
      assert.ok(result.includes('_italic_'));
      // Plain text should be escaped
      assert.ok(result.includes('This is'));
    });

    test('should escape special chars in plain text', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Hello! How are you?';
      const result = convertToMarkdownV2(input);

      // In MarkdownV2, ! must be escaped, ? is not in escape list
      assert.ok(result.includes('\\!'));
    });

    test('should preserve line breaks', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Line 1\nLine 2\nLine 3';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('Line 1'));
      assert.ok(result.includes('Line 2'));
      assert.ok(result.includes('Line 3'));
    });

    test('should handle empty string', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = convertToMarkdownV2('');
      assert.equal(result, '');
    });

    test('should handle links', async () => {
      const { convertToMarkdownV2 } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = '[Google](https://google.com)';
      const result = convertToMarkdownV2(input);

      // Links should be preserved with proper escaping
      assert.ok(result.includes('[Google]'));
      assert.ok(result.includes('(https://google\\.com)'));
    });
  });

  describe('splitRespectingCodeBlocks', () => {
    test('should not split inside code blocks', async () => {
      const { splitRespectingCodeBlocks } = await import('../../src/utils/markdown-v2-formatter.js');

      const code = '```javascript\nconst x = 1;\nconst y = 2;\n```';
      const result = splitRespectingCodeBlocks(code, 30);

      // Code block should not be split
      for (const segment of result) {
        // Each segment should either have no code block markers,
        // or have both start and end markers (complete code block)
        const hasStart = segment.includes('```');
        if (hasStart) {
          // If segment has code block start, it should have the whole block
          assert.ok(segment.includes('```') && segment.match(/```/g)?.length === 2);
        }
      }
    });

    test('should split at paragraph boundaries', async () => {
      const { splitRespectingCodeBlocks } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Line 1\n\nLine 2\n\nLine 3';
      const result = splitRespectingCodeBlocks(input, 10);

      assert.ok(result.length > 1, 'Should split into multiple segments');
    });

    test('should respect maxLength', async () => {
      const { splitRespectingCodeBlocks } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'A'.repeat(100);
      const result = splitRespectingCodeBlocks(input, 30);

      for (const segment of result) {
        assert.ok(segment.length <= 30, `Segment length ${segment.length} exceeds max 30`);
      }
    });

    test('should handle text shorter than maxLength', async () => {
      const { splitRespectingCodeBlocks } = await import('../../src/utils/markdown-v2-formatter.js');

      const input = 'Short text';
      const result = splitRespectingCodeBlocks(input, 100);

      assert.equal(result.length, 1);
      assert.equal(result[0], input);
    });

    test('should handle empty string', async () => {
      const { splitRespectingCodeBlocks } = await import('../../src/utils/markdown-v2-formatter.js');

      const result = splitRespectingCodeBlocks('', 100);

      assert.equal(result.length, 1);
      assert.equal(result[0], '');
    });
  });
});
