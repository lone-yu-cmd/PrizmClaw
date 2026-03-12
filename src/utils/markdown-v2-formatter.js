/**
 * F-011: MarkdownV2 Formatter for Telegram
 *
 * Telegram MarkdownV2 requires escaping specific characters.
 * This module provides utilities for converting common Markdown
 * to Telegram's MarkdownV2 format.
 *
 * Reference: https://core.telegram.org/bots/api#markdownv2-style
 */

/**
 * Characters that need escaping in MarkdownV2.
 * All these characters must be escaped with a backslash.
 */
const ESCAPE_CHARS = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

/**
 * Escape text for Telegram MarkdownV2 format.
 * In MarkdownV2, all special characters must be escaped.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeMarkdownV2(text) {
  if (!text) return '';

  let result = text;
  for (const char of ESCAPE_CHARS) {
    result = result.split(char).join('\\' + char);
  }
  return result;
}

/**
 * Escape text inside code blocks.
 * Inside code blocks, only ` and \ need escaping.
 * @param {string} code - Code content
 * @returns {string} Escaped code
 */
function escapeCodeContent(code) {
  if (!code) return '';
  return code
    .split('\\').join('\\\\')
    .split('`').join('\\`');
}

/**
 * Format code block for Telegram MarkdownV2.
 * @param {string} code - Code content
 * @param {string} [language=''] - Optional language identifier
 * @returns {string} Formatted code block
 */
export function formatCodeBlock(code, language = '') {
  const escapedCode = escapeCodeContent(code ?? '');
  // Handle empty code case
  if (!escapedCode) {
    return '```' + language + '\n```';
  }
  return '```' + language + '\n' + escapedCode + '\n```';
}

/**
 * Format inline code for Telegram MarkdownV2.
 * @param {string} code - Code content
 * @returns {string} Formatted inline code
 */
export function formatInlineCode(code) {
  const escapedCode = escapeCodeContent(code ?? '');
  return '`' + escapedCode + '`';
}

/**
 * Convert common Markdown to Telegram MarkdownV2.
 * Handles: code blocks, inline code, bold, italic, links.
 * @param {string} markdown - Input markdown
 * @returns {string} MarkdownV2 formatted text
 */
export function convertToMarkdownV2(markdown) {
  if (!markdown) return '';

  let result = markdown;

  // Process code blocks first (to protect their content)
  const codeBlocks = [];
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `\x00CB${codeBlocks.length}\x00`;
    codeBlocks.push(formatCodeBlock(code, lang));
    return placeholder;
  });

  // Process inline code
  const inlineCodes = [];
  result = result.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `\x00IC${inlineCodes.length}\x00`;
    inlineCodes.push(formatInlineCode(code));
    return placeholder;
  });

  // Process links [text](url)
  const links = [];
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const placeholder = `\x00LK${links.length}\x00`;
    // In MarkdownV2, escape the URL but keep the link format
    links.push(`[${escapeMarkdownV2(text)}](${escapeMarkdownV2(url)})`);
    return placeholder;
  });

  // Process bold **text** - use placeholders to prevent double-escaping
  const bolds = [];
  result = result.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
    const placeholder = `\x00BD${bolds.length}\x00`;
    bolds.push('*' + escapeMarkdownV2(text) + '*');
    return placeholder;
  });

  // Process italic _text_ - use placeholders to prevent double-escaping
  const italics = [];
  result = result.replace(/_([^_]+)_/g, (match, text) => {
    const placeholder = `\x00IT${italics.length}\x00`;
    italics.push('_' + escapeMarkdownV2(text) + '_');
    return placeholder;
  });

  // Escape remaining special characters
  result = escapeMarkdownV2(result);

  // Restore protected content (placeholders contain no special chars so they won't be escaped)
  for (let i = 0; i < codeBlocks.length; i++) {
    result = result.split(`\\x00CB${i}\\x00`).join(codeBlocks[i]);
    result = result.split(`\x00CB${i}\x00`).join(codeBlocks[i]);
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    result = result.split(`\\x00IC${i}\\x00`).join(inlineCodes[i]);
    result = result.split(`\x00IC${i}\x00`).join(inlineCodes[i]);
  }
  for (let i = 0; i < links.length; i++) {
    result = result.split(`\\x00LK${i}\\x00`).join(links[i]);
    result = result.split(`\x00LK${i}\x00`).join(links[i]);
  }
  for (let i = 0; i < bolds.length; i++) {
    result = result.split(`\\x00BD${i}\\x00`).join(bolds[i]);
    result = result.split(`\x00BD${i}\x00`).join(bolds[i]);
  }
  for (let i = 0; i < italics.length; i++) {
    result = result.split(`\\x00IT${i}\\x00`).join(italics[i]);
    result = result.split(`\x00IT${i}\x00`).join(italics[i]);
  }

  // Remove any remaining null placeholders (for safety)
  result = result.replace(/\\x00[A-Z]+\d+\\x00/g, '');
  result = result.replace(/\x00[A-Z]+\d+\x00/g, '');

  return result;
}

