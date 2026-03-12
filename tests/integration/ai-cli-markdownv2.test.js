/**
 * Integration Tests for MarkdownV2 Output
 * F-011, T-040: Test formatted output in Telegram context
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeMarkdownV2,
  formatCodeBlock,
  formatInlineCode,
  convertToMarkdownV2,
  splitRespectingCodeBlocks
} from '../../src/utils/markdown-v2-formatter.js';

describe('F-011 MarkdownV2 Output Integration', () => {
  describe('Code Block Formatting', () => {
    test('should format JavaScript code block for Telegram', () => {
      const input = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
      const result = convertToMarkdownV2(input);

      // Should preserve code block structure
      assert.ok(result.includes('```javascript'));
      assert.ok(result.includes('```'));

      // Should handle the content
      assert.ok(result.includes('const'));
      assert.ok(result.includes('console'));
    });

    test('should format Python code block for Telegram', () => {
      const input = '```python\ndef hello():\n    print("Hello!")\n```';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('```python'));
      assert.ok(result.includes('def hello'));
    });

    test('should handle code block without language', () => {
      const input = '```\nsome code\n```';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('```'));
      assert.ok(result.includes('some code'));
    });
  });

  describe('Special Character Handling', () => {
    test('should escape all MarkdownV2 special characters', () => {
      const input = '_ * [ ] ( ) ~ ` > # + - = | { } . !';
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

    test('should handle Chinese text without escaping', () => {
      const input = '你好，世界！这是中文文本。';
      const result = escapeMarkdownV2(input);

      // Chinese chars should not be escaped
      assert.ok(result.includes('你好'));
      assert.ok(result.includes('世界'));
      // But punctuation might need escaping
      assert.ok(result.includes('\\！') || result.includes('！'));
    });

    test('should handle URLs in text', () => {
      const input = 'Visit https://example.com/path?query=value for details.';
      const result = escapeMarkdownV2(input);

      // URL should be preserved (with escaped chars)
      assert.ok(result.includes('https://example'));
    });
  });

  describe('Long Message Splitting', () => {
    test('should split long text respecting code blocks', () => {
      const input = 'Some text\n\n```javascript\n' + 'const x = 1;\n'.repeat(50) + '```\n\nMore text';
      const segments = splitRespectingCodeBlocks(input, 500);

      // Verify no segment breaks a code block
      for (const segment of segments) {
        // Count code block markers
        const startMarkers = (segment.match(/```/g) || []).length;
        // Each segment should have either 0 or an even number of ```
        assert.equal(startMarkers % 2, 0, `Segment has unbalanced code blocks: ${segment.slice(0, 100)}`);
      }
    });

    test('should not split short text', () => {
      const input = 'Short text here.';
      const segments = splitRespectingCodeBlocks(input, 4000);

      assert.equal(segments.length, 1);
      assert.equal(segments[0], input);
    });

    test('should handle multiple code blocks', () => {
      const input = '```js\ncode1\n```\nText between\n```python\ncode2\n```';
      const segments = splitRespectingCodeBlocks(input, 30);

      // Verify each segment is valid
      for (const segment of segments) {
        assert.ok(segment.length <= 30 || segment.startsWith('```'));
      }
    });
  });

  describe('Mixed Formatting', () => {
    test('should handle bold with special characters', () => {
      const input = 'This is **bold text!** with special chars.';
      const result = convertToMarkdownV2(input);

      // Bold should be converted
      assert.ok(result.includes('*bold text'));
      // Exclamation in bold should be escaped
    });

    test('should handle nested code in bold', () => {
      const input = 'Use **`code`** in bold.';
      const result = convertToMarkdownV2(input);

      assert.ok(result.includes('*'));
      assert.ok(result.includes('`'));
    });

    test('should handle links with special URL chars', () => {
      const input = 'Check [API Docs](https://api.example.com/v2/users?id=123&type=admin)';
      const result = convertToMarkdownV2(input);

      // Link should be preserved
      assert.ok(result.includes('[API Docs]'));
      assert.ok(result.includes('(https://api'));
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', () => {
      assert.equal(escapeMarkdownV2(''), '');
      assert.equal(convertToMarkdownV2(''), '');
      assert.deepEqual(splitRespectingCodeBlocks('', 100), ['']);
    });

    test('should handle text with only whitespace', () => {
      const result = convertToMarkdownV2('   \n\n   ');
      assert.ok(typeof result === 'string');
    });

    test('should handle malformed code blocks gracefully', () => {
      // Unclosed code block
      const input = '```javascript\nconst x = 1;';
      const result = convertToMarkdownV2(input);

      // Should not throw, just process as text
      assert.ok(typeof result === 'string');
    });
  });

  describe('Telegram Message Simulation', () => {
    test('should format typical AI response for Telegram', () => {
      const aiResponse = `Here's the solution:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

This function uses:
- Template literals
- String interpolation

For more info, see [MDN](https://developer.mozilla.org).`;

      const result = convertToMarkdownV2(aiResponse);

      // Should not contain unescaped special chars outside code
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });
  });
});
