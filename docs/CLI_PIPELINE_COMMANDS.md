# CLI Pipeline Commands Documentation

This document provides information about the CLI pipeline scripts available in the `scripts/cli-pipeline` directory, including what they do, how to run them, and what services they interact with.

## Table of Contents

- [Overview](#overview)
- [Scripts](#scripts)
  - [analyze-scripts.sh](#analyze-scriptssh)
  - [run-ai-analyze.sh](#run-ai-analyzesh)
  - [import-script-analysis.sh](#import-script-analysissh)
  - [validate-ai-assets.sh](#validate-ai-assetssh)
  - [validate-prompt-relationships.sh](#validate-prompt-relationshipssh)
  - [script-report.sh](#script-reportsh)
  - [sync-markdown-files.sh](#sync-markdown-filessh)
  - [command-history-tracker.ts](#command-history-trackerts)
  - [check-duplicates.ts](#check-duplicatests)
  - [Other CLI Pipeline Scripts](#other-cli-pipeline-scripts)
- [Services and Dependencies](#services-and-dependencies)
- [Supabase Database Tables](#supabase-database-tables)
- [Common Workflows](#common-workflows)

## Overview

The CLI pipeline scripts provide tools for analyzing scripts, generating reports, testing AI integrations, and managing system-wide configurations. These scripts interact with various services, including:

- The CLI package in `packages/cli`
- Claude AI API for script analysis
- Supabase database for storing script metadata and analysis results

## Scripts

### analyze-scripts.sh

**Purpose**: Performs comprehensive script analysis across the entire repository, including scanning for scripts and analyzing their content.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/analyze-scripts.sh
```

**Details**:
- Scans the repository for script files with extensions js, ts, sh, py, and sql
- Analyzes each script using the CLI's batch-analyze-scripts command
- Generates a report in the `script-analysis-results` directory
- Updates the database with script metadata and analysis results

**Database Interactions**:
- Indirectly interacts with `scripts` table through the CLI package's batch-analyze-scripts command
- Updates script metadata, tags, and analysis results

**Dependencies**:
- CLI package (`packages/cli`)
- Supabase database

### run-ai-analyze.sh

**Purpose**: Similar to analyze-scripts.sh but specifically focused on using Claude AI for the analysis.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/run-ai-analyze.sh
```

**Details**:
- Specifically focuses on shell scripts (`.sh` files)
- Uses Claude AI to provide more detailed analysis
- Results are saved to the `ai-script-analysis-results` directory

**Database Interactions**:
- Indirectly interacts with `scripts` table through the CLI package's batch-analyze-scripts command
- Updates script metadata, code quality metrics, and AI-generated summaries

**Dependencies**:
- CLI package (`packages/cli`)
- Claude API (requires `CLI_CLAUDE_API_KEY` in environment)
- Supabase database

### import-script-analysis.sh

**Purpose**: Imports script analysis results into the Supabase database.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/import-script-analysis.sh
```

**Details**:
- Reads analysis results from the `script-analysis-results` directory
- Formats the data for database insertion
- Uploads the formatted data to the Supabase `scripts` table
- Handles errors and retries for better reliability

**Database Interactions**:
- Writes to `scripts` table with upsert operations (insert or update based on file path)
- Updates fields like title, language, document_type, summary, tags, relevance_score, etc.

**Dependencies**:
- Supabase database
- Node.js with axios

### validate-ai-assets.sh

**Purpose**: Tests the AI integration and validates required assets for the AI pipeline.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/validate-ai-assets.sh
```

**Details**:
- Tests Claude 3.7 API connectivity
- Validates required markdown files
- Checks document_types in the database
- Verifies the existence of specific prompts in the database
- Generates a comprehensive report of all findings in `docs/ai-assets-validation-report.md`

**Database Interactions**:
- Reads from `document_types` table:
  - Gets count of document types
  - Retrieves all document types with their IDs, names, and descriptions
- Reads from `prompts` table:
  - Searches for "markdown-document-classification-prompt"
  - Retrieves prompt content, creation date, and ID

**Dependencies**:
- Claude API (requires `CLI_CLAUDE_API_KEY` in environment)
- Supabase database
- Node.js

### validate-prompt-relationships.sh

**Purpose**: More detailed validation of prompt relationships in the database, with a focus on documentation classification prompts.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/validate-prompt-relationships.sh
```

**Details**:
- Tests Claude 3.7 API connectivity
- Queries the prompts table for "markdown-document-classification-prompt"
- Retrieves related records from prompt_relationships
- Queries document_types with category "Documentation"
- Reads and displays content from docs/markdown-report.md
- Writes results to docs/ai-assets-validation-report.md

**Database Interactions**:
- Reads from `prompts` table to find classification prompts
- Reads from `prompt_relationships` table to get relationships for the found prompt
- Reads from `document_types` table with a filter for category="Documentation"

**Dependencies**:
- Claude API (requires `CLI_CLAUDE_API_KEY` in environment)
- Supabase database
- Node.js

### script-report.sh

**Purpose**: Generates a detailed report about all shell scripts in the repository.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/script-report.sh
```

**Details**:
- Recursively finds all shell scripts (.sh) in the project
- Checks if scripts are executable
- Collects metadata (size, modification date, etc.)
- Organizes scripts by directory
- Creates a comprehensive markdown report in `docs/script-report.md`

**Database Interactions**:
- No direct database interactions

**Dependencies**:
- Bash

### sync-markdown-files.sh

**Purpose**: Synchronizes markdown files in the repository with the documentation_files table in Supabase, updating metadata and tracking file existence.

**Usage**:
```bash
cd /path/to/dhg-mono
./scripts/cli-pipeline/sync-markdown-files.sh
```

**Details**:
- Scans the repository for all markdown files (*.md), excluding specific directories (file_types, backup, archive, external tools)
- Compares found files with the documentation_files table in Supabase
- Adds new files to the database with is_deleted = FALSE
- Marks missing files as is_deleted = TRUE
- Updates metadata for all files (size, hash, title, modification date)
- Ensures full paths are stored for all files

**Database Interactions**:
- Reads from the documentation_files table to get existing records
- Inserts new files into the documentation_files table
- Updates existing files in the documentation_files table
- Sets is_deleted flag for files that no longer exist on disk

**Dependencies**:
- ts-node and TypeScript
- Supabase database (CLI_SUPABASE_URL and CLI_SUPABASE_KEY environment variables)
- FileService from the CLI package
- Logger from the CLI package

### command-history-tracker.ts

**Purpose**: Tracks command execution history by wrapping commands and recording results in the database.

**Usage**:
```bash
cd /path/to/dhg-mono
ts-node ./scripts/cli-pipeline/command-history-tracker.ts [category] [command]

# Examples:
ts-node ./scripts/cli-pipeline/command-history-tracker.ts git "git push origin main"
ts-node ./scripts/cli-pipeline/command-history-tracker.ts pnpm "pnpm install marked"
```

**Details**:
- Wraps command execution and records details in the Supabase database
- Tracks command category, success/failure, duration, and other metadata
- Useful for auditing and tracking frequently used commands

**Database Interactions**:
- Reads from `command_categories` table:
  - Gets the category ID for the specified category (git, pnpm, etc.)
- Calls the `sanitize_command` RPC function to sanitize command text
- Writes to `command_history` table:
  - Records command_text, sanitized_command, category_id, exit_code, success, and duration_ms

**Dependencies**:
- ts-node
- Supabase database
- @supabase/supabase-js

### check-duplicates.ts

**Purpose**: Checks for potential duplicate implementations across the codebase (Note: This script appears to be in the early stages of development).

**Usage**: Not fully implemented yet.

**Database Interactions**: None currently active

## Other CLI Pipeline Scripts

These scripts were moved from `apps/dhg-improve-experts` to `packages/cli/scripts` as they're directly related to the CLI package:

- **fix-ai-integration.sh**: Adds AI integration to the batch-analyze-scripts command
- **fix-batch-analyze.sh**: Fixes and enhances the batch-analyze-scripts command
- **build-scan-scripts.sh**: Builds the scan-scripts command in isolation
- **run-scan-scripts.sh**: Runs the scan-scripts command to find script files
- **fix-permissions.sh**: Fixes CLI errors by directly updating implementations

These scripts are located in the `packages/cli/scripts` directory and are used for CLI development and maintenance.

## Services and Dependencies

The CLI pipeline scripts interact with several services:

1. **CLI Package**
   - Located in `packages/cli`
   - Provides core functionality for script scanning and analysis
   - Contains commands like `scan-scripts` and `batch-analyze-scripts`

2. **Claude AI API**
   - Used for advanced script analysis
   - Requires an API key in environment (CLI_CLAUDE_API_KEY)
   - Provides intelligent context and recommendations for scripts

3. **Supabase Database**
   - Stores script metadata, analysis results, and prompt data
   - Key tables include: `scripts`, `document_types`, `prompts`, `prompt_relationships`
   - Requires credentials in environment (CLI_SUPABASE_URL and CLI_SUPABASE_KEY)

4. **Node.js/TypeScript**
   - Some scripts use Node.js with TypeScript for more complex processing
   - `ts-node` is required for TypeScript scripts

## Supabase Database Tables

The CLI pipeline scripts interact with the following Supabase database tables:

### 1. scripts
- **Used by**: analyze-scripts.sh, run-ai-analyze.sh, import-script-analysis.sh
- **Fields**: 
  - id (UUID)
  - file_path (string)
  - title (string)
  - language (string) 
  - document_type (string)
  - summary (string)
  - tags (string array)
  - code_quality (number)
  - maintainability (number)
  - utility (number)
  - documentation (number)
  - relevance_score (number)
  - relevance_reasoning (string)
  - referenced (boolean)
  - status (string)
  - status_confidence (number)
  - status_reasoning (string)
  - script_type (string)
  - usage_status (string)
  - last_analyzed (timestamp)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Insert, Update, Select

### 2. script_relationships
- **Used by**: The CLI package's batch-analyze-scripts command (used indirectly)
- **Fields**:
  - id (UUID)
  - source_script_id (UUID reference to scripts.id)
  - target_script_id (UUID reference to scripts.id)
  - relationship_type (string)
  - confidence (number)
  - notes (string, optional)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Insert, Select

### 3. document_types
- **Used by**: validate-ai-assets.sh, validate-prompt-relationships.sh
- **Fields**:
  - id (UUID)
  - name (string)
  - description (string)
  - category (string)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Select with filters and counts

### 4. prompts
- **Used by**: validate-ai-assets.sh, validate-prompt-relationships.sh
- **Fields**:
  - id (UUID)
  - name (string)
  - content (string)
  - description (string, optional)
  - tags (string array, optional)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Select with filters like ILIKE for name pattern matching

### 5. prompt_relationships
- **Used by**: validate-prompt-relationships.sh
- **Fields**:
  - id (UUID)
  - prompt_id (UUID reference to prompts.id)
  - related_id (string, reference to various entities)
  - relationship_type (string)
  - metadata (JSON, optional)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Select with filters on prompt_id

### 6. command_categories
- **Used by**: command-history-tracker.ts
- **Fields**:
  - id (UUID)
  - name (string)
  - description (string, optional)
  - created_at (timestamp)
- **Operations**: Select with exact matching on name

### 7. command_history
- **Used by**: command-history-tracker.ts
- **Fields**:
  - id (UUID)
  - command_text (string)
  - sanitized_command (string)
  - category_id (UUID reference to command_categories.id)
  - exit_code (integer)
  - success (boolean)
  - duration_ms (integer)
  - executed_at (timestamp, defaults to now())
  - created_at (timestamp)
- **Operations**: Insert

### 8. documentation_files
- **Used by**: sync-markdown-files.sh
- **Fields**:
  - id (UUID)
  - file_path (string)
  - title (string)
  - summary (string, optional)
  - ai_generated_tags (string array)
  - manual_tags (string array, optional)
  - file_hash (string)
  - metadata (JSON)
  - is_deleted (boolean)
  - document_type_id (UUID reference to document_types.id)
  - ai_assessment (JSON, optional)
  - assessment_quality_score (integer, optional)
  - assessment_model (string, optional)
  - assessment_version (integer, optional)
  - assessment_date (timestamp, optional)
  - created_at (timestamp)
  - updated_at (timestamp)
- **Operations**: Select, Insert, Update

### 9. Stored Procedures/RPC
- **sanitize_command**: Called by command-history-tracker.ts to remove sensitive information from commands
- **register_markdown_file**: Used indirectly by documentation processing scripts
- **register_document_section**: Used indirectly by documentation processing scripts

## Common Workflows

### Script Analysis Workflow

For analyzing scripts in the repository:

1. Run `analyze-scripts.sh` for a full analysis
2. Or run `run-ai-analyze.sh` for AI-powered analysis of shell scripts
3. Check the generated reports in the respective output directories
4. Use `import-script-analysis.sh` if you need to manually import results to the database

### AI Integration Testing

To validate the AI components:

1. Run `validate-ai-assets.sh` to check basic AI integration and required assets
2. Run `validate-prompt-relationships.sh` for more detailed validation of the prompt system
3. Review the generated reports in the `docs` directory

### Documentation Management

For documentation and markdown files management:

1. Run `script-report.sh` to create a comprehensive script report
2. Run `sync-markdown-files.sh` to synchronize markdown files with the database

---

This documentation will be updated as new functionality is added to the CLI pipeline.