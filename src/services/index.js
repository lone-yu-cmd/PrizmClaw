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
