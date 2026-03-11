/**
 * Plan Command Handler
 * Handles /plan command with status/versions/use/rollback/validate subcommands.
 *
 * Implements:
 * - T-101: /plan upload hint
 * - T-102: /plan versions command
 * - T-103: /plan use command
 * - T-104: /plan status command
 * - T-105: /plan rollback command
 * - T-106: /plan validate command
 */

import { createPlanIngestionService } from '../../../services/plan-ingestion-service.js';
import { loadPipelineInfraConfig } from '../../../pipeline-infra/config-loader.js';

// Valid plan types
const PLAN_TYPES = ['feature-list', 'bug-fix-list'];

/**
 * Get plan service instance.
 * @returns {Object} Plan ingestion service
 */
function getPlanService() {
  const config = loadPipelineInfraConfig();
  return createPlanIngestionService({ plansDir: config.plansDir });
}

/**
 * Validate and normalize plan type.
 * @param {string} type - Input type string
 * @returns {string|null} Normalized type or null if invalid
 */
function normalizePlanType(type) {
  if (!type) return null;
  const normalized = type.toLowerCase().trim();
  if (normalized === 'feature' || normalized === 'feature-list') return 'feature-list';
  if (normalized === 'bug' || normalized === 'bugfix' || normalized === 'bug-fix-list') return 'bug-fix-list';
  return null;
}

/**
 * Format version info for display.
 * @param {Object} version - Version info object
 * @param {string} currentVersion - Current active version
 * @returns {string} Formatted string
 */
function formatVersionInfo(version, currentVersion) {
  const isCurrent = version.version === currentVersion;
  const marker = isCurrent ? ' ← 当前' : '';
  const time = version.timestamp?.toLocaleString?.() || version.version;
  return `• ${version.version}${marker} (${version.itemCount} 项)`;
}

/**
 * Plan command metadata.
 */
export const planMeta = {
  name: 'plan',
  aliases: ['p'],
  description: '管理计划文件',
  usage: '/plan <action> [type] [version]',
  examples: [
    '/plan status',
    '/plan status feature-list',
    '/plan versions feature-list',
    '/plan use feature-list v20260312-143052',
    '/plan rollback feature-list'
  ],
  subcommands: [
    { name: 'status', description: '查看计划状态' },
    { name: 'versions', description: '列出历史版本' },
    { name: 'use', description: '切换到指定版本' },
    { name: 'rollback', description: '回滚到上一版本' },
    { name: 'validate', description: '校验计划文件' }
  ],
  params: [
    {
      name: 'type',
      type: 'enum',
      enum: ['feature-list', 'bug-fix-list'],
      required: false,
      description: '计划类型'
    },
    {
      name: 'version',
      type: 'string',
      required: false,
      description: '版本号'
    }
  ],
  requiresAuth: true,
  minRole: 'operator',
  helpText: '/plan <action> [type] [version] - 管理计划文件'
};

/**
 * Handle plan command.
 * @param {Object} handlerCtx - Handler context
 */
export async function handlePlan(handlerCtx) {
  const { ctx, parsed, params, reply } = handlerCtx;

  // Determine action from subcommand or default to help (T-101)
  const action = parsed.subcommand || null;

  switch (action) {
    case 'status':
      return handleStatus(handlerCtx);
    case 'versions':
      return handleVersions(handlerCtx);
    case 'use':
      return handleUse(handlerCtx);
    case 'rollback':
      return handleRollback(handlerCtx);
    case 'validate':
      return handleValidate(handlerCtx);
    default:
      // T-101: Show upload hint
      await reply([
        '📋 计划文件管理',
        '',
        '上传计划文件：',
        '直接发送 JSON 文件到本对话即可自动识别并保存。',
        '',
        '可用命令：',
        '• /plan status [type] - 查看当前计划状态',
        '• /plan versions <type> - 列出历史版本',
        '• /plan use <type> <version> - 切换到指定版本',
        '• /plan rollback <type> - 回滚到上一版本',
        '• /plan validate - 校验当前发送的文件'
      ].join('\n'));
  }
}

/**
 * T-104: Handle status subcommand.
 */
async function handleStatus({ params, reply, parsed }) {
  const service = getPlanService();
  const typeArg = params._args?.[0] || params.type;
  const type = normalizePlanType(typeArg);

  // If no type specified, show both
  if (!type) {
    const featureStatus = await getStatusForType(service, 'feature-list');
    const bugStatus = await getStatusForType(service, 'bug-fix-list');

    const lines = ['📋 计划文件状态', ''];
    lines.push('【特性列表】');
    lines.push(featureStatus);
    lines.push('');
    lines.push('【Bug修复列表】');
    lines.push(bugStatus);

    await reply(lines.join('\n'));
    return;
  }

  // Show specific type
  const status = await getStatusForType(service, type);
  await reply(`📋 ${type === 'feature-list' ? '特性列表' : 'Bug修复列表'} 状态\n\n${status}`);
}

