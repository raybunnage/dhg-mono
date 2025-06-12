# Service Usage Validation Report

Generated: 2025-06-10T08:05:17.709Z

## Summary

- Total services analyzed: 70
- Services with discrepancies: 25
- Actually unused services: 36

## Key Findings

## Detailed Analysis

### AiProcessingService

**Category:** ai

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### AudioService

**Category:** media

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-audio]
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### AudioTranscription

**Category:** media

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/media-processing]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/media-processing]
- Total imports found: 2

**Import Examples:**
- `scripts/cli-pipeline/media-processing/commands/transcribe-audio.ts`: `import { AudioTranscriptionService } from '../../../../packages/shared/services/audio-transcription/audio-transcription-service';`
- `scripts/cli-pipeline/media-processing/commands/transcribe-with-summary.ts`: `import { AudioTranscriptionService } from '../../../../packages/shared/services/audio-transcription/audio-transcription-service';`

---

### AuthService

**Category:** auth

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [.archived_apps, dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/registry, scripts/cli-pipeline/system]

**Actual Usage:**
- Apps: [.archived_apps, dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]
- Total imports found: 27

**Import Examples:**
- `apps/.archived_apps/dhg-audio-light.20250525/src/components/LightAuth.tsx`: `import { lightAuthService, type ProfileData } from '../services/light-auth-service';`
- `apps/.archived_apps/dhg-audio-light.20250525/src/hooks/useAuth.tsx`: `import { lightAuthService, type AppUser } from '../services/light-auth-service';`
- `apps/.archived_apps/dhg-audio-magic.20250525/src/components/EmailAuth.tsx`: `import { browserAuthService, type AccessRequestData } from '../services/auth-service';`
- `apps/.archived_apps/dhg-audio-magic.20250525/src/components/Layout.tsx`: `import { browserAuthService } from '../services/auth-service';`
- `apps/.archived_apps/dhg-audio-magic.20250525/src/components/ProfilePrompt.tsx`: `import { browserAuthService } from '../services/auth-service';`

---

### BatchDatabaseService

**Category:** database

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### BatchProcessingService

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/registry]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing]
- Total imports found: 4

**Import Examples:**
- `scripts/cli-pipeline/google_sync/classify-pdfs-with-service.ts`: `import { BatchProcessingService } from '../../../packages/shared/services/batch-processing-service';`
- `scripts/cli-pipeline/google_sync/classify-powerpoints.ts`: `import { BatchProcessingService } from '../../../packages/shared/services/batch-processing-service';`
- `scripts/cli-pipeline/media-processing/commands/batch-process.ts`: `import { BatchProcessingService, BatchStatus } from '../../../../packages/shared/services/batch-processing-service';`
- `scripts/cli-pipeline/media-processing/commands/check-status.ts`: `import { BatchProcessingService } from '../../../../packages/shared/services/batch-processing-service';`

---

### ClassificationService

**Category:** classification

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]
- Total imports found: 11

**Import Examples:**
- `scripts/cli-pipeline/document/document-type-manager.ts`: `import { documentClassificationService } from '../../packages/shared/services/document-classification-service';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/test-classify.20250608.ts`: `import { unifiedClassificationService } from '../../../packages/shared/services/unified-classification-service';`
- `scripts/cli-pipeline/google_sync/classify-missing-docs-with-service.ts`: `import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';`
- `scripts/cli-pipeline/google_sync/classify-pdfs-with-service.ts`: `import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';`
- `scripts/cli-pipeline/google_sync/classify-powerpoints.ts`: `import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';`

---

### ClassifyService

**Category:** document

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/classify]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/classify]
- Total imports found: 2

**Import Examples:**
- `scripts/cli-pipeline/classify/commands/health-check.ts`: `import { classifyService } from '../../../../packages/shared/services/classify-service';`
- `scripts/cli-pipeline/classify/index.ts`: `import { classifyService } from '../../../packages/shared/services/classify-service';`

---

### claudeService

**Category:** ai

