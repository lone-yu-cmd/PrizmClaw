/**
 * Session Binding Integration Tests
 * Tests for F-018 Web-Telegram Bidirectional Sync binding endpoints
 *
 * F-018: Web-Telegram Bidirectional Sync
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import { createHttpServer } from '../../src/http/server.js';

/**
 * Helper to create temp directory for test state
 */
function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f018-binding-test-'));
  const dataDir = path.join(tempDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return {
    tempDir,
    dataDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

/**
 * Helper to make HTTP requests
 */
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Helper to start HTTP server
 */
function startServer(bindingsPath) {
  const logger = { info: () => {}, error: () => {} };
  const app = createHttpServer({ logger, sessionBindingsPath: bindingsPath });

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port, cleanup: () => server.close() });
    });
  });
}

test('F-018: POST /api/bind creates session binding', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bind',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { webSessionId: 'web-session-123', telegramChatId: '456' });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.ok, true);

      // Verify binding via GET /api/bindings (more reliable than file read)
      const verifyResponse = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings?webSessionId=web-session-123',
        method: 'GET'
      });

      assert.strictEqual(verifyResponse.statusCode, 200);
      assert.strictEqual(verifyResponse.body.ok, true);
      assert.strictEqual(verifyResponse.body.telegramChatId, '456');
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});

test('F-018: POST /api/bind validates required fields', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bind',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { webSessionId: 'web-session-123' });

      assert.strictEqual(response.statusCode, 400);
      assert.strictEqual(response.body.ok, false);
      assert.ok(response.body.error.includes('required'));
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});

test('F-018: POST /api/unbind removes session binding', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    // Create initial binding
    fs.writeFileSync(bindingsPath, JSON.stringify({
      bindings: {
        'web-session-123': '456'
      }
    }));

    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      // First verify the binding exists
      const beforeResponse = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings?webSessionId=web-session-123',
        method: 'GET'
      });
      assert.strictEqual(beforeResponse.body.telegramChatId, '456');

      // Unbind
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/unbind',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { webSessionId: 'web-session-123' });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.ok, true);

      // Verify binding removed via API
      const afterResponse = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings?webSessionId=web-session-123',
        method: 'GET'
      });
      assert.strictEqual(afterResponse.body.telegramChatId, null);
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});

test('F-018: GET /api/bindings returns all bindings', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    // Create initial bindings
    fs.writeFileSync(bindingsPath, JSON.stringify({
      bindings: {
        'web-session-1': '456',
        'web-session-2': '456',
        'web-session-3': '789'
      }
    }));

    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings',
        method: 'GET'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.ok, true);
      assert.strictEqual(response.body.bindings['web-session-1'], '456');
      assert.strictEqual(response.body.bindings['web-session-2'], '456');
      assert.strictEqual(response.body.bindings['web-session-3'], '789');
      assert.strictEqual(Object.keys(response.body.bindings).length, 3);
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});

test('F-018: GET /api/bindings?webSessionId returns specific binding', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    // Create initial bindings
    fs.writeFileSync(bindingsPath, JSON.stringify({
      bindings: {
        'web-session-1': '456',
        'web-session-2': '789'
      }
    }));

    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings?webSessionId=web-session-2',
        method: 'GET'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.ok, true);
      assert.strictEqual(response.body.telegramChatId, '789');
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});

test('F-018: GET /api/bindings returns null for non-existent session', async (t) => {
  const { dataDir, cleanup: cleanupTemp } = createTempDir();
  const bindingsPath = path.join(dataDir, 'session-bindings.json');

  try {
    const { server, port, cleanup: cleanupServer } = await startServer(bindingsPath);
    try {
      const response = await makeRequest({
        hostname: 'localhost',
        port,
        path: '/api/bindings?webSessionId=non-existent',
        method: 'GET'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.ok, true);
      assert.strictEqual(response.body.telegramChatId, null);
    } finally {
      cleanupServer();
    }
  } finally {
    cleanupTemp();
  }
});
