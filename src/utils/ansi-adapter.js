/**
 * ANSI Adapter Utility
 * F-020: Enhanced Terminal Output Streaming
 *
 * Strips ANSI escape codes from terminal output and collapses
 * carriage-return progress lines before forwarding to Telegram.
 */

/**
 * Regex that matches all ANSI/VT100 escape sequences:
 * - CSI sequences: ESC [ ... final-byte
 * - OSC sequences: ESC ] ... (BEL or ST)
 * - Simple ESC sequences: ESC followed by single char
 */
const ANSI_REGEX = new RegExp(
  [
    // OSC sequences: ESC ] ... BEL or ESC \
    '\u001b\\][^\u0007\u001b]*(?:\u0007|\u001b\\\\)',
    // CSI sequences: ESC [ ... final byte (0x40-0x7E)
    '\u001b\\[[\\x30-\\x3f]*[\\x20-\\x2f]*[\\x40-\\x7e]',
    // Simple two-char ESC sequences
    '\u001b[\\x20-\\x7e]'
  ].join('|'),
  'g'
);

/**
 * Strip all ANSI escape codes from a string.
 * @param {string|null|undefined} text - Raw terminal output possibly containing ANSI codes
 * @returns {string} Clean text without escape sequences
 */
export function stripAnsi(text) {
  if (text == null) return '';
  return String(text).replace(ANSI_REGEX, '');
}

/**
 * Collapse carriage-return (\r) progress lines.
 *
 * Terminal progress bars work by emitting content then a \r to "overwrite"
 * the current line. For example:
 *   "Loading 10%\rLoading 50%\rLoading 100%\n"
 *
 * This function keeps only the last state before each newline,
 * simulating what a terminal would display.
 *
 * @param {string} text - Text that may contain \r overwrites
 * @returns {string} Collapsed text with only final states kept
 */
export function collapseCarriageReturns(text) {
  if (!text) return '';

  // Split into logical line groups by newlines (preserving \r\n as single newline)
  // Strategy: split the text by \n, then within each line collapse \r sequences
  const lines = text.split('\n');
  const collapsed = lines.map((line) => {
    // Each \r starts a new "overwrite" within the line — keep only the last segment
    const parts = line.split('\r');
    // Filter out empty trailing segments from trailing \r
    // The last non-empty part is what would be visible on the terminal
    let last = parts[parts.length - 1];
    // If the last part is empty, use the second-to-last non-empty part
    if (last === '' && parts.length > 1) {
      last = parts[parts.length - 2];
    }
    return last;
  });

  return collapsed.join('\n');
}

/**
 * Process a raw stdout chunk for Telegram display.
 * Strips ANSI escape codes and collapses carriage-return progress lines.
 *
 * This is the primary function used in the onChunk hook of the streaming pipeline.
 *
 * @param {string|null|undefined} chunk - Raw stdout chunk
 * @returns {string} Clean text suitable for Telegram
 */
export function processChunk(chunk) {
  if (chunk == null) return '';
  const stripped = stripAnsi(chunk);
  return collapseCarriageReturns(stripped);
}
