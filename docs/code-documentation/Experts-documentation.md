# Experts Page Documentation

## Overview
The Experts Profiles page provides a file browsing and viewing interface specifically for managing expert profiles and related documentation. It displays files from Google Drive that are associated with expert documents, allowing users to browse, select, and view these files.

## Key Features

### File Browsing
- Hierarchical display of files from Google Drive
- File selection and navigation capabilities
- Detailed file metadata display
- Integration with expert document data

### File Viewing
- Built-in file preview functionality
- Support for various document types
- View expert document processing status
- Access to file metadata and properties

### Expert Document Integration
- Links Google Drive files to their expert document records
- Shows processing status for expert documents
- Displays batch processing information
- Tracks error messages and processing statistics

### Batch Processing Status
- Displays computed status of document processing
- Shows error rate percentage for processing batches
- Tracks processing duration in hours
- Identifies top error types for troubleshooting

## Technical Components

### Database Integration
- Queries the `sources_google` table for file listings
- Joins with `expert_documents` for processing information
- Accesses `batch_processing_status` for detailed batch information
- Maps database records to FileNode structures for the UI

### File Node Structure
The component maps Supabase database records to a FileNode interface that includes:
- File identification (ID, name, etc.)
- MIME type and path information
- Content extraction status
- Web view links for Google Drive integration
- Metadata including file size information
- Associated expert document details

### Expert Document Data
The expert document data includes:
- Processing status (pending, processing, completed, error)
- Batch identification
- Error messages for failed processing
- Processing timestamps (queued, started, completed)
- Error tracking and retry information
- Batch status with aggregated metrics

### UI Components
- FileTree: Displays hierarchical file structure
- FileViewer: Renders selected file content
- SourceButtons: Provides action buttons for file operations

## Implementation Notes

### Data Loading Process
1. Queries Supabase for sources_google records
2. Includes nested expert_documents and batch_processing_status data
3. Maps database records to FileNode interface
4. Renders tree structure for navigation

### Error Handling
- Implements error states for loading failures
- Shows toast notifications for errors
- Logs detailed error information to console
- Provides feedback on query failures

### Performance Considerations
- Sets loading state during data fetching
- Optimizes queries with necessary selections
- Handles rendering of potentially large file lists
- Implements conditional rendering for UI components

## Usage
The Experts Profiles page is primarily used by team members working with expert profiles to:
1. Browse files associated with experts
2. View the processing status of expert documents
3. Access document content and metadata
4. Monitor batch processing performance

## Future Enhancements
- Selection change event handling
- Additional file metadata display
- Expanded expert document information
- Document processing actions and controls