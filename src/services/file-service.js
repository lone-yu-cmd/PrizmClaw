/**
 * File Service Module
 * F-010: File Manager
 *
 * Provides core file operations: path validation, directory listing, tree building,
 * file reading, file search, and file writing.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { config } from '../config.js';
import { sessionStore } from './session-store.js';
import { formatFileSize, formatDate, formatFileInfo, isBinaryContent, getFileExtension, isImageExtension } from '../utils/file-utils.js';

const require = createRequire(import.meta.url);

/**
 * Resolve a path relative to session cwd, handling ~ and relative paths
 * @param {string} inputPath - User-provided path
 * @param {string} sessionId - Session identifier for cwd resolution
 * @returns {string} Resolved absolute path
 */
export function resolveSessionPath(inputPath, sessionId) {
  if (!inputPath || typeof inputPath !== 'string') {
    return null;
  }

  let resolvedPath = inputPath.trim();

  // Handle home directory expansion (~)
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME || '', resolvedPath.slice(1));
  }

  // If not absolute, resolve relative to session cwd
  if (!path.isAbsolute(resolvedPath)) {
    const cwd = sessionStore.getCwd(sessionId) || process.cwd();
    resolvedPath = path.resolve(cwd, resolvedPath);
  }

  // Normalize the path (remove . and resolve .. if any)
  resolvedPath = path.normalize(resolvedPath);

  return resolvedPath;
}

/**
 * Validate path against allowed roots
 * @param {string} inputPath - User-provided path
 * @param {string} sessionId - Session for cwd resolution
 * @returns {Promise<{ok: boolean, resolved?: string, error?: string}>}
 */
export async function validatePath(inputPath, sessionId) {
  // Resolve the path
  const resolved = resolveSessionPath(inputPath, sessionId);
  if (!resolved) {
    return { ok: false, error: '路径不能为空' };
  }

  // Check for path traversal attempts
  if (resolved.includes('..')) {
    return { ok: false, error: '路径不允许包含 ..' };
  }

  // Check against allowed roots
  const allowedRoots = config.telegramFileAllowedRoots;
  if (allowedRoots && allowedRoots.length > 0) {
    const isWithinRoot = allowedRoots.some((root) => {
      const resolvedRoot = path.resolve(root);
      const relative = path.relative(resolvedRoot, resolved);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });

    if (!isWithinRoot) {
      return { ok: false, error: `路径不在允许范围内：${resolved}` };
    }
  }

  // Check if path exists and resolve symlinks
  try {
    const realPath = await fs.realpath(resolved);

    // Re-validate the real path against allowed roots (symlink check)
    if (allowedRoots && allowedRoots.length > 0) {
      const isWithinRoot = allowedRoots.some((root) => {
        const resolvedRoot = path.resolve(root);
        const relative = path.relative(resolvedRoot, realPath);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
      });

      if (!isWithinRoot) {
        return { ok: false, error: `符号链接目标不在允许范围内：${realPath}` };
      }
    }

    return { ok: true, resolved: realPath };
  } catch (err) {
    // Path doesn't exist yet - still return the resolved path for write operations
    if (err.code === 'ENOENT') {
      return { ok: true, resolved };
    }
    return { ok: false, error: `无法访问路径：${err.message}` };
  }
}

/**
 * List directory contents
 * @param {string|null} dirPath - Directory to list (uses session cwd if null)
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{path: string, items: Object[], totalCount: number, error?: string}>}
 */
export async function listDirectory(dirPath, sessionId) {
  // Resolve the path
  const targetPath = dirPath
    ? resolveSessionPath(dirPath, sessionId)
    : sessionStore.getCwd(sessionId) || process.cwd();

  if (!targetPath) {
    return { path: '', items: [], totalCount: 0, error: '路径不能为空' };
  }

  // Validate the path
  const validation = await validatePath(targetPath, sessionId);
  if (!validation.ok) {
    return { path: targetPath, items: [], totalCount: 0, error: validation.error };
  }

  try {
    const entries = await fs.readdir(validation.resolved, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(validation.resolved, entry.name);
        let size = 0;
        let modifiedTime = null;

        try {
          if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            size = stats.size;
            modifiedTime = stats.mtime;
          } else if (entry.isDirectory()) {
            const stats = await fs.stat(fullPath);
            modifiedTime = stats.mtime;
          }
        } catch {
          // Ignore stat errors
        }

        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size,
          modifiedTime
        };
      })
    );

    // Sort: directories first, then by name
    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      path: validation.resolved,
      items,
      totalCount: items.length
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { path: targetPath, items: [], totalCount: 0, error: `目录不存在：${targetPath}` };
    }
    if (err.code === 'EACCES') {
      return { path: targetPath, items: [], totalCount: 0, error: `无权限访问：${targetPath}` };
    }
    if (err.code === 'ENOTDIR') {
      return { path: targetPath, items: [], totalCount: 0, error: `不是目录：${targetPath}` };
    }
    return { path: targetPath, items: [], totalCount: 0, error: `无法读取目录：${err.message}` };
  }
}

