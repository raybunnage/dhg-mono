-- Update sys_shared_services with current test status

-- Services with passing tests
UPDATE sys_shared_services 
SET 
  refactoring_validated = true,
  tests_passing = true,
  notes = COALESCE(notes || ' | ', '') || 'All tests passing after Vitest migration (2025-06-14)'
WHERE service_name IN ('SupabaseClientService', 'SupabaseAdapterService');

-- Services with failing tests
UPDATE sys_shared_services 
SET 
  refactoring_validated = false,
  tests_passing = false,
  notes = COALESCE(notes || ' | ', '') || 'Tests failing - mock setup issues (2025-06-14)'
WHERE service_name IN ('DatabaseService', 'FolderHierarchyService', 'SupabaseService');

-- Services without tests
UPDATE sys_shared_services 
SET 
  refactoring_validated = false,
  tests_passing = null,
  notes = COALESCE(notes || ' | ', '') || 'No test files found (2025-06-14)'
WHERE service_name IN (
  'BatchProcessingService',
  'AuthService', 
  'GoogleDriveExplorerService',
  'AudioProxyService',
  'AIProcessingService',
  'FilterService',
  'ElementCatalogService',
  'AudioTranscriptionService',
  'ElementCriteriaService',
  'FileService',
  'GoogleAuthService',
  'ProxyServerBaseService',
  'MediaAnalyticsService',
  'ClaudeService',
  'LoggerService',
  'TaskService',
  'UserProfileService',
  'CLIRegistryService',
  'UnifiedClassificationService',
  'GoogleDriveSyncService',
  'SourcesGoogleUpdateService',
  'FormatterService',
  'GoogleDriveService',
  'ConverterService',
  'PromptService',
  'AudioService',
  'MediaTrackingService'
);

-- Query to see current status
SELECT 
  service_name,
  is_refactored,
  refactoring_validated,
  tests_passing,
  CASE 
    WHEN tests_passing = true THEN '✅ Passing'
    WHEN tests_passing = false THEN '❌ Failing'
    WHEN tests_passing IS NULL AND is_refactored = true THEN '⚠️ No tests'
    ELSE '⏳ Not refactored'
  END as test_status
FROM sys_shared_services
WHERE is_refactored = true
ORDER BY 
  tests_passing DESC NULLS LAST,
  service_name;