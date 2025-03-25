# Sync Page Documentation

## Overview
The Sync page is a comprehensive dashboard for managing Google Drive synchronization with the application's database. It allows users to connect to Google Drive, sync files, manage root folders, and monitor the synchronization process.

## Features
- **Dashboard**: Shows sync statistics and current status of Google Drive integration
- **Folder Management**: Add new folders to sync, manage existing root folders
- **Batch Processing**: Monitor and manage batch document processing
- **Authentication**: Manage Google Drive authentication tokens 
- **Root Management**: Set and manage root folder configurations
- **Database Cleanup**: Tools for fixing folder paths and database integrity

## Implementation Details

### Component Structure
The main component is located at `apps/dhg-improve-experts/src/pages/Sync.tsx` and organizes functionality into tabs:

1. **Dashboard Tab**: Displays sync statistics, file counts, and current folder information
2. **Folders Tab**: Provides interfaces for adding new folders and managing existing ones
3. **Batches Tab**: Shows batch processing status through BatchProcessingMonitor component
4. **Roots Tab**: Advanced management of root folder records in database
5. **Cleanup Tab**: Tools to fix database integrity issues with paths and file relationships
6. **Authentication Tab**: Authentication status and management

### Data Models
The component uses several TypeScript interfaces:
- `SyncStats`: Tracks sync statistics including total, new, updated, and deleted files
- `DriveFile`: Represents a file from Google Drive API
- `DocumentTypeStats`: Statistics about document types
- `FolderOption`: Information about folders available for selection
- `SyncResult`: Result of a sync operation

### Core Functionality
1. **Google Drive Integration**: Authenticates and communicates with Google Drive API
2. **Folder Synchronization**: Syncs files from specified Google Drive folders
3. **Database Management**: Stores file metadata in Supabase database
4. **Batch Processing**: Manages processing of documents in batches
5. **Path Management**: Ensures proper folder structure and path relationships

### Technical Details
- Uses Supabase for database operations
- Performs direct folder scanning using Google Drive API
- Supports both new folder syncing and updating existing folders
- Provides path cleanup and database integrity tools
- Uses service role authentication for admin operations

## Related Components
- `GoogleDriveDebug`: Component for debugging Google Drive integration
- `BatchManager`: Interface for managing batch processing
- `BatchProcessingMonitor`: Displays current batch processing status
- `googleDriveService`: Service for interacting with Google Drive API
- `googleAuth`: Service for managing Google authentication