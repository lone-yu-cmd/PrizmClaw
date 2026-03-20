export function assertSystemExecEnabled() {
  // open-by-default mode: exec is always enabled
}

export function assertAllowedCommand(command) {
  const normalized = String(command ?? '').trim();

  if (!normalized) {
    throw new Error('command 不能为空。');
  }

  if (normalized.length > 2000) {
    throw new Error('command 过长。');
  }

  return normalized;
}

// F-009: Blacklist and high-risk detection functions

/**
 * Check if command is blacklisted.
 * @param {string} command - Command to check
 * @param {string[]} blacklist - Array of blacklisted command prefixes
 * @returns {{ blocked: boolean, reason?: string, matchedCommand?: string }}
 */
export function checkCommandBlacklist(command, blacklist) {
  if (!blacklist || blacklist.length === 0) {
    return { blocked: false };
  }

  const normalized = String(command ?? '').trim();

  for (const blockedPrefix of blacklist) {
    if (normalized.startsWith(blockedPrefix)) {
      return {
        blocked: true,
        reason: `命令被列入黑名单: ${blockedPrefix}`,
        matchedCommand: blockedPrefix
      };
    }
  }

  return { blocked: false };
}

/**
 * Detect high-risk keywords in command.
 * @param {string} command - Command to check
 * @param {string[]} keywords - Array of high-risk keywords
 * @returns {{ isHighRisk: boolean, detectedKeywords: string[] }}
 */
export function detectHighRiskKeywords(command, keywords) {
  if (!keywords || keywords.length === 0) {
    return { isHighRisk: false, detectedKeywords: [] };
  }

  const normalized = String(command ?? '').trim();
  const detectedKeywords = [];

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      detectedKeywords.push(keyword);
    }
  }

  return {
    isHighRisk: detectedKeywords.length > 0,
    detectedKeywords
  };
}
