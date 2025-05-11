# Google Drive Document Classification Commands

This document explains the various commands available in the Google Sync CLI pipeline for classifying different types of documents. Each command is specialized for specific file types and processing stages.

## Overview of Commands

| Command | File Type | Processing Type | Prompt Used | Purpose |
|---------|-----------|----------------|-------------|---------|
| `classify-pdfs-with-service` | PDF | Classification | `scientific-document-analysis-prompt` | Classifies PDF files, handles large PDFs by extracting portions |
| `classify-powerpoints` | PPTX | Content extraction & Classification | `scientific-powerpoint` | Extracts content from PowerPoint files and classifies them |
| `classify-docs-service` | DOCX, TXT | Classification only | `document-classification-prompt-new` | Classifies DOCX/TXT files that already have content extracted |
| `reprocess-docx-files` | DOCX | Content re-extraction & Classification | Various | Specifically targets DOCX files that need reprocessing |
| `process-unprocessed` | DOCX, PDF | Full pipeline (extraction + classification) | Various | General command for unprocessed files with "unprocessed" status |
| `classify-unprocessed-with-content` | DOCX, TXT, PPTX | Classification only | `document-classification-prompt-new` | For files with content that still need classification |
| `reclassify-docs` | All | Re-classification | Various | Re-runs classification for files marked as "needs_reprocessing" |

## Detailed Command Descriptions

### 1. `classify-pdfs-with-service`

**File Type:** PDF  
**Purpose:** Classify PDF files missing document types  
**Prompt Used:** `scientific-document-analysis-prompt`  

**Key Features:**
- Downloads PDF files from Google Drive
- Handles large PDFs by extracting first 50 pages to stay within Claude's size limits
- Classifies using Claude's direct PDF analysis capability
- Updates `sources_google` with document_type_id = `2fa04116-04ed-4828-b091-ca6840eb8863` (PDF document type)  
- Creates expert_document with document_type_id = `2f5af574-9053-49b1-908d-c35001ce9680` (JSON PDF summary)

**Usage:**
```bash
./google-sync-cli.sh classify-pdfs --limit 5 --verbose
```

### 2. `classify-powerpoints`

**File Type:** PPTX  
**Purpose:** Extract content from PowerPoint files and classify them  
**Prompt Used:** `scientific-powerpoint`  

**Key Features:**
- Downloads PPTX files from Google Drive
- Extracts text content using multiple methods (office-text-extractor, pptx-text-parser, pptx-parser, etc.)
- Classifies content using Claude AI with specialized PowerPoint prompt
- Maps document_type string to document_type_id using database lookup
- Updates both sources_google and creates expert_document records
- expert_document document_type_id is set to `957d8720-473e-4820-b115-88d6a931a7d8` (PowerPoint)

**Usage:**
```bash
./google-sync-cli.sh classify-powerpoints --limit 3 --concurrency 2 --verbose
```

### 3. `classify-docs-service`

**File Type:** DOCX, TXT  
**Purpose:** Classify documents that already have content extracted  
**Prompt Used:** `document-classification-prompt-new`  

**Key Features:**
- Only updates the document_type_id in the sources_google table
- Does NOT update document_type_id in expert_documents (only classification metadata)
- Only processes files with needs_reprocessing status or null document_type_id
- Specifically uses the document-classification-prompt-new prompt
- Marks files as "reprocessing_done" when complete

**Usage:**
```bash
./google-sync-cli.sh classify-docs-service --limit 10 --concurrency 2
```

### 4. `reprocess-docx-files`

**File Type:** DOCX  
**Purpose:** Reprocess DOCX files marked as "needs_reprocessing"  
**Prompt Used:** Various (based on sub-command)  

**Key Features:**
- Specifically targets DOCX files with "needs_reprocessing" status
- Uses the same command patterns as classify-docs-service
- Wrapper that ensures proper DOCX file specific handling

**Usage:**
```bash
./google-sync-cli.sh reprocess-docx-files --limit 10 --verbose
```

### 5. `process-unprocessed`

**File Type:** DOCX, PDF (configurable by mime type)  
**Purpose:** Full pipeline for files with "unprocessed" status  
**Prompt Used:** Various (based on file type)  

