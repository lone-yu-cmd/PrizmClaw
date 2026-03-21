/**
 * Runtime Config Service
 * F-017: Runtime Config Manager
 *
 * Provides runtime configuration management with hot-reload capability.
 * Supports viewing, modifying, and resetting configuration values.
 */

// No direct import from config.js to avoid circular dependency

/**
 * Whitelist of safe-to-modify configuration keys
 * These are configs that can be safely changed at runtime without security risks
 */
const SAFE_CONFIG_KEYS = [
  'LOG_LEVEL',
  'REQUEST_TIMEOUT_MS',
  'AI_CLI_HEARTBEAT_MS',
  'MAX_PROMPT_CHARS',
  'MAX_HISTORY_TURNS',
  'SYSTEM_MONITOR_INTERVAL_MS',
  'SESSION_TIMEOUT_MS',
  'TASK_DEBOUNCE_MS'
];

/**
 * Sensitive configuration keys that should be masked in display
 */
const SENSITIVE_CONFIG_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'CODEBUDDY_BIN',
  'WEB_HOST',
  'WEB_PORT'
];

/**
 * Runtime configuration store
 * Tracks current values and original .env values for reset functionality
 */
let runtimeConfig = new Map();
let originalEnvValues = new Map();

/**
 * Initialize runtime config service
 * Loads current values from config and stores original .env values
 */
function initialize() {
  // Store original environment values for reset functionality
  for (const [key, value] of Object.entries(process.env)) {
    originalEnvValues.set(key, value);
  }

  // Initialize runtime config with current values
  for (const key of SAFE_CONFIG_KEYS) {
    if (process.env[key] !== undefined) {
      runtimeConfig.set(key, process.env[key]);
    }
  }
}

/**
 * Get all configuration values with sensitive fields masked
 * @returns {Promise<Object>} Object containing all config values
 */
export async function getAllConfig() {
  const allConfig = {};

  // Get all environment variables that match our schema
  for (const [key, value] of Object.entries(process.env)) {
    // Mask sensitive fields
    if (SENSITIVE_CONFIG_KEYS.includes(key)) {
      allConfig[key] = '***';
    } else {
      allConfig[key] = value;
    }
  }

  return allConfig;
}

/**
 * Get specific configuration value
 * @param {string} key - Configuration key
 * @returns {Promise<string|null>} Config value or null if not found
 */
export async function getConfig(key) {
  if (!key || typeof key !== 'string') {
    return null;
  }

  const normalizedKey = key.toUpperCase();

  // Check if key exists in environment
  if (process.env[normalizedKey] === undefined) {
    return null;
  }

  // Mask sensitive fields
  if (SENSITIVE_CONFIG_KEYS.includes(normalizedKey)) {
    return '***';
  }

  // Return current value (runtime value if set, otherwise env value)
  return runtimeConfig.get(normalizedKey) || process.env[normalizedKey];
}

/**
 * Set configuration value at runtime
 * @param {string} key - Configuration key
 * @param {string} value - New value
 * @returns {Promise<{success: boolean, newValue?: any, error?: string, auditLog?: string}>}
 */
export async function setConfig(key, value) {
  if (!key || typeof key !== 'string') {
    return {
      success: false,
      error: '配置项不能为空'
    };
  }

  const normalizedKey = key.toUpperCase();

  // Check if key exists in environment first
  if (process.env[normalizedKey] === undefined) {
    return {
      success: false,
      error: `未知的配置项 '${normalizedKey}'`
    };
  }

  // Then check if key is safe to modify
  if (!SAFE_CONFIG_KEYS.includes(normalizedKey)) {
    return {
      success: false,
      error: `配置项 '${normalizedKey}' 不允许修改`
    };
  }

  try {
    // Validate value against schema
    const validationResult = await validateConfigValue(normalizedKey, value);
    if (!validationResult.valid) {
      return {
        success: false,
        error: `配置值验证失败: ${validationResult.error}`
      };
    }

    // Store the new value
    runtimeConfig.set(normalizedKey, validationResult.normalizedValue);

    // Update process.env for immediate effect
    process.env[normalizedKey] = validationResult.normalizedValue;

    // Create audit log entry
    const auditLog = `配置修改: ${normalizedKey}=${validationResult.normalizedValue} (原值: ${originalEnvValues.get(normalizedKey)})`;

    return {
      success: true,
      newValue: validationResult.normalizedValue,
      auditLog
    };

  } catch (error) {
    return {
      success: false,
      error: `配置修改失败: ${error.message}`
    };
  }
}

