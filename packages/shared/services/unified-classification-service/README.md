# Unified Classification Service

A comprehensive service that handles document classification for all file types through a single, consistent interface.

## Features

- **Universal File Support**: Handles PDFs, documents, presentations, spreadsheets, media files, and more
- **Intelligent Prompt Selection**: Automatically selects the appropriate classification prompt based on mime type
- **Batch Processing**: Process multiple files with concurrency control
- **Flexible Filtering**: Filter by file type, expert, status, or custom criteria
- **Robust Error Handling**: Graceful failure handling with detailed error reporting
- **Extensible Architecture**: Easy to add new file types and classification prompts

## Usage

### Basic Classification

```typescript
import { unifiedClassificationService } from '@shared/services/unified-classification-service';

// Classify all PDF files
const result = await unifiedClassificationService.classifyDocuments({
  types: ['pdf'],
  limit: 10
});

// Classify multiple file types
const result = await unifiedClassificationService.classifyDocuments({
  types: ['pdf', 'docx', 'pptx'],
  limit: 20,
  concurrency: 5
});
```

### Advanced Options

```typescript
// Force reclassification with custom settings
const result = await unifiedClassificationService.classifyDocuments({
  types: ['pdf', 'docx'],
  force: true,                    // Reclassify even if already classified
  skipClassified: false,          // Process all files
  verbose: true,                  // Detailed logging
  concurrency: 3,                 // Process 3 files at a time
  filterProfile: 'research-docs', // Use specific filter profile
  expertName: 'John Doe',         // Only files for this expert
  customPrompt: 'scientific-document-analysis-prompt'
});

// Dry run to preview what would be classified
const result = await unifiedClassificationService.classifyDocuments({
  types: ['audio', 'video'],
  dryRun: true,
  verbose: true
});
```

## CLI Usage

### Basic Commands

```bash
# Classify all PDF files
./google-sync-cli.sh classify --types pdf

# Classify multiple types with limit
./google-sync-cli.sh classify --types pdf,docx,pptx --limit 20

# Dry run with verbose output
./google-sync-cli.sh classify --types txt,md --dry-run --verbose

# Force reclassification
./google-sync-cli.sh classify --force --types pdf

# Test the service
./google-sync-cli.sh test-classify --test-prompts
```

### Testing Commands

```bash
# Test prompt availability
./google-sync-cli.sh test-classify --test-prompts

# Test specific file
./google-sync-cli.sh test-classify --file-name "research-paper.pdf" --verbose

# Test mime type handling
./google-sync-cli.sh test-classify --mime-type "application/pdf"

# Test content extraction
./google-sync-cli.sh test-classify --test-extraction

# Run health check
./google-sync-cli.sh test-classify
```

## Supported File Types

### Documents
- PDF (`.pdf`)
- Word (`.docx`, `.doc`)
- Text (`.txt`)
- Markdown (`.md`)

### Presentations
- PowerPoint (`.pptx`, `.ppt`)
- Google Slides

### Spreadsheets
- Excel (`.xlsx`, `.xls`)
- Google Sheets

### Media
- Video (`.mp4`, `.mov`)
- Audio (`.m4a`, `.mp3`)

### Images
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)

### Google Workspace
- Google Docs
- Google Slides
- Google Sheets

## Testing

### Run All Tests

```bash
cd packages/shared/services/unified-classification-service
npm test
```

### Run Specific Tests

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests** (`unified-classification-service.test.ts`): Test individual methods and logic
- **Integration Tests** (`integration.test.ts`): Test with real prompts and database queries
- **Manual Testing** (`test-classify.ts`): Interactive testing with real files

## Adding New File Types

1. **Add mime type mapping** in `unified-classification-service.ts`:
   ```typescript
   private mimeTypeToPromptMap: MimeTypePromptMap = {
     // ... existing mappings
     'application/new-type': 'new-type-classification-prompt',
   };
   ```

2. **Add file extension** if needed:
   ```typescript
   private extensionToMimeMap: Record<string, string> = {
     // ... existing mappings
     'newext': 'application/new-type',
   };
   ```

3. **Add to SupportedFileType** in `types.ts`:
   ```typescript
   export type SupportedFileType = 'pdf' | 'docx' | /* ... */ | 'new-type';
   ```

4. **Implement content extraction** method:
   ```typescript
   private async extractNewTypeContent(file: SourceFile): Promise<ContentExtractionResult> {
     // Implementation
   }
   ```

5. **Add tests** for the new file type

6. **Update documentation** in `classification-prompt-mappings.md`

## Architecture

### Service Structure

```
UnifiedClassificationService
├── classifyDocuments()           # Main entry point
├── processFile()                 # Process individual file
├── extractContent()              # Extract content based on type
├── selectPrompt()                # Select appropriate prompt
├── classifyContent()             # Call Claude for classification
└── saveClassification()          # Save results to database
```

### Data Flow

1. **Query Files**: Get files from google_sources based on filters
2. **Extract Content**: Use appropriate method for file type
3. **Select Prompt**: Choose classification prompt based on mime type
4. **Classify**: Send content to Claude with selected prompt
5. **Parse Result**: Extract classification data from response
6. **Save Results**: Update google_sources and expert_documents
7. **Save Concepts**: Store extracted concepts in learn_document_concepts

## Error Handling

The service handles various error scenarios:

- **Missing prompts**: Falls back to default prompt
- **Content extraction failures**: Records error and continues
- **Claude API errors**: Retries with exponential backoff
- **Database errors**: Logs and reports in batch results
- **Invalid file types**: Skips with appropriate message

## Performance Considerations

- **Concurrency**: Default 3 parallel classifications
- **Content Limits**: 16,000 character limit for Claude
- **Batch Processing**: Processes files in chunks
- **Memory Management**: Cleans up temporary files
- **Rate Limiting**: Built-in delays between API calls

## Troubleshooting

### Common Issues

1. **"No classification prompt found"**
   - Check mime type is in `mimeTypeToPromptMap`
   - Verify prompt exists in database

2. **"Failed to extract content"**
   - Check file exists in Google Drive
   - Verify Google Drive API credentials
   - Check file permissions

3. **"Classification failed"**
   - Check Claude API key is set
   - Verify prompt returns valid JSON
   - Check for rate limiting

4. **Performance Issues**
   - Reduce concurrency
   - Process smaller batches
   - Check for large files

### Debug Mode

Enable verbose logging for detailed information:

```bash
./google-sync-cli.sh classify --verbose --types pdf --limit 1
```

## Future Enhancements

- [ ] Add caching for prompt templates
- [ ] Implement progress tracking for large batches
- [ ] Add support for custom content extractors
- [ ] Create web UI for classification management
- [ ] Add classification quality metrics
- [ ] Implement automatic retraining based on feedback