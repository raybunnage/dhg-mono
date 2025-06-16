# Service Refactoring - 3 Worktree Parallel Assignment

## Total Services to Refactor: 57 services
**Distribution: 19 services per worktree (balanced by complexity and usage)**

---

## 🔥 WORKTREE A - HIGH IMPACT SERVICES (19 services)
**Focus: Core infrastructure and high-usage services**

### High Priority Services (10+ usage locations)
1. **PromptService** (42 locations)
   - Path: `prompt-service/`
   - Description: AI prompt management and template service
   - Type: Infrastructure (manages AI resources)
   - Expected Base: SingletonService

2. **FilterService** (38 locations)
   - Path: `filter-service/`
   - Description: User filter profiles and preferences management
   - Type: Business (user data management)
   - Expected Base: BusinessService

3. **GoogleDriveService** (36 locations)
   - Path: `../../../packages/shared/services/google-drive/google-drive-service.ts`
   - Description: Google Drive API integration and file management
   - Type: Infrastructure (external API)
   - Expected Base: SingletonService

4. **GoogleDrive** (31 locations)
   - Path: `google-drive/`
   - Description: Google Drive API integration and file management
   - Type: Infrastructure (external API)
   - Expected Base: SingletonService

5. **TaskService** (30 locations)
   - Path: `task-service/`
   - Description: Task management and tracking service
   - Type: Business (task management)
   - Expected Base: BusinessService

6. **ClipboardService** (19 locations)
   - Path: `packages/shared/services/clipboard-service/`
   - Description: Clipboard snippet management with categories, favorites, and usage tracking
   - Type: Business (data management)
   - Expected Base: BusinessService

7. **GoogleAuthService** (16 locations)
   - Path: `../../../packages/shared/services/google-drive/google-auth-service.ts`
   - Description: Google Drive authentication service
   - Type: Infrastructure (auth management)
   - Expected Base: SingletonService

### Medium Priority Services
8. **UnifiedClassificationService** (9 locations)
   - Path: `unified-classification-service/`
   - Description: Utility service
   - Type: Business (classification logic)
   - Expected Base: BusinessService

9. **TranscriptionService** (9 locations)
   - Path: `transcription-service/`
   - Description: Audio/video transcription service
   - Type: Infrastructure (external processing)
   - Expected Base: SingletonService

### Lower Priority Services
10. **UserProfileService** (2 locations)
    - Path: `user-profile-service/`
    - Description: Utility service
    - Type: Business (user management)
    - Expected Base: BusinessService

### Zero Usage (Evaluate for removal vs refactor)
11. **ProxyServerBaseService** (0 locations)
    - Path: `packages/shared/services/proxy-server-base-service`
    - Description: Base class for proxy server implementations
    - Type: Infrastructure (base class)
    - Expected Base: SingletonService

12. **ServerRegistryService** (0 locations)
    - Path: `packages/shared/services/server-registry-service`
    - Description: Dynamic server port discovery and management
    - Type: Infrastructure (server management)
    - Expected Base: SingletonService

13. **CLIExecutorService** (0 locations)
    - Path: `packages/shared/services/cli-executor-service`
    - Description: Safe command execution service
    - Type: Infrastructure (command execution)
    - Expected Base: SingletonService

14. **GitOperationsService** (0 locations)
    - Path: `packages/shared/services/git-operations-service`
    - Description: Git command utilities for repository operations
    - Type: Infrastructure (git operations)
    - Expected Base: SingletonService

15. **AdminUserService** (0 locations)
    - Path: `packages/shared/services/admin-user-service`
    - Description: User and admin management service
    - Type: Business (user management)
    - Expected Base: BusinessService

16. **EmailService** (0 locations)
    - Path: `email-service/`
    - Description: Email processing and sending service
    - Type: Infrastructure (email processing)
    - Expected Base: SingletonService

17. **WorktreeService** (0 locations)
    - Path: `worktree-service/`
    - Description: Git worktree management service
    - Type: Infrastructure (git operations)
    - Expected Base: SingletonService

18. **GitService** (0 locations)
    - Path: `git-service/`
    - Description: Git repository operations service
    - Type: Infrastructure (git operations)
    - Expected Base: SingletonService

19. **GmailService** (0 locations)
    - Path: `gmail-service/`
    - Description: Gmail API integration service
    - Type: Infrastructure (external API)
    - Expected Base: SingletonService

---

## 🎯 WORKTREE B - BUSINESS LOGIC SERVICES (19 services)
**Focus: Document processing, media, and business logic services**

### High Priority Services
1. **ElementCriteriaService** (19 locations)
   - Path: `../../../packages/shared/services/element-criteria-service.ts`
   - Description: Element criteria management
   - Type: Business (criteria logic)
   - Expected Base: BusinessService

2. **ElementCatalogService** (19 locations)
   - Path: `../../../packages/shared/services/element-catalog-service.ts`
   - Description: Element catalog management
   - Type: Business (catalog logic)
   - Expected Base: BusinessService