/**
 * Get status string for a plan type.
 */
async function getStatusForType(service, type) {
  const current = await service.getCurrent(type);

  if (!current) {
    return '暂无激活的计划文件';
  }

  const versions = await service.listVersions(type);
  const versionInfo = versions.find(v => v.version === current.version);

  const lines = [
    `版本: ${current.version}`,
    `项目数: ${versionInfo?.itemCount || '未知'}`,
    `激活时间: ${current.activatedAt || '未知'}`
  ];

  return lines.join('\n');
}

/**
 * T-102: Handle versions subcommand.
 */
async function handleVersions({ params, reply, parsed }) {
  const service = getPlanService();
  const typeArg = params._args?.[0] || params.type;
  const type = normalizePlanType(typeArg);

  if (!type) {
    await reply('❌ 请指定计划类型: /plan versions <feature-list|bug-fix-list>');
    return;
  }

  const versions = await service.listVersions(type);
  const current = await service.getCurrent(type);
  const currentVersion = current?.version;

  if (versions.length === 0) {
    await reply(`暂无历史版本。请上传 ${type === 'feature-list' ? '特性列表' : 'Bug修复列表'} JSON 文件。`);
    return;
  }

  const lines = [
    `📜 ${type === 'feature-list' ? '特性列表' : 'Bug修复列表'} 历史版本`,
    ''
  ];

  for (const v of versions) {
    lines.push(formatVersionInfo(v, currentVersion));
  }

  lines.push('');
  lines.push(`共 ${versions.length} 个版本`);

  await reply(lines.join('\n'));
}

/**
 * T-103: Handle use subcommand.
 */
async function handleUse({ params, reply, parsed }) {
  const service = getPlanService();
  const args = params._args || [];

  const typeArg = args[0] || params.type;
  const versionArg = args[1] || params.version;

  const type = normalizePlanType(typeArg);

  if (!type) {
    await reply('❌ 用法: /plan use <feature-list|bug-fix-list> <version>');
    return;
  }

  if (!versionArg) {
    await reply('❌ 请指定版本号。例如: /plan use feature-list v20260312-143052');
    return;
  }

  // Normalize version (add v prefix if missing)
  const version = versionArg.startsWith('v') ? versionArg : `v${versionArg}`;

  // Check if version exists
  const content = await service.getVersion(type, version);
  if (!content) {
    await reply(`❌ 版本 ${version} 不存在。使用 /plan versions ${type} 查看可用版本。`);
    return;
  }

  // Set as current
  const success = await service.setCurrent(type, version);

  if (!success) {
    await reply('❌ 切换版本失败。');
    return;
  }

  // Parse content to get summary
  const parsedContent = JSON.parse(content);
  const itemCount = parsedContent.features?.length || parsedContent.bugs?.length || 0;
  const name = parsedContent.app_name || parsedContent.project_name || '未知';

  await reply([
    `✅ 已切换到版本 ${version}`,
    `类型: ${type === 'feature-list' ? '特性列表' : 'Bug修复列表'}`,
    `名称: ${name}`,
    `项目数: ${itemCount}`
  ].join('\n'));
}

/**
 * T-105: Handle rollback subcommand.
 * Maps to US-3 Version Management.
 */
async function handleRollback({ params, reply, parsed }) {
  const service = getPlanService();
  const typeArg = params._args?.[0] || params.type;
  const type = normalizePlanType(typeArg);

  if (!type) {
    await reply('❌ 用法: /plan rollback <feature-list|bug-fix-list>');
    return;
  }

  const result = await service.rollback(type);

  if (!result) {
    await reply('❌ 无法回滚：没有可回滚的上一版本。');
    return;
  }

  await reply([
    '✅ 已回滚到上一版本',
    `原版本: ${result.previousVersion}`,
    `当前版本: ${result.currentVersion}`
  ].join('\n'));
}

/**
 * T-106: Handle validate subcommand.
 * Note: This is a placeholder - actual validation happens when user sends a file.
 */
async function handleValidate({ params, reply, parsed, ctx }) {
  await reply([
    '🔍 计划文件校验',
    '',
    '发送 JSON 文件到本对话即可自动校验。',
    '校验通过会显示文件摘要，校验失败会显示具体错误信息。',
    '',
    '支持的 schema 类型：',
    '• dev-pipeline-feature-list-v1',
    '• dev-pipeline-bug-fix-list-v1'
  ].join('\n'));
}

export default handlePlan;
