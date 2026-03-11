/**
 * Logs Command Handler
 * Handles /logs command to retrieve pipeline logs.
 */

import { getPipelineLogs } from '../../../services/pipeline-control-service.js';

/**
 * Logs command metadata.
 */
export const logsMeta = {
  name: 'logs',
  aliases: ['l'],
  description: '查看管道日志',
  usage: '/logs [target]',
  examples: ['/logs', '/logs my-feature'],
  params: [
    {
      name: 'target',
      type: 'string',
      required: false,
      description: '目标标识符'
    }
  ],
  requiresAuth: true,
  helpText: '/logs [target] - 查看管道日志'
};

/** Character threshold for sending logs as file */
const FILE_THRESHOLD = 4000;

/**
 * Handle logs command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleLogs(handlerCtx) {
  const { params, reply, replyFile, parsed } = handlerCtx;

  // Get target from positional args or params
  const target = params._args?.[0] || params.target;

  try {
    const result = await getPipelineLogs({ targetId: target });

    if (result.ok) {
      const logs = result.stdout || result.logs || '';

      if (!logs.trim()) {
        await reply('📭 暂无日志。');
        return;
      }

      // Send as file if too long
      if (logs.length >= FILE_THRESHOLD) {
        const filename = `pipeline-logs-${target || 'latest'}.txt`;
        await replyFile(logs, filename);
        await reply(`📄 日志已发送为文件 (${logs.length} 字符)`);
      } else {
        // Send in chunks if moderately long
        await sendLogsInChunks(reply, logs);
      }
    } else {
      await reply(`❌ 获取日志失败: ${result.stderr || result.error || '未知错误'}`);
    }
  } catch (error) {
    await reply(`❌ 获取日志失败: ${error.message}`);
  }
}

/**
 * Send logs in chunks to avoid Telegram message limits.
 * @param {Function} reply - Reply function
 * @param {string} logs - Log content
 */
async function sendLogsInChunks(reply, logs) {
  const CHUNK_SIZE = 3800;

  if (logs.length <= CHUNK_SIZE) {
    await reply(`📋 日志:\n\`\`\`\n${logs}\n\`\`\``);
    return;
  }

  // Split into chunks
  const chunks = [];
  for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
    chunks.push(logs.slice(i, i + CHUNK_SIZE));
  }

  await reply(`📋 日志 (${logs.length} 字符, 分 ${chunks.length} 段):`);

  for (let i = 0; i < chunks.length; i++) {
    await reply(`\`\`\`\n${chunks[i]}\n\`\`\``);
  }
}

export default handleLogs;
