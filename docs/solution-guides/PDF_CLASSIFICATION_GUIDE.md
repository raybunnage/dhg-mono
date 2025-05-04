# PDF Classification Guide

## Overview

This document explains the PDF classification process implemented in the `classify-pdfs` command, which uses Claude AI to analyze PDF documents and determine their document types. The system handles large PDFs by splitting them into manageable chunks and includes robust error handling and retry mechanisms.

## How PDF Classification Works

The PDF classification process involves several key components:

1. **Claude Service Integration**: Uses the singleton `claudeService` from `packages/shared/services/claude-service` which handles all Claude API interactions
2. **PDF Processing**: Manages PDF file handling, including large PDF splitting
3. **Classification Logic**: Analyzes PDF content to determine document types
4. **Database Integration**: Updates document metadata in Supabase

### Command Structure

The classify-pdfs command is implemented in:
- `scripts/cli-pipeline/google_sync/classify-pdfs-with-service.ts` - Core implementation
- `scripts/cli-pipeline/google_sync/google-sync-cli.sh` - CLI wrapper

To run the command:
```bash
./scripts/cli-pipeline/google_sync/google-sync-cli.sh classify-pdfs [options]
```

Available options:
- `--limit <number>` - Number of PDFs to process (default: 10)
- `--folder-id <id>` - Filter by Google Drive folder ID or name
- `--output <path>` - Save results to specified file path
- `--debug` or `--verbose` - Enable detailed logging
- `--dry-run` - Process PDFs without updating the database

## Large PDF Handling

The system handles large PDFs using a sophisticated approach:

1. **Page Count Estimation**: Uses file size as a heuristic to estimate page count
   - Rough estimate: 100KB per page
   - This avoids needing to fully parse the PDF for performance reasons

2. **PDF Splitting**: For PDFs that exceed Claude's 100-page limit
   - Uses `pdf-lib` library to extract the first 99 pages
   - Creates a new PDF file with the "_first99pages" suffix
   - Falls back to the original file if splitting fails

3. **Size Limit Handling**: Checks if PDF exceeds Claude's 10MB limit
   - Throws an error if file is too large
   - Provides clear error messages about size limitations

## Claude Service Integration

The `claudeService` singleton provides several methods for PDF analysis:

1. **`analyzePdf(pdfPath, prompt, options)`**: Gets text response from Claude about PDF content
2. **`analyzePdfToJson(pdfPath, prompt, options)`**: Gets structured JSON response
3. **`splitPdfFirstChunk(pdfPath, maxPages)`**: Extracts first N pages from large PDFs

The PDF analysis process:
1. Converts PDF to base64 encoding
2. Sends to Claude API with proper document type media headers
3. Handles retry logic for network issues and rate limiting
4. Parses and validates response data

## Error Handling and Retries

The system implements comprehensive error handling:

1. **Retry Logic**: For intermittent failures
   - Auto-retries network errors and rate limiting issues
   - Implements exponential backoff between retries
   - Maximum of 3 retry attempts

2. **Fallback Classification**: When Claude API fails
   - Creates basic classification based on filename and extension
   - Provides reasonable document type guesses
   - Uses lower confidence scores for fallback classifications

3. **Cleanup Process**: Automatically removes temporary files
   - Handles any PDF splitting artifacts
   - Cleans up after exceptions

## Database Integration

After successful classification:

1. **Sources Table Update**: Updates `document_type_id` in `sources_google` table
2. **Expert Documents Creation**:
   - Creates minimal record first to ensure database integrity
   - Then updates with full classification metadata and content
   - Uses a two-step approach to handle potential JSON storage issues

## Recent Improvements

Recent updates have enhanced the system's ability to handle large PDFs:

1. **Better Page Estimation**: Improved the heuristic for estimating PDF page count
2. **Robust Splitting**: Enhanced PDF splitting to handle problematic files
3. **Graceful Fallbacks**: Added better fallback options when splitting fails
4. **Error Recovery**: Improved error handling for corrupted PDFs

## Usage Examples

### Basic Classification
```bash
./scripts/cli-pipeline/google_sync/google-sync-cli.sh classify-pdfs --limit 5
```

### Debug Mode with Folder Filter
```bash
./scripts/cli-pipeline/google_sync/google-sync-cli.sh classify-pdfs --debug --folder-id "Research"
```

### Dry Run with Output File
```bash
./scripts/cli-pipeline/google_sync/google-sync-cli.sh classify-pdfs --dry-run --output ./results/classification-results.json
```

## Troubleshooting

Common issues and solutions:

1. **API Connection Errors**: Check Claude API key and network connection
2. **PDF Processing Errors**: 
   - Password-protected PDFs cannot be processed
   - Corrupted PDFs may cause failures
   - Extremely large PDFs (>10MB) exceed Claude's limits
3. **Database Update Issues**: Check Supabase credentials and connection