**Registry Data:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/.archived_pipelines, scripts/cli-pipeline/classify, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/scripts, scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/.archived_pipelines, scripts/cli-pipeline/classify, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/scripts, scripts/cli-pipeline/shared]
- Total imports found: 50

**Import Examples:**
- `apps/dhg-admin-google/src/pages/ClassifyDocument.tsx`: `import { claudeService } from '@shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/.archived_pipelines/examples.2025-06-08/claude-service-example.ts`: `import { claudeService } from '../../../packages/shared/services/claude-service';`
- `scripts/cli-pipeline/.archived_pipelines/examples.2025-06-08/test-claude-4-models.ts`: `import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/classify/commands/classify-remaining-experts.ts`: `import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/classify/commands/classify-source.ts`: `import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';`

---

### ClaudeService

**Category:** ai

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/.archived_pipelines, scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/classify, scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/scripts, scripts/cli-pipeline/shared, scripts/cli-pipeline/system]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/.archived_pipelines, scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/classify, scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/scripts]
- Total imports found: 51

**Import Examples:**
- `apps/dhg-admin-google/src/pages/ClassifyDocument.tsx`: `import { claudeService } from '@shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/.archived_pipelines/examples.2025-06-08/test-claude-4-models.ts`: `import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/.archived_scripts/display-doc-paths.20250406.ts`: `import { ClaudeService } from '../../packages/cli/src/services/claude-service';`
- `scripts/cli-pipeline/classify/commands/classify-remaining-experts.ts`: `import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';`
- `scripts/cli-pipeline/classify/commands/classify-source.ts`: `import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';`

---

### CliCommandUtils

**Category:** cli

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### ClipboardService

**Category:** Utilities

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-admin-code]
- Pipelines: []
- Total imports found: 1

**Import Examples:**
- `apps/dhg-admin-code/src/pages/ClipboardManager.tsx`: `import { ClipboardService, type ClipboardItem } from '@shared/services/clipboard-service';`

---

### CliRegistryService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### CommandExecutionService

**Category:** System

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### CommandTrackingService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/classify, scripts/cli-pipeline/database, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/tracking]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/classify, scripts/cli-pipeline/database, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/tracking]
- Total imports found: 49

**Import Examples:**
- `scripts/cli-pipeline/classify/commands/health-check.ts`: `import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';`
- `scripts/cli-pipeline/database/commands/backup/add-backup-table.ts`: `import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service/command-tracking-service';`
- `scripts/cli-pipeline/database/commands/backup/list-backup-config.ts`: `import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service/command-tracking-service';`
- `scripts/cli-pipeline/database/commands/check-and-create-rls-policies.ts`: `import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';`
- `scripts/cli-pipeline/database/commands/connection-test.ts`: `import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';`

---

### ConverterService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### DatabaseMetadataService

**Category:** Database

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### DatabaseService

**Category:** database

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/shared]
- Total imports found: 2

**Import Examples:**
- `scripts/cli-pipeline/shared/services/script-pipeline-service.bak.ts`: `import { DatabaseService } from './database-service';`
- `scripts/cli-pipeline/shared/services/script-pipeline-service.ts`: `import { DatabaseService } from './database-service';`

---

### DevTaskService

**Category:** Task Management

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-admin-code]
- Pipelines: []
- Total imports found: 1

**Import Examples:**
- `apps/dhg-admin-code/src/services/task-service.ts`: `import { DevTaskService } from '@shared/services/dev-task-service';`

---

### DocFilesService

**Category:** documentation

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### DocumentationService

**Category:** documentation

**Registry Data:**
- Apps: []
- Pipelines: [scripts/root/process-documentation.ts]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/root/process-documentation.ts]
- Total imports found: 1

**Import Examples:**
- `scripts/root/process-documentation.ts`: `import { DocumentationService } from '../apps/dhg-improve-experts/src/services/documentationService';`

---

### DocumentClassificationService

**Category:** document

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/.archived_scripts]

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### DocumentPipeline

**Category:** document

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document]

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### DocumentService

