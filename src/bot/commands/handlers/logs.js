/**
 * Logs Command Handler
 * Handles /logs command to retrieve pipeline logs with pagination support.
 *
 * F-005: Pipeline Status Aggregation and Log Streaming - US-2: Paginated Logs Query, US-3: Message Length Compliance
 */

import { createLogPager } from '../../../services/log-pager.js';

/**
 * Logs command metadata.
 */
export const logsMeta = {
  name: 'logs',
  aliases: ['l'],
  description: '查看管道日志',
  usage: '/logs [--lines=N] [--offset=N] [--type=feature|bugfix] [--file]',
  examples: [
    '/logs',
    '/logs --lines=100',
    '/logs --lines=50 --offset=50',
    '/logs --type=bugfix',
    '/logs --file'
  ],
  params: [
    {
      name: 'lines',
      type: 'number',
      required: false,
      description: '显示行数 (最大 500)',
      default: 50,
      aliases: ['n']
    },
    {
      name: 'offset',
      type: 'number',
      required: false,
      description: '跳过前 N 行',
      default: 0,
      aliases: ['o']
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'Pipeline 类型 (feature 或 bugfix)',
      default: 'feature',
      aliases: ['t']
    },
    {
      name: 'file',
      type: 'boolean',
      required: false,
      description: '发送为文件',
      default: false,
      aliases: ['f']
    }
  ],
  requiresAuth: true,
  helpText: '/logs [--lines=N] [--offset=N] [--type=feature|bugfix] [--file] - 查看管道日志'
};

/**
 * Handle logs command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handleLogs(handlerCtx) {
  const { params, reply, replyFile } = handlerCtx;

  // Parse parameters
  const lines = Math.min(parseInt(params.lines || params.n, 10) || 50, 500);
  const offset = parseInt(params.offset || params.o, 10) || 0;
  const pipelineType = params.type || params.t || 'feature';
  const sendAsFile = params.file || params.f || false;

  // Validate pipeline type
  if (pipelineType !== 'feature' && pipelineType !== 'bugfix') {
    await reply(`❌ 无效的 pipeline 类型: ${pipelineType}。请使用 'feature' 或 'bugfix'。`);
    return;
  }

  try {
    const pager = createLogPager();
    const result = await pager.readLogPage(pipelineType, { lines, offset });

    if (!result.ok) {
      await reply(`❌ 获取日志失败: ${result.message || '未知错误'}`);
      return;
    }

    const logs = result.logs || '';

    // Check for empty logs
    if (!logs.trim()) {
      await reply(`📭 ${result.message || '暂无日志。'}`);
      return;
    }

    // Send as file if requested or if too long
    if (sendAsFile || pager.shouldSendAsFile(logs)) {
      const filename = `pipeline-${pipelineType}-logs-${Date.now()}.txt`;
      await replyFile(logs, filename);
      await reply(`📄 日志已发送为文件 (${logs.length} 字符, ${result.metadata.actualLines} 行)`);
      return;
    }

    // Send formatted logs
    const formatted = pager.formatLogsForTelegram(logs, result.metadata);
    await reply(formatted);
  } catch (error) {
    await reply(`❌ 获取日志失败: ${error.message}`);
  }
}

export default handleLogs;