/**
 * Reset configuration to original .env value
 * @param {string} key - Configuration key
 * @returns {Promise<{success: boolean, newValue?: any, error?: string, auditLog?: string}>}
 */
export async function resetConfig(key) {
  if (!key || typeof key !== 'string') {
    return {
      success: false,
      error: '配置项不能为空'
    };
  }

  const normalizedKey = key.toUpperCase();

  // Check if key exists in environment first
  if (process.env[normalizedKey] === undefined) {
    return {
      success: false,
      error: `未知的配置项 '${normalizedKey}'`
    };
  }

  // Then check if key is safe to modify
  if (!SAFE_CONFIG_KEYS.includes(normalizedKey)) {
    return {
      success: false,
      error: `配置项 '${normalizedKey}' 不允许修改`
    };
  }

  try {
    const originalValue = originalEnvValues.get(normalizedKey);

    if (originalValue === undefined) {
      return {
        success: false,
        error: `无法找到配置项 '${normalizedKey}' 的原始值`
      };
    }

    // Reset to original value
    runtimeConfig.delete(normalizedKey);
    process.env[normalizedKey] = originalValue;

    // Create audit log entry
    const auditLog = `配置重置: ${normalizedKey}=${originalValue}`;

    return {
      success: true,
      newValue: originalValue,
      auditLog
    };

  } catch (error) {
    return {
      success: false,
      error: `配置重置失败: ${error.message}`
    };
  }
}

/**
 * Check if a config key is safe to modify at runtime
 * @param {string} key - Configuration key
 * @returns {Promise<boolean>} True if safe to modify
 */
export async function isSafeConfigKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const normalizedKey = key.toUpperCase();
  return SAFE_CONFIG_KEYS.includes(normalizedKey);
}

/**
 * Validate configuration value against schema
 * @param {string} key - Configuration key
 * @param {string} value - Value to validate
 * @returns {Promise<{valid: boolean, normalizedValue?: any, error?: string}>}
 */
async function validateConfigValue(key, value) {
  try {
    // Basic type validation based on key patterns
    let normalizedValue = value;

    // Handle numeric values
    if (key.endsWith('_MS') || key.endsWith('_SIZE') || key.includes('TIMEOUT') || key.includes('INTERVAL')) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        return {
          valid: false,
          error: `配置项 '${key}' 需要有效的数字值`
        };
      }
      normalizedValue = numValue; // Return as number, not string
    }

    // Handle boolean values
    if (key.startsWith('ENABLE_') || key.startsWith('ALLOW_') || key.includes('_ENABLE')) {
      const boolValue = value.toLowerCase();
      if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(boolValue)) {
        return {
          valid: false,
          error: `配置项 '${key}' 需要布尔值 (true/false)`
        };
      }
      normalizedValue = boolValue;
    }

    // Handle enum values
    if (key === 'LOG_LEVEL') {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
      if (!validLevels.includes(value.toLowerCase())) {
        return {
          valid: false,
          error: `LOG_LEVEL 必须是: ${validLevels.join(', ')}`
        };
      }
      normalizedValue = value.toLowerCase();
    }

    return {
      valid: true,
      normalizedValue
    };

  } catch (error) {
    return {
      valid: false,
      error: `配置值验证失败: ${error.message}`
    };
  }
}

/**
 * Get list of safe-to-modify config keys
 * @returns {Promise<string[]>} Array of safe config keys
 */
export async function getSafeConfigKeys() {
  return [...SAFE_CONFIG_KEYS];
}

/**
 * Get list of sensitive config keys
 * @returns {Promise<string[]>} Array of sensitive config keys
 */
export async function getSensitiveConfigKeys() {
  return [...SENSITIVE_CONFIG_KEYS];
}

// Initialize the service
initialize();

export const configService = {
  getAllConfig,
  getConfig,
  setConfig,
  resetConfig,
  isSafeConfigKey,
  getSafeConfigKeys,
  getSensitiveConfigKeys
};

export default configService;