**Category:** classification

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/presentations, scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/presentations]
- Total imports found: 1

**Import Examples:**
- `scripts/cli-pipeline/presentations/index.ts`: `import { ExpertDocumentService } from './services/expert-document-service';`

---

### DocumentTypeService

**Category:** document

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/shared]
- Total imports found: 1

**Import Examples:**
- `scripts/cli-pipeline/shared/services/.archive_supabase/document-service.2025-04-13_17-19-48.ts`: `import { DocumentTypeService } from './document-type-service';`

---

### EmailService

**Category:** email

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### EnvConfigService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 1

**Import Examples:**
- `packages/shared/services/env-config-service/env-config-service.ts`: `throw new Error('EnvConfigService should not be used in browser environments. Use createSupabaseAdapter with import.meta.env instead.');`

---

### ExpertService

**Category:** classification

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### FileReader

**Category:** processing

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### FileService

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/ai, scripts/cli-pipeline/document, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/scripts, scripts/cli-pipeline/shared, scripts/cli-pipeline/system, scripts/cli-pipeline/utilities]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/ai, scripts/cli-pipeline/document, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/utilities]
- Total imports found: 20

**Import Examples:**
- `scripts/cli-pipeline/.archived_scripts/display-doc-paths.20250406.ts`: `import { FileService } from '../../packages/cli/src/services/file-service';`
- `scripts/cli-pipeline/ai/.archive_supabase/prompt-lookup.2025-04-13_17-21-32.ts`: `import { FileService, FileResult } from '../../packages/shared/services/file-service/file-service';`
- `scripts/cli-pipeline/ai/prompt-lookup.ts`: `import { FileService } from '../../packages/shared/services/file-service/file-service';`
- `scripts/cli-pipeline/document/.archive_supabase/sync-markdown-files.2025-04-13_17-27-00.ts`: `import { FileService } from '../../packages/cli/src/services/file-service';`
- `scripts/cli-pipeline/document/sync-markdown-files.ts`: `import { FileService } from '../../../packages/shared/services/file-service';`

---

### FileSystemService

**Category:** file-management

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### FilterService

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-google, dhg-admin-suite, dhg-audio, dhg-hub]
- Pipelines: [scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/registry, scripts/cli-pipeline/system]

**Actual Usage:**
- Apps: [dhg-admin-google, dhg-admin-suite, dhg-audio]
- Pipelines: [scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync]
- Total imports found: 23

**Import Examples:**
- `apps/dhg-admin-google/src/utils/filter-service-adapter.ts`: `import { FilterService, FilterProfile, FilterProfileDrive } from '../../../../packages/shared/services/filter-service';`
- `apps/dhg-admin-suite/src/services/drive-filter-service.ts`: `import { FilterService } from '@shared/services/filter-service/filter-service';`
- `apps/dhg-audio/src/components/DebugFilterService.tsx`: `import { FilterService } from '@shared/services/filter-service/filter-service';`
- `apps/dhg-audio/src/components/DriveFilterComboboxDebug.tsx`: `import { FilterService, type FilterProfile } from '@shared/services/filter-service/filter-service';`
- `apps/dhg-audio/src/components/DriveFilterDebug.tsx`: `import { FilterService } from '@shared/services/filter-service/filter-service';`

---

### FolderHierarchyService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync]
- Total imports found: 1

**Import Examples:**
- `scripts/cli-pipeline/google_sync/.archived_scripts/process-new-files.20250526.ts`: `import { createFolderHierarchyService } from '../../../packages/shared/services/folder-hierarchy-service';`

---

### FormatterService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### GitService

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/dev_tasks, scripts/cli-pipeline/system]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/dev_tasks]
- Total imports found: 2

**Import Examples:**
- `scripts/cli-pipeline/dev_tasks/create-with-branch.ts`: `import { gitService } from '../../../packages/shared/services/git-service/git-service';`
- `scripts/cli-pipeline/dev_tasks/start-session.ts`: `import { gitService } from '../../../packages/shared/services/git-service/git-service';`

