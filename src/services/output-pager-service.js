/**
 * Output Pager Service
 * F-009: General Command Executor
 *
 * Handles pagination of long command output for Telegram's 4096 character limit.
 */

import { sessionStore } from './session-store.js';

/**
 * Default chunk size for Telegram messages (leaving room for formatting)
 */
const DEFAULT_CHUNK_SIZE = 4000;

/**
 * Paginate output text into chunks.
 * @param {string} text - Text to paginate
 * @param {number} [chunkSize=4000] - Size of each chunk
 * @returns {string[]} Array of text chunks
 */
export function paginateOutput(text, chunkSize = DEFAULT_CHUNK_SIZE) {
  const normalized = String(text ?? '');

  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const pages = [];
  for (let i = 0; i < normalized.length; i += chunkSize) {
    pages.push(normalized.slice(i, i + chunkSize));
  }

  return pages;
}

/**
 * Store output pages in session for later retrieval via /more.
 * @param {string} sessionId - Session identifier
 * @param {string[]} pages - Array of text pages
 */
export function storeOutputPages(sessionId, pages) {
  // Store a copy of the array to avoid mutation issues
  sessionStore.setOutputPages(sessionId, [...pages]);
}

/**
 * Get the next page of output.
 * Removes and returns the first page from the stored pages.
 * @param {string} sessionId - Session identifier
 * @returns {string|null} Next page of output, or null if no pages left
 */
export function getNextPage(sessionId) {
  const pages = sessionStore.getOutputPages(sessionId);

  if (!pages || pages.length === 0) {
    return null;
  }

  const nextPage = pages.shift();
  return nextPage;
}

/**
 * Clear stored output pages for a session.
 * @param {string} sessionId - Session identifier
 */
export function clearPages(sessionId) {
  sessionStore.clearOutputPages(sessionId);
}

/**
 * Check if there are more pages available.
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if more pages exist
 */
export function hasMorePages(sessionId) {
  const pages = sessionStore.getOutputPages(sessionId);
  return pages !== null && pages.length > 0;
}

export default {
  paginateOutput,
  storeOutputPages,
  getNextPage,
  clearPages,
  hasMorePages
};
