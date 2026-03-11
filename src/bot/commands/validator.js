/**
 * Command Validator
 * Validates command parameters and generates error messages.
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} param - Parameter name
 * @property {string} message - Error message
 * @property {string} [suggestion] - Correction suggestion
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {ValidationError[]} errors - Validation errors
 * @property {Record<string, *>} [normalized] - Normalized parameters
 */

/**
 * @typedef {import('./parser.js').ParsedCommand} ParsedCommand
 * @typedef {import('./registry.js').CommandMeta} CommandMeta
 * @typedef {import('./registry.js').ParamMeta} ParamMeta
 * @typedef {import('./registry.js').SubcommandMeta} SubcommandMeta
 */

/**
 * Validate a parsed command against its metadata.
 * @param {ParsedCommand} parsed - Parsed command
 * @param {CommandMeta} meta - Command metadata
 * @returns {ValidationResult} Validation result
 */
export function validateCommand(parsed, meta) {
  const errors = [];
  const normalized = { ...parsed.options };

  // Validate subcommand if command has subcommands
  if (meta.subcommands?.length) {
    const validSubcommands = meta.subcommands.map((s) => s.name);
    if (parsed.subcommand && !validSubcommands.includes(parsed.subcommand)) {
      errors.push({
        param: 'subcommand',
        message: `未知子命令 '${parsed.subcommand}'`,
        suggestion: `可用子命令: ${validSubcommands.join(', ')}`
      });
    }
  }

  // Get applicable params
  const params = getParamsForSubcommand(meta, parsed.subcommand);

  // Validate parameters
  for (const param of params) {
    const value = getParamValue(parsed, param.name);
    const result = validateParam(param, value);

    if (!result.valid) {
      errors.push(result.error);
    } else if (result.value !== undefined) {
      normalized[param.name] = result.value;
    }
  }

  // Add positional args to normalized
  if (parsed.args.length > 0) {
    normalized._args = parsed.args;
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : undefined
  };
}

/**
 * Get parameters applicable to a subcommand.
 * @param {CommandMeta} meta - Command metadata
 * @param {string|undefined} subcommand - Subcommand name
 * @returns {ParamMeta[]} Parameters
 */
function getParamsForSubcommand(meta, subcommand) {
  const params = [...(meta.params || [])];

  // Add subcommand-specific params
  if (subcommand && meta.subcommands) {
    const subMeta = meta.subcommands.find((s) => s.name === subcommand);
    if (subMeta?.params) {
      params.push(...subMeta.params);
    }
  }

  return params;
}

/**
 * Get parameter value from parsed command.
 * @param {ParsedCommand} parsed - Parsed command
 * @param {string} paramName - Parameter name
 * @returns {string|undefined} Parameter value
 */
function getParamValue(parsed, paramName) {
  // Check options first
  if (parsed.options[paramName] !== undefined) {
    return parsed.options[paramName];
  }

  // Check positional args (first arg maps to first positional param)
  const positionalIndex = 0; // Simplified: first positional param
  if (parsed.args[positionalIndex] !== undefined) {
    // We need a smarter mapping - for now, use named params
  }

  return undefined;
}

/**
 * Validate a single parameter.
 * @param {ParamMeta} param - Parameter metadata
 * @param {string|undefined} value - Parameter value
 * @returns {{valid: boolean, error?: ValidationError, value?: *}}
 */
function validateParam(param, value) {
  // Check required
  if (param.required && (value === undefined || value === '')) {
    return {
      valid: false,
      error: {
        param: param.name,
        message: `缺少参数 '${param.name}'`,
        suggestion: `请提供 ${param.name} 参数`
      }
    };
  }

  // If not provided and has default, use default
  if (value === undefined && param.default !== undefined) {
    return { valid: true, value: param.default };
  }

  // If not provided and not required, OK
  if (value === undefined) {
    return { valid: true };
  }

  // Type validation
  if (param.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return {
        valid: false,
        error: {
          param: param.name,
          message: `参数 '${param.name}' 必须是数字`,
          suggestion: `请输入有效的数字`
        }
      };
    }
    return { valid: true, value: num };
  }

  // Enum validation
  if (param.type === 'enum' && param.enum?.length) {
    if (!param.enum.includes(value)) {
      return {
        valid: false,
        error: {
          param: param.name,
          message: `参数 '${param.name}' 值无效: ${value}`,
          suggestion: `可选值: ${param.enum.join(', ')}`
        }
      };
    }
  }

  return { valid: true, value };
}

/**
 * Validate that a subcommand is valid for a command.
 * @param {string} subcommand - Subcommand name
 * @param {SubcommandMeta[]} subcommands - Available subcommands
 * @returns {{valid: boolean, error?: ValidationError}}
 */
export function validateSubcommand(subcommand, subcommands) {
  if (!subcommand) {
    return { valid: true };
  }

  const validNames = (subcommands || []).map((s) => s.name);
  if (validNames.length === 0) {
    return { valid: true };
  }

  if (!validNames.includes(subcommand)) {
    return {
      valid: false,
      error: {
        param: 'subcommand',
        message: `未知子命令 '${subcommand}'`,
        suggestion: `可用子命令: ${validNames.join(', ')}`
      }
    };
  }

  return { valid: true };
}
