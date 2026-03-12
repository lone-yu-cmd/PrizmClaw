/**
 * Alias Command Handler
 * F-013: Session and Context Manager
 *
 * Handles the /alias command for managing command aliases.
 */

import { aliasStore } from '../../../services/alias-store.js';

/**
 * Alias command metadata.
 */
export const aliasMeta = {
  name: 'alias',
  aliases: [],
  description: '管理命令别名',
  usage: '/alias [name=command] 或 /alias del <name>',
  examples: ['/alias', '/alias ll=ls -la', '/alias del ll'],
  params: [],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/alias - 查看别名列表；/alias name=command - 定义别名；/alias del name - 删除别名'
};

/**
 * Parse alias definition from string.
 * @param {string} input - Input string like "name=command"
 * @returns {{ name: string, command: string } | null} Parsed result or null
 */
function parseAliasDefinition(input) {
  const eqIndex = input.indexOf('=');
  if (eqIndex === -1) {
    return null;
  }
  const name = input.slice(0, eqIndex).trim();
  const command = input.slice(eqIndex + 1).trim();
  if (!name || !command) {
    return null;
  }
  return { name, command };
}

/**
 * Handle /alias command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleAlias(handlerCtx) {
  const { reply, userId, args = [] } = handlerCtx;
  const userIdStr = String(userId);

  // No args: list all aliases
  if (args.length === 0) {
    const aliases = aliasStore.getAllAliases(userIdStr);
    const aliasNames = Object.keys(aliases);

    if (aliasNames.length === 0) {
      await reply('📋 您还没有定义任何别名。');
      return;
    }

    const lines = ['📋 您的命令别名：'];
    for (const name of aliasNames.sort()) {
      lines.push(`  ${name} = ${aliases[name]}`);
    }
    lines.push('', '用法: /alias name=command 定义别名，/alias del name 删除别名');
    await reply(lines.join('\n'));
    return;
  }

  // Check for delete subcommand
  if (args[0].toLowerCase() === 'del' || args[0].toLowerCase() === 'delete') {
    if (args.length < 2) {
      await reply('❌ 用法: /alias del <name>');
      return;
    }

    const name = args[1];
    const deleted = await aliasStore.deleteAlias(userIdStr, name);

    if (deleted) {
      await reply(`✅ 已删除别名: ${name}`);
    } else {
      await reply(`❌ 别名 "${name}" 不存在。`);
    }
    return;
  }

  // Parse alias definition
  const definition = parseAliasDefinition(args.join(' '));
  if (!definition) {
    await reply('❌ 用法: /alias name=command 或 /alias del <name>');
    return;
  }

  try {
    await aliasStore.setAlias(userIdStr, definition.name, definition.command);
    await reply(`✅ 已定义别名: ${definition.name} = ${definition.command}`);
  } catch (error) {
    await reply(`❌ ${error.message}`);
  }
}

export default {
  aliasMeta,
  handleAlias
};