---

### GmailService

**Category:** email

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/gmail]

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### GoogleDrive

**Category:** google

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-google, dhg-audio]
- Pipelines: [scripts/cli-pipeline/check-find-folder.ts, scripts/cli-pipeline/check-google-sync.ts, scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/system]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]
- Total imports found: 35

**Import Examples:**
- `apps/dhg-admin-google/src/pages/Viewer.tsx`: `import { GoogleDriveExplorerService, FileNode } from '@shared/services/google-drive-explorer';`
- `apps/dhg-admin-google/src/utils/google-drive.ts`: `import { googleDriveBrowser } from '@shared/services/google-drive/google-drive-browser-service';`
- `scripts/cli-pipeline/document/.archived_scripts/test-google-doc-classification.ts`: `import { GoogleDriveService } from '../../../packages/shared/services/google-drive/google-drive-service';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/archived_2025_04_11/add-drive-root.2025-04-11.ts`: `import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/archived_2025_04_11/enhanced-google-sync.2025-04-11.ts`: `import GoogleDriveService from '../packages/shared/services/google-drive/google-drive-service';`

---

### GoogleDriveExplorer

**Category:** google

**Registry Data:**
- Apps: [dhg-admin-google]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: []
- Total imports found: 1

**Import Examples:**
- `apps/dhg-admin-google/src/pages/Viewer.tsx`: `import { GoogleDriveExplorerService, FileNode } from '@shared/services/google-drive-explorer';`

---

### GoogleDriveService

**Category:** google

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/check-find-folder.ts, scripts/cli-pipeline/check-google-sync.ts, scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync]
- Total imports found: 33

**Import Examples:**
- `apps/dhg-admin-google/src/utils/google-drive.ts`: `import { googleDriveBrowser } from '@shared/services/google-drive/google-drive-browser-service';`
- `scripts/cli-pipeline/document/.archived_scripts/test-google-doc-classification.ts`: `import { GoogleDriveService } from '../../../packages/shared/services/google-drive/google-drive-service';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/archived_2025_04_11/add-drive-root.2025-04-11.ts`: `import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/archived_2025_04_11/enhanced-google-sync.2025-04-11.ts`: `import GoogleDriveService from '../packages/shared/services/google-drive/google-drive-service';`
- `scripts/cli-pipeline/google_sync/.archived_scripts/archived_2025_04_11/list-drive-service-account.2025-04-11.ts`: `import { defaultGoogleAuth, getGoogleDriveService } from '../../../packages/shared/services/google-drive';`

---

### GoogleSyncService

**Category:** google

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### GoogleUtils

**Category:** google

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### Index

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [.archived_apps, dhg-a, dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio, dhg-hub, dhg-hub-lovable, dhg-research]
- Pipelines: [scripts/cli-pipeline/.archived_pipelines, scripts/cli-pipeline/ai, scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/database, scripts/cli-pipeline/deprecation, scripts/cli-pipeline/docs, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/email, scripts/cli-pipeline/experts, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/refactor_tracking, scripts/cli-pipeline/registry, scripts/cli-pipeline/service_dependencies, scripts/cli-pipeline/shared, scripts/cli-pipeline/system, scripts/cli-pipeline/tracking, scripts/cli-pipeline/utilities, scripts/cli-pipeline/work_summaries]

**Actual Usage:**
- Apps: [.archived_apps, dhg-a, dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio, dhg-hub, dhg-hub-lovable, dhg-research]
- Pipelines: [scripts/cli-pipeline/deprecation, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics]
- Total imports found: 20

**Import Examples:**
- `apps/.archived_apps/dhg-audio-light.20250525/src/main.tsx`: `import './index.css'`
- `apps/.archived_apps/dhg-audio-magic.20250525/src/main.tsx`: `import './index.css';`
- `apps/.archived_apps/test-audio.20250525/src/main.tsx`: `import './index.css';`
- `apps/dhg-a/src/main.jsx`: `import './index.css'`
- `apps/dhg-admin-code/src/main.tsx`: `import './index.css'`

