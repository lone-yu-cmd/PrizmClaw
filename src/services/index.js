/**
 * Services Index
 * Exports all service modules for convenience.
 */

// F-005: Pipeline Status Aggregation and Log Streaming
export { createStatusAggregator } from './status-aggregator.js';
export { createLogPager } from './log-pager.js';
export { createTelegramPusher } from './telegram-pusher.js';

// Existing services
export { chatQueue } from './chat-queue.js';
export { chatWithSession, buildSessionContext, resetSession } from './chat-service.js';
export { captureScreenshot } from './screenshot-service.js';
export { executeSystemCommand } from './system-exec-service.js';
export { realtimeHub } from './realtime-hub.js';
export { sessionStore } from './session-store.js';
export { createPipelineControlService } from './pipeline-control-service.js';
export { createPlanIngestionService } from './plan-ingestion-service.js';
export {
  createPipelineController,
  getDefaultPipelineController,
  startPipeline,
  stopPipeline,
  retryTarget,
  runSingle,
  getStatus,
  getLogs,
  forceUnlock
} from './pipeline-controller.js';

// F-006: Safety and Permission Guard - Audit Log Service
export {
  initAuditLogService,
  logAuditEntry,
  queryAuditLogs,
  resetAuditLogService,
  getAuditLogStats
} from './audit-log-service.js';

// F-011: AI CLI Proxy
export {
  executeAiCli,
  interruptAiCli,
  isAiCliRunning,
  getActiveProcessInfo,
  canInterruptAiCli,
  getMetrics,
  resetMetrics
} from './ai-cli-service.js';

// F-013: Session and Context Manager
export { sessionContextService } from './session-context-service.js';
export { aliasStore } from './alias-store.js';

// F-014: Notification and Scheduled Tasks
export { scheduledTaskService } from './scheduled-task-service.js';
export { fileWatcherService } from './file-watcher-service.js';

// F-018: Web-Telegram Bidirectional Sync
export { createSessionBindService } from './session-bind.js';
export { createMessageRouter } from './message-router.js';
