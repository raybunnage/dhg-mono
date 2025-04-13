# Docs Page Documentation

## Overview
The Docs page provides a comprehensive interface for managing and viewing documentation files stored in the repository. It allows users to browse, search, filter, view, and manage documentation across different categories.

## Features
- **Documentation Browser**: Hierarchical view of documentation files organized by type/folder
- **File Viewer**: Built-in markdown viewer for displaying file content
- **Search Functionality**: Full-text search across file paths, titles, summaries, and tags
- **Tag-Based Filtering**: Filter documents by AI-generated or manual tags
- **File Metadata Display**: View comprehensive file metadata including summaries and assessments
- **File Management**: Archive and delete documentation files
- **Duplicate Detection**: Identify and manage duplicate files across the repository

## Implementation Details

### Component Structure
The main component is located at `apps/dhg-improve-experts/src/pages/Docs.tsx` and consists of:

1. **Left Panel**: Document tree view organized by document types/folders
2. **Right Panel**: Document content viewer with file metadata, summary, and content

### Data Models
The component uses several TypeScript interfaces:
- `DocumentationFile`: Represents a documentation file with metadata from Supabase
- `DocumentType`: Information about document type categories
- `DocumentTypeGroup`: Custom grouping for organizing files in the UI

### Core Functionality
1. **File Organization**: Files are organized by folder path rather than document type
2. **Markdown Rendering**: Displays markdown files with proper formatting using the MarkdownViewer component
3. **Search and Filter**: Allows searching across multiple fields and tag-based filtering
4. **File Management**: Provides operations to archive or delete files
5. **Duplicate Detection**: Automatically identifies files with the same name in different locations

### Technical Details
- Uses Supabase for database operations
- Uses markdownFileService for file operations
- Groups files based on their directory structure 
- Handles various tag formats (arrays, JSON strings, comma-separated values)
- Shows file metadata in collapsible sections

## Integration Points
- `supabase`: Database integration for querying documentation files
- `markdownFileService`: Service for reading and managing markdown files
- `MarkdownViewer`: Component for rendering markdown content

## User Interaction
1. Users can navigate the document tree in the left panel
2. Selecting a file displays its content in the right panel
3. File metadata and summaries appear in collapsible sections
4. Files can be searched by content or filtered by tags
5. Document operations include archiving and deletion