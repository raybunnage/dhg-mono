# DHG CLI Pipelines Documentation

> This document is continuously updated to reflect the latest state of all CLI pipelines in the DHG monorepo.  
> Last updated: 2025-01-06

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pipeline Summary](#pipeline-summary)
4. [Google Sync Pipeline](#google-sync-pipeline)
5. [Document Pipeline](#document-pipeline)
6. [Media Processing Pipeline](#media-processing-pipeline)
7. [Presentations Pipeline](#presentations-pipeline)
8. [Prompt Service Pipeline](#prompt-service-pipeline)
9. [Scripts Pipeline](#scripts-pipeline)
10. [Document Types Pipeline](#document-types-pipeline)
11. [Database Pipeline](#database-pipeline)
12. [Authentication Pipeline](#authentication-pipeline)
13. [Documentation Pipeline](#documentation-pipeline)
14. [Tracking Pipeline](#tracking-pipeline)
15. [All Pipelines (Master CLI)](#all-pipelines-master-cli)
16. [Development Guidelines](#development-guidelines)
17. [Command Registry](#command-registry)

## Overview

The DHG CLI Pipeline ecosystem provides command-line interfaces for managing various aspects of the Dynamic Healing system. Each pipeline is domain-specific and follows a consistent two-layer architecture:

1. **Shell Wrapper Layer** (`.sh` files) - User-facing interface
2. **TypeScript Implementation Layer** - Business logic using Commander.js

All pipelines integrate with shared services and implement command tracking for auditing and analytics.

## Architecture

### Directory Structure
```
scripts/cli-pipeline/
├── all_pipelines/     # Master CLI for all pipelines
├── auth/              # Authentication management
├── database/          # Database operations
├── document/          # Document processing
├── document_types/    # Document type management
├── documentation/     # Documentation management
├── google_sync/       # Google Drive synchronization
├── media-processing/  # Media file processing
├── presentations/     # Presentation management
├── prompt_service/    # AI prompt management
├── scripts/           # Script analysis
└── tracking/          # Command tracking
```

### Design Principles
- **Domain Separation**: Each pipeline handles a specific domain
- **Shared Services**: Reuse functionality from `packages/shared/services`
- **Command Tracking**: All commands are tracked for analytics
- **Consistent Interface**: Standardized command structure
- **Error Handling**: Comprehensive error handling and reporting

## Pipeline Summary

| Pipeline | Purpose | Key Commands | Status |
|----------|---------|--------------|--------|
| google_sync | Google Drive synchronization | sync, find-folder, check-duplicates | Active |
| document | Document classification & processing | classify, process-batch, validate | Active |
| media-processing | Audio/video transcription | transcribe, process-mp4, extract-audio | Active |
| presentations | Presentation management | sync, generate-summary, update-status | Active |
| prompt_service | AI prompt management | load, get, update, list | Active |
| scripts | Script analysis & management | analyze, scan, categorize | Active |
| document_types | Document type operations | list, create, update, validate | Active |
| database | Database migrations & operations | migration, backup, query | Active |
| auth | Authentication management | make-admin, check-audit, reset-password | Active |
| documentation | Documentation tracking | add-continuous, update-continuous | Active |
| tracking | Command usage analytics | history, report, analyze | Active |
| all_pipelines | Master control interface | health-check, populate-registry | Active |

## Google Sync Pipeline

### Location
`scripts/cli-pipeline/google_sync/`

### Purpose
Synchronize files, folders, and metadata between Google Drive and the database.

### Key Commands

#### sync
```bash
./google-sync-cli.sh sync [options]
```
- Performs full synchronization of Google Drive content
- Options: `--folder-id`, `--recursive`, `--dry-run`
- Updates `google_sources` table with file metadata

#### find-folder
```bash
./google-sync-cli.sh find-folder <name>
```
- Searches for folders by name in Google Drive
- Returns folder IDs and paths
- Useful for identifying sync targets

#### check-duplicates
```bash
./google-sync-cli.sh check-duplicates [--check-current]
```
- Identifies duplicate files in the database
- `--check-current`: Verifies if files still exist in Drive
- Helps maintain data integrity

#### sync-single-file
```bash
./google-sync-cli.sh sync-single-file <drive-id>
```
- Synchronizes a specific file by Drive ID
- Updates metadata and relationships
- Useful for targeted updates

### Database Tables
- `google_sources`: File and folder metadata
- `google_sync_history`: Sync operation logs
- `google_sync_statistics`: Performance metrics

### Recent Updates
- Added recursive folder synchronization
- Improved duplicate detection algorithm
- Enhanced error handling for API limits
- Added dry-run mode for testing

## Document Pipeline

### Location
`scripts/cli-pipeline/document/`

### Purpose
Process, classify, and manage documents using AI-powered classification.

### Key Commands

#### classify
```bash
./document-cli.sh classify <file-id> [options]
```
- Classifies a document using Claude AI
- Options: `--force`, `--document-type`
- Updates classification in database

#### process-batch
```bash
./document-cli.sh process-batch [options]
```
- Processes multiple documents in batch
- Options: `--limit`, `--offset`, `--filter`
- Implements rate limiting for API calls

#### validate
```bash
./document-cli.sh validate [options]
```
- Validates document classifications
- Checks for consistency and completeness
- Generates validation reports

#### report
```bash
./document-cli.sh report [type]
```
- Generates various document reports
- Types: `status`, `classification`, `errors`
- Outputs to console or file

### Database Tables
- `doc_files`: Document metadata and content
- `learn_document_classifications`: Classification results
- `batch_processing`: Batch operation tracking

### Integration Points
- Claude Service for AI classification
- Document Type Service for type management
- Supabase for database operations

## Media Processing Pipeline

### Location
`scripts/cli-pipeline/media-processing/`

### Purpose
Process audio and video files for transcription and analysis.

### Key Commands

#### transcribe
```bash
./media-processing-cli.sh transcribe <file-id> [options]
```
- Transcribes audio/video content
- Options: `--model`, `--language`
- Stores transcripts in database

#### process-mp4
```bash
./media-processing-cli.sh process-mp4 <file-id>
```
- Extracts audio from MP4 files
- Processes for transcription
- Updates media metadata

#### extract-audio
```bash
./media-processing-cli.sh extract-audio <video-id> [output-path]
```
- Extracts audio track from video
- Converts to M4A format
- Optimizes for transcription

#### generate-summary
```bash
./media-processing-cli.sh generate-summary <transcript-id>
```
- Creates AI-powered summaries
- Uses Claude for content analysis
- Stores summaries with metadata

### Database Tables
- `media_transcripts`: Transcription results
- `media_summaries`: AI-generated summaries
- `media_processing_queue`: Processing job queue

### Technical Details
- Uses Whisper for transcription
- Supports multiple audio formats
- Implements chunking for large files
- Handles concurrent processing

## Presentations Pipeline

### Location
`scripts/cli-pipeline/presentations/`

### Purpose
Manage presentation metadata and generate comprehensive summaries.

### Key Commands

#### sync
```bash
./presentations-cli.sh sync
```
- Synchronizes presentation data
- Links videos, documents, and assets
- Updates presentation metadata

#### generate-summary
```bash
./presentations-cli.sh generate-summary <presentation-id>
```
- Creates comprehensive summaries
- Combines video, slides, and documents
- Uses AI for content synthesis

#### link-assets
```bash
./presentations-cli.sh link-assets <presentation-id>
```
- Associates related files with presentations
- Identifies slides, handouts, resources
- Updates `presentation_assets` table

### Database Tables
- `media_presentations`: Core presentation data
- `media_presentation_assets`: Related files
- `presentation_summaries`: Generated summaries

## Prompt Service Pipeline

### Location
`scripts/cli-pipeline/prompt_service/`

### Purpose
Manage and deploy AI prompts for various services.

### Key Commands

#### load
```bash
./prompt-service-cli.sh load <prompt-file>
```
- Loads prompt from file to database
- Validates prompt structure
- Assigns unique identifier

#### get
```bash
./prompt-service-cli.sh get <prompt-name>
```
- Retrieves prompt by name
- Shows template and variables
- Displays usage examples

#### update
```bash
./prompt-service-cli.sh update <prompt-id> <prompt-file>
```
- Updates existing prompt
- Maintains version history
- Validates changes

#### list
```bash
./prompt-service-cli.sh list [--category]
```
- Lists all available prompts
- Filters by category
- Shows usage statistics

### Database Tables
- `ai_prompts`: Prompt templates
- `ai_prompt_categories`: Categorization
- `ai_prompt_relationships`: Prompt dependencies

## Scripts Pipeline

### Location
`scripts/cli-pipeline/scripts/`

### Purpose
Analyze and manage scripts across the repository.

### Key Commands

#### analyze
```bash
./scripts-cli.sh analyze <script-path>
```
- Analyzes script using Claude AI
- Extracts purpose and functionality
- Identifies dependencies

#### scan
```bash
./scripts-cli.sh scan [directory]
```
- Scans for scripts in directory
- Updates script registry
- Identifies new/changed scripts

#### categorize
```bash
./scripts-cli.sh categorize
```
- Groups scripts by functionality
- Updates categorization
- Generates category reports

### Database Tables
- `scripts_registry`: Script metadata
- `script_analysis`: AI analysis results
- `script_categories`: Categorization

## Document Types Pipeline

### Location
`scripts/cli-pipeline/document_types/`

### Purpose
Manage document type definitions and relationships.

### Key Commands

#### list
```bash
./document-types-cli.sh list [--active]
```
- Lists all document types
- Shows usage statistics
- Filters by status

#### create
```bash
./document-types-cli.sh create <name> <category>
```
- Creates new document type
- Sets initial properties
- Validates uniqueness

#### update
```bash
./document-types-cli.sh update <type-id> [options]
```
- Updates document type properties
- Options: `--name`, `--category`, `--active`
- Maintains change history

### Database Tables
- `document_types`: Type definitions
- `document_type_categories`: Categories
- `document_type_relationships`: Type hierarchy

## Database Pipeline

### Location
`scripts/cli-pipeline/database/`

### Purpose
Database migrations, maintenance, and operations.

### Key Commands

#### migration validate
```bash
./database-cli.sh migration validate <migration.sql>
```
- Validates migration syntax
- Checks for conflicts
- Tests reversibility

#### migration run-staged
```bash
./database-cli.sh migration run-staged <migration.sql>
```
- Applies migration to database
- Updates types.ts automatically
- Records in migration history

#### backup
```bash
./database-cli.sh backup [--tables]
```
- Creates database backup
- Options for specific tables
- Stores in secure location

### Database Tables
- `sys_migrations`: Migration history
- `sys_table_definitions`: Table metadata

## Authentication Pipeline

### Location
`scripts/cli-pipeline/auth/`

### Purpose
User authentication and access management.

### Key Commands

#### make-admin
```bash
./auth-cli.sh make-admin <email>
```
- Grants admin privileges to user
- Updates role in database
- Sends notification email

#### check-audit
```bash
./auth-cli.sh check-audit [--user <email>]
```
- Reviews authentication logs
- Filters by user or time
- Identifies suspicious activity

#### reset-password
```bash
./auth-cli.sh reset-password <email>
```
- Sends password reset email
- Logs reset attempt
- Expires after 24 hours

### Database Tables
- `auth_user_profiles`: User profiles
- `auth_audit_log`: Authentication events
- `auth_allowed_emails`: Email allowlist

## Documentation Pipeline

### Location
`scripts/cli-pipeline/documentation/`

### Purpose
Manage continuously updated documentation.

### Key Commands

#### add-continuous
```bash
./documentation-cli.sh add-continuous <file-path> [category] [frequency]
```
- Adds document to tracking
- Sets update frequency
- Categories: project-instructions, technical-specs, etc.

#### update-continuous
```bash
./documentation-cli.sh update-continuous [--force]
```
- Updates tracked documents
- Checks for changes
- `--force`: Updates regardless of schedule

#### list-continuous
```bash
./documentation-cli.sh list-continuous
```
- Shows all tracked documents
- Displays update status
- Shows next update time

### Implementation
- Uses `.tracking.json` for metadata
- Copies files to `docs/continuously-updated/`
- Maintains update history

## Tracking Pipeline

### Location
`scripts/cli-pipeline/tracking/`

### Purpose
Track and analyze command execution across all pipelines.

### Key Commands

#### history
```bash
./tracking-cli.sh history [--pipeline <name>] [--days <n>]
```
- Shows command execution history
- Filters by pipeline or time
- Displays success/failure rates

#### report
```bash
./tracking-cli.sh report [--format <type>]
```
- Generates usage reports
- Formats: text, json, csv
- Includes performance metrics

#### analyze
```bash
./tracking-cli.sh analyze [--command <name>]
```
- Analyzes command usage patterns
- Identifies trends
- Suggests optimizations

### Database Tables
- `command_tracking`: Execution logs
- `command_definitions`: Command registry
- `command_pipelines`: Pipeline definitions

## All Pipelines (Master CLI)

### Location
`scripts/cli-pipeline/all_pipelines/`

### Purpose
Master control interface for all CLI pipelines.

### Key Commands

#### health-check
```bash
./all-pipelines-cli.sh health-check
```
- Checks health of all services
- Tests database connections
- Validates API keys

#### populate-command-registry
```bash
./all-pipelines-cli.sh populate-command-registry
```
- Scans all pipelines for commands
- Updates command registry
- Essential after adding new commands

#### sync-command-status
```bash
./all-pipelines-cli.sh sync-command-status
```
- Synchronizes command tracking
- Updates execution statistics
- Maintains registry consistency

#### clear-cache
```bash
./all-pipelines-cli.sh clear-cache [app-name]
```
- Clears Vite build caches
- Useful for development
- Can target specific apps

### Special Features
- Aggregates all pipeline functionality
- Provides unified interface
- Monitors system health

## Development Guidelines

### Adding New Commands

1. **Create TypeScript Implementation**:
   ```typescript
   // scripts/cli-pipeline/{domain}/new-command.ts
   import { Command } from 'commander';
   const program = new Command();
   
   program
     .command('new-command')
     .description('Description')
     .action(async (options) => {
       // Implementation
     });
   ```

2. **Add to Shell Wrapper**:
   ```bash
   # In {domain}-cli.sh
   new_command() {
     track_command "new-command" "ts-node $SCRIPT_DIR/new-command.ts $@"
   }
   ```

3. **Register Command**:
   ```bash
   ./all-pipelines-cli.sh populate-command-registry
   ./all-pipelines-cli.sh sync-command-status
   ```

### Best Practices

1. **Use Shared Services**:
   - Import from `packages/shared/services`
   - Never create direct database clients
   - Use singleton instances

2. **Error Handling**:
   - Comprehensive try-catch blocks
   - Meaningful error messages
   - Proper exit codes

3. **Command Tracking**:
   - Always use `track_command` wrapper
   - Include meaningful descriptions
   - Track success/failure

4. **Documentation**:
   - Update this document
   - Include usage examples
   - Document options clearly

## Command Registry

### Viewing Registry
```sql
-- All commands by pipeline
SELECT cp.name as pipeline, cd.command_name, cd.description 
FROM command_pipelines cp
JOIN command_definitions cd ON cd.pipeline_id = cp.id
WHERE cp.status = 'active'
ORDER BY cp.name, cd.command_name;

-- Command usage statistics
SELECT command_name, 
       COUNT(*) as executions,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
       AVG(execution_time_ms) as avg_time_ms
FROM command_tracking
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY command_name
ORDER BY executions DESC;
```

### Registry Maintenance
- Run `populate-command-registry` after adding commands
- Use `sync-command-status` to update tracking
- Review usage with tracking pipeline commands

---

## Update Log

### 2025-01-06
- Initial consolidated documentation created
- Compiled from multiple pipeline documentation sources
- Standardized format across all pipelines
- Added comprehensive command listings

---

*This document is automatically updated. For manual updates, use the documentation CLI pipeline.*