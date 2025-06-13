-- Complete Service Cleanup - Remove remaining duplicates identified in SERVICE_CLEANUP_SUMMARY.md
-- This migration removes services that were supposed to be cleaned up but still exist

-- Remove the specific services identified as duplicates that should be removed
DELETE FROM sys_shared_services 
WHERE service_name IN (
  'GoogleDriveService',           -- Keep GoogleDrive instead
  'LightAuthEnhancedService',     -- Keep LightAuthService instead  
  'PDFProcessorService',          -- Keep PdfProcessorService instead
  'PromptManagementService'       -- Keep PromptService instead
);

-- Additional cleanup of other obvious duplicates found in the analysis
DELETE FROM sys_shared_services 
WHERE service_name IN (
  'GoogleDriveExplorerService',   -- Keep GoogleDriveExplorer instead
  'GoogleDriveBrowserService',    -- Keep GoogleDrive instead
  'GoogleDriveSyncService',       -- Keep GoogleSyncService instead
  'SupabaseClientService',        -- Keep SupabaseClient instead
  'SupabaseClientAdapter',        -- Keep SupabaseAdapter instead
  'SupabaseService',              -- Keep SupabaseClient instead
  'getBrowserAuthService'         -- Keep AuthService instead
);

-- Log what was removed
INSERT INTO sys_database_change_events (
  event_type,
  table_name, 
  description,
  change_details
) VALUES (
  'cleanup',
  'sys_shared_services',
  'Completed service cleanup removing duplicate services',
  jsonb_build_object(
    'removed_services', ARRAY[
      'GoogleDriveService',
      'LightAuthEnhancedService', 
      'PDFProcessorService',
      'PromptManagementService',
      'GoogleDriveExplorerService',
      'GoogleDriveBrowserService',
      'GoogleDriveSyncService',
      'SupabaseClientService',
      'SupabaseClientAdapter',
      'SupabaseService',
      'getBrowserAuthService'
    ],
    'reason', 'Remove duplicates as specified in SERVICE_CLEANUP_SUMMARY.md'
  )
);