# CLI Pipeline Commands Documentation

This document provides information about the CLI pipeline scripts available in the `scripts/cli-pipeline` directory, including what they do, how to run them, and what services they interact with.

## Table of Contents
Based on my inspection of the packages/cli directory and its critical
  files, here's what I found regarding path handling and environment
  variables:

  1. Environment Variables:
    - The config.ts file has a robust mechanism for loading environment
  variables
    - It properly searches for .env files in multiple possible root
  paths, including the monorepo root
    - It has a good order of precedence: .env.local → .env.[environment]
  → .env
    - It correctly handles CLI-specific environment variables with
  appropriate fallbacks
  2. Output Path Handling:
    - The default output directory is set to 'docs' in the config (line
  31 in config.ts)
    - Report generation properly resolves paths to the docs folder (line
  816 in documentation-processor.ts)
    - Analysis results are also written correctly to the specified output
   directory
  3. File Path Resolution:
    - The CLI properly handles both absolute and relative paths
    - It has a findProjectRoot function that safely identifies the
  monorepo root
    - It correctly resolves paths that start with 'apps/' to be relative
  to the monorepo root
  4. Path Safety:
    - Path operations use proper path.resolve() and path.join() functions
    - The code checks for directory existence before writing files

  Everything appears to be properly configured to run the CLI from the
  monorepo root. The CLI will correctly access .env files from the root
  directory and write output files to the docs directory as expected.
- [Overview](#overview)
- [Scripts](#scripts)
  - [analyze-scripts.sh](#analyze-scriptssh)
  - [run-ai-analyze.sh](#run-ai-analyzesh)
  - [import-script-aBased on my inspection of the packages/cli directory and its critical
  files, here's what I found regarding path handling and environment
  variables:

  1. Environment Variables:
    - The config.ts file has a robust mechanism for loading environment
  variables
    - It properly searches for .env files in multiple possible root
  paths, including the monorepo root
    - It has a good order of precedence: .env.local → .env.[environment]
  → .env
    - It correctly handles CLI-specific environment variables with
  appropriate fallbacks
  2. Output Path Handling:
    - The default output directory is set to 'docs' in the config (line
  31 in config.ts)
    - Report generation properly resolves paths to the docs folder (line
  816 in documentation-processor.ts)
    - Analysis results are also written correctly to the specified output
   directory
  3. File Path Resolution:
    - The CLI properly handles both absolute and relative paths
    - It has a findProjectRoot function that safely identifies the
  monorepo root
    - It correctly resolves paths that start with 'apps/' to be relative
  to the monorepo root
  4. Path Safety:
    - Path operations use proper path.resolve() and path.join() functions
    - The code checks for directory existence before writing files

  Everything appears to be properly configured to run the CLI from the
  monorepo root. The CLI will correctly access .env files from the root
  directory and write output files to the docs directory as expected.Based on my inspection of the packages/cli directory and its critical
  files, here's what I found regarding path handling and environment
  variables:

  1. Environment Variables:
    - The config.ts file has a robust mechanism for loading environment
  variables
    - It properly searches for .env files in multiple possible root
  paths, including the monorepo root
    - It has a good order of precedence: .env.local → .env.[environment]
  → .env
    - It correctly handles CLI-specific environment variables with
  appropriate fallbacks
  2. Output Path Handling:
    - The default output directory is set to 'docs' in the config (line
  31 in config.ts)
    - Report generation properly resolves paths to the docs folder (line
  816 in documentation-processor.ts)
    - Analysis results are also written correctly to the specified output
   directory
  3. File Path Resolution:
    - The CLI properly handles both absolute and relative paths
    - It has a findProjectRoot function that safely identifies the
  monorepo root
    - It correctly resolves paths that start with 'apps/' to be relative
  to the monorepo root
  4. Path Safety:
    - Path operations use proper path.resolve() and path.join() functions
    - The code checks for directory existence before writing files

  Everything appears to be properlBased on my inspection of the packages/cli directory and its critical
  files, here's what I found regarding path handling and environment
  variables:

  1. Environment Variables:
    - The config.ts file has a robust mechanism for loading environment
  variables
    - It properly searches for .env files in multiple possible root
  paths, including the monorepo root
    - It has a good order of precedence: .env.local → .env.[environment]
  → .env
    - It correctly handles CLI-specific environment variables with
  appropriate fallbacks
  2. Output Path Handling:
    - The default output directory is set to 'docs' in the config (line
  31 in config.ts)
    - Report generation properly resolves paths to the docs folder (line
  816 in documentation-processor.ts)
    - Analysis results are also written correctly to the specified output
   directory
  3. File Path Resolution:
    - The CLI properly handles both absolute and relative paths
    - It has a findProjectRoot function that safely identifies the
  monorepo root
    - It correctly resolves paths that start with 'apps/' to be relative
  to the monorepo root
  4. Path Safety:
    - Path operations use proper path.resolve() and path.join() functions
    - The code checks for directory existence before writing files

  Everything appears to be properly configured to run the CLI from the
  monorepo root. The CLI will correctly access .env files from the root
  directory and write output files to the docs directory as expected.y configured to run the CLI from the
  monorepo root. The CLI will correctly access .env files from the root
  directory and write output files to the docs directory as expected.nalysis.sh](#import-script-analysissh)
  - [validate-ai-assets.sh](#validate-ai-assetssh)
  - [validate-prompt-relationships.sh](#validate-prompt-relationshipssh)
  - [script-report.sh](#script-reportsh)
  - [command-history-tracker.ts](#command-history-trackerts)
  - [check-duplicates.ts](#check-duplicatests)
  - [Other CLI Pipeline Scripts](#other-cli-pipeline-scripts)
- [Services and Dependencies](#services-and-dependencies)
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

**Dependencies**:
- CLI package (`packages/cli`)
- Claude API (requires `ANTHROPIC_API_KEY` in .env.development)
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

**Dependencies**:
- Supabase database (requires SUPABASE credentials in .env.development)
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

**Dependencies**:
- Claude API (requires `ANTHROPIC_API_KEY` in .env.development)
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

**Dependencies**:
- Claude API (requires `ANTHROPIC_API_KEY` in .env.development)
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

**Dependencies**:
- Bash

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

**Dependencies**:
- ts-node
- Supabase database
- @supabase/supabase-js

### check-duplicates.ts

**Purpose**: Checks for potential duplicate implementations across the codebase (Note: This script appears to be in the early stages of development).

**Usage**: Not fully implemented yet.

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
   - Requires an API key in `.env.development` (ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY)
   - Provides intelligent context and recommendations for scripts

3. **Supabase Database**
   - Stores script metadata, analysis results, and prompt data
   - Key tables include: `scripts`, `document_types`, `prompts`, `prompt_relationships`
   - Requires credentials in `.env.development` (VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY)

4. **Node.js/TypeScript**
   - Some scripts use Node.js with TypeScript for more complex processing
   - `ts-node` is required for TypeScript scripts

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

### Documentation Generation

To generate documentation about scripts:

1. Run `script-report.sh` to create a comprehensive script report

---

This documentation will be updated as new functionality is added to the CLI pipeline.