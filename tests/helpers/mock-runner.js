/**
 * Mock Script Runner Helper
 * F-007: Test and Validation Suite
 *
 * Replaces real shell execution with controlled responses.
 * Supports action routing, response sequencing, and delay simulation.
 */

/**
 * @typedef {Object} MockResponse
 * @property {boolean} ok - Whether the action succeeded
 * @property {any} [data] - Optional response data
 * @property {string} [errorCode] - Error code if ok is false
 * @property {string} [message] - Optional message
 * @property {number} [delay] - Optional delay in ms to simulate execution time
 * @property {number} [exitCode] - Exit code (default 0 if ok, 1 if not)
 * @property {string} [stdout] - Simulated stdout
 * @property {string} [stderr] - Simulated stderr
 */

/**
 * @typedef {Object} MockResponseMap
 * @property {MockResponse|MockResponse[]} [action] - Response(s) for each action
 */

/**
 * Create a mock script runner
 * @param {MockResponseMap} responses - Map of action -> response(s)
 * @returns {Function} Mock runner function compatible with pipeline-control-service
 */
export function createMockRunner(responses = {}) {
  const callLog = [];
  const responseQueue = new Map();

  // Initialize response queues
  for (const [action, response] of Object.entries(responses)) {
    if (Array.isArray(response)) {
      responseQueue.set(action, [...response]);
    } else {
      responseQueue.set(action, [response]);
    }
  }

  /**
   * Mock runner function
   * @param {Object} req - Request object with action and params
   * @returns {Promise<Object>} Response object
   */
  const runner = async (req) => {
    const { action, ...params } = req;
    callLog.push({ action, params, timestamp: Date.now() });

    const queue = responseQueue.get(action);
    let response;

    if (queue && queue.length > 0) {
      // Get next response from queue (or reuse last one)
      if (queue.length === 1) {
        response = queue[0];
      } else {
        response = queue.shift();
      }
    } else {
      // Default response for unmocked actions
      response = {
        ok: true,
        message: `Mocked action: ${action}`,
        exitCode: 0,
        stdout: '',
        stderr: ''
      };
    }

    // Simulate delay if specified
    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    // Normalize response format
    return {
      ok: response.ok ?? true,
      exitCode: response.exitCode ?? (response.ok !== false ? 0 : 1),
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? '',
      normalizedStatus: response.ok !== false ? 'success' : 'failed',
      ...response
    };
  };

  /**
   * Get the call log
   * @returns {Array} List of calls made to the runner
   */
  runner.getCallLog = () => [...callLog];

  /**
   * Get calls for a specific action
   * @param {string} action - Action to filter by
   * @returns {Array} List of calls for that action
   */
  runner.getCalls = (action) => callLog.filter((c) => c.action === action);

  /**
   * Clear the call log
   */
  runner.clearLog = () => {
    callLog.length = 0;
  };

  /**
   * Add a response for an action
   * @param {string} action - Action name
   * @param {MockResponse} response - Response to add
   */
  runner.addResponse = (action, response) => {
    if (!responseQueue.has(action)) {
      responseQueue.set(action, []);
    }
    responseQueue.get(action).push(response);
  };

  /**
   * Set responses (replaces existing)
   * @param {MockResponseMap} newResponses - New response map
   */
  runner.setResponses = (newResponses) => {
    responseQueue.clear();
    for (const [action, response] of Object.entries(newResponses)) {
      if (Array.isArray(response)) {
        responseQueue.set(action, [...response]);
      } else {
        responseQueue.set(action, [response]);
      }
    }
  };

  return runner;
}

/**
 * Create a mock runner that simulates state transitions
 * @param {Object} options - Configuration options
 * @param {boolean} [options.startRunning] - Whether pipeline starts in running state
 * @returns {Function} Mock runner with state tracking
 */
export function createStatefulMockRunner(options = {}) {
  const state = {
    isRunning: options.startRunning ?? false,
    pid: options.startRunning ? 12345 : null,
    runId: options.startRunning ? 'run-test-001' : null,
    currentFeature: options.startRunning ? 'F-TEST-001' : null,
    completed: [],
    failed: []
  };

  const responses = {
    run: () => {
      if (state.isRunning) {
        return {
          ok: false,
          errorCode: 'ALREADY_RUNNING',
          message: 'Pipeline is already running'
        };
      }
      state.isRunning = true;
      state.pid = 12345;
      state.runId = `run-${Date.now()}`;
      state.currentFeature = 'F-TEST-001';
      return {
        ok: true,
        pid: state.pid,
        runId: state.runId,
        message: 'Pipeline started'
      };
    },
    status: () => ({
      ok: true,
      isRunning: state.isRunning,
      pid: state.pid,
      runId: state.runId,
      currentFeature: state.currentFeature,
      completed: state.completed,
      failed: state.failed
    }),
    stop: () => {
      if (!state.isRunning) {
        return {
          ok: true,
          errorCode: 'ALREADY_STOPPED',
          message: 'Pipeline is not running'
        };
      }
      state.isRunning = false;
      state.completed = ['F-TEST-001', 'F-TEST-002'];
      state.currentFeature = null;
      return {
        ok: true,
        previousPid: state.pid,
        message: 'Pipeline stopped'
      };
    },
    retry: ({ targetId }) => ({
      ok: true,
      targetId,
      message: `Retried ${targetId}`
    }),
    logs: () => ({
      ok: true,
      logs: 'Mock log line 1\nMock log line 2\nMock log line 3',
      lines: 3
    }),
    reset: ({ targetId }) => ({
      ok: true,
      targetId,
      message: `Reset ${targetId}`
    })
  };

  const runner = async (req) => {
    const { action, ...params } = req;
    const handler = responses[action];

    if (handler) {
      const result = handler(params);
      return {
        ...result,
        exitCode: result.ok !== false ? 0 : 1,
        stdout: result.message || '',
        stderr: result.ok === false ? result.message : '',
        normalizedStatus: result.ok !== false ? 'success' : 'failed'
      };
    }

    return {
      ok: true,
      message: `Mocked action: ${action}`,
      exitCode: 0,
      stdout: '',
      stderr: '',
      normalizedStatus: 'success'
    };
  };

  runner.getState = () => ({ ...state });
  runner.setState = (newState) => Object.assign(state, newState);

  return runner;
}

export default {
  createMockRunner,
  createStatefulMockRunner
};
