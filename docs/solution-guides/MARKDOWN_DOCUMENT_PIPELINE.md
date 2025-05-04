# Markdown Document Pipeline Documentation

## Overview

The Markdown Document Pipeline is a system for discovering, cataloging, and classifying markdown files throughout the DHG monorepo. The system has been enhanced to process **all** files without limits when using the `find-new` and `classify-untyped` commands.

## Key Commands

### `find-new`

This command has been updated to discover all markdown files in the repository and add them to the Supabase database without any limits.

```bash
./scripts/cli-pipeline/document-pipeline-main.sh find-new
```

### `classify-untyped`

This command classifies untyped markdown documents. It has been updated to process all untyped files by default:

```bash
# Process all untyped files (default behavior now)
./scripts/cli-pipeline/document-pipeline-main.sh classify-untyped

# Process all untyped files (explicit)
./scripts/cli-pipeline/document-pipeline-main.sh classify-untyped all

# Process a specific number of untyped files
./scripts/cli-pipeline/document-pipeline-main.sh classify-untyped 20
```

## How It Works

### File Discovery Process

The `find-new` command performs the following steps:

1. **Retrieves existing files** from the Supabase database
2. **Discovers markdown files** on disk using the `find` command
   - Excludes system directories like `node_modules`, `.git`, etc.
   - Processes all matching files regardless of quantity
3. **Determines new files** by comparing database records with files on disk
4. **Processes files in parallel batches** for performance
   - Files are processed in batches of 5 for optimal throughput
   - Multiple batches are processed concurrently
5. **Inserts new files** into the Supabase database
   - Each file gets a unique UUID
   - File metadata is preserved (size, creation date, etc.)
   - Existing document type associations are maintained when possible

### Classification Process

The `classify-untyped` command performs these steps:

1. **Retrieves all untyped files** from the Supabase database
   - No longer has a default limit of 10 files
   - Processes all untyped files by default
2. **Filters for files that exist on disk**
3. **Processes files in parallel batches**
   - Each batch contains 5 files for optimal throughput
   - Claude API rate limiting is handled automatically
4. **Uses AI classification** with the Claude API
   - Each file is processed using the "markdown-document-classification-prompt"
   - Document types are assigned based on content analysis
5. **Updates the database** with classification results
   - Document type IDs are assigned
   - Related metadata is updated

## Key Modifications

The following key changes were made to enable unlimited file processing:

1. **Query Modification**: 
   ```javascript
   // Only add limit if not -1 (unlimited)
   if (limit !== '-1') {
     query = query.limit(Number(limit));
   }
   ```

2. **Default Parameter Changes**:
   ```bash
   # Changed default from 10 to -1 (unlimited)
   local limit=${1:-"-1"}
   ```

3. **Command-Line Argument Processing**:
   ```bash
   if [ "$2" = "all" ]; then
     limit="-1"
   else
     limit=${2:-"-1"}
   fi
   ```

4. **Explicit Messaging**:
   ```bash
   if [ "$limit" = "-1" ]; then
     echo "=== Classifying ALL untyped files (no limit) ==="
   else
     echo "=== Classifying $limit untyped files ==="
   fi
   ```

5. **Batch Processing**:
   ```bash
   echo "Processing all untyped files without any limit..."
   ```

## Benefits

These changes provide several advantages:

1. **Complete Coverage**: Ensures all markdown files are discovered and cataloged
2. **Consistency**: Files don't get missed due to arbitrary limits
3. **Efficiency**: Parallel processing keeps performance high even with large numbers of files
4. **Flexibility**: Users can still specify limits when needed
5. **Automation**: Makes it easier to fully automate document management

## Usage Guidelines

- For initial setup, run `find-new` followed by `classify-untyped` to process all files
- For routine maintenance, run the complete pipeline with `all`
- Monitor the logs for any rate limiting or API issues during classification
- If processing large numbers of files, consider the API usage implications

## Troubleshooting

If you encounter issues:

1. **Check Environment Variables**:
   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are properly set
   - Verify `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` is set for classification

2. **API Rate Limiting**:
   - Watch for Claude API rate limiting errors when classifying many files
   - The script implements a 10-second delay between file classifications to mitigate this

3. **Database Connection Issues**:
   - Verify Supabase connection credentials
   - Check if the database is accessible

4. **File Path Resolution**:
   - The system tries multiple path resolution strategies
   - If files are reported as "missing" despite existing, check the paths stored in the database