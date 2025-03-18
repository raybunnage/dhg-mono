# DHG Improve Experts Code Audit

## Table of Contents
- [Introduction](#introduction)
- [Components](#components)
- [Lib](#lib)
- [Utils](#utils)
- [Pages](#pages)
- [App](#app)
- [Summary and Recommendations](#summary-and-recommendations)

## Introduction

This document provides a comprehensive audit of the `dhg-improve-experts` application, focusing on key files and functionality within the `src` directory. The application appears to be a document processing tool that extracts expert profiles from various document types using AI (Claude), with integrations to Google Drive and Supabase.

## Components

### Authentication & Layout

#### AuthRequired.tsx
- **Purpose**: Authentication guard component that redirects unauthenticated users.
- **Dependencies**: React router, Supabase auth hooks.
- **Status**: Core authentication component, actively used.
- **Integration**: Supabase for auth verification.
- **Improvement Potential**: Add role-based access control.

#### MainLayout.tsx
- **Purpose**: Main application layout structure.
- **Dependencies**: Header component, navigation components.
- **Status**: Core structural component, actively used.
- **Improvement Potential**: Add layout customization options and themes.

#### MainNavbar.tsx
- **Purpose**: Main navigation component with app structure.
- **Dependencies**: UI components, routing.
- **Status**: Core structural component, actively used.
- **Improvement Potential**: Add responsive design improvements for smaller screens.

#### Header.tsx
- **Purpose**: Main application header component.
- **Dependencies**: UI components, authentication state.
- **Status**: Core layout component, actively used.
- **Improvement Potential**: Add context-aware navigation options.

#### EnvironmentBadge.tsx
- **Purpose**: Visual indicator showing the current environment (dev/staging/prod).
- **Dependencies**: UI components, environment configuration.
- **Status**: Utility component, likely actively used.
- **Improvement Potential**: Add click functionality to show more environment details.

### Document Processing

#### PDFViewer.tsx
- **Purpose**: PDF document viewer component.
- **Dependencies**: react-pdf, UI components, Lucide icons.
- **Status**: Complete and actively used.
- **Improvement Potential**: Add page navigation, search, annotations, and mobile controls.

#### DocumentActions.tsx
- **Purpose**: Simple UI component that provides a three-step process for document actions.
- **Dependencies**: ExtractContentButton, GetContentButton, ExtractButton.
- **Status**: Simple UI component, likely still in use.
- **Improvement Potential**: Add progress indicators, status checking, error handling.

#### ExtractButton.tsx, ExtractContentButton.tsx, GetContentButton.tsx
- **Purpose**: Button components for content extraction operations.
- **Dependencies**: UI components (Button), extraction utilities.
- **Status**: Utility components, actively used.
- **Improvement Potential**: Consolidate into a single configurable component.

#### ExtractedContentViewer.tsx
- **Purpose**: Displays extracted content from documents.
- **Dependencies**: UI components, content formatting utilities.
- **Status**: Active component for content display.
- **Improvement Potential**: Add search/filter capabilities within extracted content.

#### AnalysisDebugger.tsx
- **Purpose**: Debug tool for examining the analysis of content.
- **Dependencies**: UI components (Accordion, Card), React state hooks.
- **Status**: Debug utility, actively used.
- **Improvement Potential**: Add filtering options for large analysis results.

### File Management

#### FileTree.tsx
- **Purpose**: Sophisticated file browser showing a hierarchical view of files/folders from Google Drive.
- **Dependencies**: React hooks, Supabase client, FileTreeItem component.
- **Status**: Actively used with recent updates (archive from 2025-02-16).
- **Integration**: Google Drive for file structure, Supabase for processing status.
- **Improvement Potential**: Performance optimization, code refactoring, completion of processing implementation.

#### FileTreeItem.tsx
- **Purpose**: Renders individual items in the file tree.
- **Dependencies**: UI components, file type detection utilities.
- **Status**: Active component for file display.
- **Improvement Potential**: Better keyboard accessibility, drag-and-drop functionality.

#### FileList.tsx
- **Purpose**: Displays a list of files with selection capabilities.
- **Dependencies**: UI components, file data structures.
- **Status**: Active component for file listing.
- **Improvement Potential**: Add sorting and filtering options.

#### FileViewer.tsx
- **Purpose**: Universal file viewer for different file types.
- **Dependencies**: PDF viewer, possibly other file type viewers.
- **Status**: Core component for document viewing, actively used.
- **Improvement Potential**: Add support for more file types.

### Expert Management

#### ExpertProfileExtractor.tsx
- **Purpose**: UI for extracting expert profiles from source documents.
- **Dependencies**: React hooks, Supabase client, AI processing utilities.
- **Status**: Core functionality component, actively used.
- **Integration**: AI services (Claude) for extraction, Supabase for storage.
- **Improvement Potential**: Add batch processing capability for multiple experts.

#### ExpertForm.tsx
- **Purpose**: Form for creating and updating expert records.
- **Dependencies**: React hooks, react-hook-form, UI components.
- **Status**: Simple but actively used CRUD form.
- **Integration**: Supabase for expert data storage.
- **Improvement Potential**: Add form validation, multi-step functionality, expertise autocomplete.

#### ExpertCard.tsx
- **Purpose**: Card component displaying expert information.
- **Dependencies**: UI components (Card, Avatar), expert data types.
- **Status**: Core component for expert display, actively used.
- **Improvement Potential**: Add a compact variant for dense listings.

#### ProcessedProfileViewer.tsx
- **Purpose**: Displays processed expert profiles.
- **Dependencies**: UI components, expert profile data structures.
- **Status**: Active component for profile viewing.
- **Improvement Potential**: Add editing capabilities directly in the viewer.

### Batch Processing

#### BatchManager.tsx, BatchProcessing.tsx, BatchProcessingMonitor.tsx, BatchProgress.tsx
- **Purpose**: Suite of components for managing batch operations.
- **Dependencies**: React state hooks, UI components, batch-processor utility.
- **Status**: Active components for batch processing operations.
- **Integration**: Supabase for data persistence, possibly AI services.
- **Improvement Potential**: Complete BatchStatus component, add pagination, proper error handling.

#### ProcessingControls.tsx
- **Purpose**: UI controls for document processing operations.
- **Dependencies**: UI components, processing utilities.
- **Status**: Active component for processing workflows.
- **Improvement Potential**: Add saving of processing configurations.

### Audio Processing

#### AudioPlayer.tsx
- **Purpose**: Audio playback component for transcribed content.
- **Dependencies**: React hooks, HTML5 audio element.
- **Status**: Active component for audio playback functionality.
- **Improvement Potential**: Add volume control, playback speed options.

### Other Components

#### ChatContent.tsx
- **Purpose**: Displays chat/conversation content.
- **Dependencies**: UI components, possibly markdown rendering libraries.
- **Status**: Appears to be actively used.
- **Improvement Potential**: Add support for rich media in messages.

#### RegistryViewer.tsx
- **Purpose**: Displays registered functions in the function registry.
- **Dependencies**: React, Supabase client, database types.
- **Status**: Development tool, fully implemented.
- **Improvement Potential**: Add filtering, sorting, pagination, and search functionality.

#### FunctionUsageTooltip.tsx
- **Purpose**: Displays usage information for functions in tooltips.
- **Dependencies**: UI components (Tooltip), function registry data.
- **Status**: Utility component, likely still used.
- **Improvement Potential**: Add examples of function usage.

#### SourceButtons.tsx, SourcesView.tsx
- **Purpose**: Components for source management and viewing.
- **Dependencies**: UI components, source management utilities.
- **Status**: Active components for source handling.
- **Improvement Potential**: Add batch operations for sources.

## Lib

### google-drive.ts
- **Purpose**: Google Drive integration utility.
- **Key Functions**: Authentication, file listing, download, file content retrieval.
- **Status**: Core Google Drive integration, actively used.
- **Integration**: Google Drive API.
- **Improvement Potential**: Add token refresh handling, better type safety, error handling.

### google-drive/sync.ts
- **Purpose**: Synchronizes Google Drive files and metadata.
- **Key Functions**: File synchronization, metadata mapping.
- **Status**: Active sync utility.
- **Integration**: Google Drive API, likely Supabase for metadata storage.
- **Improvement Potential**: Add caching for frequently accessed files.

### pdf-utils.ts and pdf-worker.ts
- **Purpose**: Utilities for PDF processing and manipulation.
- **Key Functions**: Text extraction, parsing, page handling.
- **Status**: Core PDF utilities, actively used.
- **Improvement Potential**: Add support for form field extraction.

### supabase.ts and supabase/ directory
- **Purpose**: Supabase client configuration and data access functions.
- **Key Functions**: Database operations, authentication, file storage.
- **Status**: Core infrastructure, actively used.
- **Integration**: Direct integration with Supabase services.
- **Improvement Potential**: Add more robust error handling and retries.

### supabase/client.ts
- **Purpose**: Initializes and exports the Supabase client.
- **Status**: Core infrastructure component, actively used.
- **Improvement Potential**: Add error handling for missing environment variables, authentication state management.

### supabase/expert-documents.ts and sources-google.ts
- **Purpose**: Specialized database operations for expert documents and Google sources.
- **Status**: Active database access layers.
- **Integration**: Supabase, possibly Google Drive for metadata.
- **Improvement Potential**: Add query builders for complex operations.

### utils.ts
- **Purpose**: General utility functions.
- **Key Functions**: Formatting, validation, data transformation.
- **Status**: Core utilities, actively used.
- **Improvement Potential**: Add comprehensive documentation for each utility.

## Utils

### ai-processing.ts
- **Purpose**: Utilities for AI content processing.
- **Key Functions**: Sending content to AI services (Claude), parsing responses, validation.
- **Status**: Core AI integration, actively used.
- **Integration**: Claude API (using claude-3-5-sonnet-20241022 model), Supabase.
- **Improvement Potential**: Add rate limiting, caching, streaming responses, model fallbacks.

### audio-extractor.ts
- **Purpose**: Extracts audio from video files using browser-based FFmpeg.
- **Key Functions**: `extractAudio` - processes video to MP3 audio.
- **Status**: Functional but minimally used.
- **Improvement Potential**: Add error handling, format options, progress callbacks.

### audio-pipeline.ts
- **Purpose**: Audio processing pipeline from Google Drive.
- **Key Functions**: Download and process audio files.
- **Status**: Currently disabled/transitional with placeholder implementations.
- **Integration**: References Google Drive and Supabase (but disabled).
- **Improvement Potential**: Re-implement core functionality, add error handling.

### whisper-processing.ts
- **Purpose**: Process audio files with OpenAI's Whisper speech-to-text.
- **Key Functions**: Audio extraction, chunking, transcription with Whisper API.
- **Status**: Active and functional core component.
- **Integration**: OpenAI Whisper API, Supabase, Google Drive.
- **Improvement Potential**: Implement caching, add more formats, improve parallel processing.

### batch-processor.ts
- **Purpose**: Manages batched processing of items with concurrency control.
- **Key Functions**: Queue management, status tracking, database operations.
- **Status**: Core batch processing utility, actively used.
- **Integration**: Supabase for batch tracking, audio processing.
- **Improvement Potential**: Add prioritization, better error recovery, batch cancellation.

### code-analysis/ directory
- **Purpose**: Utilities for code analysis and detection.
- **Key Functions**: Pattern detection, code parsing, analysis pipelines.
- **Status**: Specialized utilities, likely actively used for code analysis.
- **Improvement Potential**: Add support for more programming languages.

### database.ts
- **Purpose**: Database utility functions beyond the Supabase client.
- **Key Functions**: Complex queries, data transformations, batch operations.
- **Status**: Core database utilities, actively used.
- **Integration**: Supabase.
- **Improvement Potential**: Add query builders for complex operations.

### document-processing.ts
- **Purpose**: Document processing utilities for extraction and classification.
- **Key Functions**: Batch processing, AI integration, error handling.
- **Status**: Active and maintained with recent improvements.
- **Integration**: Supabase (expert_documents, sources_google), Claude AI, Google Drive.
- **Improvement Potential**: Fix Anthropic import, complete PDF extraction, add rate limiting.

### format.ts
- **Purpose**: Formatting utilities for various data types.
- **Key Functions**: Date formatting, number formatting, text formatting.
- **Status**: General utilities, actively used.
- **Improvement Potential**: Add localization support for formats.

### function-registry.ts
- **Purpose**: Registry system to track and document application functions.
- **Key Functions**: Function registration, metadata management.
- **Status**: Active but early stage implementation.
- **Integration**: Supabase for registry storage.
- **Improvement Potential**: Add more registrations, implement automatic discovery.

### function-decorators.ts
- **Purpose**: TypeScript decorators for function registry integration.
- **Key Functions**: `RegisterFunction` decorator for automatic registration.
- **Status**: Incomplete with TypeScript errors.
- **Improvement Potential**: Fix TypeScript errors, add error handling, documentation generation.

### google-auth.ts, google-drive-sync.ts, google-drive.ts
- **Purpose**: Google Drive authentication and synchronization.
- **Key Functions**: OAuth flow, token management, file operations.
- **Status**: Active Google Drive integration utilities.
- **Integration**: Google Drive API.
- **Improvement Potential**: Add more granular permission handling.

### metadata-sync.ts
- **Purpose**: Synchronizes metadata between services.
- **Key Functions**: Metadata extraction, transformation, synchronization.
- **Status**: Likely active for maintaining data consistency.
- **Integration**: Likely Supabase and Google Drive.
- **Improvement Potential**: Add conflict resolution strategies.

### prompt-loader.ts
- **Purpose**: Loads and manages AI prompts.
- **Key Functions**: Prompt loading, variable substitution, template management.
- **Status**: Active utility for AI prompting.
- **Integration**: Works with AI processing utilities.
- **Improvement Potential**: Add versioning for prompts, A/B testing capabilities.

### registrations/ directory
- **Purpose**: Contains function registrations for various modules.
- **Key Functions**: Function registration for different domains.
- **Status**: Core function registration, actively used.
- **Improvement Potential**: Add automated testing for registered functions.

### scan-functions.ts
- **Purpose**: Scans codebase for registrable functions.
- **Key Functions**: Code scanning, function discovery, metadata extraction.
- **Status**: Development utility, may not be used in production.
- **Improvement Potential**: Add incremental scanning for better performance.

## Pages

### Analyze.tsx
- **Purpose**: Page for analyzing code files, particularly React components.
- **Key Functions**: File selection, code analysis, results display.
- **Status**: Active development with debug features.
- **Integration**: Uses code-analysis-system, likely integrates with AI.
- **Improvement Potential**: Code organization, TypeScript improvements, error handling.

### ClassifyDocument.tsx
- **Purpose**: Document classification interface.
- **Key Functions**: Document type classification, content extraction, database operations.
- **Status**: Active and maintained component.
- **Integration**: Supabase (complex queries), AI services, Google Drive.
- **Improvement Potential**: Refactor large component, complete unimplemented methods.

### ExpertDetail.tsx
- **Purpose**: Page showing detailed expert information.
- **Key Functions**: Expert data display, related documents, profile editing.
- **Status**: Core expert management page, actively used.
- **Integration**: Retrieves data from Supabase.
- **Improvement Potential**: Add activity history, expertise visualization.

### ExpertProfiles.tsx, Experts.tsx
- **Purpose**: Pages for expert profile management and listing.
- **Key Functions**: Profile listing, filtering, actions.
- **Status**: Core expert management pages, actively used.
- **Integration**: Retrieves data from Supabase.
- **Improvement Potential**: Add advanced filtering and sorting options.

### FileTree.tsx
- **Purpose**: Page for file exploration.
- **Key Functions**: Tree view, file operations, navigation.
- **Status**: Active page for file management.
- **Integration**: Likely integrates with Google Drive.
- **Improvement Potential**: Add drag-and-drop file organization.

### Supabase.tsx
- **Purpose**: Page for Supabase data exploration or management.
- **Key Functions**: Data viewing, possibly direct manipulation.
- **Status**: Possibly an admin/development tool.
- **Integration**: Direct integration with Supabase.
- **Improvement Potential**: Add data export/import capabilities.

### Transcribe.tsx
- **Purpose**: Page for audio transcription.
- **Key Functions**: Audio upload, transcription, result editing.
- **Status**: Active page for transcription functionality.
- **Integration**: Whisper service, Supabase for results.
- **Improvement Potential**: Add real-time transcription for streaming audio.

### document-testing.tsx
- **Purpose**: Testing page for document processing.
- **Key Functions**: Test routines, result validation, debugging.
- **Status**: Development/testing page, may not be used in production.
- **Improvement Potential**: Add automated test cases, reporting.

### documents/index.tsx
- **Purpose**: Main document management page.
- **Key Functions**: Document listing, filtering, operations.
- **Status**: Core document management page, actively used.
- **Integration**: Retrieves data from Supabase.
- **Improvement Potential**: Add advanced search capabilities, bulk operations.

### file-explorer.tsx
- **Purpose**: File exploration interface.
- **Key Functions**: Directory navigation, file operations, search.
- **Status**: Active page for file management.
- **Integration**: Likely integrates with Google Drive.
- **Improvement Potential**: Add search within files, favorites.

### function-registry.tsx
- **Purpose**: Page for exploring registered functions.
- **Key Functions**: Function listing, filtering, details.
- **Status**: Development/admin tool.
- **Improvement Potential**: Add function testing interface.

### mp4-test.tsx, pdf-test-extract.tsx
- **Purpose**: Test pages for media processing.
- **Key Functions**: Media file testing, extraction testing.
- **Status**: Development tools, may not be used in production.
- **Improvement Potential**: Consolidate test pages into a test suite.

### pdf-research-portal.tsx
- **Purpose**: Interface for researching through PDF documents.
- **Key Functions**: Document search, content extraction, annotation.
- **Status**: Specialized research tool, likely actively used.
- **Integration**: Likely integrates with AI services, Supabase.
- **Improvement Potential**: Add collaborative annotation features.

### source-buttons.tsx, source-management.tsx
- **Purpose**: Pages for source management.
- **Key Functions**: Source operations, listing, configuration.
- **Status**: Core source management functionality, actively used.
- **Integration**: Likely integrates with Google Drive, Supabase.
- **Improvement Potential**: Add source verification, health checks.

## App

### app/experts/profiler/page.tsx
- **Purpose**: Page component that displays expert document folders in a tree structure.
- **Dependencies**: FileTree component.
- **Status**: Active page in the application navigation.
- **Integration**: Indirectly with Supabase and Google Drive through FileTree.
- **Improvement Potential**: Add authentication checks, loading states, search functionality.

## Summary and Recommendations

The `dhg-improve-experts` application is a sophisticated document processing system that:

1. **Integrates multiple external services:**
   - Claude AI for document analysis and expert profile extraction
   - Google Drive for document storage and retrieval
   - Supabase for database operations and file storage
   - OpenAI Whisper for audio transcription

2. **Provides comprehensive functionality:**
   - Expert profile extraction from documents
   - Document classification
   - File management and synchronization
   - Batch processing with progress tracking
   - Audio transcription and processing

3. **Uses modern web technologies:**
   - React with hooks for UI
   - TypeScript for type safety
   - Shadcn UI components for design

### Key Recommendations

1. **Code Organization:**
   - Refactor large components into smaller, focused components
   - Standardize error handling patterns
   - Improve TypeScript type definitions

2. **Feature Completion:**
   - Complete audio pipeline implementation (currently disabled)
   - Finish the function registry system
   - Implement missing PDF extraction functionality

3. **Performance Optimization:**
   - Add caching for frequent operations
   - Implement pagination for large data sets
   - Add virtualization for large file trees

4. **User Experience:**
   - Add more detailed progress reporting
   - Improve mobile responsiveness
   - Add advanced search capabilities

5. **Testing and Reliability:**
   - Add automated tests for core functionality
   - Implement retry mechanisms for external service calls
   - Add comprehensive input validation

The application appears to be actively maintained and developed, with recent cleanup and documentation additions. The core document processing and expert profile extraction features seem robust, while the audio processing pipeline is in a transitional state.