---

### LightAuthEnhancedService

**Category:** auth

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### LightAuthService

**Category:** auth

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-audio]
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### MediaProcessingService

**Category:** media

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### MediaTrackingService

**Category:** media

**Registry Data:**
- Apps: [dhg-audio]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-audio]
- Pipelines: []
- Total imports found: 2

**Import Examples:**
- `apps/dhg-audio/src/hooks/useMediaTracking.ts`: `import { MediaTrackingService } from '@shared/services/media-tracking-service';`
- `packages/shared/hooks/useMediaTracking.ts`: `import { MediaTrackingService } from '../services/media-tracking-service';`

---

### PdfProcessor

**Category:** processing

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### PdfProcessorService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### PipelineService

**Category:** cli

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/scripts, scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/scripts]
- Total imports found: 6

**Import Examples:**
- `scripts/cli-pipeline/document/.archived_scripts/document-pipeline-runner.20250331.ts`: `import { documentPipelineService } from './scripts/cli-pipeline/document/document-pipeline-service';`
- `scripts/cli-pipeline/document/.archived_scripts/document-pipeline-runner.20250331_from_tmp.ts`: `import { documentPipelineService } from './scripts/cli-pipeline/document/document-pipeline-service';`
- `scripts/cli-pipeline/scripts/script-pipeline-main.ts`: `import { scriptPipelineService } from '../shared/services/script-pipeline-service';`
- `packages/.archived_packages/cli.20250608/src/commands/document-commands.ts`: `import { documentPipelineService } from '@dhg/shared/services';`
- `packages/.archived_packages/cli.20250608/src/commands/script-commands.ts`: `import { scriptPipelineService } from '../services/script-pipeline-service-helpers';`

---

### PromptService

**Category:** ai

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/system, scripts/cli-pipeline/utilities]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/document, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/utilities]
- Total imports found: 28

**Import Examples:**
- `apps/dhg-admin-google/src/App.tsx`: `import { PromptService } from './pages/PromptService';`
- `scripts/cli-pipeline/document/auto-classify.ts`: `import { documentClassifier } from '../../../packages/shared/services/prompt-service/prompt-service';`
- `scripts/cli-pipeline/document/simplified-cli.ts`: `import { documentClassifier } from '../../../packages/shared/services/prompt-service/prompt-service';`
- `scripts/cli-pipeline/presentations/check-prompt.ts`: `import { PromptService } from '../../../packages/shared/services/prompt-service';`
- `scripts/cli-pipeline/presentations/commands/generate-summary.ts`: `import { PromptService } from '../../../../packages/shared/services/prompt-service';`

---

### ReportService

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/document]

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 2

**Import Examples:**
- `packages/.archived_packages/cli.20250608/src/commands/batch-analyze-scripts.ts`: `import { ReportService } from '../services/report-service-helpers';`
- `packages/.archived_packages/cli.20250608/src/commands/classify-markdown.ts`: `import { ReportService } from '../services/report-service-helpers';`

---

### ScriptPipeline

**Category:** utility

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/shared]

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 1

**Import Examples:**
- `packages/.archived_packages/cli.20250608/src/services/script-pipeline-service-helpers.ts`: `import { scriptPipelineService as sharedScriptPipelineService } from '@dhg/shared/services';`

---

### ScriptService

**Category:** scripts

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### ServiceDependencyMapping

**Category:** system

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### SupabaseAdapter

**Category:** adapters

**Registry Data:**
- Apps: [dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio, dhg-hub, dhg-hub-lovable]
- Pipelines: [scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/git]

**Actual Usage:**
- Apps: [dhg-admin-code, dhg-admin-google, dhg-admin-suite, dhg-audio, dhg-hub, dhg-hub-lovable]
- Pipelines: [scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/git]
- Total imports found: 23