**Key Features:**
- Focuses on files with pipeline_status = "unprocessed" 
- Different processing logic based on mime type:
  - DOCX: Downloads, extracts content with Mammoth, updates expert_document with raw_content, sets status to "needs_classification"
  - PDF: Downloads, processes with Claude AI directly, updates expert_document with classification metadata, sets status to "processed"
- PDF files are fully processed in one step (extraction + classification)
- DOCX files are processed in two steps (extraction, then later classification)

**Usage:**
```bash
./google-sync-cli.sh process-unprocessed --limit 5 --mime-type application/pdf
```

### 6. `classify-unprocessed-with-content`

**File Type:** DOCX, TXT, PPTX  
**Purpose:** Classify files with content that still need classification  
**Prompt Used:** `document-classification-prompt-new`  

**Key Features:**
- Finds files with expert_documents that have raw_content but need classification
- Targets files with no document_type_id OR pipeline_status = "unprocessed"
- Uses document-classification-prompt-new prompt for consistent classification
- Updates sources_google.document_type_id
- Updates expert_documents with classification_metadata and sets pipeline_status = "processed"
- Also stores concepts in document_concepts table

**Usage:**
```bash
./google-sync-cli.sh classify-unprocessed-with-content --limit 5 --mime-types docx,txt
```

### 7. `reclassify-docs`

**File Type:** All (DOCX, PDF, PPTX, MP4)  
**Purpose:** Re-classify documents marked as needs_reprocessing  
**Prompt Used:** Various (based on file type)  

**Key Features:**
- Master command that handles multiple file types
- Dynamically routes to appropriate classification command based on file extension:
  - .docx → `force-reclassify` or `classify-docs-service`
  - .pdf → `force-reclassify` or `classify-pdfs`
  - .pptx → `force-reclassify` or `classify-powerpoints`
  - .mp4 → marked as "skip_processing" (videos aren't text processed)
- Generates detailed processing report with counts by file type

**Usage:**
```bash
./google-sync-cli.sh reclassify-docs --dry-run
./google-sync-cli.sh reclassify-docs 200 # process up to 200 files
```

## Claude Prompts Used

Each command uses specialized prompts designed for specific file types:

1. **scientific-document-analysis-prompt** (for PDF classification)
   - Two-layer classification approach (category + specific type)
   - Designed for scientific research papers
   - Generates comprehensive summary, key topics, clinical implications
   - Used by classify-pdfs-with-service

2. **scientific-powerpoint** (for PowerPoint classification)
   - Specialized for presentation content
   - Includes PowerPoint slide organization suggestions
   - Recognizes slide structure and content patterns
   - Used by classify-powerpoints

3. **document-classification-prompt-new** (general document classification)
   - Two-layer classification (category + specific document type)
   - More general purpose classification for any document type
   - Focuses on extracting key concepts with confidence weights
   - Used by classify-docs-service and classify-unprocessed-with-content

## Choosing the Right Command

When deciding which command to use:

1. **For new unprocessed files**:
   - Start with `process-unprocessed` to handle initial extraction
   - Or use specific commands based on file type:
     - PDF files: `classify-pdfs-with-service`
     - PowerPoint files: `classify-powerpoints`
     - DOCX/TXT files: both extraction and classification steps needed

2. **For files that need reprocessing**:
   - Use `reclassify-docs` as the general-purpose command
   - For specific file types, use:
     - DOCX files: `reprocess-docx-files`
     - Multiple file types with needs_reprocessing: `reclassify-docs`

3. **For files with content but missing classification**:
   - Use `classify-unprocessed-with-content`

4. **For bulk updates to pipeline status**:
   - Use `update-pipeline-status` to fix status inconsistencies
   - `update-processed-records` to update records with valid content

## Database Table Updates

Different commands update different database tables:

- **sources_google**:
  - document_type_id: Updated by all classification commands
  
- **expert_documents**:
  - document_type_id: Updated by some commands (varies)
  - classification_metadata: Updated by all commands
  - raw_content: Updated by content extraction commands
  - pipeline_status: Updated by most commands
  - processed_content: Updated by classification commands
  - reprocessing_status: Updated by commands handling reprocessing

- **document_concepts**:
  - Only updated by classify-unprocessed-with-content