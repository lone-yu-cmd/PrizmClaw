/**
 * Output Segmenter Utility
 * F-020: Enhanced Terminal Output Streaming
 *
 * Smart segmentation of AI CLI output for Telegram.
 * Replaces the hard-boundary splitMessage() for the final display path.
 *
 * Key behaviors:
 * - Respect Telegram 4096-char limit (uses 3800 as safe default)
 * - Never split inside a code block (between ``` fences)
 * - Split at logical boundaries: blank lines (paragraphs), then single newlines
 * - Fall back to hard split only when no logical boundary is available
 */

const DEFAULT_MAX_CHUNK_SIZE = 3800;

/**
 * Split text into segments at logical boundaries, respecting code blocks.
 *
 * @param {string|null|undefined} text - Full output text to segment
 * @param {number} [maxChunkSize=3800] - Maximum chars per segment (Telegram safe limit)
 * @returns {string[]} Array of text segments, each within the size limit
 */
export function segmentOutput(text, maxChunkSize = DEFAULT_MAX_CHUNK_SIZE) {
  if (text == null) return [''];
  const str = String(text);
  if (!str) return [''];
  if (str.length <= maxChunkSize) return [str];

  const segments = [];
  let remaining = str;

  while (remaining.length > maxChunkSize) {
    const chunk = remaining.slice(0, maxChunkSize);

    // Find the best split point — must not be inside a code block
    const splitPoint = findSplitPoint(chunk, remaining, maxChunkSize);

    segments.push(remaining.slice(0, splitPoint));
    remaining = remaining.slice(splitPoint);
  }

  if (remaining.length > 0) {
    segments.push(remaining);
  }

  return segments.length > 0 ? segments : [''];
}

/**
 * Find the best split point in the text at or before maxChunkSize.
 * Prioritizes: paragraph boundary > newline > space > hard cut.
 * Never splits inside a code block fence pair.
 *
 * @param {string} chunk - The first maxChunkSize characters of remaining text
 * @param {string} remaining - The full remaining text
 * @param {number} maxChunkSize - Size limit
 * @returns {number} Character index (in remaining) where we should split
 */
function findSplitPoint(chunk, remaining, maxChunkSize) {
  // Check if we're inside a code block at position maxChunkSize
  // Count unmatched opening fences up to the split point
  if (isInsideCodeBlock(chunk)) {
    // We must find a split point BEFORE the code block starts
    const codeBlockStart = findLastCodeBlockStart(chunk);
    if (codeBlockStart > 0) {
      // Split just before the code block
      const beforeBlock = chunk.slice(0, codeBlockStart);
      const paraBreak = beforeBlock.lastIndexOf('\n\n');
      if (paraBreak > 0) return paraBreak + 2;
      const newline = beforeBlock.lastIndexOf('\n');
      if (newline > 0) return newline + 1;
      // If the code block starts at position 0, we have no choice but to
      // find the end of the code block and split after it
      return findCodeBlockEnd(remaining, 0, maxChunkSize);
    }
  }

  // Try paragraph boundary (double newline) — best for readability
  const paraBreak = chunk.lastIndexOf('\n\n');
  if (paraBreak > 0) {
    return paraBreak + 2; // include the blank line
  }

  // Try single newline boundary
  const newlineBreak = chunk.lastIndexOf('\n');
  if (newlineBreak > 0) {
    return newlineBreak + 1;
  }

  // Try space boundary
  const spaceBreak = chunk.lastIndexOf(' ');
  if (spaceBreak > 0) {
    return spaceBreak + 1;
  }

  // Hard cut — no logical boundary found
  return maxChunkSize;
}

/**
 * Check if the text ends while inside an unclosed code block.
 * Counts ``` fence occurrences — if odd number, we're inside a block.
 *
 * @param {string} text - Text to analyze
 * @returns {boolean} True if text ends inside a code block
 */
function isInsideCodeBlock(text) {
  // Match all ``` occurrences (code block fences)
  const fenceRegex = /```/g;
  let count = 0;
  while (fenceRegex.exec(text) !== null) {
    count++;
  }
  return count % 2 === 1; // odd number of fences means we're inside a block
}

/**
 * Find the start position of the last unclosed code block fence.
 *
 * @param {string} text - Text to search
 * @returns {number} Index of the opening ``` fence, or -1 if not found
 */
function findLastCodeBlockStart(text) {
  const fenceRegex = /```/g;
  const positions = [];
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    positions.push(match.index);
  }

  // The last opening fence is positions[positions.length - 1] when count is odd
  if (positions.length % 2 === 1) {
    return positions[positions.length - 1];
  }
  return -1;
}

/**
 * Find the end of the code block that starts at or after startPos.
 * Returns a position after the closing ``` fence, or maxChunkSize as fallback.
 *
 * @param {string} text - Full remaining text
 * @param {number} startPos - Position to start searching from
 * @param {number} maxChunkSize - Fallback position
 * @returns {number} Position after the closing fence
 */
function findCodeBlockEnd(text, startPos, maxChunkSize) {
  // Find the opening fence
  const openIdx = text.indexOf('```', startPos);
  if (openIdx === -1) return maxChunkSize;

  // Find the closing fence (skip the language identifier line)
  const afterOpen = openIdx + 3;
  const closeIdx = text.indexOf('```', afterOpen);
  if (closeIdx === -1) return maxChunkSize;

  // Return position after the closing fence (plus newline if present)
  const afterClose = closeIdx + 3;
  if (afterClose < text.length && text[afterClose] === '\n') {
    return afterClose + 1;
  }
  return afterClose;
}
