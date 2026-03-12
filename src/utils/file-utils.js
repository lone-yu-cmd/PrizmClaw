/**
 * File utilities for F-010 File Manager
 */

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size (e.g., "1.2 KB", "3.4 MB")
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(k, index);

  // Show decimal only if not bytes and size < 10
  if (index === 0) {
    return `${bytes} B`;
  }
  return size < 10 ? `${size.toFixed(1)} ${units[index]}` : `${Math.round(size)} ${units[index]}`;
}

/**
 * Format date for display in file listings
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) {
    return '-';
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return '-';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Format based on recency
  if (diffDays === 0) {
    // Today: show time
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    // Within a week: show day and time
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else if (d.getFullYear() === now.getFullYear()) {
    // This year: show month and day
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } else {
    // Older: show year, month, day
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Format file info for display in listings
 * @param {Object} info - File info object
 * @param {string} info.name - File name
 * @param {boolean} info.isDirectory - Whether it's a directory
 * @param {number} info.size - File size in bytes
 * @param {Date} info.modifiedTime - Last modified time
 * @returns {string} Formatted string for display
 */
export function formatFileInfo(info) {
  if (!info || !info.name || typeof info.isDirectory !== 'boolean') {
    return '';
  }

  const icon = info.isDirectory ? '📁' : '📄';
  const size = info.isDirectory ? '' : ` ${formatFileSize(info.size)}`;
  const modified = info.modifiedTime ? ` ${formatDate(info.modifiedTime)}` : '';

  return `${icon} ${info.name}${size}${modified}`;
}

/**
 * Detect if content is binary (non-text)
 * @param {Buffer} buffer - Content buffer to check
 * @param {number} sampleSize - Number of bytes to check (default 8192)
 * @returns {boolean} True if content appears to be binary
 */
export function isBinaryContent(buffer, sampleSize = 8192) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  const checkLength = Math.min(buffer.length, sampleSize);

  // Check for null bytes (common indicator of binary content)
  // Only check within the specified sample size
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename to extract extension from
 * @returns {string} Lowercase extension without dot, or empty string
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Check if file extension is a known image type
 * @param {string} extension - File extension (without dot)
 * @returns {boolean} True if it's an image extension
 */
export function isImageExtension(extension) {
  const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']);
  return imageExtensions.has(extension.toLowerCase());
}