3. **DevTaskService** (16 locations)
   - Path: `packages/shared/services/dev-task-service/`
   - Description: Comprehensive task management service with CRUD operations
   - Type: Business (task management)
   - Expected Base: BusinessService

4. **PromptManagementService** (13 locations)
   - Path: `../../../packages/shared/services/prompt-service/prompt-management-service.ts`
   - Description: Prompt management service
   - Type: Business (prompt management)
   - Expected Base: BusinessService

5. **FileService** (12 locations)
   - Path: `file-service/`
   - Description: File system operations and management
   - Type: Infrastructure (file operations)
   - Expected Base: SingletonService

6. **DocumentClassificationService** (11 locations)
   - Path: `document-classification-service/`
   - Description: Document service
   - Type: Business (classification logic)
   - Expected Base: BusinessService

### Medium Priority Services
7. **AudioTranscriptionService** (9 locations)
   - Path: `../../../packages/shared/services/audio-transcription/audio-transcription-service.ts`
   - Description: Audio transcription service
   - Type: Infrastructure (external processing)
   - Expected Base: SingletonService

8. **MediaAnalyticsService** (7 locations)
   - Path: `../../../packages/shared/services/media-analytics-service/media-analytics-service.ts`
   - Description: Media analytics service
   - Type: Business (analytics logic)
   - Expected Base: BusinessService

9. **WorkSummaryService** (7 locations)
   - Path: `packages/shared/services/work-summary-service/`
   - Description: AI work summary management with CRUD, filtering, statistics
   - Type: Business (content management)
   - Expected Base: BusinessService

### Lower Priority Services
10. **MediaPresentationService** (4 locations)
    - Path: `../../../packages/shared/services/media-presentation-service/media-presentation-service.ts`
    - Description: Media presentation service
    - Type: Business (presentation logic)
    - Expected Base: BusinessService

11. **PipelineService** (4 locations)
    - Path: `pipeline-service/`
    - Description: Pipeline management and orchestration service
    - Type: Infrastructure (pipeline management)
    - Expected Base: SingletonService

12. **DatabaseMetadataService** (3 locations)
    - Path: `packages/shared/services/database-metadata-service/`
    - Description: Database introspection service
    - Type: Infrastructure (database operations)
    - Expected Base: SingletonService

13. **TestingService** (3 locations)
    - Path: `../../../packages/shared/services/testing-service/testing-service.ts`
    - Description: Testing service
    - Type: Infrastructure (testing utilities)
    - Expected Base: SingletonService

14. **DocumentTypeService** (2 locations)
    - Path: `document-type-service/`
    - Description: Document type classification and management
    - Type: Business (classification logic)
    - Expected Base: BusinessService

### Zero Usage Services
15. **ExpertService** (0 locations)
    - Path: `expert-service/`
    - Description: Expert profile management service
    - Type: Business (profile management)
    - Expected Base: BusinessService

16. **DocumentationService** (0 locations)
    - Path: `documentation-service/`
    - Description: Documentation generation and management service
    - Type: Business (content management)
    - Expected Base: BusinessService

17. **DocumentMaintenanceService** (0 locations)
    - Path: `packages/shared/services/document-maintenance-service`
    - Description: Document maintenance statistics and health monitoring
    - Type: Business (maintenance logic)
    - Expected Base: BusinessService

18. **ScriptService** (0 locations)
    - Path: `script-service/`
    - Description: Script management and execution service
    - Type: Infrastructure (script execution)
    - Expected Base: SingletonService

19. **MediaProcessingService** (0 locations)
    - Path: `media-processing-service/`
    - Description: Media file processing and conversion service
    - Type: Infrastructure (media processing)
    - Expected Base: SingletonService

---

## ⚙️ WORKTREE C - UTILITY & SUPPORT SERVICES (19 services)
**Focus: System utilities, file operations, and support services**

### Lower Priority Services (1-4 usage)
1. **DocumentService** (4 locations)
   - Path: `document-service/`
   - Description: Document management service
   - Type: Business (document management)
   - Expected Base: BusinessService

2. **EnvConfigService** (1 location)
   - Path: `env-config-service/`
   - Description: Utility service
   - Type: Infrastructure (configuration)
   - Expected Base: SingletonService

3. **BatchDatabaseService** (1 location)
   - Path: `packages/shared/services/batch-database-service.ts`
   - Description: Batch database operations service
   - Type: Infrastructure (database operations)
   - Expected Base: SingletonService

4. **SystemService** (1 location)
   - Path: `system-service/`
   - Description: System utilities and operations service
   - Type: Infrastructure (system operations)
   - Expected Base: SingletonService

5. **FileSystemService** (1 location)
   - Path: `packages/shared/services/file-system-service.ts`
   - Description: File system operations wrapper
   - Type: Infrastructure (file operations)
   - Expected Base: SingletonService

