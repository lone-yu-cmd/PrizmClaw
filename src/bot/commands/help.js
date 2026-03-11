/**
 * Help Text Generator
 * Generates help text for commands.
 */

import { getCommand, getAllCommands } from './registry.js';

/**
 * Generate help text for all commands or a specific command.
 * @param {string} [commandName] - Optional command name
 * @returns {string} Help text
 */
export function generateHelp(commandName) {
  if (commandName) {
    return generateCommandHelp(commandName);
  }
  return generateGeneralHelp();
}

/**
 * Generate general help text listing all commands.
 * @returns {string} Help text
 */
function generateGeneralHelp() {
  const commands = getAllCommands();

  if (commands.length === 0) {
    return '暂无可用命令。';
  }

  const lines = ['可用命令：', ''];

  for (const entry of commands) {
    const { meta } = entry;
    const aliases = meta.aliases?.length ? ` (${meta.aliases.map((a) => `/${a}`).join(', ')})` : '';
    lines.push(`/${meta.name}${aliases}`);
    lines.push(`  ${meta.description}`);
    lines.push('');
  }

  lines.push('输入 /help <命令> 查看详细用法。');

  return lines.join('\n');
}

/**
 * Generate detailed help text for a specific command.
 * @param {string} commandName - Command name
 * @returns {string} Help text
 */
function generateCommandHelp(commandName) {
  const entry = getCommand(commandName);

  if (!entry) {
    return `未知命令 '${commandName}'。输入 /help 查看可用命令。`;
  }

  const { meta } = entry;
  const lines = [];

  // Command name and description
  lines.push(`/${meta.name} - ${meta.description}`);
  lines.push('');

  // Aliases
  if (meta.aliases?.length) {
    lines.push(`别名: ${meta.aliases.map((a) => `/${a}`).join(', ')}`);
    lines.push('');
  }

  // Usage
  if (meta.usage) {
    lines.push(`用法: ${meta.usage}`);
    lines.push('');
  }

  // Subcommands
  if (meta.subcommands?.length) {
    lines.push('子命令:');
    for (const sub of meta.subcommands) {
      lines.push(`  ${sub.name} - ${sub.description}`);
    }
    lines.push('');
  }

  // Parameters
  if (meta.params?.length) {
    lines.push('参数:');
    for (const param of meta.params) {
      const required = param.required ? '(必填)' : '(可选)';
      const type = param.type ? ` [${param.type}]` : '';
      const enumValues = param.enum ? ` {${param.enum.join(', ')}}` : '';
      const defaultVal = param.default !== undefined ? ` = ${param.default}` : '';
      lines.push(`  ${param.name}${type}${enumValues}${defaultVal} ${required}`);
      lines.push(`    ${param.description}`);
    }
    lines.push('');
  }

  // Examples
  if (meta.examples?.length) {
    lines.push('示例:');
    for (const example of meta.examples) {
      lines.push(`  ${example}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Generate quick reference for all commands.
 * @returns {string} Quick reference text
 */
export function generateQuickReference() {
  const commands = getAllCommands();

  if (commands.length === 0) {
    return '暂无可用命令。';
  }

  const lines = commands.map((entry) => {
    const { meta } = entry;
    const aliases = meta.aliases?.length ? ` /${meta.aliases.join(' /')}` : '';
    return `/${meta.name}${aliases} - ${meta.description}`;
  });

  return lines.join('\n');
}