**Import Examples:**
- `apps/dhg-admin-code/src/components/EditTaskModal.tsx`: `import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';`
- `apps/dhg-admin-code/src/components/WorktreeCommits.tsx`: `import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';`
- `apps/dhg-admin-code/src/lib/supabase.ts`: `import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';`
- `apps/dhg-admin-code/src/pages/GitManagement.tsx`: `import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';`
- `apps/dhg-admin-code/src/pages/ScriptsManagement.tsx`: `import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';`

---

### SupabaseClient

**Category:** database

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [.archived_apps, dhg-admin-google, dhg-audio, dhg-hub]
- Pipelines: [scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/ai, scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/analysis, scripts/cli-pipeline/analyze-services.ts, scripts/cli-pipeline/auth, scripts/cli-pipeline/check-find-folder.ts, scripts/cli-pipeline/check-google-sync.ts, scripts/cli-pipeline/classify, scripts/cli-pipeline/continuous_docs, scripts/cli-pipeline/core, scripts/cli-pipeline/create-ai-work-summary.ts, scripts/cli-pipeline/database, scripts/cli-pipeline/deprecation, scripts/cli-pipeline/dev_tasks, scripts/cli-pipeline/docs, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/email, scripts/cli-pipeline/experts, scripts/cli-pipeline/fix-service-registry.ts, scripts/cli-pipeline/gmail, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/monitoring, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/refactor_tracking, scripts/cli-pipeline/registry, scripts/cli-pipeline/scripts, scripts/cli-pipeline/service_dependencies, scripts/cli-pipeline/shared, scripts/cli-pipeline/system, scripts/cli-pipeline/tracking, scripts/cli-pipeline/utilities, scripts/cli-pipeline/validate-service-usage.ts, scripts/cli-pipeline/work_summaries]

**Actual Usage:**
- Apps: [dhg-admin-google, dhg-audio]
- Pipelines: [scripts/cli-pipeline/ai, scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/analysis, scripts/cli-pipeline/analyze-services.ts, scripts/cli-pipeline/auth, scripts/cli-pipeline/classify, scripts/cli-pipeline/continuous_docs, scripts/cli-pipeline/core, scripts/cli-pipeline/create-ai-work-summary.ts, scripts/cli-pipeline/database, scripts/cli-pipeline/deprecation, scripts/cli-pipeline/dev_tasks, scripts/cli-pipeline/docs, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/email, scripts/cli-pipeline/experts, scripts/cli-pipeline/fix-service-registry.ts, scripts/cli-pipeline/gmail, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/monitoring, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/refactor_tracking, scripts/cli-pipeline/registry, scripts/cli-pipeline/scripts, scripts/cli-pipeline/service_dependencies, scripts/cli-pipeline/shared, scripts/cli-pipeline/tracking, scripts/cli-pipeline/utilities, scripts/cli-pipeline/validate-service-usage.ts, scripts/cli-pipeline/work_summaries]
- Total imports found: 543

**Import Examples:**
- `apps/dhg-admin-google/src/main.tsx`: `import { getSupabaseClient } from './lib/supabase'`
- `apps/dhg-admin-google/src/pages/Easy.tsx`: `import { supabase, supabaseAdapter } from '@root/packages/shared/services/supabase-client/universal'`
- `apps/dhg-audio/src/pages/DebugPage.tsx`: `import { CompareSupabaseClients } from '@/components/CompareSupabaseClients';`
- `apps/dhg-audio/src/services/light-auth-browser-service.ts`: `import type { User, Session, SupabaseClient } from '@supabase/supabase-js';`
- `scripts/cli-pipeline/ai/.archive_supabase/prompt-lookup.2025-04-13_17-21-32.ts`: `import { createClient, SupabaseClient } from '@supabase/supabase-js';`

---

### SupabaseClientFixed

**Category:** database

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### SupabaseClientService

