# CLI Pipeline Scripts

This directory contains command-line interface (CLI) scripts for various operations in the DHG monorepo.

## Directory Structure

- `/core` - Core utility scripts shared across multiple domains
- `/document` - Document management and processing scripts
- `/analysis` - Analysis scripts for code and content
- `/scripts` - Scripts for managing shell scripts and pipelines
- `/ai` - AI-related scripts for Claude API and prompts
- `/audio` - Audio processing scripts (future)

## Key Scripts

### Document Pipeline

- `document/document-pipeline-main.sh` - Main entry point for document operations
- `document/document-pipeline-manager.sh` - Core document management functionality

### Script Management

- `scripts/script-pipeline-main.sh` - Main entry point for script operations
- `scripts/script-manager.sh` - Core script management functionality

### Analysis

- `analysis/analyze-scripts.sh` - Analyze script files
- `analysis/classify-script-with-prompt.sh` - Classify scripts using Claude API

### AI Utilities

- `ai/check-claude-api-key.sh` - Verify Claude API key configuration
- `ai/prompt-lookup.sh` - Look up and manage prompts

### Core Utilities

- `core/load-env.sh` - Load environment variables
- `core/test-env.sh` - Test environment configuration

## Running Scripts

Most scripts should be run from the repository root. For example:

```bash
# Run document pipeline
scripts/cli-pipeline/document/document-pipeline-main.sh

# Run script pipeline
scripts/cli-pipeline/scripts/script-pipeline-main.sh
```

## Adding New Scripts

When adding new scripts, please follow these guidelines:

1. Place scripts in the appropriate subdirectory based on their function
2. Update this README if adding a major new script category
3. Make sure paths are correctly referenced based on the script's location
4. Use shared utilities from the core directory when possible