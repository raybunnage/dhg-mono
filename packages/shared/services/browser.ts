/**
 * Browser-safe exports for shared services
 * This file exports only services that are safe to use in browser environments
 */

// Database and core services
export * from "./supabase-client";
export * from "./database-service/database-service";
export * from "./batch-database-service";

// Auth and user services  
export * from "./auth-service/browser";
export * from "./user-profile-service";
export * from "./light-auth-enhanced-service";

// UI and data services
export * from "./filter-service";
export * from "./formatter-service";
export * from "./element-catalog-service";
export * from "./element-criteria-service";
export * from "./media-analytics-service";
export * from "./dev-task-service";
export * from "./clipboard-service";
export * from "./work-summary-service";
export * from "./worktree-management-service";
export * from "./database-metadata-service";

// AI and document services (browser-safe parts)
export * from "./ai-processing-service";
export * from "./document-classification-service";

// Command execution client (browser-safe)
export { CommandExecutionClient } from "./command-execution-service/command-execution-client";
export type { 
  CommandResult,
  GitBranchInfo,
  GitWorktreeInfo,
  GitStatusInfo,
  CommandHistory,
  CommandTemplate 
} from "./command-execution-service/types";

// Note: The following services are NOT included as they require Node.js:
// - command-execution-service (server implementation)
// - file-service
// - file-system-service  
// - converter-service
// - document-pipeline
// - script-pipeline
// - pdf-processor-service
// - google-drive services (except browser version)
// - git-service
// - audio-transcription
// - testing-service