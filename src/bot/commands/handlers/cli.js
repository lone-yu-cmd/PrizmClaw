import { backendRegistry } from '../../../services/backend-registry.js';
import { profileStore } from '../../../services/profile-store.js';
import { sessionStore } from '../../../services/session-store.js';
import { logger } from '../../../utils/logger.js';

/**
 * CLI command metadata.
 */
export const cliMeta = {
  name: 'cli',
  aliases: ['backend', 'ai-backend'],
  description: 'AI CLI后端切换和管理',
  usage: '/cli [list|profiles|add|remove|use|reset|<backend>]',
  examples: [
    '/cli',
    '/cli list',
    '/cli profiles',
    '/cli add claude /usr/bin/claude --permission=-y --timeout=300000',
    '/cli remove claude',
    '/cli use claude',
    '/cli reset'
  ],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText:
    '/cli - 显示当前后端；' +
    '/cli list - 列出可用后端；' +
    '/cli profiles - 列出所有已保存的配置档案；' +
    '/cli add <name> <bin> [--permission=<flag>] [--timeout=<ms>] - 添加配置档案；' +
    '/cli remove <name> - 删除配置档案；' +
    '/cli use <name> - 切换到指定配置档案；' +
    '/cli reset - 重置为默认后端'
};

/**
 * Parse --key=value flags from args array.
 * @param {string[]} args
 * @returns {{ flags: Object, positional: string[] }}
 */
function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      flags[match[1]] = match[2];
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * CLI Command Handler
 * Handles /cli commands for AI backend switching and management.
 */
export class CliCommandHandler {
  #backendRegistry;
  #profileStore;

  /**
   * Create a new CLI command handler.
   * @param {Object} options - Handler options
   * @param {Object} [options.backendRegistry] - Backend registry instance
   * @param {Object} [options.profileStore] - Profile store instance
   */
  constructor(options = {}) {
    this.#backendRegistry = options.backendRegistry || backendRegistry;
    this.#profileStore = options.profileStore || profileStore;
  }

  /**
   * Set backend registry for testing purposes.
   * @param {Object} registry - Backend registry instance
   */
  setBackendRegistry(registry) {
    this.#backendRegistry = registry;
  }

  /**
   * Set profile store for testing purposes.
   * @param {Object} store - Profile store instance
   */
  setProfileStore(store) {
    this.#profileStore = store;
  }

  /**
   * Handle /cli command with subcommands.
   * @param {Object} ctx - Telegraf context
   * @param {string[]} args - Command arguments
   * @returns {Promise<string>} Response message
   */
  async handle(ctx, args) {
    const sessionKey = this.#getSessionKey(ctx);
    const subcommand = args[0]?.toLowerCase();

    try {
      switch (subcommand) {
        case 'list':
          return this.#handleList();
        case 'profiles':
          return this.#handleProfiles();
        case 'add':
          return await this.#handleAdd(args.slice(1));
        case 'remove':
          return await this.#handleRemove(args[1]);
        case 'use':
          return this.#handleUse(sessionKey, args[1]);
        case 'reset':
          return this.#handleReset(sessionKey);
        case undefined:
        case '':
          return this.#handleStatus(sessionKey);
        default:
          return this.#handleSwitch(sessionKey, subcommand);
      }
    } catch (error) {
      logger.error(`CLI command error: ${error.message}`, { sessionKey, subcommand });
      return `❌ Error: ${error.message}`;
    }
  }

  /**
   * Handle /cli list - List available backends.
   * @returns {string} List of backends
   */
  #handleList() {
    const backends = this.#backendRegistry.listBackends();

    if (backends.length === 0) {
      return '📋 No backends configured. Use /cli add <name> <bin> to create one.';
    }

    const backendList = backends.map(backend => {
      const status = this.#backendRegistry.validateBackend(backend.name) ? '✅' : '❌';
      return `${status} ${backend.name} - ${backend.description}`;
    }).join('\n');

    const defaultBackend = this.#backendRegistry.getDefaultBackend();
    const defaultInfo = defaultBackend ? `\n\nDefault: ${defaultBackend.name}` : '';