### Zero Usage Services (Evaluate for removal)
6. **CommandExecutionService** (0 locations)
   - Path: `packages/shared/services/command-execution-service/`
   - Description: Command execution service with dual implementation
   - Type: Infrastructure (command execution)
   - Expected Base: SingletonService

7. **FileReader** (0 locations)
   - Path: `file-reader/`
   - Description: File reading and parsing service
   - Type: Infrastructure (file operations)
   - Expected Base: SingletonService

8. **ThemeService** (0 locations)
   - Path: `theme-service/`
   - Description: Utility service
   - Type: Business (theme management)
   - Expected Base: BusinessService

9. **DocFilesService** (0 locations)
   - Path: `doc-files-service/`
   - Description: Documentation file handling service
   - Type: Business (file management)
   - Expected Base: BusinessService

10. **PdfProcessorService** (0 locations)
    - Path: `pdf-processor-service/`
    - Description: Utility service
    - Type: Infrastructure (document processing)
    - Expected Base: SingletonService

11. **ServiceDependencyMapping** (0 locations)
    - Path: `service-dependency-mapping/`
    - Description: Service dependency tracking and analysis
    - Type: Infrastructure (dependency tracking)
    - Expected Base: SingletonService

12. **CliRegistryService** (0 locations)
    - Path: `cli-registry-service/`
    - Description: Utility service
    - Type: Infrastructure (CLI management)
    - Expected Base: SingletonService

13. **FileOperationsService** (0 locations)
    - Path: `packages/shared/services/file-operations-service`
    - Description: Centralized file operations service
    - Type: Infrastructure (file operations)
    - Expected Base: SingletonService

14. **ReportService** (0 locations)
    - Path: `report-service/`
    - Description: Utility service
    - Type: Business (report generation)
    - Expected Base: BusinessService

15. **GoogleSyncService** (0 locations)
    - Path: `google-sync-service/`
    - Description: Google Drive synchronization service
    - Type: Infrastructure (sync operations)
    - Expected Base: SingletonService

16. **HtmlFileBrowserService** (0 locations)
    - Path: `packages/shared/services/html-file-browser/HtmlFileBrowserService.ts`
    - Description: File browsing capabilities for HTML file browser proxy
    - Type: Business (UI service)
    - Expected Base: BusinessService

17. **MarkdownViewerService** (0 locations)
    - Path: `packages/shared/services/markdown-viewer/MarkdownViewerService.ts`
    - Description: Service for viewing, archiving, and deleting markdown files
    - Type: Business (file management)
    - Expected Base: BusinessService

18. **ScriptViewerService** (0 locations)
    - Path: `packages/shared/services/script-viewer/ScriptViewerService.ts`
    - Description: Service for viewing, archiving, and deleting script files
    - Type: Business (file management)
    - Expected Base: BusinessService

19. **WorktreeSwitcherService** (0 locations)
    - Path: `packages/shared/services/worktree-switcher/WorktreeSwitcherService.ts`
    - Description: Service for managing git worktrees and generating switcher UI
    - Type: Infrastructure (git operations)
    - Expected Base: SingletonService

---

## 📋 INSTRUCTIONS FOR EACH WORKTREE AGENT

### Common Process for All Agents:
1. **Create your assigned worktree** and switch to it
2. **For each service in your list**:
   - First check if the service actually exists at the specified path
   - Check for duplicates by searching for similar functionality
   - If it's a real service that needs refactoring, proceed with the 4-checkpoint migration:
     - `baseline` - Before any changes
     - `migrated` - Service refactored to extend appropriate base class
     - `validated` - Tests created and passing
     - `finalized` - Documentation created, database updated, old service archived

### Base Class Selection Guide:
- **SingletonService**: For infrastructure services managing expensive resources (APIs, databases, external services)
- **BusinessService**: For business logic services with dependency injection patterns

### What to Exclude (Don't Refactor):
- Services that are just type files (types.ts)
- Services that are utility functions or clients
- Services that don't actually exist at the specified path
- Services that are clear duplicates of others

### Documentation Requirements:
- Create `MIGRATION.md` for each refactored service
- Update database record with migration completion
- Archive original service with date stamp

### Commit Pattern:
```bash
git add -A && git commit -m "checkpoint: [stage] - [ServiceName] migration [step]"
```

### Database Update Pattern:
```typescript
await supabase
  .from('sys_shared_services')
  .update({
    migration_status: 'completed',
    migration_completed_at: now,
    service_path: 'service-name-refactored/',
    base_class_type: 'SingletonService|BusinessService',
    service_type: 'infrastructure|business'
  })
  .eq('service_name', 'ServiceName');
```

---

## 🎯 SUCCESS CRITERIA
- **Worktree A**: Focus on high-impact, high-usage services first
- **Worktree B**: Focus on business logic and document processing
- **Worktree C**: Focus on utilities and support services
- **All Worktrees**: Skip services that don't exist or are duplicates
- **Quality**: Each service should have comprehensive tests and documentation
- **Consistency**: Follow established patterns from previous migrations