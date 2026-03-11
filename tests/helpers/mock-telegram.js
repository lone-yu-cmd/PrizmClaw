/**
 * Mock Telegram Context Helper
 * F-007: Test and Validation Suite
 *
 * Simulates Telegraf bot context for command handler tests.
 */

/**
 * @typedef {Object} MockContext
 * @property {Object} message - The message object
 * @property {Object} chat - The chat object
 * @property {Object} from - The user object
 * @property {Function} reply - Mock reply function
 * @property {Function} replyWithDocument - Mock replyWithDocument function
 * @property {Object} state - State object for middleware data
 */

/**
 * Create a mock Telegram context
 * @param {Object} overrides - Override properties
 * @returns {MockContext} Mock context object
 */
export function createMockContext(overrides = {}) {
  const replies = [];
  const documents = [];

  const defaultContext = {
    message: {
      text: null,
      document: null,
      from: {
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      chat: {
        id: 123456789,
        type: 'private'
      },
      date: Math.floor(Date.now() / 1000),
      message_id: 1
    },
    chat: {
      id: 123456789,
      type: 'private'
    },
    from: {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser'
    },
    state: {},
    reply: async (text, options = {}) => {
      replies.push({ text, options, timestamp: Date.now() });
      return { message_id: replies.length };
    },
    replyWithDocument: async (document, options = {}) => {
      documents.push({ document, options, timestamp: Date.now() });
      return { message_id: documents.length };
    },
    deleteMessage: async () => true,
    editMessageText: async (text, options = {}) => {
      replies.push({ text, options, edited: true, timestamp: Date.now() });
      return true;
    }
  };

  const context = {
    ...defaultContext,
    ...overrides,
    message: {
      ...defaultContext.message,
      ...(overrides.message || {}),
      from: {
        ...defaultContext.message.from,
        ...(overrides.message?.from || {})
      },
      chat: {
        ...defaultContext.message.chat,
        ...(overrides.message?.chat || {})
      }
    },
    chat: {
      ...defaultContext.chat,
      ...(overrides.chat || {})
    },
    from: {
      ...defaultContext.from,
      ...(overrides.from || {})
    },
    state: overrides.state || {}
  };

  // Attach helper methods
  context._getReplies = () => [...replies];
  context._getLastReply = () => replies[replies.length - 1] || null;
  context._getDocuments = () => [...documents];
  context._getLastDocument = () => documents[documents.length - 1] || null;
  context._clearReplies = () => {
    replies.length = 0;
    documents.length = 0;
  };

  return context;
}

/**
 * Create a mock context with admin user
 * @param {Object} overrides - Override properties
 * @returns {MockContext}
 */
export function createAdminContext(overrides = {}) {
  return createMockContext({
    from: {
      id: 999999999,
      username: 'admin_user',
      first_name: 'Admin'
    },
    message: {
      from: {
        id: 999999999,
        username: 'admin_user',
        first_name: 'Admin'
      }
    },
    state: {
      permission: 'admin'
    },
    ...overrides
  });
}

/**
 * Create a mock context with operator user
 * @param {Object} overrides - Override properties
 * @returns {MockContext}
 */
export function createOperatorContext(overrides = {}) {
  return createMockContext({
    from: {
      id: 888888888,
      username: 'operator_user',
      first_name: 'Operator'
    },
    message: {
      from: {
        id: 888888888,
        username: 'operator_user',
        first_name: 'Operator'
      }
    },
    state: {
      permission: 'operator'
    },
    ...overrides
  });
}

/**
 * Create a mock context with viewer user
 * @param {Object} overrides - Override properties
 * @returns {MockContext}
 */
export function createViewerContext(overrides = {}) {
  return createMockContext({
    from: {
      id: 777777777,
      username: 'viewer_user',
      first_name: 'Viewer'
    },
    message: {
      from: {
        id: 777777777,
        username: 'viewer_user',
        first_name: 'Viewer'
      }
    },
    state: {
      permission: 'viewer'
    },
    ...overrides
  });
}

/**
 * Create a mock context with document upload
 * @param {Object} documentInfo - Document information
 * @param {Object} overrides - Override properties
 * @returns {MockContext}
 */
export function createDocumentContext(documentInfo = {}, overrides = {}) {
  const defaultDocument = {
    file_id: 'test-file-id-123',
    file_unique_id: 'test-unique-id-123',
    file_name: 'test-plan.json',
    mime_type: 'application/json',
    file_size: 1024
  };

  return createMockContext({
    message: {
      document: {
        ...defaultDocument,
        ...documentInfo
      },
      caption: overrides.caption || '',
      from: overrides.message?.from || {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test'
      }
    },
    ...overrides
  });
}

/**
 * Create a mock context with command text
 * @param {string} commandText - The command text (e.g., "/pipeline run --type=feature")
 * @param {Object} overrides - Override properties
 * @returns {MockContext}
 */
export function createCommandContext(commandText, overrides = {}) {
  return createMockContext({
    message: {
      text: commandText,
      ...overrides.message
    },
    ...overrides
  });
}

export default {
  createMockContext,
  createAdminContext,
  createOperatorContext,
  createViewerContext,
  createDocumentContext,
  createCommandContext
};
