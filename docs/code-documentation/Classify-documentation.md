# Classify Document Page Documentation

## Overview
The Classify Document page provides a comprehensive dashboard for managing document classification workflows. It offers tools for extracting content from documents, classifying them using AI, and processing them into expert documents.

## Key Features

### Document Processing Pipeline
- **Content Extraction**: Extracts content from various file types (PDF, DOCX, TXT)
- **Document Classification**: Uses AI to categorize documents based on their content
- **Expert Document Creation**: Transfers classified documents to expert_documents table
- **AI Processing**: Processes expert documents based on their document type

### Document Type Management
- Create, edit, and delete document types
- Generate document types using AI
- Organize document types by categories
- Track document type usage statistics

### Dashboard Views
- Pipeline statistics with progress indicators
- Document statistics by file type and document type
- Document type listing with filtering options

## Database Integration
- Primarily interacts with the following tables:
  - `sources_google`: Source files from Google Drive
  - `document_types`: Classification categories for documents
  - `expert_documents`: Processed documents with AI enrichment

## Main Workflow
1. **Extract Content**: Process files to extract textual content
2. **Classify Documents**: Use AI to determine the document type
3. **Transfer to Expert Documents**: Create structured expert documents
4. **Process with AI**: Extract insights based on document type

## Technical Components

### Content Extraction
The system supports extracting content from:
- DOCX files (using mammoth)
- Text files
- PDF files (via API integration)

### Classification Process
- Uses Claude 3.7 Sonnet to analyze document content
- Compares against known document types
- Assigns confidence scores and provides reasoning
- Updates the source document with classification metadata

### Document Type Model
Document types include:
- `document_type`: Name of the document type
- `category`: Grouping category
- `description`: Detailed description
- `validation_rules`: Rules for validating documents
- `ai_processing_rules`: Instructions for AI processing

### AI Integration
- Communicates with AI models to process documents
- Validates results to ensure proper formatting
- Handles errors and retries when needed

## Implementation Notes
- Robust error handling for network and processing failures
- Batch processing capabilities for handling multiple documents
- Caching of classification results for performance
- Detailed logging for troubleshooting

## User Interface
- Tab-based navigation between Dashboard, Document Types, Utilities, and Results
- Interactive filters for document types
- Progress indicators for processing status
- Detailed forms for document type creation and editing