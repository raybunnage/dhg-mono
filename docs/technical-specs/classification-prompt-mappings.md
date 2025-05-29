# Classification Prompt Mappings

This document defines the mapping between file types (mime types) and their corresponding classification prompts, along with expected output formats.

## Mime Type to Prompt Mappings

### Documents

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `application/pdf` | `pdf-classification-prompt` | .pdf | Scientific papers, reports |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `document-classification-prompt-new` | .docx | Word documents |
| `application/msword` | `document-classification-prompt-new` | .doc | Legacy Word documents |
| `text/plain` | `text-classification-prompt` | .txt | Plain text files |
| `text/markdown` | `markdown-document-classification-prompt` | .md | Markdown documents |

### Presentations

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `powerpoint-classification-prompt` | .pptx | PowerPoint presentations |
| `application/vnd.ms-powerpoint` | `powerpoint-classification-prompt` | .ppt | Legacy PowerPoint |
| `application/vnd.google-apps.presentation` | `google-slides-classification-prompt` | N/A | Google Slides |

### Spreadsheets

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `spreadsheet-classification-prompt` | .xlsx | Excel spreadsheets |
| `application/vnd.ms-excel` | `spreadsheet-classification-prompt` | .xls | Legacy Excel |
| `application/vnd.google-apps.spreadsheet` | `google-sheets-classification-prompt` | N/A | Google Sheets |

### Media Files

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `video/mp4` | `video-classification-prompt` | .mp4 | Video files |
| `video/quicktime` | `video-classification-prompt` | .mov | QuickTime videos |
| `audio/x-m4a` | `audio-classification-prompt` | .m4a | Audio files |
| `audio/mpeg` | `audio-classification-prompt` | .mp3 | MP3 audio |
| `audio/mp3` | `audio-classification-prompt` | .mp3 | Alternative MP3 mime |

### Google Workspace

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `application/vnd.google-apps.document` | `google-doc-classification-prompt` | N/A | Google Docs |
| `application/vnd.google-apps.presentation` | `google-slides-classification-prompt` | N/A | Google Slides |
| `application/vnd.google-apps.spreadsheet` | `google-sheets-classification-prompt` | N/A | Google Sheets |

### Images

| Mime Type | Prompt Name | File Extensions | Notes |
|-----------|------------|-----------------|-------|
| `image/jpeg` | `image-classification-prompt` | .jpg, .jpeg | JPEG images |
| `image/png` | `image-classification-prompt` | .png | PNG images |
| `image/gif` | `image-classification-prompt` | .gif | GIF images |

### Special Cases

| Condition | Prompt Name | Notes |
|-----------|------------|-------|
| Filename contains "transcript" | `transcript-classification-prompt` | Overrides mime type |
| Unknown mime type | `document-classification-prompt-new` | Default fallback |

## Expected Classification Output Format

All classification prompts should return a JSON object with the following structure:

```json
{
  "name": "string",                      // Document type name (e.g., "research paper", "meeting notes")
  "document_type_id": "uuid",            // UUID from document_types table
  "classification_confidence": 0.0-1.0,   // Confidence score
  "classification_reasoning": "string",   // Explanation of classification
  "document_summary": "string",          // Brief summary of content
  "key_topics": ["string"],              // Main topics/themes
  "target_audience": "string",           // Intended audience
  "unique_insights": ["string"],         // Key insights or findings
  "concepts": [                          // Optional: Weighted concepts
    {
      "name": "string",
      "weight": 0.0-1.0,
      "description": "string"            // Optional description
    }
  ]
}
```

### Legacy Format Support

Some prompts may return legacy formats that need to be mapped:

```json
{
  "generalCategory": "string",           // Maps to category
  "specificDocumentType": "string",      // Maps to name
  "keyConcepts": ["string"],            // Maps to key_topics
  "confidence": 0.0-1.0,                // Maps to classification_confidence
  "reasoning": "string"                 // Maps to classification_reasoning
}
```

## Prompt Requirements

Each classification prompt must:

1. **Accept** a document's content as input
2. **Return** valid JSON matching the expected format
3. **Include** confidence scoring (0.0-1.0)
4. **Provide** reasoning for the classification
5. **Extract** key concepts or topics
6. **Identify** the target audience when applicable
7. **Summarize** the document's main points

## Content Extraction Methods

Different file types require different extraction methods:

### Text-Based Files
- **PDF**: Use `pdfProcessorService` to extract text and metadata
- **DOCX/DOC**: Download and extract text content
- **TXT/MD**: Direct text reading
- **Google Docs**: Export as text via Google Drive API

### Presentation Files
- **PPTX/PPT**: Extract slide content and speaker notes
- **Google Slides**: Export as text via Google Drive API

### Media Files
- **Video**: Extract metadata, require separate transcription
- **Audio**: Extract metadata, require separate transcription

### Structured Data
- **XLSX/XLS**: Extract data structure and content
- **Google Sheets**: Export as CSV or structured data

### Images
- **JPEG/PNG/GIF**: Extract metadata, may use OCR if needed

## Testing Requirements

For each mime type mapping:

1. **Unit Test**: Verify correct prompt selection
2. **Integration Test**: Verify prompt availability
3. **Content Test**: Verify extraction method works
4. **Output Test**: Verify classification returns expected format
5. **Edge Case Test**: Handle missing/corrupted files

## Adding New File Types

To add support for a new file type:

1. Add mime type to `mimeTypeToPromptMap` in unified-classification-service.ts
2. Add file extension to `extensionToMimeMap` if needed
3. Create or assign appropriate classification prompt
4. Implement content extraction method
5. Add to `SupportedFileType` type definition
6. Add unit and integration tests
7. Update this documentation

## Performance Considerations

- **Concurrency**: Default to 3 parallel classifications
- **Content Limits**: Truncate content to 16,000 characters for Claude
- **Retry Logic**: 3 attempts with exponential backoff
- **Batch Size**: Process files in chunks to avoid memory issues
- **Caching**: Consider caching prompt templates