/**
 * Build directory tree representation
 * @param {string|null} dirPath - Root directory for tree
 * @param {Object} options - Tree building options
 * @param {number} [options.maxDepth=3] - Maximum depth
 * @param {number} [options.maxItems=100] - Maximum items to include
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{path: string, tree: string, depth: number, itemCount: number, truncated: boolean, error?: string}>}
 */
export async function buildTree(dirPath, options, sessionId) {
  const { maxDepth = config.fileMaxTreeDepth || 3, maxItems = config.fileMaxTreeItems || 100 } = options || {};

  // Resolve the path
  const targetPath = dirPath
    ? resolveSessionPath(dirPath, sessionId)
    : sessionStore.getCwd(sessionId) || process.cwd();

  if (!targetPath) {
    return { path: '', tree: '', depth: 0, itemCount: 0, truncated: false, error: '路径不能为空' };
  }

  // Validate the path
  const validation = await validatePath(targetPath, sessionId);
  if (!validation.ok) {
    return { path: targetPath, tree: '', depth: 0, itemCount: 0, truncated: false, error: validation.error };
  }

  const state = { count: 0, truncated: false };

  /**
   * Recursively build tree
   * @param {string} currentPath - Current directory path
   * @param {number} currentDepth - Current depth
   * @param {string} prefix - Line prefix
   * @param {boolean} isLast - Whether this is the last item in parent
   * @returns {Promise<string>}
   */
  async function buildTreeRecursive(currentPath, currentDepth, prefix = '', isLast = true) {
    if (currentDepth > maxDepth || state.count >= maxItems) {
      state.truncated = true;
      return '';
    }

    let output = '';

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      // Sort entries: directories first, then by name
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      for (let i = 0; i < entries.length; i++) {
        if (state.count >= maxItems) {
          state.truncated = true;
          break;
        }

        const entry = entries[i];
        const isEntryLast = i === entries.length - 1;
        const connector = isEntryLast ? '└── ' : '├── ';
        const icon = entry.isDirectory() ? '📁 ' : '📄 ';

        output += `${prefix}${connector}${icon}${entry.name}\n`;
        state.count++;

        if (entry.isDirectory() && currentDepth < maxDepth) {
          const newPrefix = prefix + (isEntryLast ? '    ' : '│   ');
          output += await buildTreeRecursive(
            path.join(currentPath, entry.name),
            currentDepth + 1,
            newPrefix,
            isEntryLast
          );
        }
      }
    } catch (err) {
      output += `${prefix}└── ⚠️ ${err.message}\n`;
    }

    return output;
  }

  try {
    // Check if it's a directory
    const stats = await fs.stat(validation.resolved);
    if (!stats.isDirectory()) {
      return {
        path: validation.resolved,
        tree: '',
        depth: 0,
        itemCount: 0,
        truncated: false,
        error: `不是目录：${validation.resolved}`
      };
    }

    // Start building tree
    const rootName = path.basename(validation.resolved) || validation.resolved;
    let treeOutput = `📁 ${rootName}\n`;
    state.count = 1;

    treeOutput += await buildTreeRecursive(validation.resolved, 1);

    return {
      path: validation.resolved,
      tree: treeOutput,
      depth: maxDepth,
      itemCount: state.count,
      truncated: state.truncated
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { path: targetPath, tree: '', depth: 0, itemCount: 0, truncated: false, error: `目录不存在：${targetPath}` };
    }
    return { path: targetPath, tree: '', depth: 0, itemCount: 0, truncated: false, error: `无法构建目录树：${err.message}` };
  }
}