**Category:** database

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [.archived_apps, dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/.archived_scripts, scripts/cli-pipeline/ai, scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/analysis, scripts/cli-pipeline/analyze-services.ts, scripts/cli-pipeline/auth, scripts/cli-pipeline/check-find-folder.ts, scripts/cli-pipeline/check-google-sync.ts, scripts/cli-pipeline/classify, scripts/cli-pipeline/continuous_docs, scripts/cli-pipeline/core, scripts/cli-pipeline/create-ai-work-summary.ts, scripts/cli-pipeline/database, scripts/cli-pipeline/deprecation, scripts/cli-pipeline/dev_tasks, scripts/cli-pipeline/docs, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/email, scripts/cli-pipeline/experts, scripts/cli-pipeline/fix-service-registry.ts, scripts/cli-pipeline/gmail, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/monitoring, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/refactor_tracking, scripts/cli-pipeline/registry, scripts/cli-pipeline/scripts, scripts/cli-pipeline/service_dependencies, scripts/cli-pipeline/shared, scripts/cli-pipeline/system, scripts/cli-pipeline/tracking, scripts/cli-pipeline/utilities, scripts/cli-pipeline/validate-service-usage.ts, scripts/cli-pipeline/work_summaries]

**Actual Usage:**
- Apps: [dhg-admin-google]
- Pipelines: [scripts/cli-pipeline/ai, scripts/cli-pipeline/all_pipelines, scripts/cli-pipeline/analysis, scripts/cli-pipeline/analyze-services.ts, scripts/cli-pipeline/auth, scripts/cli-pipeline/classify, scripts/cli-pipeline/continuous_docs, scripts/cli-pipeline/core, scripts/cli-pipeline/create-ai-work-summary.ts, scripts/cli-pipeline/database, scripts/cli-pipeline/deprecation, scripts/cli-pipeline/dev_tasks, scripts/cli-pipeline/docs, scripts/cli-pipeline/document, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/email, scripts/cli-pipeline/experts, scripts/cli-pipeline/fix-service-registry.ts, scripts/cli-pipeline/gmail, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-analytics, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/monitoring, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/refactor_tracking, scripts/cli-pipeline/registry, scripts/cli-pipeline/scripts, scripts/cli-pipeline/service_dependencies, scripts/cli-pipeline/shared, scripts/cli-pipeline/tracking, scripts/cli-pipeline/utilities, scripts/cli-pipeline/validate-service-usage.ts, scripts/cli-pipeline/work_summaries]
- Total imports found: 506

**Import Examples:**
- `apps/dhg-admin-google/src/pages/Easy.tsx`: `import { supabase, supabaseAdapter } from '@root/packages/shared/services/supabase-client/universal'`
- `scripts/cli-pipeline/ai/create-work-summary.ts`: `import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';`
- `scripts/cli-pipeline/ai/prompt-lookup.ts`: `import { SupabaseClientService } from '../../packages/shared/services/supabase-client';`
- `scripts/cli-pipeline/all_pipelines/assign-pipeline-categories.ts`: `import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';`
- `scripts/cli-pipeline/all_pipelines/check-command-tracking.ts`: `import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';`

---

### SupabaseHelpers

**Category:** database

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### SupabaseService

**Category:** database

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/ai, scripts/cli-pipeline/media-processing]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/ai, scripts/cli-pipeline/media-processing]
- Total imports found: 9

**Import Examples:**
- `scripts/cli-pipeline/ai/.archive_supabase/prompt-lookup.2025-04-13_17-21-32.ts`: `import { SupabaseService } from '../../packages/shared/services/supabase-service/supabase-service';`
- `scripts/cli-pipeline/ai/prompt-lookup.ts`: `import { SupabaseService } from '../../packages/shared/services/supabase-service/supabase-service';`
- `scripts/cli-pipeline/media-processing/commands/check-status.ts`: `import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';`
- `scripts/cli-pipeline/media-processing/commands/link-assets.ts`: `import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';`
- `scripts/cli-pipeline/media-processing/commands/manage-presentations.ts`: `import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';`

---

### SystemService

**Category:** system

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### TaskService

**Category:** system

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-admin-code]
- Pipelines: []
- Total imports found: 8

