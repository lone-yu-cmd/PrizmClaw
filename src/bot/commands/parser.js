/**
 * Command Parser
 * Parses Telegram message text into structured ParsedCommand object.
 */

/**
 * @typedef {Object} ParsedCommand
 * @property {string} command - The command name (e.g., "pipeline")
 * @property {string} [subcommand] - Optional subcommand (e.g., "run")
 * @property {string[]} args - Positional arguments
 * @property {Record<string, string>} options - Key-value options (--key=value)
 * @property {string} raw - Original message text
 */

/**
 * Parse Telegram message text into a structured command object.
 * @param {string} text - The message text to parse
 * @param {Object} [aliasMap={}] - Map of aliases to command names
 * @returns {ParsedCommand | null} Parsed command or null if not a command
 */
export function parseCommand(text, aliasMap = {}) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();

  // Must start with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Extract command (first token after /)
  const tokens = trimmed.slice(1).split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) {
    return null;
  }

  let command = tokens[0].toLowerCase();
  const rest = tokens.slice(1);

  // Handle @bot suffix (e.g., /command@mybot)
  const atIndex = command.indexOf('@');
  if (atIndex !== -1) {
    command = command.slice(0, atIndex);
  }

  // Apply alias mapping
  if (aliasMap[command]) {
    command = aliasMap[command];
  }

  const args = [];
  const options = {};
  let subcommand = undefined;

  for (const token of rest) {
    // Parse --key=value options
    if (token.startsWith('--')) {
      const optionText = token.slice(2);
      const eqIndex = optionText.indexOf('=');
      if (eqIndex !== -1) {
        const key = optionText.slice(0, eqIndex).toLowerCase();
        const value = optionText.slice(eqIndex + 1);
        options[key] = value;
      } else {
        // Boolean flag --flag
        options[optionText.toLowerCase()] = 'true';
      }
    } else if (token.includes('=')) {
      // Parse key=value (without --)
      const eqIndex = token.indexOf('=');
      const key = token.slice(0, eqIndex).toLowerCase();
      const value = token.slice(eqIndex + 1);
      options[key] = value;
    } else if (subcommand === undefined && !token.startsWith('-') && args.length === 0) {
      // First non-option token is subcommand if it looks like one
      // This will be validated by the registry
      subcommand = token.toLowerCase();
    } else {
      // Positional argument
      args.push(token);
    }
  }

  return {
    command,
    subcommand,
    args,
    options,
    raw: text
  };
}
