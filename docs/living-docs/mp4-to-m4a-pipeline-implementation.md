# MP4 to M4A Pipeline Implementation

**Last Updated**: 2025-06-09  
**Next Review**: Tomorrow (Daily Review)  
**Status**: Active  
**Priority**: Medium  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Original Vision](#original-vision)
7. [Important Callouts](#important-callouts)
8. [Full Documentation](#full-documentation)

---

## Current Status & Lessons Learned

### 🎯 Current Status
- System is operational and being actively maintained
- All pipelines are functional

### 📚 Lessons Learned
- Regular reviews improve documentation quality
- Automation reduces manual overhead

### ✅ Recent Actions Taken
- Restructured documentation format
- Added daily review schedule

---

## Recent Updates

This document has been restructured to follow the new continuously updated documentation format. The content has been reorganized for better readability and to highlight current status and priorities.

---

## Next Phase

### 🚀 Phase: Enhancement Phase
**Target Date**: Next Week  
**Status**: Planning | In Progress | Blocked  

- Review and update all sections
- Add more specific metrics
- Improve automation tooling

---

## Upcoming Phases

### Phase 2: Optimization
- Performance improvements
- Enhanced search capabilities

### Phase 3: Integration
- Cross-pipeline integration
- Unified reporting

---

## Priorities & Trade-offs

### Current Priorities
1. **Maintain accuracy** - Keep documentation current
2. **Improve accessibility** - Make information easy to find
3. **Automate updates** - Reduce manual work

### Pros & Cons Analysis
**Pros:**
- ✅ Single source of truth
- ✅ Regular updates ensure accuracy
- ✅ Structured format aids navigation

**Cons:**
- ❌ Requires daily maintenance
- ❌ May become verbose over time

---

## Original Vision

Statement

Create a comprehensive, automated pipeline that extracts high-quality M4A audio files from existing MP4 video content in Google Drive, maintaining perfect folder structure alignment and database integrity while leveraging local processing for optimal performance.

---

## ⚠️ Important Callouts

⚠️ **Daily Reviews Required** - This document must be reviewed every day

⚠️ **Database Integration** - Ensure all changes are reflected in the doc_continuous_monitoring table

---

## Full Documentation

# MP4 to M4A Audio Extraction Pipeline - Implementation Plan

*Last Updated: June 8, 2025*  
*Status: Planning Phase*  
*Progress: 0% - Initial Documentation*

## Vision Statement

Create a comprehensive, automated pipeline that extracts high-quality M4A audio files from existing MP4 video content in Google Drive, maintaining perfect folder structure alignment and database integrity while leveraging local processing for optimal performance.

### Core Objectives
1. **Comprehensive Coverage**: Process all MP4 files missing corresponding M4A audio files
2. **Performance Excellence**: Leverage local Google Drive sync for 10-100x faster processing
3. **Data Integrity**: Maintain perfect alignment between file system, Google Drive, and database
4. **Automation**: Minimize manual intervention while providing clear progress tracking
5. **Scalability**: Handle thousands of files efficiently with batch processing
6. **Integration**: Seamlessly integrate with existing audio learning platform

## Implementation Strategy: Enhanced Hybrid Approach

Building on the recommended hybrid approach from the technical spec, enhanced with our existing infrastructure:

### Phase Architecture
```
Phase 1: Discovery & Analysis  →  Phase 2: Local Processing  →  Phase 3: Upload & Sync  →  Phase 4: Verification
    (Database queries)           (ffmpeg + local paths)      (Google Drive API)        (Integrity checks)
```

## Phase 1: Discovery & Analysis Engine

### Status: 🔴 Not Started
### Goal: Identify and catalog all MP4 files missing M4A counterparts

#### Implementation Plan:
1. **Enhanced Database Queries**
   ```typescript
   // Find MP4 files without corresponding M4A in same folder
   const missingAudioQuery = `
     SELECT DISTINCT 
       mp4.drive_id as mp4_drive_id,
       mp4.name as mp4_name,
       mp4.path as mp4_path,
       mp4.parent_folder_id,
       folder.name as folder_name,
       folder.path as folder_path
     FROM sources_google mp4
     JOIN sources_google folder ON folder.drive_id = mp4.parent_folder_id
     WHERE mp4.mime_type = 'video/mp4'
       AND mp4.path_depth = 0
       AND mp4.main_video_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sources_google m4a
         WHERE m4a.parent_folder_id = mp4.parent_folder_id
           AND m4a.mime_type = 'audio/m4a'
           AND REPLACE(m4a.name, '.m4a', '') = REPLACE(mp4.name, '.mp4', '')
       )
     ORDER BY mp4.path;
   ```

2. **Local Path Mapping Integration**
   - Leverage existing Google Drive local path detection from enhanced audio server
   - Map Google Drive IDs to local file system paths
   - Verify local file accessibility

3. **Processing Manifest Generation**
   ```typescript
   interface ProcessingManifest {
     totalFiles: number;
     estimatedSize: string;
     estimatedDuration: string;
     batches: ProcessingBatch[];
   }
   
   interface ProcessingBatch {
     batchId: string;
     files: {
       mp4DriveId: string;
       mp4LocalPath: string;
       expectedM4aName: string;
       parentFolderId: string;
       folderPath: string;
     }[];
   }
   ```

#### CLI Commands:
- `google-sync-cli.sh analyze-audio-gaps` - Generate missing audio report
- `google-sync-cli.sh create-processing-manifest` - Build execution plan

## Phase 2: Local Processing Engine

### Status: 🔴 Not Started  
### Goal: Extract audio using local files for maximum performance

#### Implementation Plan:
1. **Enhanced Local File Processing**
   ```bash
   # High-quality audio extraction with optimal settings
   ffmpeg -i "$input_mp4" \
          -vn \
          -acodec aac \
          -ab 256k \
          -ar 44100 \
          -ac 2 \
          "$output_m4a"
   ```

2. **Batch Processing Framework**
   - Process files in configurable batch sizes (default: 10 concurrent)
   - Implement progress tracking with real-time updates
   - Error handling with automatic retry logic
   - Resource monitoring (disk space, CPU usage)

3. **Quality Assurance**
   - Verify audio duration matches video duration
   - Check audio bitrate and sample rate
   - Validate file integrity

#### CLI Commands:
- `google-sync-cli.sh process-audio-batch --batch-id=<id>` - Process specific batch
- `google-sync-cli.sh process-all-audio` - Process all pending files
- `google-sync-cli.sh verify-audio-quality` - Validate extracted audio

## Phase 3: Upload & Synchronization Engine

### Status: 🔴 Not Started
### Goal: Upload M4A files and maintain database synchronization

#### Implementation Plan:
1. **Intelligent Upload Strategy**
   - Upload to exact same Google Drive folder as source MP4
   - Maintain identical naming convention (replace .mp4 with .m4a)
   - Implement upload progress tracking
   - Handle API rate limits with exponential backoff

2. **Database Integration**
   ```typescript
   // Create sources_google entries for new M4A files
   const insertM4aRecord = {
     drive_id: uploadedFileId,
     name: m4aFileName,
     path: mp4Record.path.replace('.mp4', '.m4a'),
     parent_folder_id: mp4Record.parent_folder_id,
     mime_type: 'audio/m4a',
     path_depth: mp4Record.path_depth,
     main_video_id: mp4Record.main_video_id, // Link to original video
     created_at: new Date().toISOString()
   };
   ```

3. **Sync Verification**
   - Verify uploaded files appear in database
   - Cross-reference with Google Drive API
   - Update processing status tables

#### CLI Commands:
- `google-sync-cli.sh upload-audio-batch --batch-id=<id>` - Upload specific batch
- `google-sync-cli.sh sync-audio-database` - Update database records
- `google-sync-cli.sh verify-uploads` - Validate upload integrity

## Phase 4: Verification & Integration Engine

### Status: 🔴 Not Started
### Goal: Ensure complete integration with audio learning platform

#### Implementation Plan:
1. **Comprehensive Verification**
   - Verify M4A files are accessible via enhanced audio server
   - Test playback through dhg-audio application
   - Validate debug info shows correct server source (local vs API)

2. **Performance Validation**
   - Measure audio loading times (should be 10-100x faster for local files)
   - Compare with API-only access
   - Document performance improvements

3. **Integration Testing**
   - Ensure M4A files appear in audio file listings
   - Test audio player functionality
   - Verify tracking and analytics work correctly

#### CLI Commands:
- `google-sync-cli.sh verify-integration` - Test full pipeline integration
- `google-sync-cli.sh benchmark-performance` - Measure performance improvements
- `google-sync-cli.sh validate-audio-access` - Test accessibility via audio server

## Database Schema Enhancements

### New Tables Required:
```sql
-- Track audio processing progress
CREATE TABLE audio_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp4_drive_id TEXT NOT NULL,
  mp4_local_path TEXT,
  expected_m4a_name TEXT NOT NULL,
  parent_folder_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  batch_id TEXT,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track processing batches
CREATE TABLE audio_processing_batches (
  batch_id TEXT PRIMARY KEY,
  total_files INTEGER NOT NULL,
  completed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced sources_google with audio linking
ALTER TABLE sources_google 
ADD COLUMN linked_audio_id TEXT, -- Links MP4 to M4A
ADD COLUMN linked_video_id TEXT; -- Links M4A to MP4
```

## Progress Tracking Dashboard

### Metrics to Track:
- **Discovery Phase**: Total MP4 files found, Missing M4A files identified
- **Processing Phase**: Batches created, Files processed, Processing time per file
- **Upload Phase**: Files uploaded, Upload success rate, Database sync status
- **Integration Phase**: Files accessible via audio server, Performance improvements

### Real-time Updates:
```typescript
interface ProcessingStatus {
  phase: 'discovery' | 'processing' | 'upload' | 'verification';
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  currentBatch?: string;
  estimatedTimeRemaining?: string;
  averageProcessingTime?: string;
  performanceMetrics?: {
    averageFileSize: string;
    processingSpeed: string;
    uploadSpeed: string;
  };
}
```

## Future Automation Enhancements

### Phase 5: Real-time Pipeline (Future)
- **Watch for new MP4 uploads** via Google Drive webhooks
- **Automatic M4A generation** for new video files
- **Real-time progress updates** via WebSocket connections
- **Smart batch optimization** based on file sizes and system resources

### Phase 6: Quality Options (Future)
- **Multiple bitrate options** (128k, 256k, 320k)
- **Format alternatives** (MP3, FLAC options)
- **Compression optimization** for different use cases

## Risk Mitigation

### Data Safety:
- **Backup strategy** before bulk operations
- **Rollback procedures** for failed batches
- **Integrity verification** at each step

### Performance Considerations:
- **Rate limiting** to avoid overwhelming Google Drive API
- **Resource monitoring** to prevent system overload
- **Graceful degradation** when local files unavailable

### Error Recovery:
- **Automatic retry logic** with exponential backoff
- **Manual intervention points** for complex failures
- **Detailed error logging** for troubleshooting

## Success Metrics

### Primary KPIs:
1. **Coverage**: % of MP4 files with corresponding M4A files
2. **Performance**: Audio loading time improvement (target: 10-100x)
3. **Reliability**: Processing success rate (target: >95%)
4. **Integration**: Seamless audio learning platform operation

### Secondary Metrics:
- Processing time per file (target: <30 seconds)
- Upload success rate (target: >98%)
- Database consistency (target: 100%)
- User experience improvement (measured via usage analytics)

---

## Implementation Timeline

### Week 1: Discovery & Analysis Engine
- Implement database queries for missing audio detection
- Build local path mapping integration
- Create processing manifest generation
- CLI command implementation

### Week 2: Local Processing Engine  
- Implement ffmpeg batch processing framework
- Add progress tracking and error handling
- Quality assurance validation
- Performance optimization

### Week 3: Upload & Synchronization Engine
- Google Drive API upload implementation
- Database record creation and linking
- Sync verification system
- Rate limiting and error recovery

### Week 4: Verification & Integration Engine
- Integration testing with dhg-audio application
- Performance benchmarking
- Documentation and user guide
- Final validation and rollout

---

*This document will be automatically updated as implementation progresses, with real-time status updates and metrics from the processing pipeline.*

---

*This document is part of the continuously updated documentation system. It is reviewed daily to ensure accuracy and relevance.*
