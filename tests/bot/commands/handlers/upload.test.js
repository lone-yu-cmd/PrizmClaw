/**
 * Tests for F-010 /upload command handler
 * T-051: Create upload.test.js unit tests
 *
 * F-002: File size validation (50MB limit)
 * F-003: Overwrite confirmation flow
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { confirmAction, createConfirmation } from '../../../../src/security/confirmation-manager.js';

// Constants for file size limits (matching Telegram limits)
const TELEGRAM_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

describe('F-010 /upload Command Handler', () => {
  let uploadHandler;
  let sessionStore;

  beforeEach(async () => {
    const projectRoot = process.cwd();
    const uploadModulePath = new URL(`file://${projectRoot}/src/bot/commands/handlers/upload.js`);
    const sessionModulePath = new URL(`file://${projectRoot}/src/services/session-store.js`);

    const module = await import(uploadModulePath.href);
    uploadHandler = module;
    const sessionModule = await import(sessionModulePath.href);
    sessionStore = sessionModule.sessionStore;
  });

  describe('uploadMeta', () => {
    test('should export uploadMeta with command metadata', async () => {
      assert.ok(uploadHandler.uploadMeta);
      assert.equal(uploadHandler.uploadMeta.name, 'upload');
      assert.ok(uploadHandler.uploadMeta.description);
      assert.ok(uploadHandler.uploadMeta.usage);
    });

    test('should require operator role', async () => {
      assert.equal(uploadHandler.uploadMeta.minRole, 'operator');
    });
  });

  describe('handleUpload', () => {
    test('should be exported', async () => {
      assert.ok(uploadHandler.handleUpload);
      assert.ok(typeof uploadHandler.handleUpload === 'function');
    });

    test('should reject missing path', async () => {
      const { handleUpload } = uploadHandler;

      const replies = [];
      const mockCtx = {
        message: {
          reply_to_message: {
            document: { file_id: 'test-file-id', file_name: 'test.txt' }
          }
        },
        telegram: {
          getFileLink: async () => ({ href: 'file://test' })
        }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-1',
        sessionId: 'test-session-upload-1',
        args: []
      };

      await handleUpload(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('请提供') || replies[0].includes('❌'));
    });

    test('should reject when no document in reply', async () => {
      const { handleUpload } = uploadHandler;

      const replies = [];
      const mockCtx = {
        message: {
          reply_to_message: null
        }
      };

      const handlerCtx = {
        ctx: mockCtx,
        reply: (msg) => replies.push(msg),
        params: {},
        userId: 'test-user-2',
        sessionId: 'test-session-upload-2',
        args: ['/tmp/test.txt']
      };

      await handleUpload(handlerCtx);

      assert.ok(replies.length > 0);
      assert.ok(replies[0].includes('回复') || replies[0].includes('文档') || replies[0].includes('❌'));
    });

    test('should require operator role', async () => {
      // The role check is done by the command routing layer, not the handler itself
      // This test verifies the metadata is correct
      assert.equal(uploadHandler.uploadMeta.minRole, 'operator');
    });

    // F-002: File size validation tests
    describe('F-002: File size validation', () => {
      test('should reject files exceeding 50MB limit', async () => {
        const { handleUpload } = uploadHandler;

        const replies = [];
        // Create a mock document with file_size exceeding 50MB
        const oversizedFileSize = TELEGRAM_MAX_FILE_SIZE + 1; // 50MB + 1 byte
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-oversized',
                file_name: 'large-file.bin',
                file_size: oversizedFileSize
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'file://test' })
          }
        };

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f002-1',
          sessionId: 'test-session-f002-1',
          args: ['/tmp/large-file.bin']
        };

        await handleUpload(handlerCtx);

        assert.ok(replies.length > 0);
        const replyText = replies[0];
        // Should mention size limit or rejection
        assert.ok(
          replyText.includes('50MB') ||
          replyText.includes('过大') ||
          replyText.includes('超过') ||
          replyText.includes('❌'),
          `Expected rejection message about size limit, got: ${replyText}`
        );
      });

      test('should accept files at exactly 50MB', async () => {
        const { handleUpload } = uploadHandler;

        const replies = [];
        const exactLimitFileSize = TELEGRAM_MAX_FILE_SIZE; // Exactly 50MB
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-exact',
                file_name: 'exact-limit.bin',
                file_size: exactLimitFileSize
              }
            }
          },
          telegram: {
            getFileLink: async () => {
              // Return a valid file URL that fetch can handle
              // We'll use a data URL with minimal content for testing
              return { href: 'data:application/octet-stream;base64,dGVzdA==' };
            }
          }
        };

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-exact-'));
        const targetPath = path.join(tmpDir, 'exact-limit.bin');

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f002-2',
          sessionId: 'test-session-f002-2',
          args: [targetPath]
        };

        await handleUpload(handlerCtx);

        // Should not reject based on size - might fail for other reasons (fetch, etc)
        // but should NOT have a "file too large" message
        const hasSizeRejection = replies.some(r =>
          r.includes('过大') || r.includes('超过') && r.includes('限制')
        );
        assert.ok(!hasSizeRejection, 'Should not reject file at exactly 50MB');

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      test('should accept files under 50MB', async () => {
        const { handleUpload } = uploadHandler;

        const replies = [];
        const smallFileSize = 1024; // 1KB
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-small',
                file_name: 'small-file.txt',
                file_size: smallFileSize
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'data:text/plain;base64,dGVzdCBjb250ZW50' })
          }
        };

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-small-'));
        const targetPath = path.join(tmpDir, 'small-file.txt');

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f002-3',
          sessionId: 'test-session-f002-3',
          args: [targetPath]
        };

        await handleUpload(handlerCtx);

        // Should not reject based on size
        const hasSizeRejection = replies.some(r =>
          r.includes('过大') || (r.includes('超过') && r.includes('限制'))
        );
        assert.ok(!hasSizeRejection, 'Should not reject small file');

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      test('should handle missing file_size gracefully', async () => {
        const { handleUpload } = uploadHandler;

        const replies = [];
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-no-size',
                file_name: 'no-size-file.txt'
                // file_size is undefined
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'data:text/plain;base64,dGVzdA==' })
          }
        };

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-nosize-'));
        const targetPath = path.join(tmpDir, 'no-size-file.txt');

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f002-4',
          sessionId: 'test-session-f002-4',
          args: [targetPath]
        };

        await handleUpload(handlerCtx);

        // Should proceed without size check (missing file_size is allowed)
        // The upload may succeed or fail for other reasons, but not due to size check
        const hasSizeRejection = replies.some(r =>
          r.includes('过大') || (r.includes('超过') && r.includes('限制'))
        );
        assert.ok(!hasSizeRejection, 'Should not reject file with missing file_size');

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });
    });

    // F-003: Overwrite confirmation tests
    describe('F-003: Overwrite confirmation', () => {
      test('should request confirmation when file already exists', async () => {
        const { handleUpload } = uploadHandler;

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-overwrite-'));
        const existingFile = path.join(tmpDir, 'existing-file.txt');

        // Create an existing file
        await fs.writeFile(existingFile, 'original content');

        const replies = [];
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-overwrite',
                file_name: 'existing-file.txt',
                file_size: 100
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'data:text/plain;base64,bmV3IGNvbnRlbnQ=' })
          }
        };

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f003-1',
          sessionId: 'test-session-f003-1',
          args: [existingFile]
        };

        await handleUpload(handlerCtx);

        // Should request confirmation, not overwrite immediately
        const hasConfirmationRequest = replies.some(r =>
          r.includes('CONFIRM') ||
          r.includes('确认') ||
          r.includes('已存在') ||
          r.includes('覆盖')
        );
        assert.ok(hasConfirmationRequest, `Expected confirmation request, got: ${replies.join(', ')}`);

        // File content should NOT have changed
        const content = await fs.readFile(existingFile, 'utf-8');
        assert.equal(content, 'original content', 'File should not be overwritten without confirmation');

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      test('should overwrite file after confirmation', async () => {
        const { handleUpload } = uploadHandler;

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-confirm-'));
        const existingFile = path.join(tmpDir, 'confirm-file.txt');

        // Create an existing file
        await fs.writeFile(existingFile, 'original content');

        const replies = [];
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-confirm',
                file_name: 'confirm-file.txt',
                file_size: 100
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'data:text/plain;base64,bmV3IGNvbnRlbnQ=' })
          }
        };

        const userId = 'test-user-f003-2';
        const sessionId = 'test-session-f003-2';

        // First call - should request confirmation
        const handlerCtx1 = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId,
          sessionId,
          args: [existingFile]
        };

        await handleUpload(handlerCtx1);

        // Find confirmation ID from the reply
        const confirmationMatch = replies.join(' ').match(/confirm[_-]?id[:\s]+([a-f0-9-]+)/i);
        assert.ok(confirmationMatch, 'Should include confirmation ID in response');

        // Second call with confirmation - user sends "CONFIRM" along with confirmationId
        const replies2 = [];
        const handlerCtx2 = {
          ctx: mockCtx,
          reply: (msg) => replies2.push(msg),
          params: {},
          userId,
          sessionId,
          // The implementation expects args[0] to be "CONFIRM" when confirming
          args: ['CONFIRM'],
          confirmationId: confirmationMatch[1]
        };

        await handleUpload(handlerCtx2);

        // Should show success message
        const hasSuccess = replies2.some(r =>
          r.includes('✅') || r.includes('成功') || r.includes('已保存')
        );
        assert.ok(hasSuccess, `Expected success message after confirmation, got: ${replies2.join(', ')}`);

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });

      test('should upload new file without confirmation', async () => {
        const { handleUpload } = uploadHandler;

        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-new-'));
        const newFile = path.join(tmpDir, 'new-file.txt');

        const replies = [];
        const mockCtx = {
          message: {
            reply_to_message: {
              document: {
                file_id: 'test-file-id-new',
                file_name: 'new-file.txt',
                file_size: 100
              }
            }
          },
          telegram: {
            getFileLink: async () => ({ href: 'data:text/plain;base64,bmV3IGNvbnRlbnQ=' })
          }
        };

        const handlerCtx = {
          ctx: mockCtx,
          reply: (msg) => replies.push(msg),
          params: {},
          userId: 'test-user-f003-3',
          sessionId: 'test-session-f003-3',
          args: [newFile]
        };

        await handleUpload(handlerCtx);

        // Should upload directly without confirmation
        const hasConfirmationRequest = replies.some(r =>
          r.includes('CONFIRM') || r.includes('确认覆盖')
        );
        assert.ok(!hasConfirmationRequest, 'New file should not require confirmation');

        // Should show success message
        const hasSuccess = replies.some(r =>
          r.includes('✅') || r.includes('成功') || r.includes('已保存')
        );
        assert.ok(hasSuccess, 'Should show success for new file upload');

        // Cleanup
        try {
          await fs.rm(tmpDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      });
    });
  });
});
