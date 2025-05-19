# DHG CLI Pipeline & Shared Services Architecture Overview

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
   - [CLI Pipeline Design](#cli-pipeline-design)
   - [Shared Services Design](#shared-services-design)
   - [Integration Pattern](#integration-pattern)
3. [CLI Pipelines](#cli-pipelines)
   - [Google Drive Sync Pipeline](#google-drive-sync-pipeline)
   - [Document Pipeline](#document-pipeline)
   - [Media Processing Pipeline](#media-processing-pipeline)
   - [Presentations Pipeline](#presentations-pipeline)
   - [Prompt Service Pipeline](#prompt-service-pipeline)
   - [Scripts Pipeline](#scripts-pipeline)
   - [Tracking Pipeline](#tracking-pipeline)
   - [All Pipelines (Master CLI)](#all-pipelines-master-cli)
4. [Shared Services](#shared-services)
   - [Database Services](#database-services)
   - [Document Services](#document-services)
   - [AI Services](#ai-services)
   - [File/Media Services](#filemedia-services)
   - [Utility Services](#utility-services)
5. [Development Patterns](#development-patterns)
   - [Command Implementation Pattern](#command-implementation-pattern)
   - [Service Singleton Pattern](#service-singleton-pattern)
   - [Error Handling Pattern](#error-handling-pattern)
   - [Command Tracking Pattern](#command-tracking-pattern)
6. [Common Tasks & Quick Reference](#common-tasks--quick-reference)
   - [Database Operations](#database-operations)
   - [Claude AI Integration](#claude-ai-integration)
   - [Google Drive Integration](#google-drive-integration)
   - [Document Classification](#document-classification)
   - [Media Processing](#media-processing)

## Introduction

The DHG CLI Pipeline ecosystem is a comprehensive system for document management, classification, and processing. It consists of domain-specific command-line interfaces organized into pipeline directories, a robust shared services architecture, and integrated documentation. This overview provides a comprehensive guide to the CLI pipelines, shared services, and development patterns that form the backbone of the system.

The system follows a consistent design philosophy:
- **Shared Services First**: Reusable functionality lives in shared services
- **Singleton Pattern**: Services are implemented as singletons
- **Shell + TypeScript**: CLI commands have shell wrappers and TypeScript implementations
- **Command Tracking**: All commands are tracked for auditing and usage analysis
- **Comprehensive Documentation**: Each component is thoroughly documented

## Architecture Overview

### CLI Pipeline Design

The CLI pipeline architecture follows a two-layer pattern:

1. **Shell Wrapper Layer**:
   - User-facing interface via `.sh` files
   - Environment setup and credential management
   - Command routing and argument parsing
   - Implementation tracking

2. **TypeScript Implementation Layer**:
   - Commander.js-based command structure
   - Business logic implementation
   - Integration with shared services
   - Error handling and reporting

Each CLI pipeline is self-contained in its own directory under `scripts/cli-pipeline/`, with standardized:
- Command structure
- Documentation
- Error handling
- Execution tracking

### Shared Services Design

The shared services follow a singleton pattern and provide reusable functionality across the application:

- **Service Initialization**: Services are initialized using a singleton pattern
- **Configuration Management**: Environment-specific configuration
- **Error Handling**: Comprehensive error handling and reporting
- **Cross-Service Integration**: Services integrate with each other as needed

### Integration Pattern

CLI pipelines and shared services integrate through a consistent pattern:

1. CLI commands import shared services
2. Services use other services as needed
3. Service configuration is environment-aware
4. Error handling follows a consistent pattern across the system

## CLI Pipelines

The CLI pipeline ecosystem consists of several domain-specific pipelines, each with its own set of commands and functionality. Each pipeline follows the two-layer architecture described above.

### Google Drive Sync Pipeline

**Location**: `scripts/cli-pipeline/google_sync/`

**Purpose**: Synchronize files, folders, and metadata between Google Drive and the database.

**Key Commands**:
- `sync-folders`: Synchronize folder structure from Google Drive
- `sync-files`: Synchronize files from Google Drive
- `sync-drive`: Full Google Drive synchronization
- `update-metadata`: Update file metadata in the database
- `download-file`: Download a specific file from Google Drive
- `search-drive`: Search files and folders in Google Drive
- `list-folders`: List folders from Google Drive
- `configure-sync`: Configure synchronization settings

**Integration Points**:
- Google Drive Service for API interaction
- Supabase Client Service for database operations
- Command Tracking Service for execution tracking

### Document Pipeline

**Location**: `scripts/cli-pipeline/document/`

**Purpose**: Process, classify, and manage documents from various sources.

**Key Commands**:
- `process-documents`: Process documents through the classification pipeline
- `classify-documents`: Classify documents using Claude AI
- `update-document-types`: Update document type information
- `update-document-status`: Update processing status for documents
- `validate-documents`: Validate document classification
- `batch-process`: Process documents in batches
- `report-status`: Generate document processing status reports

**Integration Points**:
- Document Classification Service for AI-based classification
- Claude Service for AI integration
- Supabase Service for database operations
- File Service for file operations

### Media Processing Pipeline

**Location**: `scripts/cli-pipeline/media-processing/`

**Purpose**: Process, transcribe, and manage media files.

**Key Commands**:
- `process-mp4`: Process MP4 video files
- `process-m4a`: Process M4A audio files
- `transcribe-media`: Generate transcripts for media files
- `process-summary`: Generate summaries for media content
- `batch-process-media`: Process media files in batches
- `report-transcription-status`: Report on transcription status

**Integration Points**:
- Audio Transcription Service for media transcription
- Claude Service for AI-based summarization
- File Service for file operations
- Google Drive Service for file retrieval
- Supabase Service for database operations

### Presentations Pipeline

**Location**: `scripts/cli-pipeline/presentations/`

**Purpose**: Manage presentation assets and generate summaries.

**Key Commands**:
- `sync-presentations`: Synchronize presentation information
- `generate-summary`: Generate summaries for presentations
- `update-presentation-status`: Update presentation processing status
- `link-presentation-assets`: Link assets to presentations
- `report-presentation-status`: Report on presentation status

**Integration Points**:
- Claude Service for AI-based summarization
- Supabase Service for database operations
- File Service for file operations

### Prompt Service Pipeline

**Location**: `scripts/cli-pipeline/prompt_service/`

**Purpose**: Manage and deploy prompts for AI services.

**Key Commands**:
- `load-prompt`: Load a prompt template from file
- `get-prompt`: Retrieve a prompt from the database
- `update-prompt`: Update a prompt template
- `list-prompts`: List available prompts
- `create-prompt`: Create a new prompt template
- `associate-template`: Associate an output template with a prompt
- `manage-output-templates`: Manage prompt output templates

**Integration Points**:
- Claude Service for AI integration
- Supabase Service for database operations
- File Service for file operations

### Scripts Pipeline

**Location**: `scripts/cli-pipeline/scripts/`

**Purpose**: Analyze, manage, and document scripts.

**Key Commands**:
- `analyze-scripts`: Analyze script content using Claude AI
- `scan-scripts`: Scan for scripts in the repository
- `categorize-scripts`: Categorize scripts by functionality
- `report-scripts`: Generate reports on script usage
- `validate-scripts`: Validate script functionality

**Integration Points**:
- Claude Service for AI-based analysis
- File Service for file operations
- Supabase Service for database operations

### Tracking Pipeline

**Location**: `scripts/cli-pipeline/tracking/`

**Purpose**: Track and analyze command execution.

**Key Commands**:
- `history`: Show command execution history
- `report-usage`: Generate usage reports for commands
- `analyze-trends`: Analyze command usage trends
- `export-tracking`: Export tracking data

**Integration Points**:
- Supabase Service for database operations
- Report Service for report generation

### All Pipelines (Master CLI)

**Location**: `scripts/cli-pipeline/all_pipelines/`

**Purpose**: Provide a unified interface for managing all pipelines.

**Key Commands**:
- `health-check`: Check health of all pipeline services
- `list-pipelines`: List available pipelines
- `report-status`: Generate consolidated status reports
- `check-service`: Check specific service health

**Integration Points**:
- All pipeline services for health checks
- Report Service for report generation
- Command Tracking Service for execution tracking

## Shared Services

The shared services provide reusable functionality across the application. Each service follows the singleton pattern and provides a specific set of capabilities.

### Database Services

#### Supabase Client Service

**Location**: `packages/shared/services/supabase-client/`

**Purpose**: Provide a unified interface for interacting with Supabase.

**Key Features**:
- Environment-specific client initialization
- Connection testing and diagnostics
- Error handling and logging
- Database query abstraction

**Usage Pattern**:
```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

#### Database Service

**Location**: `packages/shared/services/database-service/`

**Purpose**: Provide database operations abstraction.

**Key Features**:
- Transaction handling
- Query building and execution
- Error handling and retry mechanisms
- Query optimization

**Usage Pattern**:
```typescript
import { databaseService } from '../../../packages/shared/services/database-service';
const results = await databaseService.executeQuery('tableName', queryOptions);
```

### Document Services

#### Document Classification Service

**Location**: `packages/shared/services/document-classification-service/`

**Purpose**: Classify documents using AI and rule-based approaches.

**Key Features**:
- Integration with Claude AI for document classification
- Rule-based classification fallbacks
- Document type management
- Classification reporting

**Usage Pattern**:
```typescript
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';
const classification = await documentClassificationService.classifyDocument(documentContent);
```

#### Document Pipeline Service

**Location**: `packages/shared/services/document-pipeline/`

**Purpose**: Process documents through the classification pipeline.

**Key Features**:
- End-to-end document processing
- Status tracking and reporting
- Error handling and recovery
- Batch processing capabilities

**Usage Pattern**:
```typescript
import { documentPipelineService } from '../../../packages/shared/services/document-pipeline';
await documentPipelineService.processDocument(documentId);
```

#### Document Type Service

**Location**: `packages/shared/services/document-type-service/`

**Purpose**: Manage document types and their metadata.

**Key Features**:
- Document type fetching and caching
- Type validation and verification
- Metadata management
- Relationship handling

**Usage Pattern**:
```typescript
import { documentTypeService } from '../../../packages/shared/services/document-type-service';
const documentTypes = await documentTypeService.getDocumentTypes();
```

### AI Services

#### Claude Service

**Location**: `packages/shared/services/claude-service/`

**Purpose**: Interact with Claude AI API.

**Key Features**:
- API request handling with authentication
- Text prompt processing
- JSON response parsing
- Error handling and rate limiting

**Usage Pattern**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
const response = await claudeService.sendPrompt('Your prompt');
```

#### Prompt Service

**Location**: `packages/shared/services/prompt-service/`

**Purpose**: Manage and deploy prompts for AI services.

**Key Features**:
- Prompt template management
- Template variable substitution
- Output template association
- Prompt versioning

**Usage Pattern**:
```typescript
import { promptService } from '../../../packages/shared/services/prompt-service';
const prompt = await promptService.getPrompt('prompt-name', variables);
```

### File/Media Services

#### File Service

**Location**: `packages/shared/services/file-service/`

**Purpose**: Handle file operations across the application.

**Key Features**:
- File reading and writing
- Directory operations
- File searching and filtering
- Temporary file management

**Usage Pattern**:
```typescript
import { fileService } from '../../../packages/shared/services/file-service';
const fileContent = await fileService.readFile(filePath);
```

#### Google Drive Service

**Location**: `packages/shared/services/google-drive/`

**Purpose**: Interact with Google Drive API.

**Key Features**:
- Authentication and authorization
- File and folder operations
- Search capabilities
- Batch operations

**Usage Pattern**:
```typescript
import { googleDriveService } from '../../../packages/shared/services/google-drive';
const files = await googleDriveService.listFiles(folderId);
```

#### Audio Transcription Service

**Location**: `packages/shared/services/audio-transcription/`

**Purpose**: Transcribe audio files to text.

**Key Features**:
- Audio file processing
- Transcription generation
- Format conversion
- Error handling

**Usage Pattern**:
```typescript
import { audioTranscriptionService } from '../../../packages/shared/services/audio-transcription';
const transcript = await audioTranscriptionService.transcribeAudio(audioFilePath);
```

#### PDF Processor Service

**Location**: `packages/shared/services/pdf-processor-service/`

**Purpose**: Process and extract content from PDF files.

**Key Features**:
- PDF text extraction
- Content parsing and cleanup
- Image extraction
- Structure analysis

**Usage Pattern**:
```typescript
import { pdfProcessorService } from '../../../packages/shared/services/pdf-processor-service';
const pdfContent = await pdfProcessorService.extractText(pdfFilePath);
```

### Utility Services

#### Formatter Service

**Location**: `packages/shared/services/formatter-service/`

**Purpose**: Format text, dates, and numbers consistently.

**Key Features**:
- Text formatting
- Date formatting and parsing
- Number formatting
- JSON formatting

**Usage Pattern**:
```typescript
import { formatterService } from '../../../packages/shared/services/formatter-service';
const formattedDate = formatterService.formatDate(date);
```

#### Converter Service

**Location**: `packages/shared/services/converter-service/`

**Purpose**: Convert between different file formats.

**Key Features**:
- File format conversion
- Data format transformation
- Encoding and decoding
- Type conversion utilities

**Usage Pattern**:
```typescript
import { converterService } from '../../../packages/shared/services/converter-service';
const convertedContent = await converterService.convertFile(sourcePath, targetFormat);
```

#### Filter Service

**Location**: `packages/shared/services/filter-service/`

**Purpose**: Apply filters to database queries and collections.

**Key Features**:
- Query filter building
- Collection filtering
- Sorting utilities
- Pagination handling

**Usage Pattern**:
```typescript
import { filterService } from '../../../packages/shared/services/filter-service';
const filteredQuery = filterService.applyFilters(baseQuery, filters);
```

#### Report Service

**Location**: `packages/shared/services/report-service/`

**Purpose**: Generate reports for various services.

**Key Features**:
- Report generation
- Data formatting
- Export capabilities
- Template-based reporting

**Usage Pattern**:
```typescript
import { reportService } from '../../../packages/shared/services/report-service';
const report = await reportService.generateReport(reportType, data);
```

#### Tracking Service

**Location**: `packages/shared/services/tracking-service/`

**Purpose**: Track command execution and usage.

**Key Features**:
- Command tracking
- Usage analytics
- Audit trail generation
- Performance metrics

**Usage Pattern**:
```typescript
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
const trackingId = await commandTrackingService.startTracking('pipeline', 'command');
```

## Development Patterns

The DHG CLI Pipeline system follows consistent development patterns across its components. Understanding these patterns is essential for maintaining and extending the system.

### Command Implementation Pattern

All CLI commands follow a consistent implementation pattern:

1. **Shell Wrapper**:
```bash
command_name() {
  # Validate inputs
  # ...
  
  # Track command execution
  track_command "command-name" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/command-file.ts $@"
}
```

2. **TypeScript Implementation**:
```typescript
import { Command } from 'commander';
const program = new Command();

program
  .command('command-name')
  .description('Command description')
  .option('-o, --option', 'Option description')
  .action(async (options) => {
    try {
      // Command implementation
      // ...
      console.log('Command completed successfully');
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });
```

### Service Singleton Pattern

All shared services follow a singleton pattern:

```typescript
export class ServiceName {
  private static instance: ServiceName;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }
  
  // Service methods
  public async serviceMethod(): Promise<Result> {
    // Implementation
  }
}

// Export singleton instance
export const serviceName = ServiceName.getInstance();
```

### Error Handling Pattern

Error handling follows a consistent pattern:

```typescript
try {
  // Operation that might fail
  const result = await riskyOperation();
  
  // Handle success
  return result;
} catch (error) {
  // Log error details
  console.error('Operation failed:', error);
  
  // Provide context
  const contextualError = new Error(`Failed to perform operation: ${error.message}`);
  
  // Preserve stack trace
  contextualError.stack = error.stack;
  
  // Rethrow with context
  throw contextualError;
}
```

### Command Tracking Pattern

Command tracking follows a consistent pattern:

```typescript
// In shell script
track_command() {
  local pipeline_name="pipeline_name"
  local command_name="$1"
  shift
  local full_command="$@"
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

// In TypeScript
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

async function trackedOperation() {
  const startTime = new Date();
  const trackingId = await commandTrackingService.startTracking('pipeline', 'command');
  
  try {
    // Command implementation
    // ...
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: 123,
      summary: 'Command completed successfully'
    });
  } catch (error) {
    await commandTrackingService.failTracking(
      trackingId,
      `Command failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
```

## Common Tasks & Quick Reference

### Database Operations

**Get Supabase Client**:
```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

**Basic Query**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('column1, column2')
  .limit(10);

if (error) {
  console.error('Query error:', error);
  throw new Error(`Failed to query data: ${error.message}`);
}
```

**Insert Record**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({
    column1: value1,
    column2: value2
  })
  .select();

if (error) {
  console.error('Insert error:', error);
  throw new Error(`Failed to insert record: ${error.message}`);
}
```

**Update Record**:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .update({ 
    column1: newValue1,
    column2: newValue2
  })
  .eq('id', recordId)
  .select();

if (error) {
  console.error('Update error:', error);
  throw new Error(`Failed to update record: ${error.message}`);
}
```

### Claude AI Integration

**Send Text Prompt**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

const response = await claudeService.sendPrompt('Your prompt');
```

**Get JSON Response**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

const jsonResponse = await claudeService.getJsonResponse('Your prompt');
```

**Classify Document**:
```typescript
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';

const classification = await documentClassificationService.classifyDocument(documentContent);
```

### Google Drive Integration

**List Files**:
```typescript
import { googleDriveService } from '../../../packages/shared/services/google-drive';

const files = await googleDriveService.listFiles(folderId);
```

**Download File**:
```typescript
import { googleDriveService } from '../../../packages/shared/services/google-drive';

const fileContent = await googleDriveService.downloadFile(fileId, localPath);
```

**Search Files**:
```typescript
import { googleDriveService } from '../../../packages/shared/services/google-drive';

const searchResults = await googleDriveService.searchFiles(query);
```

### Document Classification

**Classify Document**:
```typescript
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';

const classification = await documentClassificationService.classifyDocument(documentContent);
```

**Update Document Type**:
```typescript
import { documentTypeService } from '../../../packages/shared/services/document-type-service';

await documentTypeService.updateDocumentType(documentId, documentTypeId);
```

**Process Document**:
```typescript
import { documentPipelineService } from '../../../packages/shared/services/document-pipeline';

await documentPipelineService.processDocument(documentId);
```

### Media Processing

**Transcribe Audio**:
```typescript
import { audioTranscriptionService } from '../../../packages/shared/services/audio-transcription';

const transcript = await audioTranscriptionService.transcribeAudio(audioFilePath);
```

**Process Media File**:
```typescript
import { mediaProcessingService } from '../../../packages/shared/services/media-processing';

await mediaProcessingService.processMediaFile(mediaFilePath);
```

**Generate Summary**:
```typescript
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

const summary = await claudeService.sendPrompt(`Summarize the following transcript: ${transcript}`);
```

---

This overview provides a comprehensive guide to the DHG CLI Pipeline ecosystem, covering CLI pipelines, shared services, development patterns, and common tasks. For more detailed information on specific components, refer to the corresponding documentation in the `docs/cli-pipeline/` directory.