/**
 * Read file content with options
 * @param {string} filePath - File to read
 * @param {Object} options - Read options
 * @param {number} [options.headLines] - Number of lines from head
 * @param {number} [options.tailLines] - Number of lines from tail
 * @param {number} [options.maxSize] - Maximum file size to read
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{path: string, content: string, size: number, isBinary: boolean, truncated: boolean, lineCount?: number, error?: string}>}
 */
export async function readFile(filePath, options, sessionId) {
  const { headLines, tailLines, maxSize = config.fileMaxReadSize || 1048576 } = options || {};

  // Resolve and validate path
  const validation = await validatePath(filePath, sessionId);
  if (!validation.ok) {
    return { path: filePath || '', content: '', size: 0, isBinary: false, truncated: false, error: validation.error };
  }

  try {
    const stats = await fs.stat(validation.resolved);

    // Check if it's a file
    if (stats.isDirectory()) {
      return {
        path: validation.resolved,
        content: '',
        size: 0,
        isBinary: false,
        truncated: false,
        error: `是目录，不是文件：${validation.resolved}`
      };
    }

    // Check file size
    if (stats.size > maxSize) {
      return {
        path: validation.resolved,
        content: '',
        size: stats.size,
        isBinary: false,
        truncated: true,
        error: `文件过大 (${formatFileSize(stats.size)})，超过限制 (${formatFileSize(maxSize)})`
      };
    }

    // Read the file
    const buffer = await fs.readFile(validation.resolved);

    // Check for binary content
    const isBinary = isBinaryContent(buffer);
    if (isBinary) {
      return {
        path: validation.resolved,
        content: '',
        size: stats.size,
        isBinary: true,
        truncated: false,
        error: '二进制文件，无法显示内容'
      };
    }

    // Convert to string
    let content = buffer.toString('utf-8');
    const lines = content.split('\n');
    const lineCount = lines.length;

    // Handle head/tail options
    if (headLines !== undefined && headLines > 0) {
      content = lines.slice(0, headLines).join('\n');
    } else if (tailLines !== undefined && tailLines > 0) {
      content = lines.slice(-tailLines).join('\n');
    }

    return {
      path: validation.resolved,
      content,
      size: stats.size,
      isBinary: false,
      truncated: false,
      lineCount
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { path: validation.resolved, content: '', size: 0, isBinary: false, truncated: false, error: `文件不存在：${validation.resolved}` };
    }
    if (err.code === 'EACCES') {
      return { path: validation.resolved, content: '', size: 0, isBinary: false, truncated: false, error: `无权限访问：${validation.resolved}` };
    }
    return { path: validation.resolved, content: '', size: 0, isBinary: false, truncated: false, error: `无法读取文件：${err.message}` };
  }
}

/**
 * Search files by glob pattern
 * @param {string} pattern - Glob pattern to match
 * @param {Object} options - Search options
 * @param {number} [options.maxDepth=10] - Maximum search depth
 * @param {number} [options.maxResults=100] - Maximum results
 * @param {string} [options.cwd] - Search starting point (uses session cwd if not specified)
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{pattern: string, results: Object[], totalCount: number, truncated: boolean, error?: string}>}
 */
export async function searchFiles(pattern, options, sessionId) {
  const {
    maxDepth = config.fileMaxSearchDepth || 10,
    maxResults = config.fileMaxSearchResults || 100,
    cwd
  } = options || {};

  if (!pattern || typeof pattern !== 'string') {
    return { pattern: '', results: [], totalCount: 0, truncated: false, error: '搜索模式不能为空' };
  }

  // Resolve search starting point
  const searchCwd = cwd
    ? resolveSessionPath(cwd, sessionId)
    : sessionStore.getCwd(sessionId) || process.cwd();

  // Validate the search directory
  const validation = await validatePath(searchCwd, sessionId);
  if (!validation.ok) {
    return { pattern, results: [], totalCount: 0, truncated: false, error: validation.error };
  }

  try {
    // Simple glob implementation using fs.readdir recursively
    const results = [];
    const truncated = false;
    const regex = globToRegex(pattern);

    /**
     * Recursively search
     * @param {string} currentPath - Current directory
     * @param {number} currentDepth - Current depth
     */
    async function searchRecursive(currentPath, currentDepth) {
      if (currentDepth > maxDepth || results.length >= maxResults) {
        return;
      }

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) {
            return;
          }

          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(validation.resolved, fullPath);

          // Check if name matches pattern
          if (regex.test(entry.name) || regex.test(relativePath)) {
            let size = 0;
            let modifiedTime = null;

            try {
              const stats = await fs.stat(fullPath);
              size = stats.size;
              modifiedTime = stats.mtime;
            } catch {
              // Ignore stat errors
            }

            results.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              isDirectory: entry.isDirectory(),
              size,
              modifiedTime
            });
          }

          // Recurse into directories
          if (entry.isDirectory()) {
            await searchRecursive(fullPath, currentDepth + 1);
          }
        }
      } catch {
        // Ignore errors in subdirectories
      }
    }

    await searchRecursive(validation.resolved, 0);

    return {
      pattern,
      results,
      totalCount: results.length,
      truncated: results.length >= maxResults
    };
  } catch (err) {
    return { pattern, results: [], totalCount: 0, truncated: false, error: `搜索失败：${err.message}` };
  }
}

