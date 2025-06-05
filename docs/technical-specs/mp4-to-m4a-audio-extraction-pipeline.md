# MP4 to M4A Audio Extraction Pipeline

## Overview

This document outlines the strategy for adding M4A audio files alongside MP4 video files in Google Drive. The goal is to extract audio from existing MP4 files and upload the resulting M4A files back to their source folders in Google Drive.

## Problem Statement

- High-level folders (path_depth = 0) with main_video_id contain MP4 files
- Audio was previously extracted locally for transcription but never uploaded to Google Drive
- Need M4A files alongside MP4 files in the same Google Drive folders
- Process must maintain folder structure and file naming conventions

## Proposed Approaches

### Approach 1: Local Processing with Google Drive Desktop

**Process:**
1. Use Google Drive desktop sync to access files locally via Finder
2. Run a script to find MP4 files without corresponding M4A
3. Use ffmpeg to extract audio locally
4. Copy M4A files back to their folders in Google Drive (via Finder)

**Pros:**
- Simple file access via Finder
- Fast local processing
- No API rate limits

**Cons:**
- Requires manual folder navigation or script to track source locations
- Depends on Google Drive sync being complete
- Semi-manual process

### Approach 2: Automated Script with Google Drive API

**Process:**
1. Query database for folders with MP4 but no M4A
2. Download MP4 files via Google Drive API
3. Process with ffmpeg locally
4. Upload M4A files back via API to same folder

**Pros:**
- Fully automated
- Precise tracking of file locations
- Can process in batches
- Progress tracking in database

**Cons:**
- API rate limits
- Slower due to download/upload
- Requires handling large file transfers

### Approach 3: Hybrid Approach (Recommended) ✅

**Process:**
1. Use database to identify folders needing M4A files
2. Generate a report with local Google Drive paths
3. Process files locally using the mapped paths
4. Use a script to copy M4A files to correct locations
5. Sync back to Google Drive
6. Update database with new M4A file records

**Pros:**
- Combines speed of local processing with database tracking
- Can be semi-automated with clear checkpoints
- Maintains data integrity
- Can process in controlled batches

**Cons:**
- Requires Google Drive desktop app
- Need to map drive paths to local filesystem

### Approach 4: Cloud Processing Service

**Process:**
1. Use a cloud service (Google Cloud Functions, AWS Lambda)
2. Stream MP4 from Drive → Process → Upload M4A back

**Pros:**
- No local storage needed
- Scalable

**Cons:**
- Complex setup
- Costs for compute/bandwidth
- Size limits on serverless functions

## Recommended Implementation: Hybrid Approach

### Phase 1: Analysis and Planning
```typescript
// Query for folders needing M4A files
const foldersNeedingAudio = await supabase
  .from('sources_google')
  .select('*')
  .eq('path_depth', 0)
  .not('main_video_id', 'is', null)
  // Check if M4A already exists
  .filter(row => !hasMatchingM4A(row));
```

### Phase 2: Generate Processing Plan
- Create a manifest file with:
  - Source MP4 drive_id
  - Expected M4A filename
  - Parent folder drive_id
  - Local path mapping (if available)

### Phase 3: Local Processing
```bash
# Example ffmpeg command for audio extraction
ffmpeg -i input.mp4 -vn -acodec copy output.m4a
```

### Phase 4: Upload and Database Update
- Upload M4A files to Google Drive
- Create sources_google entries for new M4A files
- Update metadata to link M4A with MP4

## Database Schema Considerations

### Required Fields
- `main_video_id`: Links to the primary MP4 file
- `audio_file_id`: New field to track associated M4A file
- `mime_type`: To differentiate between video/mp4 and audio/m4a

### Query Patterns
```sql
-- Find folders with MP4 but no M4A
SELECT DISTINCT sg1.parent_folder_id, sg1.name as mp4_name
FROM sources_google sg1
WHERE sg1.mime_type = 'video/mp4'
  AND sg1.path_depth = 0
  AND NOT EXISTS (
    SELECT 1 FROM sources_google sg2
    WHERE sg2.parent_folder_id = sg1.parent_folder_id
      AND sg2.mime_type = 'audio/m4a'
      AND REPLACE(sg2.name, '.m4a', '') = REPLACE(sg1.name, '.mp4', '')
  );
```

## CLI Command Structure

### Command: `google-sync-cli.sh analyze-audio-gaps`
- Identifies folders with MP4 files missing M4A counterparts
- Generates processing manifest
- Provides statistics on files to process

### Command: `google-sync-cli.sh generate-audio-batch`
- Creates batch processing scripts
- Maps Google Drive IDs to local paths
- Generates ffmpeg commands

### Command: `google-sync-cli.sh process-audio-batch`
- Executes ffmpeg commands
- Tracks progress
- Handles errors gracefully

### Command: `google-sync-cli.sh upload-audio-files`
- Uploads M4A files to Google Drive
- Updates database records
- Verifies file integrity

## Error Handling

1. **File Access Errors**
   - Log inaccessible files
   - Continue processing other files
   - Generate error report

2. **Processing Failures**
   - Retry with different ffmpeg settings
   - Log failures for manual review
   - Skip corrupted files

3. **Upload Failures**
   - Implement exponential backoff
   - Queue failed uploads for retry
   - Maintain upload state

## Progress Tracking

### Database Tables
- `audio_processing_queue`: Track files to process
- `audio_processing_status`: Track processing state
- `audio_processing_errors`: Log failures

### Status Updates
- Pending
- Downloading
- Processing
- Uploading
- Completed
- Failed

## Security Considerations

1. **Temporary File Management**
   - Use secure temporary directories
   - Clean up files after processing
   - Never store files in public locations

2. **API Credentials**
   - Use service account authentication
   - Store credentials securely
   - Implement proper access controls

## Performance Optimization

1. **Batch Processing**
   - Process multiple files concurrently
   - Limit concurrent operations to avoid overload
   - Implement queue management

2. **Resource Management**
   - Monitor disk space usage
   - Implement file size checks
   - Clean up temporary files promptly

## Future Enhancements

1. **Automated Pipeline**
   - Watch for new MP4 uploads
   - Automatically generate M4A files
   - Real-time processing

2. **Quality Options**
   - Multiple bitrate options
   - Format conversion options
   - Compression settings

3. **Integration**
   - Direct integration with transcription services
   - Webhook notifications
   - Status dashboard