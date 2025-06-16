# Service Refactoring Categorization

Based on analysis of the 94 remaining services, here's the categorization:

## EXCLUDE - NOT ACTUAL SERVICES (26 services)
**Type files, index files, utility functions, clients, interfaces:**
1. work-summary-service (types.ts file)
2. worktree-management-service (types.ts file) 
3. command-execution-service (types.ts file)
4. Index (index.ts file)
5. google-drive (index.ts file)
6. getBrowserAuthService (utility function)
7. FilterServiceClient (client interface)
8. CommandExecutionClient (client interface)
9. PromptCliInterface (interface)
10. MockDataFactory (factory utility)
11. LifecycleTrackingMixin (mixin, not service)
12. GoogleUtils (utility functions)
13. CliCommandUtils (utility functions)
14. PromptOutputTemplateService (template utility)
15. PDFProcessorService (utility)
16. DocumentTypeAIService (utility)
17. ScriptPipelineService (utility)
18. GoogleDriveBrowserService (browser utility)
19. PortsManagementService (utility)
20. DeploymentService (utility)
21. FollowUpTaskService (utility)
22. DocumentArchivingService (utility)
23. DocumentPipelineService (utility) 
24. LivingDocsPrioritizationService (utility)
25. PromptCliInterface (interface)
26. HTTPResponseHelpersService (utility)

## EXCLUDE - DUPLICATES (8 services)
**Services that duplicate existing functionality:**
1. AudioTranscription (duplicate of AudioTranscriptionService)
2. LightAuthService (duplicate, LightAuthEnhancedService is better)
3. ClassifyService (duplicate of DocumentClassificationService)
4. AudioService (duplicate of media services)
5. DocumentService (generic, covered by specific doc services)
6. GoogleDriveBrowserService (covered by GoogleDriveService)
7. DocumentPipeline (covered by DocumentPipelineService)
8. CommandTrackingService (duplicate in tracking-service)

## EXCLUDE - ALREADY PROPER (3 services)
**Services already following correct patterns:**
1. claudeService (already singleton following CLAUDE.md pattern)
2. SupabaseAdapter (approved factory pattern for browser)
3. TrackingService (appears to already follow patterns)

## INCLUDE - NEEDS REFACTORING (57 services)
**Real services requiring refactoring to extend BaseService/SingletonService:**

### HIGH PRIORITY (High Usage - 10+ locations)
1. **PromptService** (42 locations) - AI prompt management
2. **FilterService** (38 locations) - User filter profiles  
3. **GoogleDriveService** (36 locations) - Google Drive API
4. **GoogleDrive** (31 locations) - Google Drive integration
5. **TaskService** (30 locations) - Task management
6. **ClipboardService** (19 locations) - Clipboard management
7. **ElementCriteriaService** (19 locations) - Element criteria
8. **ElementCatalogService** (19 locations) - Element catalog
9. **GoogleAuthService** (16 locations) - Google authentication
10. **DevTaskService** (16 locations) - Task management
11. **PromptManagementService** (13 locations) - Prompt management
12. **FileService** (12 locations) - File operations
13. **DocumentClassificationService** (11 locations) - Document classification

### MEDIUM PRIORITY (5-9 locations)
14. **UnifiedClassificationService** (9 locations) - Classification
15. **TranscriptionService** (9 locations) - Audio transcription
16. **AudioTranscriptionService** (9 locations) - Audio transcription
17. **MediaAnalyticsService** (7 locations) - Media analytics
18. **WorkSummaryService** (7 locations) - Work summaries

### LOWER PRIORITY (1-4 locations)
19. **DocumentService** (4 locations) - Document management
20. **MediaPresentationService** (4 locations) - Media presentations
21. **PipelineService** (4 locations) - Pipeline management
22. **DatabaseMetadataService** (3 locations) - Database introspection
23. **TestingService** (3 locations) - Testing utilities
24. **UserProfileService** (2 locations) - User profiles
25. **DocumentTypeService** (2 locations) - Document types
26. **EnvConfigService** (1 location) - Environment config
27. **BatchDatabaseService** (1 location) - Batch operations
28. **SystemService** (1 location) - System utilities
29. **FileSystemService** (1 location) - File system ops

### ZERO USAGE (Evaluate for removal)
30. **ProxyServerBaseService** - Base class for proxies
31. **ServerRegistryService** - Server discovery
32. **CLIExecutorService** - Command execution
33. **ExpertService** - Expert profiles
34. **GitOperationsService** - Git operations
35. **CommandExecutionService** - Command execution
36. **AdminUserService** - User management
37. **FileReader** - File reading
38. **ThemeService** - Theme management
39. **DocFilesService** - Documentation files
40. **EmailService** - Email processing
41. **PdfProcessorService** - PDF processing
42. **ServiceDependencyMapping** - Service dependencies
43. **WorktreeService** - Git worktrees
44. **GitService** - Git operations
45. **CliRegistryService** - CLI registry
46. **FileOperationsService** - File operations
47. **DocumentationService** - Documentation
48. **DocumentMaintenanceService** - Document maintenance
49. **ReportService** - Reports
50. **ScriptService** - Script management
51. **GoogleSyncService** - Google sync
52. **MediaProcessingService** - Media processing
53. **GmailService** - Gmail integration
54. **HtmlFileBrowserService** - HTML file browser
55. **MarkdownViewerService** - Markdown viewer
56. **ScriptViewerService** - Script viewer
57. **WorktreeSwitcherService** - Worktree switching

## SUMMARY
- **Total services analyzed:** 94
- **To exclude:** 37 (26 not services + 8 duplicates + 3 already proper)
- **To refactor:** 57 real services
- **High priority:** 13 services (10+ usage)
- **Medium priority:** 5 services (5-9 usage)  
- **Lower priority:** 11 services (1-4 usage)
- **Zero usage:** 28 services (evaluate for removal)