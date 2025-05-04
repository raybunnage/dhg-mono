# Audio Processing Pipeline - Database Schema Review

## Overview
This document summarizes our database schema review for the DHG Presenter audio processing pipeline, focusing on field consolidation recommendations and overall schema design. The pipeline will extract audio from MP4 files, transcribe and diarize content, and associate processed content with presentations.

## Key Tables Review
After reviewing the complete schema in Supabase, we identified the following key tables that form the backbone of our audio processing pipeline:

| Table | Purpose | Status |
|-------|---------|--------|
| sources_google | Tracks Google Drive files and identifies MP4 videos to process | Well-structured with the needed audio fields |
| expert_documents | Stores processed documents (transcripts, summaries) | Had redundant metadata fields |
| audio_segments | Stores segments of audio with transcription data | Well-designed with appropriate fields |
| processing_batches | Manages groups of processing jobs | Had redundant configuration fields |
| audio_processing_stages | Tracks individual stages of processing | Well-designed with appropriate fields |
| speaker_profiles | Manages speaker identification | Well-designed with appropriate fields |
| ai_processing_attempts | Tracks individual AI processing attempts | Well-designed with detailed metrics |

## Field Consolidation Recommendations
We identified two key areas for field consolidation to improve schema clarity:

### 1. Consolidation in expert_documents
**Recommendation**: Keep `ai_processing_details` and remove `processing_metadata`

**Rationale**:
- Prevents storing overlapping information in two separate JSONB fields
- Simplifies queries by having a single field to check
- Creates a clearer mental model for developers
- Establishes a single source of truth for processing-related information

### 2. Consolidation in processing_batches
**Recommendation**: Keep `processor_config` and remove `processor_settings`

**Rationale**:
- Removes ambiguity about which field should contain which configuration
- Simplifies code by providing a single reference point for processing parameters
- Creates a more consistent data structure
- Prevents configuration sprawl across multiple fields

## Benefits of Early Consolidation
These consolidations were recommended early in development before data accumulation for several reasons:

1. Zero Migration Cost: With no existing data using these fields, there's no complex migration needed
2. Cleaner Initial Design: Starting with a streamlined schema establishes better patterns
3. Future-Proofing: Avoiding the need for future refactoring when data exists
4. Simplified Documentation: Having single-purpose fields makes onboarding easier

## Audio Processing Pipeline Structure
The database schema supports a multi-stage processing pipeline:

1. Discovery: `sources_google` table identifies video files for processing
2. Extraction: Temporary extraction of audio from MP4 files (no permanent MP4 storage)
3. Processing: Multiple stages tracked in `audio_processing_stages` table
   - Audio extraction (ffmpeg)
   - Transcription (Whisper)
   - Diarization (speaker identification)
   - Summarization
4. Storage: Audio data in M4A format, metadata in database
5. Presentation: Association with presentations via `presentation_assets` table

## Implementation Considerations
1. Temporary MP4 Storage: MP4 files will only be stored temporarily during audio extraction
2. M4A Storage Options:
   - Server local storage (development)
   - Supabase Storage buckets (production)
3. BullMQ Integration: Separate queues for extraction, transcription and diarization
4. Monitoring: Detailed metrics stored in database for performance tracking

## Conclusion
The database schema is well-designed for the audio processing pipeline with the recommended consolidations. These changes establish a cleaner foundation for development while maintaining all necessary relationships and fields for the audio extraction, transcription, and diarization workflow.