/**
 * Split text into segments respecting code block boundaries.
 * Useful for splitting long messages without breaking code blocks.
 * @param {string} text - Text to split
 * @param {number} maxLength - Maximum length per segment (default 4000)
 * @returns {string[]} Array of segments
 */
export function splitRespectingCodeBlocks(text, maxLength = 4000) {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];

  const segments = [];
  let currentSegment = '';

  // Split text into chunks: code blocks and non-code parts
  const parts = text.split(/(```[\s\S]*?```)/g);

  for (const part of parts) {
    // If adding this part would exceed maxLength
    if (currentSegment.length + part.length > maxLength) {
      // If it's a code block, we need to keep it whole
      if (part.startsWith('```') && part.endsWith('```')) {
        // If current segment has content, push it
        if (currentSegment.trim()) {
          segments.push(currentSegment);
          currentSegment = '';
        }
        // Check if code block itself exceeds maxLength
        if (part.length > maxLength) {
          // We have to split it - but try at a reasonable point
          // For now, just push it as a single segment (Telegram will truncate)
          segments.push(part);
        } else {
          currentSegment = part;
        }
      } else {
        // Regular text - try to split at paragraph or newline
        const remaining = maxLength - currentSegment.length;
        if (remaining > 0) {
          // Take what we can from this part
          const chunk = part.slice(0, remaining);
          const breakPoint = Math.max(
            chunk.lastIndexOf('\n\n'),
            chunk.lastIndexOf('\n'),
            chunk.lastIndexOf(' ')
          );

          if (breakPoint > 0) {
            currentSegment += chunk.slice(0, breakPoint + 1);
            segments.push(currentSegment);
            currentSegment = part.slice(breakPoint + 1);
          } else {
            currentSegment += chunk;
            segments.push(currentSegment);
            currentSegment = part.slice(remaining);
          }
        } else {
          if (currentSegment.trim()) {
            segments.push(currentSegment);
          }
          currentSegment = part;
        }

        // If current segment still exceeds, we need to keep splitting
        while (currentSegment.length > maxLength) {
          const chunk = currentSegment.slice(0, maxLength);
          const breakPoint = Math.max(
            chunk.lastIndexOf('\n\n'),
            chunk.lastIndexOf('\n'),
            chunk.lastIndexOf(' ')
          );

          if (breakPoint > 0) {
            segments.push(chunk.slice(0, breakPoint + 1));
            currentSegment = currentSegment.slice(breakPoint + 1);
          } else {
            segments.push(chunk);
            currentSegment = currentSegment.slice(maxLength);
          }
        }
      }
    } else {
      currentSegment += part;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment);
  }

  return segments.length > 0 ? segments : [''];
}
