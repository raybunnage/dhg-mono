# Script Analysis Pipeline

This document outlines the script analysis pipeline for categorizing and tracking script files in the monorepo.

## Overview

The script analysis pipeline is a CLI tool that scans, analyzes, and categorizes script files in the monorepo. It uses Claude AI to analyze scripts and categorize them into document types:

- **AI**: Scripts related to AI/ML models, prompts, and configurations
- **Integration**: Scripts for external system integrations
- **Operations**: Scripts for operational tasks and infrastructure
- **Development**: Scripts for development tools and processes

The pipeline also assesses the quality, relevance, and status of each script, making it easier to maintain and understand the codebase.

## Getting Started

### Prerequisites

- Node.js 16+ installed
- Access to Claude API
- Supabase project set up

### Installation

1. Set up environment variables:

```bash
export CLAUDE_API_KEY=your_claude_api_key
export SUPABASE_URL=your_supabase_url
export SUPABASE_KEY=your_supabase_key
```

2. Apply the database migrations:

```bash
./apply_script_migrations.sh
```

3. Build the CLI tool:

```bash
cd scripts/cli
npm install
npm run build
```

## Usage

### Command Line Interface

The pipeline provides several commands:

#### 1. Scan Scripts

Scans the repository for script files and outputs a JSON file with script information:

```bash
./scripts/cli/dist/index.js scan-scripts --dir /path/to/repo --output scripts-scan-results.json
```

Options:
- `--dir`: Directory to scan (default: current directory)
- `--extensions`: Comma-separated list of file extensions to include (default: "js,ts,sh,py")
- `--exclude`: Comma-separated list of patterns to exclude (default: "node_modules,dist,build,.git")
- `--recursive`: Scan directories recursively (default: true)
- `--output`: Output file path for scan results (default: "scripts-scan-results.json")
- `--verbose`: Enable verbose logging (default: false)

#### 2. Analyze Script

Analyzes a single script file:

```bash
./scripts/cli/dist/index.js analyze-script --file /path/to/script.js --output script-analysis.json
```

Options:
- `--file`: Script file path to analyze (required)
- `--output`: Output file path for analysis results (default: none)
- `--prompt`: Custom prompt file path (default: "public/prompts/script-analysis-prompt.md")
- `--check-references`: Check for references in package.json files (default: false)
- `--find-duplicates`: Find potential duplicate scripts (default: false)
- `--update-database`: Update the Supabase database with analysis results (default: false)
- `--verbose`: Enable verbose logging (default: false)

#### 3. Batch Analyze Scripts

Analyzes multiple script files in batch:

```bash
./scripts/cli/dist/index.js batch-analyze-scripts --input scripts-scan-results.json --output-dir script-analysis-results
```

Options:
- `--input`: Input JSON file with script files to analyze (required)
- `--output-dir`: Output directory for analysis results (default: "./script-analysis-results")
- `--prompt`: Custom prompt file path (default: "public/prompts/script-analysis-prompt.md")
- `--batch-size`: Number of scripts to analyze in each batch (default: 10)
- `--concurrency`: Number of concurrent analysis requests (default: 2)
- `--check-references`: Check for references in package.json files (default: false)
- `--update-database`: Update the Supabase database with analysis results (default: false)
- `--generate-report`: Generate a summary report (default: true)
- `--verbose`: Enable verbose logging (default: false)

### Shell Script

A convenience shell script is provided to run the complete pipeline:

```bash
./scripts/analyze-scripts.sh
```

This script will:
1. Scan for script files
2. Analyze the scripts using Claude AI
3. Generate summary reports
4. Display a preview of the analysis results

### Web UI

A web UI is also available at `/script-analysis` in the application. This provides a user-friendly interface for:

- Scanning script files
- Running batch analysis
- Viewing analysis reports
- Exploring categorized scripts

## Database Schema

The pipeline uses a Supabase database with the following schema:

### Tables

- `scripts`: Stores metadata and assessments for script files
- `script_relationships`: Tracks relationships between scripts (duplicates, dependencies)

### Enums

- `script_status`: ACTIVE, UPDATE_NEEDED, OBSOLETE, DUPLICATE, UNUSED
- `script_type`: UTILITY, DEPLOYMENT, DATABASE, BUILD, SETUP, OTHER
- `script_usage_status`: DIRECTLY_REFERENCED, INDIRECTLY_REFERENCED, NOT_REFERENCED
- `document_type_category`: AI, Integration, Operations, Development

### Views

- `active_scripts_view`: Shows active scripts with assessment data
- `script_duplicates_view`: Shows duplicate script relationships

## API Routes

The following API routes are available:

### POST /api/script-analysis

Triggers script analysis actions:

- `scan`: Scan for script files
- `analyze`: Analyze specific script file
- `batch`: Batch analyze script files
- `status`: Get analysis status

### GET /api/script-analysis

Retrieves script analysis data:

- `report`: Get the script analysis report
- `category-summary`: Get the category summary
- `script-analysis`: Get analysis for a specific script
- `list-analyses`: List all available script analyses

## Reports

The pipeline generates the following reports:

1. **Script Analysis Report**: A comprehensive report of all analyzed scripts, including details on document types, statuses, and quality scores.

2. **Category Summary**: A breakdown of scripts by document type category, with status distribution for each category.

## Extending the Pipeline

### Custom Prompts

You can customize the analysis by modifying the prompt file at `public/prompts/script-analysis-prompt.md`.

### Additional Categories

To add new document type categories:

1. Update the database schema to add the new category to the `document_type_category` enum
2. Modify the prompt to include the new category
3. Update the UI to display the new category

## Troubleshooting

### Common Issues

- **API Rate Limiting**: If you're seeing timeouts or failures, try reducing the concurrency and batch size.
- **Database Connectivity**: Ensure your Supabase credentials are correct and the database is accessible.
- **Script File Extensions**: If some scripts aren't being found, check the extensions parameter when scanning.

### Logs

Logs are printed to the console during CLI operation. Use the `--verbose` flag to enable detailed logging.

## License

This project is licensed under the MIT License - see the LICENSE file for details.