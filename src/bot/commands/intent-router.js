/**
 * Intent Router
 * F-015: Universal Command Natural Language Routing
 *
 * Maps natural-language text (or partial slash-command text) to ranked command candidates.
 * Uses keyword-based scoring with tiered confidence levels.
 */

/**
 * @typedef {Object} IntentCandidate
 * @property {string} command - Target command name
 * @property {string} [subcommand] - Optional subcommand
 * @property {string[]} [args] - Optional positional arguments
 * @property {number} confidence - 0..1 confidence score
 * @property {string} reason - Human-readable match reason
 */

/**
 * @typedef {Object} IntentRouteResult
 * @property {boolean} matched - True if at least one candidate found
 * @property {number} confidence - Highest confidence among candidates (0 if none)
 * @property {IntentCandidate | null} primary - Highest-confidence candidate, or null
 * @property {IntentCandidate[]} candidates - All ranked candidates (desc confidence)
 * @property {boolean} needsConfirmation - True when confidence < HIGH_CONFIDENCE_THRESHOLD
 * @property {string} [ambiguityReason] - Set when multiple candidates have similar confidence
 */

// ─── Confidence thresholds ──────────────────────────────────────────────────

/** Confidence at which we execute directly without confirmation */
const HIGH_CONFIDENCE_THRESHOLD = 0.75;

/** Minimum confidence to include a candidate in the result */
const MIN_CONFIDENCE_THRESHOLD = 0.20;

/** Gap below which two top candidates are considered ambiguous */
const AMBIGUITY_GAP_THRESHOLD = 0.15;

// ─── Command intent definitions ─────────────────────────────────────────────

/**
 * Command intent descriptor.
 * keywords: token-weight pairs used to score input text.
 * subcommandHints: subcommand-specific keyword lists.
 * argExtractor: optional function to extract args from the raw text.
 *
 * @type {Array<{
 *   command: string,
 *   keywords: Array<[string, number]>,
 *   subcommandHints: Record<string, Array<[string, number]>>,
 *   argExtractor?: (text: string) => string[],
 * }>}
 */
