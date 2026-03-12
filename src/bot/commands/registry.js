/**
 * Command Registry
 * Manages command registration, lookup, and metadata.
 */

/**
 * @typedef {Object} ParamMeta
 * @property {string} name - Parameter name
 * @property {boolean} required - Whether the parameter is required
 * @property {string} description - Parameter description
 * @property {string} [type] - Parameter type (string, number, enum)
 * @property {string[]} [enum] - Allowed values for enum type
 * @property {*} [default] - Default value
 */

/**
 * @typedef {Object} SubcommandMeta
 * @property {string} name - Subcommand name
 * @property {string} description - Subcommand description
 * @property {ParamMeta[]} [params] - Subcommand parameters
 */

/**
 * @typedef {Object} CommandMeta
 * @property {string} name - Command name
 * @property {string[]} [aliases] - Command aliases
 * @property {string} description - Command description
 * @property {string} usage - Usage example
 * @property {string[]} [examples] - Usage examples
 * @property {SubcommandMeta[]} [subcommands] - Available subcommands
 * @property {ParamMeta[]} [params] - Command parameters
 * @property {boolean} requiresAuth - Whether authorization is required
 * @property {string} [minRole] - Minimum required role (viewer, operator, admin)
 * @property {boolean} [requiresConfirmation] - Whether confirmation is required for high-risk commands
 * @property {string} helpText - Help text for the command
 */

/**
 * @typedef {Object} CommandEntry
 * @property {CommandMeta} meta - Command metadata
 * @property {Function} handler - Command handler function
 */

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 */

// Internal registry storage
const commands = new Map();
const aliasToCommand = new Map();

/**
 * Register a command with its metadata and handler.
 * @param {CommandMeta} meta - Command metadata
 * @param {Function} handler - Command handler function
 * @throws {Error} If command already registered
 */
export function registerCommand(meta, handler) {
  if (!meta || !meta.name) {
    throw new Error('Command meta must have a name');
  }

  // Normalize meta with lowercase name
  const normalizedMeta = {
    ...meta,
    name: meta.name.toLowerCase()
  };
  const name = normalizedMeta.name;

  if (commands.has(name)) {
    throw new Error(`Command "${name}" is already registered`);
  }

  // Register command
  commands.set(name, { meta: normalizedMeta, handler });

  // Register aliases
  if (meta.aliases && Array.isArray(meta.aliases)) {
    for (const alias of meta.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasToCommand.has(aliasLower)) {
        throw new Error(`Alias "${alias}" is already registered`);
      }
      aliasToCommand.set(aliasLower, name);
    }
  }
}

/**
 * Get a command entry by name or alias.
 * @param {string} name - Command name or alias
 * @returns {CommandEntry | null} Command entry or null
 */
export function getCommand(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const nameLower = name.toLowerCase();

  // Try direct lookup
  if (commands.has(nameLower)) {
    return commands.get(nameLower);
  }

  // Try alias lookup
  const resolvedName = aliasToCommand.get(nameLower);
  if (resolvedName && commands.has(resolvedName)) {
    return commands.get(resolvedName);
  }

  return null;
}

/**
 * Check if a name is a registered alias.
 * @param {string} name - Name to check
 * @returns {boolean} True if name is an alias
 */
export function isAlias(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return aliasToCommand.has(name.toLowerCase());
}

/**
 * Get all registered commands.
 * @returns {CommandEntry[]} All command entries
 */
export function getAllCommands() {
  return Array.from(commands.values());
}

/**
 * Generate help text for a specific command or all commands.
 * @param {string} [commandName] - Optional command name for specific help
 * @returns {string} Help text
 */
export function getHelpText(commandName) {
  if (commandName) {
    const entry = getCommand(commandName);
    if (!entry) {
      return `未知命令 '${commandName}'。输入 /help 查看可用命令。`;
    }
    return formatCommandHelp(entry.meta);
  }

  // Generate general help
  const commandList = getAllCommands()
    .map((entry) => {
      const aliases = entry.meta.aliases?.length ? ` (${entry.meta.aliases.map((a) => `/${a}`).join(', ')})` : '';
      return `/${entry.meta.name}${aliases} - ${entry.meta.description}`;
    })
    .sort();

  return `可用命令：\n\n${commandList.join('\n')}`;
}

/**
 * Format detailed help for a single command.
 * @param {CommandMeta} meta - Command metadata
 * @returns {string} Formatted help text
 */
function formatCommandHelp(meta) {
  const lines = [`/${meta.name} - ${meta.description}`];

  if (meta.aliases?.length) {
    lines.push(`别名: ${meta.aliases.map((a) => `/${a}`).join(', ')}`);
  }

  if (meta.usage) {
    lines.push(`用法: ${meta.usage}`);
  }

  if (meta.subcommands?.length) {
    lines.push('\n子命令:');
    for (const sub of meta.subcommands) {
      lines.push(`  ${sub.name} - ${sub.description}`);
    }
  }

  if (meta.params?.length) {
    lines.push('\n参数:');
    for (const param of meta.params) {
      const required = param.required ? '(必填)' : '(可选)';
      lines.push(`  ${param.name} ${required} - ${param.description}`);
    }
  }

  if (meta.examples?.length) {
    lines.push('\n示例:');
    for (const example of meta.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}

/**
 * Clear the registry (for testing).
 */
export function clearRegistry() {
  commands.clear();
  aliasToCommand.clear();
}

/**
 * Get the alias map for parser usage.
 * @returns {Record<string, string>} Alias to command name mapping
 */
export function getAliasMap() {
  /** @type {Record<string, string>} */
  const map = {};
  for (const [alias, command] of aliasToCommand) {
    map[alias] = command;
  }
  return map;
}
