# Write Page Documentation

## Overview
The Write page provides a powerful multi-document summarization and analysis tool. It enables users to select primary documents, find related documents, configure summarization parameters, and generate comprehensive summaries using AI.

## Key Features

### Document Selection
- Browse and select files from Google Drive
- Filter documents by type and search terms
- Preview document content in an embedded viewer
- Navigate folder structures to find relevant documents

### Related Document Discovery
- Automatically finds related documents based on folder location
- Enables selection of multiple related documents for analysis
- Provides previews of related document content
- Shows document summaries when available

### Summary Configuration
- Multiple summary types:
  - Comprehensive Analysis
  - Comparative Analysis
  - Executive Summary
- Custom instruction input for tailored summaries
- Interactive prompt builder dialog
- Summary type selection with visual indicators

### AI-Generated Summaries
- Generates structured multi-document summaries
- Formats summaries with headers, lists, and paragraphs
- Provides options to export or copy summary content
- Includes reference citations to source documents

## Technical Components

### Document Retrieval
- Integrates with Supabase to fetch document metadata
- Queries the `sources_google` table for file listings
- Loads document types from `uni_document_types` table
- Handles both folders and individual documents

### Document Preview
- Embeds Google Drive viewer for document previews
- Extracts Drive IDs from web view links
- Handles various document formats (PDF, DOCX, etc.)
- Provides fallbacks for documents without preview support

### Document Relationships
- Finds related documents using folder-based relationships
- Links to expert documents when available
- Fetches document summaries for context
- Caches document summary data for improved performance

### Summary Generation
- Implements mock summary generation (placeholder for AI integration)
- Structures summaries based on selected format
- Includes document references and metadata
- Formats output with headings, bullets, and paragraphs

## UI Components

### Navigation Tabs
- Select Document
- Related Documents
- Configure Summary
- View Summary

### Document Browser
- Folder navigation
- Document type filtering
- Search functionality
- Document preview pane

### Related Document Selector
- Document cards with metadata
- Selection checkboxes
- Preview capabilities
- Summary information display

### Summary Configuration
- Summary type selection cards
- Custom instruction editor
- Document overview accordion
- Processing status indicators

## Implementation Notes

### Document Data Model
- Primary document selection with metadata
- Related document array with selection state
- Document summaries cache using source IDs
- Prompt and configuration state management

### User Flow
1. Select primary document from browser
2. Choose related documents to include in analysis
3. Configure summary type and custom instructions
4. Generate summary with AI processing
5. View, copy, or export the generated summary

### React Component Structure
- Tab-based navigation using `Tabs` component
- Card-based layouts for document selection
- Dialog components for expanded views
- Accordion elements for collapsible sections

### UI Libraries
- Uses Lucide icons for visual elements
- Implements Shadcn UI component library
- Utilizes custom hooks for state management
- Responsive grid layouts for different screen sizes

## Future Enhancements
- Integration with real AI processing API
- Additional summary formats and templates
- Document content extraction improvements
- Enhanced content visualization options