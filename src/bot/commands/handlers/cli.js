import { backendRegistry } from '../../../services/backend-registry.js';
import { sessionStore } from '../../../services/session-store.js';
import { logger } from '../../../utils/logger.js';

/**
 * CLI command metadata.
 */
export const cliMeta = {
  name: 'cli',
  aliases: ['backend', 'ai-backend'],
  description: 'AI CLI后端切换和管理',
  usage: '/cli [list|reset|<backend>]',
  examples: ['/cli', '/cli list', '/cli claude', '/cli reset'],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/cli - 显示当前后端；/cli list - 列出可用后端；/cli <backend> - 切换到指定后端；/cli reset - 重置为默认后端'
};

/**
 * CLI Command Handler
 * Handles /cli commands for AI backend switching and management.
 */
export class CliCommandHandler {
  #backendRegistry;

  /**
   * Create a new CLI command handler.
   * @param {Object} options - Handler options
   * @param {Object} options.backendRegistry - Backend registry instance
   */
  constructor(options = {}) {
    this.#backendRegistry = options.backendRegistry || backendRegistry;
  }

  /**
   * Set backend registry for testing purposes.
   * @param {Object} registry - Backend registry instance
   */
  setBackendRegistry(registry) {
    this.#backendRegistry = registry;
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
      return '📋 No backends configured. Use /cli <backend> to add one.';
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
      return `${status} Current backend: ${currentBackend.name}\nPath: ${currentBackend.binPath}\n${isValid ? 'Ready to use' : 'Binary not accessible'}`;
    } else if (defaultBackend) {
      return `🔧 Using default backend: ${defaultBackend.name}\nPath: ${defaultBackend.binPath}`;
    } else {
      return '❌ No backend configured. Use /cli <backend> to set one.';
    }
  }

  /**
   * Handle /cli <backend> - Switch to specified backend.
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
      return `❌ Backend "${backendName}" not found.\nAvailable: ${availableBackends || 'none'}`;
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
    return ctx.from?.id ? `user-${ctx.from.id}` : 'anonymous';
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