**Import Examples:**
- `apps/dhg-admin-code/src/components/EditTaskModal.tsx`: `import { TaskService, type DevTask } from '../services/task-service';`
- `apps/dhg-admin-code/src/components/TaskCard.tsx`: `import { TaskService, type DevTask } from '../services/task-service';`
- `apps/dhg-admin-code/src/pages/CreateTaskPage.tsx`: `import { TaskService } from '../services/task-service';`
- `apps/dhg-admin-code/src/pages/TaskDetailPage.tsx`: `import { TaskService } from '../services/task-service';`
- `apps/dhg-admin-code/src/pages/TasksPage.tsx`: `import { TaskService } from '../services/task-service';`

---

### ThemeService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### TrackingService

**Category:** utility

**Registry Data:**
- Apps: [dhg-audio]
- Pipelines: [scripts/cli-pipeline/classify, scripts/cli-pipeline/database, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/tracking]

**Actual Usage:**
- Apps: [dhg-audio]
- Pipelines: [scripts/cli-pipeline/classify, scripts/cli-pipeline/database, scripts/cli-pipeline/document_types, scripts/cli-pipeline/drive_filter, scripts/cli-pipeline/google_sync, scripts/cli-pipeline/media-processing, scripts/cli-pipeline/mime_types, scripts/cli-pipeline/presentations, scripts/cli-pipeline/prompt_service, scripts/cli-pipeline/tracking]
- Total imports found: 59

**Import Examples:**
- `apps/dhg-audio/src/hooks/useMediaTracking.ts`: `import { MediaTrackingService } from '@shared/services/media-tracking-service';`
- `scripts/cli-pipeline/classify/commands/health-check.ts`: `import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';`
- `scripts/cli-pipeline/database/commands/backup/add-backup-table-cmd.ts`: `import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service';`
- `scripts/cli-pipeline/database/commands/backup/add-backup-table.ts`: `import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service/command-tracking-service';`
- `scripts/cli-pipeline/database/commands/backup/create-backup-cmd.ts`: `import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service';`

---

### TranscriptionService

**Category:** media

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/media-processing]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/media-processing]
- Total imports found: 2

**Import Examples:**
- `scripts/cli-pipeline/media-processing/commands/transcribe-audio.ts`: `import { AudioTranscriptionService } from '../../../../packages/shared/services/audio-transcription/audio-transcription-service';`
- `scripts/cli-pipeline/media-processing/commands/transcribe-with-summary.ts`: `import { AudioTranscriptionService } from '../../../../packages/shared/services/audio-transcription/audio-transcription-service';`

---

### UnifiedClassificationService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync]

**Actual Usage:**
- Apps: []
- Pipelines: [scripts/cli-pipeline/google_sync]
- Total imports found: 3

**Import Examples:**
- `scripts/cli-pipeline/google_sync/classify.ts`: `import { SupportedFileType } from '../../../packages/shared/services/unified-classification-service/types';`
- `packages/shared/services/unified-classification-service/integration.test.ts`: `import { UnifiedClassificationService } from './unified-classification-service';`
- `packages/shared/services/unified-classification-service/unified-classification-service.test.ts`: `import { UnifiedClassificationService } from './unified-classification-service';`

---

### UserProfileService

**Category:** utility

**Registry Data:**
- Apps: []
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### WorkSummaryService

**Category:** Work Tracking

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: [dhg-admin-code]
- Pipelines: []
- Total imports found: 2

**Import Examples:**
- `apps/dhg-admin-code/src/pages/WorkSummaries.tsx`: `import { WorkSummaryService, type WorkSummary, type WorkItem } from '@shared/services/work-summary-service';`
- `apps/dhg-admin-code/src/pages/WorkSummariesEnhanced.tsx`: `import { WorkSummaryService, type WorkSummary, type WorkItem } from '@shared/services/work-summary-service';`

---

### WorktreeManagementService

**Category:** Git Management

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

### WorktreeService

**Category:** system

⚠️ **DISCREPANCY DETECTED**

**Registry Data:**
- Apps: [dhg-admin-code]
- Pipelines: []

**Actual Usage:**
- Apps: []
- Pipelines: []
- Total imports found: 0

---

