# DHG Application Design Specification

## Overview
This document outlines the design specifications for three main dashboard pages in the DHG application: Sync, Classify, and Transcribe. Each dashboard serves a specific purpose in the content processing pipeline.

## 1. Sync Dashboard
The foundation of our content processing pipeline, handling Google Drive synchronization.

### Core Requirements
1. **Multiple Folder Support**
   - Support for 5+ Google folders initially, scaling to 20+
   - Folders identified by unique ID and human-readable name
   - Dashboard layout similar to classify page

### Key Functions
1. **New Folder Processing**
   - Recursive identification of subfolders and files
   - Creation of matching sync records
   - Integration with sources_google table
   - Google metadata recording
   - Statistics tracking across multiple tables

2. **Existing Folder Management**
   - Sync record maintenance
   - New file identification
   - Soft delete for unavailable files

3. **Sync History**
   - Display of sync history
   - Status updates post-sync
   - Progress tracking

4. **Token Management**
   - Google token status display
   - One-hour token lifecycle tracking
   - Token expiration timer
   - Optional token refresh functionality
   - Pre-sync token validation

5. **Batch Processing Integration**
   - Support for syncing operations
   - File copying management
   - Audio processing preparation
   - Transcription readiness

### File Processing Workflows
1. **Content Extraction**
   - DOCX processing via Mammoth
   - Direct TXT file reading
   - Mime-type specific strategies

2. **File Management**
   - New file detection
   - sources_google record creation
   - AI classification integration

3. **Audio Processing**
   - M4A file local copying
   - MP4 audio extraction
   - Temporary storage management
   - Optional Google Drive M4A storage

4. **Batch Processing**
   - Processing table utilization
   - Enum support
   - UI integration

## 2. Classify Dashboard

### Core Functions
1. **File Classification**
   - AI classification for unclassified files
   - Initial support: DOCX and TXT files
   - Future expansion to PDF support

2. **Content Processing**
   - Presentation document content extraction
   - expert_documents record creation
   - AI-based expert JSON extraction
   - processed_documents field management

### Document Type Management
1. **Dynamic Type System**
   - New document type addition support
   - Immediate UI updates
   - Category-based pill filtering
   - JSON-based document type support

### Status Tracking
1. **Processing Status**
   - sources_google processing status
   - expert_documents AI processing status
   - Document type association tracking

## 3. Transcribe Dashboard

### Purpose
Clean transcription generation from MP4 files with comprehensive audio processing.

### Core Components
1. **Audio Processing**
   - MP4 audio extraction
   - Timestamp identification
   - Speaker identification
   - Speaker file creation
   - Content merging and processing

### Technical Implementation
1. **Processing Architecture**
   - Dedicated Python processing folder
   - Handoff functionality
   - Integration with existing dashboards

### Design Principles
1. **Consistency**
   - Follow Sync and Classify dashboard patterns
   - Maintain existing functionality
   - Support transcription pipeline steps

### Future Considerations
1. **Presentation Layer**
   - Multiple element integration
   - Layout planning
   - Content organization

## Implementation Guidelines
1. **Progressive Development**
   - Preserve existing functionality
   - Intuitive layout design
   - Logical process flow
   - Batch processing integration

2. **UI/UX Considerations**
   - Clear process visualization
   - Status tracking
   - Progress indicators
   - User-friendly controls

3. **Technical Requirements**
   - Python processing integration
   - Google Drive API integration
   - Batch processing support
   - Error handling
   - Token management

# Notes
- All changes should preserve existing functionality
- Dashboard layouts should follow logical processing order
- Batch processing integration is critical across all components
- Future expansion should be considered in initial design