const COMMAND_INTENTS = [
  {
    command: 'pipeline',
    keywords: [
      ['pipeline', 1.0], ['管道', 0.9], ['流水线', 0.85], ['任务', 0.4],
      ['p ', 0.5], ['/p ', 0.7], ['feature', 0.4], ['运行', 0.3]
    ],
    subcommandHints: {
      run:    [['运行', 0.9], ['启动', 0.9], ['开始', 0.8], ['执行', 0.8], ['跑', 0.8], ['run', 1.0], ['start', 0.8]],
      status: [['状态', 0.9], ['查看', 0.6], ['看看', 0.6], ['查询', 0.8], ['status', 1.0], ['怎么样', 0.5], ['进度', 0.6]],
      logs:   [['日志', 0.95], ['log', 1.0], ['logs', 1.0], ['记录', 0.8], ['输出', 0.6]],
      stop:   [['停止', 0.95], ['停', 0.8], ['stop', 1.0], ['中断', 0.7], ['停掉', 0.9], ['kill', 0.6]],
      'force-unlock': [['解锁', 0.95], ['force-unlock', 1.0], ['unlock', 0.9], ['强制', 0.7]]
    }
  },
  {
    command: 'planner',
    keywords: [
      ['planner', 1.0], ['规划', 0.85], ['计划', 0.7], ['plan', 0.5], ['planner', 1.0]
    ],
    subcommandHints: {
      run:    [['运行', 0.9], ['启动', 0.9], ['执行', 0.8], ['run', 1.0]],
      status: [['状态', 0.9], ['查看', 0.6], ['status', 1.0], ['查询', 0.8]],
      logs:   [['日志', 0.95], ['log', 1.0], ['logs', 1.0], ['记录', 0.8]]
    }
  },
  {
    command: 'bugfix',
    keywords: [
      ['bugfix', 1.0], ['bug', 0.85], ['修复', 0.85], ['fix', 0.75], ['问题', 0.4],
      ['修bug', 0.9], ['修 bug', 0.9], ['b ', 0.4]
    ],
    subcommandHints: {},
    argExtractor: (text) => {
      // Try to extract a target slug like "session-123" or "F-001-xxx"
      const match = text.match(/\b([A-Za-z][\w-]{2,})\b/);
      return match ? [match[1]] : [];
    }
  },
  {
    command: 'ls',
    keywords: [
      ['ls', 1.0], ['列出', 0.85], ['列目录', 0.9], ['查看目录', 0.8], ['目录内容', 0.9],
      ['文件列表', 0.85], ['看目录', 0.7], ['dir', 0.7], ['list', 0.6]
    ],
    subcommandHints: {}
  },
  {
    command: 'find',
    keywords: [
      ['find', 1.0], ['搜索', 0.85], ['查找', 0.85], ['找文件', 0.9], ['文件搜索', 0.9],
      ['search', 0.8], ['查一下', 0.4], ['找一下', 0.5]
    ],
    subcommandHints: {}
  },
  {
    command: 'cat',
    keywords: [
      ['cat', 1.0], ['查看文件', 0.85], ['读取文件', 0.85], ['文件内容', 0.85],
      ['显示文件', 0.8], ['打开文件', 0.7]
    ],
    subcommandHints: {}
  },
  {
    command: 'ps',
    keywords: [
      ['ps', 1.0], ['进程', 0.9], ['process', 0.85], ['进程列表', 0.95],
      ['查看进程', 0.9], ['运行中的进程', 0.9]
    ],
    subcommandHints: {}
  },
  {
    command: 'sysinfo',
    keywords: [
      ['sysinfo', 1.0], ['系统信息', 0.95], ['系统状态', 0.95], ['系统概览', 0.9],
      ['cpu', 0.7], ['内存', 0.65], ['磁盘', 0.5], ['系统', 0.45], ['硬件', 0.6]
    ],
    subcommandHints: {}
  },
  {
    command: 'kill',
    keywords: [
      ['kill', 1.0], ['杀进程', 0.9], ['终止进程', 0.9], ['结束进程', 0.85],
      ['停止进程', 0.75]
    ],
    subcommandHints: {}
  },
  {
    command: 'monitor',
    keywords: [
      ['monitor', 1.0], ['监控', 0.9], ['监听', 0.7], ['实时监控', 0.95], ['持续监控', 0.85]
    ],
    subcommandHints: {}
  },
  {
    command: 'cron',
    keywords: [
      ['cron', 1.0], ['定时', 0.85], ['定时任务', 0.95], ['计划任务', 0.8],
      ['scheduled', 0.75], ['schedule', 0.7]
    ],
    subcommandHints: {}
  },
  {
    command: 'jobs',
    keywords: [
      ['jobs', 1.0], ['任务列表', 0.9], ['所有任务', 0.85], ['后台任务', 0.85],
      ['job', 0.75]
    ],
    subcommandHints: {}
  },
  {
    command: 'commit',
    keywords: [
      ['commit', 1.0], ['提交', 0.85], ['git commit', 0.95], ['代码提交', 0.9]
    ],
    subcommandHints: {}
  },
  {
    command: 'status',
    keywords: [
      ['status', 1.0], ['状态', 0.6], ['查状态', 0.85], ['当前状态', 0.8]
    ],
    subcommandHints: {}
  },
  {
    command: 'logs',
    keywords: [
      ['logs', 1.0], ['日志', 0.7], ['log', 0.85], ['查看日志', 0.9], ['看日志', 0.85]
    ],
    subcommandHints: {}
  },
  {
    command: 'history',
    keywords: [
      ['history', 1.0], ['历史', 0.85], ['命令历史', 0.9], ['历史记录', 0.9]
    ],
    subcommandHints: {}
  },
  {
    command: 'sessions',
    keywords: [
      ['sessions', 1.0], ['会话', 0.85], ['会话列表', 0.95], ['查看会话', 0.9]
    ],
    subcommandHints: {}
  },
  {
    command: 'watch',
    keywords: [
      ['watch', 1.0], ['监视文件', 0.9], ['文件监视', 0.9], ['文件变化', 0.85],
      ['watcher', 0.9]
    ],
    subcommandHints: {}
  },
  {
    command: 'stop',
    keywords: [
      ['stop', 1.0], ['停止', 0.7], ['中断', 0.65], ['停掉', 0.7], ['停下', 0.7]
    ],
    subcommandHints: {}
  }
];

// ─── Scoring helpers ─────────────────────────────────────────────────────────

/**
 * Tokenize text into lower-case terms.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text.toLowerCase().trim();
}

/**
 * Score a single intent against the given text.
 * Returns a value in [0, 1].
 *
 * @param {string} text - normalized input text
 * @param {Array<[string, number]>} keywords
 * @returns {number}
 */
function scoreKeywords(text, keywords) {
  let maxScore = 0;
  for (const [kw, weight] of keywords) {
    if (text.includes(kw.toLowerCase())) {
      if (weight > maxScore) {
        maxScore = weight;
      }
    }
  }
  return maxScore;
}

/**
 * Determine the best subcommand from the subcommand hint map.
 * @param {string} text
 * @param {Record<string, Array<[string, number]>>} subcommandHints
 * @returns {{ subcommand: string | undefined, subScore: number }}
 */
function detectSubcommand(text, subcommandHints) {
  let bestSub = undefined;
  let bestScore = 0;

  for (const [sub, hints] of Object.entries(subcommandHints)) {
    const score = scoreKeywords(text, hints);
    if (score > bestScore) {
      bestScore = score;
      bestSub = sub;
    }
  }

  return { subcommand: bestSub, subScore: bestScore };
}

// ─── Main API ────────────────────────────────────────────────────────────────

/**
 * Route text to candidate commands.
 *
 * @param {string} text - Raw user input (may or may not start with `/`)
 * @param {Object} [options]
 * @param {string} [options.scopeCommand] - If provided, restrict sub-command detection to this command's hints
 * @returns {IntentRouteResult}
 */
