# CLI Pipeline Commands Documentation

This document provides information about the CLI pipeline scripts available in the `scripts/cli-pipeline` directory, including what they do, how to run them, and what services they interact with.

## Table of Contents
- [Overview](#overview)
- [Presentations Pipeline Commands](#presentations-pipeline-commands)
  - [generate-summary](#generate-summary)
  - [Other Presentation Commands](#other-presentation-commands)
- [Media Processing Commands](#media-processing-commands)
- [Script Analysis Commands](#script-analysis-commands)
- [Document Pipeline Commands](#document-pipeline-commands)
- [Git Management Pipeline Commands](#git-management-pipeline-commands)

## Overview

The CLI pipeline scripts provide tools for:
- Analyzing and managing video presentations and transcripts
- Processing media files (MP4, M4A, transcripts)
- Analyzing scripts and generating reports
- Testing AI integrations
- Managing system-wide configurations

These scripts interact with various services, including:
- Claude AI API for content summarization and analysis
- Supabase database for storing metadata, documents, and analysis results
- Local filesystem for media files and transcripts

## Presentations Pipeline Commands

The presentations pipeline provides commands for managing expert presentations, including generating AI summaries from transcriptions, creating expert profiles, and managing presentation assets.

### generate-summary

Generates AI summaries from presentation transcripts using Claude AI.

**Usage**:
```bash
./scripts/cli-pipeline/presentations/commands/generate-summary.ts [options]

# Examples:
# Generate summaries for up to 5 presentations with a detailed format
./scripts/cli-pipeline/presentations/commands/generate-summary.ts --format detailed

# Generate summary for a specific presentation in bullet-point format (dry run)
./scripts/cli-pipeline/presentations/commands/generate-summary.ts --presentation-id 1234abcd --format bullet-points --dry-run

# Process presentations for a specific expert
./scripts/cli-pipeline/presentations/commands/generate-summary.ts --expert-id 5678efgh --limit 10
```

**Options**:
- `-p, --presentation-id <id>` - Generate summary for a specific presentation ID
- `-e, --expert-id <id>` - Generate summaries for a specific expert ID
- `-f, --force` - Force regeneration of summaries, even if they already exist
- `--dry-run` - Preview mode: generate summaries but do not save to database
- `-l, --limit <number>` - Maximum number of presentations to process (default: 5)
- `-o, --output <path>` - Output file path for JSON results (default: presentation-summaries.json)
- `--folder-id <id>` - Filter presentations by Google Drive folder ID
- `--format <format>` - Summary format style:
  - `concise` - 2-3 paragraph summary (default)
  - `detailed` - 5-7 paragraph thorough summary with supporting evidence
  - `bullet-points` - 5-10 bullet points covering key presentation points
- `--status <status>` - Filter by presentation status (default: make-ai-summary)

**Details**:
- Finds presentations with transcripts ready for AI summarization
- Uses Claude API with the "final_video-summary-prompt" from the prompts database
- Generates professionally formatted summaries following the designated style
- Saves summaries to the database (unless in dry-run mode)
- Creates a JSON report of processed presentations and results

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

## Git Management Pipeline Commands

The Git Management pipeline provides commands for managing git worktrees, merge queues, and git operations in a monorepo environment.

### list-worktrees

Lists all git worktrees with information about their active tasks.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh list-worktrees
```

**Details**:
- Shows all git worktrees in the repository
- Displays the branch checked out in each worktree
- Shows count of active tasks (from dev_tasks table) for each worktree
- Provides path to each worktree directory

### worktree-status

Shows detailed status of all worktrees including clean/dirty state and ahead/behind information.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh worktree-status
```

**Details**:
- Checks git status for each worktree
- Shows if working directory is clean or has uncommitted changes
- Displays ahead/behind status relative to remote branch
- Color-coded output for easy status identification

### create-worktree

Creates a new git worktree for a specified branch.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh create-worktree --branch <branch-name> [--path <path>]
```

**Options**:
- `--branch <name>` - Name of the branch to check out in the new worktree (required)
- `--path <path>` - Path where the worktree should be created (optional, auto-generated if not provided)

### remove-worktree

Removes an existing git worktree.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh remove-worktree --path <worktree-path>
```

**Options**:
- `--path <path>` - Path to the worktree to remove (required)

### merge-queue-add

Adds a branch to the merge queue with specified priority.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh merge-queue-add --branch <branch-name> --priority <1-5> [--notes <notes>]
```

**Options**:
- `--branch <name>` - Branch name to add to merge queue (defaults to current branch if not specified)
- `--priority <1-5>` - Priority level (1=highest, 5=lowest)
- `--notes <text>` - Optional notes about the merge request

**Details**:
- Creates entry in dev_merge_queue table
- Automatically captures current branch if not specified
- Sets initial status to 'pending'
- Records submitter information

### merge-queue-list

Displays all branches currently in the merge queue.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh merge-queue-list [--status <status>]
```

**Options**:
- `--status <status>` - Filter by status (pending, ready, merging, completed, failed)

**Details**:
- Shows branches ordered by priority and creation date
- Displays status, priority, submitter, and notes
- Color-coded status indicators
- Shows merge checklist completion for each item

### merge-queue-status

Shows detailed status of the merge queue including checklist items.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh merge-queue-status --branch <branch-name>
```

**Options**:
- `--branch <name>` - Branch name to check status for

**Details**:
- Shows current merge queue position and status
- Displays merge checklist with pass/fail status
- Shows any error messages or notes
- Indicates readiness for merge

### run-merge-checks

Runs automated checks on a branch to verify merge readiness.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh run-merge-checks --branch <branch-name>
```

**Options**:
- `--branch <name>` - Branch to run checks on (defaults to current branch)

**Details**:
- Checks for merge conflicts with target branch
- Runs test suite if configured
- Verifies code quality checks (linting, type checking)
- Updates merge checklist in database
- Reports pass/fail status for each check

### start-merge

Initiates the merge process for a branch in the queue.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh start-merge --branch <branch-name> [--strategy <strategy>]
```

**Options**:
- `--branch <name>` - Branch to merge
- `--strategy <strategy>` - Merge strategy (merge, squash, rebase) (default: merge)

**Details**:
- Verifies all merge checks have passed
- Updates queue status to 'merging'
- Performs the actual git merge operation
- Updates status to 'completed' or 'failed' based on result

### update-from-source

Updates a branch with latest changes from its source branch.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh update-from-source --branch <branch-name> [--source <source-branch>]
```

**Options**:
- `--branch <name>` - Branch to update
- `--source <name>` - Source branch to pull from (default: main/master)

### check-conflicts

Checks if a branch has conflicts with target branch.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh check-conflicts --branch <branch-name> [--target <target-branch>]
```

**Options**:
- `--branch <name>` - Branch to check
- `--target <name>` - Target branch to check against (default: main/master)

### health-check

Verifies git CLI functionality and database connections.

**Usage**:
```bash
./scripts/cli-pipeline/git/git-cli.sh health-check
```

**Details**:
- Tests git command availability
- Verifies database connectivity
- Checks required tables exist (dev_tasks, dev_merge_queue, etc.)
- Reports overall health status

---

This documentation will be updated as new functionality is added to the CLI pipeline.