# Transcribe Page Documentation

## Overview
The Transcribe page is designed for processing audio content from video files. It extracts audio from MP4 files, stores the extracted audio content in Supabase, and provides tools for transcription, playback, and batch processing.

## Key Features

### Audio Extraction
- Extracts audio content from MP4 video files
- Stores extracted audio as base64-encoded data in Supabase
- Supports direct downloading and playback of extracted audio
- Validates audio extraction with checksums and metadata validation

### Audio Processing Pipeline
- Single-file processing capabilities
- Batch processing of multiple files
- Progress tracking and error handling
- Test playback to verify extraction quality

### Google Drive Integration
- Fetches files directly from Google Drive
- Utilizes Drive IDs to access file content
- Validates Google Drive authentication tokens
- Handles MIME type verification

### User Interface
- File browser with folder navigation
- MP4 file listing with associated audio files
- Progress indicators for extraction process
- Audio player for instant playback verification

## Technical Components

### Audio Extraction Process
1. Fetches file metadata from Google Drive
2. Downloads the binary audio data
3. Converts to base64 for storage in Supabase
4. Updates the `sources_google` table with extracted content
5. Creates Blob URL for playback testing

### Data Storage
- Stores audio data in the `extracted_content` JSONB field of the `sources_google` table
- Includes metadata such as:
  - Original file size
  - MIME type
  - Extraction timestamp
  - Content data (base64 encoded)

### Error Handling
- Validates file content to ensure it's not HTML error responses
- Performs size validation checks
- Implements checksums to verify data integrity
- Detailed error reporting with console logging

### Batch Processing
The batch processing system:
- Allows selection of multiple files
- Processes files sequentially or concurrently
- Provides detailed progress tracking
- Reports success/failure for each processed file

## Implementation Notes

### Audio Formats
- Primarily focused on processing M4A audio files
- Works with various MIME types including:
  - `audio/m4a`
  - `audio/x-m4a`
  - `audio/mp4`
  - `audio/mpeg`

### Troubleshooting Tools
- Direct download test to verify file accessibility
- Stored audio playback test
- Content verification
- Checksum comparison between original and processed files

### Performance Considerations
- Implements sequential processing to prevent overwhelming API limits
- Includes detailed logging for debugging
- Validates binary data integrity during processing

## User Flow
1. Browse and select MP4 files with associated audio
2. Extract audio content from selected files
3. Verify extraction with playback testing
4. Process audio files individually or in batches
5. Monitor processing progress through UI indicators

## Future Enhancements
- Direct file upload support (currently implemented but basic)
- Automated transcription processing
- Summary generation from transcription
- Enhanced batch processing capabilities