export function routeIntent(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      matched: false,
      confidence: 0,
      primary: null,
      candidates: [],
      needsConfirmation: true
    };
  }

  const normalized = normalizeText(text);
  const { scopeCommand } = options;

  /** @type {IntentCandidate[]} */
  const candidates = [];

  for (const intent of COMMAND_INTENTS) {
    // When scoped, only check the specified command
    if (scopeCommand && intent.command !== scopeCommand) {
      continue;
    }

    const commandScore = scopeCommand
      ? 1.0  // Already scoped; full command score
      : scoreKeywords(normalized, intent.keywords);

    if (commandScore < MIN_CONFIDENCE_THRESHOLD && !scopeCommand) {
      continue;
    }

    // Sub-command detection
    const { subcommand, subScore } = detectSubcommand(normalized, intent.subcommandHints);

    // Combine scores: command score contributes 60%, subcommand 40% (when hints exist)
    const hasSubHints = Object.keys(intent.subcommandHints).length > 0;
    let confidence;
    if (scopeCommand) {
      // In scope mode the command is already known; confidence comes from subcommand match
      confidence = hasSubHints ? subScore : 0.5;
    } else {
      confidence = hasSubHints
        ? commandScore * 0.6 + subScore * 0.4
        : commandScore;
    }

    // Trim precision
    confidence = Math.min(1, parseFloat(confidence.toFixed(3)));

    if (confidence < MIN_CONFIDENCE_THRESHOLD) {
      continue;
    }

    // Extract args if extractor is defined
    const args = intent.argExtractor ? intent.argExtractor(text) : undefined;

    const reasonParts = [];
    if (!scopeCommand) reasonParts.push(`命令匹配 (${(commandScore * 100).toFixed(0)}%)`);
    if (subcommand) reasonParts.push(`子命令推断: ${subcommand} (${(subScore * 100).toFixed(0)}%)`);
    const reason = reasonParts.join(', ') || `文本相似度 ${(confidence * 100).toFixed(0)}%`;

    candidates.push({
      command: intent.command,
      ...(subcommand !== undefined && { subcommand }),
      ...(args && args.length > 0 && { args }),
      confidence,
      reason
    });
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Filter to reasonable candidates (don't include very-low-confidence noise)
  const filtered = candidates.filter((c) => c.confidence >= MIN_CONFIDENCE_THRESHOLD);

  if (filtered.length === 0) {
    return {
      matched: false,
      confidence: 0,
      primary: null,
      candidates: [],
      needsConfirmation: true
    };
  }

  const primary = filtered[0];
  const secondary = filtered[1];

  // Ambiguity: two candidates within AMBIGUITY_GAP_THRESHOLD of each other
  const isAmbiguous = secondary !== undefined
    && (primary.confidence - secondary.confidence) <= AMBIGUITY_GAP_THRESHOLD
    && primary.confidence < HIGH_CONFIDENCE_THRESHOLD;

  /** @type {string | undefined} */
  let ambiguityReason;
  if (isAmbiguous) {
    ambiguityReason = `多个可能的操作（${primary.command} / ${secondary.command}），置信度相近`;
  }

  const needsConfirmation = primary.confidence < HIGH_CONFIDENCE_THRESHOLD || isAmbiguous;

  return {
    matched: true,
    confidence: primary.confidence,
    primary,
    candidates: filtered,
    needsConfirmation,
    ...(ambiguityReason !== undefined && { ambiguityReason })
  };
}

/**
 * Enhance an invalid-subcommand scenario using NL routing within a command scope.
 *
 * @param {string} command - The command already identified
 * @param {string} nlText - The remaining natural-language text (after `/command `)
 * @returns {IntentRouteResult}
 */
export function enhanceSlashCommand(command, nlText) {
  return routeIntent(nlText, { scopeCommand: command });
}

/**
 * Build a formatted suggestion message for low-confidence or ambiguous routes.
 *
 * @param {IntentRouteResult} result
 * @returns {string}
 */
export function formatCandidateSuggestions(result) {
  if (!result.matched || result.candidates.length === 0) {
    return '无法识别你的意图，请尝试使用具体命令（如 /pipeline status）或 /help 查看所有命令。';
  }

  const lines = ['我不完全确定你的意图，候选动作如下：', ''];

  const top = result.candidates.slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    const c = top[i];
    const cmd = `/${c.command}${c.subcommand ? ` ${c.subcommand}` : ''}${c.args?.length ? ` ${c.args.join(' ')}` : ''}`;
    lines.push(`${i + 1}. ${cmd}  (置信度: ${(c.confidence * 100).toFixed(0)}%)`);
    lines.push(`   原因: ${c.reason}`);
  }

  lines.push('');
  lines.push('请直接执行上述命令，或输入 /help 查看所有可用命令。');

  return lines.join('\n');
}

export default { routeIntent, enhanceSlashCommand, formatCandidateSuggestions };