    return `📋 Available Backends:\n${backendList}${defaultInfo}`;
  }

  /**
   * Handle /cli profiles - List all saved profiles with full params.
   * @returns {string} Profile list
   */
  #handleProfiles() {
    const profiles = this.#profileStore.listProfiles();
    const defaultName = this.#profileStore.getDefaultProfileName();

    if (profiles.length === 0) {
      return '📋 No profiles saved. Use /cli add <name> <bin> to create one.';
    }

    const lines = profiles.map(p => {
      const isDefault = p.name === defaultName ? ' [default]' : '';
      const permission = p.permissionFlag ? `\n  Permission: ${p.permissionFlag}` : '';
      const timeout = p.timeoutMs ? `\n  Timeout: ${p.timeoutMs}ms` : '';
      return `• ${p.name}${isDefault}\n  Bin: ${p.binPath}${permission}${timeout}`;
    });

    return `📋 CLI Profiles:\n\n${lines.join('\n\n')}`;
  }

  /**
   * Handle /cli add <name> <bin> [--permission=<flag>] [--timeout=<ms>]
   * @param {string[]} args - Arguments after 'add'
   * @returns {Promise<string>} Result message
   */
  async #handleAdd(args) {
    const { flags, positional } = parseFlags(args);
    const [name, binPath] = positional;

    if (!name || !binPath) {
      return '❌ Usage: /cli add <name> <bin> [--permission=<flag>] [--timeout=<ms>]\nExample: /cli add claude /usr/bin/claude --permission=-y --timeout=300000';
    }

    const permissionFlag = flags.permission ?? null;
    const timeoutMs = flags.timeout ? parseInt(flags.timeout, 10) : null;

    if (flags.timeout && (isNaN(timeoutMs) || timeoutMs <= 0)) {
      return '❌ Invalid --timeout value. Must be a positive integer (milliseconds).';
    }

    const profile = {
      name,
      binPath,
      permissionFlag,
      timeoutMs,
      description: flags.description || `${name} CLI backend`
    };

    // Persist to profile store
    await this.#profileStore.addProfile(profile);

    // Register/update in backend registry
    if (this.#backendRegistry.getBackend(name)) {
      // Backend already registered — update fields
      this.#backendRegistry.updateBackend(name, {
        permissionFlag,
        timeoutMs,
        description: profile.description
      });
    } else {
      // Try to register (binary validation happens inside)
      try {
        this.#backendRegistry.registerBackend(name, binPath, {
          description: profile.description,
          permissionFlag,
          timeoutMs
        });
      } catch (err) {
        // Binary not accessible — profile is saved but backend not active
        logger.warn(`CLI add: backend "${name}" registered but binary not accessible: ${err.message}`);
        return `⚠️ Profile "${name}" saved, but binary "${binPath}" is not accessible.\nProfile will load on next startup. Check your binary path.`;
      }
    }

    const details = [
      `Bin: ${binPath}`,
      permissionFlag ? `Permission: ${permissionFlag}` : null,
      timeoutMs ? `Timeout: ${timeoutMs}ms` : null
    ].filter(Boolean).join('\n');

    return `✅ Profile "${name}" added.\n${details}`;
  }

  /**
   * Handle /cli remove <name> - Delete a non-default profile.
   * @param {string} name - Profile name to remove
   * @returns {Promise<string>} Result message
   */
  async #handleRemove(name) {
    if (!name) {
      return '❌ Usage: /cli remove <name>';
    }

    try {
      await this.#profileStore.removeProfile(name);
    } catch (err) {
      return `❌ ${err.message}`;
    }

    // Unregister from backend registry if present
    if (this.#backendRegistry.getBackend(name)) {
      this.#backendRegistry.unregisterBackend(name);
    }

    return `🗑️ Profile "${name}" removed.`;
  }

  /**
   * Handle /cli use <name> - Switch session to named profile.
   * @param {string} sessionKey - Session identifier
   * @param {string} name - Profile name
   * @returns {string} Result message
   */
  #handleUse(sessionKey, name) {
    if (!name) {
      return '❌ Usage: /cli use <name>';
    }

    const backend = this.#backendRegistry.getBackend(name);
    if (!backend) {
      const available = this.#profileStore.listProfiles().map(p => p.name).join(', ');
      return `❌ Profile "${name}" not found.\nAvailable: ${available || 'none'}`;
    }

    if (!this.#backendRegistry.validateBackend(name)) {
      return `❌ Profile "${name}" binary is not accessible.\nPath: ${backend.binPath}`;
    }

    sessionStore.setCurrentBackend(sessionKey, name);
    logger.info(`Switched backend for session ${sessionKey} to ${name} via /cli use`);

    const details = [
      `Bin: ${backend.binPath}`,
      backend.permissionFlag ? `Permission: ${backend.permissionFlag}` : null,
      backend.timeoutMs ? `Timeout: ${backend.timeoutMs}ms` : null
    ].filter(Boolean).join('\n');

    return `✅ Switched to profile: ${name}\n${details}`;
  }

  /**
   * Handle /cli - Show current backend status.
   * @param {string} sessionKey - Session identifier
   * @returns {string} Current backend information
   */
  #handleStatus(sessionKey) {
    const currentBackendName = sessionStore.getCurrentBackend(sessionKey);
    const currentBackend = currentBackendName
      ? this.#backendRegistry.getBackend(currentBackendName)
      : null;

    const defaultBackend = this.#backendRegistry.getDefaultBackend();

    if (currentBackend) {
      const isValid = this.#backendRegistry.validateBackend(currentBackend.name);
      const status = isValid ? '✅' : '⚠️';
      const details = [
        `Path: ${currentBackend.binPath}`,
        currentBackend.permissionFlag ? `Permission: ${currentBackend.permissionFlag}` : null,
        currentBackend.timeoutMs ? `Timeout: ${currentBackend.timeoutMs}ms` : null,
        isValid ? 'Ready to use' : 'Binary not accessible'
      ].filter(Boolean).join('\n');
      return `${status} Current backend: ${currentBackend.name}\n${details}`;
    } else if (defaultBackend) {
      return `🔧 Using default backend: ${defaultBackend.name}\nPath: ${defaultBackend.binPath}`;
    } else {
      return '❌ No backend configured. Use /cli add <name> <bin> to create one.';
    }
  }

  /**
   * Handle /cli <backend> - Switch to specified backend (legacy/F-015).
   * @param {string} sessionKey - Session identifier
   * @param {string} backendName - Backend name to switch to
   * @returns {string} Switch confirmation message
   */
  #handleSwitch(sessionKey, backendName) {
    // Try to find backend by name or alias
    let backend = this.#backendRegistry.getBackend(backendName);
    if (!backend) {
      backend = this.#backendRegistry.getBackendByAlias(backendName);
    }

    if (!backend) {
      const availableBackends = this.#backendRegistry.listBackends().map(b => b.name).join(', ');
      return `❌ Backend "${backendName}" not found.\nAvailable: ${availableBackends || 'none'}\n💡 Use /cli add <name> <bin> to add a new profile.`;
    }

    // Validate backend binary exists
    if (!this.#backendRegistry.validateBackend(backend.name)) {
      return `❌ Backend "${backend.name}" is not accessible.\nPath: ${backend.binPath}`;
    }

    // Set backend for session
    sessionStore.setCurrentBackend(sessionKey, backend.name);
    logger.info(`Switched backend for session ${sessionKey} to ${backend.name}`);

    return `✅ Switched to backend: ${backend.name}\nPath: ${backend.binPath}`;
  }

  /**
   * Handle /cli reset - Reset to default backend.
   * @param {string} sessionKey - Session identifier
   * @returns {string} Reset confirmation message
   */
  #handleReset(sessionKey) {
    sessionStore.resetBackend(sessionKey);
    const defaultBackend = this.#backendRegistry.getDefaultBackend();

    if (defaultBackend) {
      logger.info(`Reset backend for session ${sessionKey} to default: ${defaultBackend.name}`);
      return `🔄 Reset to default backend: ${defaultBackend.name}`;
    } else {
      logger.info(`Reset backend for session ${sessionKey}, no default backend configured`);
      return '🔄 Backend reset. No default backend configured.';
    }
  }

  /**
   * Get session key from context.
   * @param {Object} ctx - Telegraf context
   * @returns {string} Session key
   */
  #getSessionKey(ctx) {
    return ctx.chat?.id ? `telegram:${ctx.chat.id}` : 'anonymous';
  }
}

// Create and export singleton instance
export const cliCommandHandler = new CliCommandHandler();

/**
 * Handle /cli command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleCli(handlerCtx) {
  const { reply, ctx, args = [] } = handlerCtx;

  try {
    const result = await cliCommandHandler.handle(ctx, args);
    await reply(result);
  } catch (error) {
    logger.error(`CLI command error: ${error.message}`, { error });
    await reply(`❌ CLI命令执行错误: ${error.message}`);
  }
}
