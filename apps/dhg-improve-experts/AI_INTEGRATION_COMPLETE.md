# AI Integration for Script Analysis

## Overview

I've successfully integrated Claude AI into the script analysis pipeline to analyze shell scripts and store the results in the Supabase database. This implementation follows the exact workflow you requested:

1. Fetches the prompt from the `prompts` table using the name "script-analysis-prompt"
2. Retrieves related metadata from "script-report.md" files
3. Loads document types from specific categories (AI, Development, Integrations, Operations)
4. Uses Claude to analyze each shell script with the database prompt
5. Writes the analysis results to the scripts table in Supabase

## Implementation Details

The AI integration consists of three main components:

### 1. Claude Service

A robust Claude API client that:
- Sends prompts to Claude API using proper authentication
- Handles token management and response parsing
- Includes retry logic for API failures
- Parses JSON results from Claude's responses
- Provides specific functionality for analyzing script files

### 2. Database Integration

Extensions to the Supabase service that:
- Retrieve prompts with all relationships from the database
- Fetch document types filtered by specific categories
- Get script report metadata for context
- Update scripts table with analysis results
- Create script relationship records for referenced files

### 3. Enhanced Analysis Command

An improved batch-analyze-scripts command that:
- Accepts a new `--use-ai` flag to enable AI analysis
- Filters scripts by file extension (defaults to .sh files)
- Processes scripts in batches with controlled concurrency
- Handles both AI-based and rule-based analysis
- Generates comprehensive reports with AI insights
- Updates the database with analysis results when specified

## How to Use

To use the AI-enabled script analysis:

1. Run the fix-ai-integration.sh script (already done)
2. Execute the AI analysis with:
   ```bash
   ./run-ai-analyze.sh
   ```

This will:
1. Scan your repository for shell scripts
2. Analyze up to 5 scripts using Claude AI (configurable)
3. Generate reports and summaries in the ai-script-analysis-results directory
4. Store results in the Supabase database if enabled

## Script Analysis Format

For each script, the AI will generate structured data including:

- **title**: A descriptive title for the script
- **summary**: A comprehensive summary of the script's functionality
- **document_type**: Categorization based on purpose (e.g., "build_script", "deployment_script")
- **script_type**: Classification by function (e.g., "utility", "setup", "configuration")
- **tags**: Keywords representing the script's content and purpose
- **status**: Current status assessment (e.g., "active", "deprecated")
- **relevance_score**: Numerical assessment of relevance (0-100)
- **code_quality**: Assessment of code quality (0-100)
- **maintainability**: Assessment of maintainability (0-100)
- **utility**: Assessment of usefulness (0-100)
- **documentation**: Assessment of documentation quality (0-100)
- **references**: Lists of other files the script references

## Database Structure

The analysis results are stored in the following database structure:

1. **scripts table**: Main script metadata and assessment
2. **script_relationships table**: References between scripts

## Configuration Options

The AI analysis can be customized with various options:

- **--extensions**: Filter files by extension (default: "sh")
- **--max-scripts**: Limit the number of scripts to analyze
- **--concurrency**: Control parallel API requests to Claude
- **--prompt-name**: Change the prompt to use from the database
- **--update-database**: Enable/disable database updates

## Future Improvements

Potential enhancements for the future:

1. **Diff Analysis**: Compare file changes over time for incremental analysis
2. **Tag Clustering**: Group scripts by automatically detected themes
3. **Dependency Graphs**: Generate visual representations of script relationships
4. **Interactive Reporting**: Add web UI for exploring analysis results
5. **Training Data Collection**: Save analyses to improve future prompts