/**
 * Convert glob pattern to regex
 * Supports: *, **, ?, [...]
 * @param {string} pattern - Glob pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  // Escape special regex characters except glob characters
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLESTAR}}/g, '.*')
    .replace(/\?/g, '[^/]');

  // Handle character classes [...]
  regex = regex.replace(/\[([^\]]*)\]/g, '[$1]');

  return new RegExp(`^${regex}$`, 'i');
}

/**
 * Write file to disk
 * @param {string} filePath - Target file path
 * @param {Buffer|ReadableStream} content - File content
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{path: string, size: number, overwritten: boolean, error?: string}>}
 */
export async function writeFile(filePath, content, sessionId) {
  // Resolve and validate path
  const validation = await validatePath(filePath, sessionId);
  if (!validation.ok) {
    return { path: filePath || '', size: 0, overwritten: false, error: validation.error };
  }

  try {
    // Check if file already exists
    let overwritten = false;
    try {
      await fs.access(validation.resolved);
      overwritten = true;
    } catch {
      // File doesn't exist
    }

    // Create parent directories if needed
    const parentDir = path.dirname(validation.resolved);
    await fs.mkdir(parentDir, { recursive: true });

    // Write the file
    let buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else if (content && typeof content === 'object' && typeof content[Symbol.asyncIterator] === 'function') {
      // Handle async iterable (stream)
      const chunks = [];
      for await (const chunk of content) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    } else {
      return { path: validation.resolved, size: 0, overwritten: false, error: '无效的内容类型' };
    }

    await fs.writeFile(validation.resolved, buffer);

    return {
      path: validation.resolved,
      size: buffer.length,
      overwritten
    };
  } catch (err) {
    if (err.code === 'EACCES') {
      return { path: validation.resolved, size: 0, overwritten: false, error: `无权限写入：${validation.resolved}` };
    }
    return { path: validation.resolved, size: 0, overwritten: false, error: `无法写入文件：${err.message}` };
  }
}

/**
 * Check if file is binary (non-text)
 * @param {string} filePath - File to check
 * @returns {Promise<boolean>}
 */
export async function isBinaryFile(filePath) {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, 8192, 0);
    await handle.close();
    return isBinaryContent(buffer.slice(0, bytesRead));
  } catch {
    return false;
  }
}

/**
 * Check if file exists at the given path
 * @param {string} filePath - Path to check
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{ok: boolean, exists: boolean, resolved?: string, error?: string}>}
 */
export async function fileExists(filePath, sessionId) {
  const validation = await validatePath(filePath, sessionId);
  if (!validation.ok) {
    return { ok: false, exists: false, error: validation.error };
  }

  try {
    await fs.access(validation.resolved);
    return { ok: true, exists: true, resolved: validation.resolved };
  } catch {
    return { ok: true, exists: false, resolved: validation.resolved };
  }
}

// Re-export utilities for convenience
export { formatFileSize, formatDate, formatFileInfo, isBinaryContent, getFileExtension, isImageExtension };

export default {
  validatePath,
  resolveSessionPath,
  listDirectory,
  buildTree,
  readFile,
  searchFiles,
  writeFile,
  isBinaryFile,
  fileExists,
  formatFileSize,
  formatDate,
  formatFileInfo,
  isBinaryContent,
  getFileExtension,
  isImageExtension
};
