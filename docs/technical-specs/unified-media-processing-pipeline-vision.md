# Unified Media Processing Pipeline Vision

## Executive Summary

This document outlines a comprehensive vision for streamlining the media processing pipeline, eliminating redundancies, and implementing an efficient workflow that minimizes local storage requirements while maximizing processing efficiency.

## Current State Analysis

### Pain Points

1. **Inefficient File Transfer**
   - MP4 files are copied from Google Drive to local machine for processing
   - Files are deleted after processing, losing the local cache benefit
   - No mechanism to upload processed M4A files back to Google Drive

2. **Command Redundancy**
   - Multiple overlapping commands:
     - `find-missing-media` vs `find-processable-videos` vs `find-untranscribed-media`
     - `process-video` vs `batch-process-media` vs `process-local-mp4-files`
     - `transcribe` vs `transcribe-with-summary` vs `batch-transcribe`

3. **Complex Registration Process**
   - Files must be registered in multiple tables (`google_sources`, `google_expert_documents`, `presentations`)
   - Multiple steps required to track a single file through the pipeline
   - Inconsistent status tracking across tables

4. **Hardcoded Paths and Configuration**
   - Google Drive paths hardcoded in scripts
   - No centralized configuration management
   - Different accelerator configurations scattered across commands

5. **Poor Error Recovery**
   - No consistent error handling or retry mechanism
   - Files can get stuck in intermediate states
   - No way to resume failed batch operations

## Comprehensive Vision: All Possibilities

### 1. Direct Google Drive Streaming Architecture
**Concept**: Process files directly from Google Drive without local copying

**Components**:
- Google Drive streaming service that provides file URLs for processing
- Modal integration that can fetch files directly from Google Drive
- Temporary local cache only for active processing
- Direct upload of results back to Google Drive

**Pros**:
- No local storage requirements
- Seamless integration with Google Drive
- Real-time processing capabilities

**Cons**:
- Complex authentication flow
- Potential API rate limits
- Network dependency for all operations

### 2. Intelligent Local Cache System
**Concept**: Smart local cache that manages files based on processing needs

**Components**:
- Cache manager that tracks file usage and automatically purges old files
- Predictive pre-fetching based on processing queue
- Symlink management to Google Drive Desktop folders
- Automatic synchronization of processed files back to Drive

**Pros**:
- Optimal balance of speed and storage
- Works with existing Google Drive Desktop
- Resilient to network issues

**Cons**:
- Requires Google Drive Desktop installation
- Cache management complexity
- Storage space still needed temporarily

### 3. Hybrid Cloud-Local Processing
**Concept**: Use cloud services for heavy processing, local for coordination

**Components**:
- Cloud functions for MP4→M4A conversion (Google Cloud Run)
- Modal for transcription and AI summarization
- Local orchestration service managing the pipeline
- Event-driven architecture with webhooks

**Pros**:
- Scalable processing capacity
- Minimal local resources needed
- Pay-per-use cost model

**Cons**:
- Multiple service dependencies
- Complex orchestration
- Potential higher costs

### 4. Unified Command Architecture
**Concept**: Single entry point with intelligent routing

**Components**:
- One master command: `media process` with smart detection
- Automatic file type and status detection
- Unified status tracking across all stages
- Single configuration file for all settings

**Example**:
```bash
# Automatically detects what needs to be done
media process --source "folder-name" --limit 10

# Specific operations if needed
media process --stage transcribe --file "specific.mp4"
```

### 5. Distributed Processing Network
**Concept**: Use multiple processing nodes for parallel execution

**Components**:
- Job queue system (Redis/RabbitMQ)
- Multiple worker nodes (local + cloud)
- Central coordinator service
- Real-time progress dashboard

**Pros**:
- Massive parallel processing capability
- Fault tolerance with job redistribution
- Scalable to any volume

**Cons**:
- Complex infrastructure
- Requires dedicated resources
- Overkill for current volumes

## Critique: Complexity vs Priority Analysis

### Complexity Assessment

1. **Direct Google Drive Streaming** - HIGH Complexity
   - Requires significant API integration work
   - Authentication and permission challenges
   - Network reliability concerns

2. **Intelligent Local Cache** - MEDIUM Complexity
   - Builds on existing Google Drive Desktop
   - Manageable scope with clear boundaries
   - Proven patterns available

3. **Hybrid Cloud-Local** - HIGH Complexity
   - Multiple service integrations
   - Cost management overhead
   - DevOps requirements

4. **Unified Command Architecture** - LOW Complexity
   - Mostly refactoring existing code
   - Clear migration path
   - Immediate benefits

5. **Distributed Processing** - VERY HIGH Complexity
   - Requires infrastructure investment
   - Ongoing maintenance burden
   - Team scaling needs

### Priority Assessment

Based on immediate needs and ROI:

1. **HIGH Priority**: Unified Command Architecture
   - Quick wins with existing code
   - Improves developer experience immediately
   - Foundation for future enhancements

2. **HIGH Priority**: Basic M4A Upload to Google Drive
   - Solves immediate streaming need
   - Relatively simple implementation
   - Clear business value

3. **MEDIUM Priority**: Intelligent Local Cache
   - Good balance of benefits vs effort
   - Solves storage efficiency problem
   - Enhances existing workflow

4. **LOW Priority**: Full streaming or distributed processing
   - Current volumes don't justify complexity
   - Can be added later if needed

## Revised Implementation Plan: Phased Approach

### Phase 1: Foundation & Quick Wins (1-2 weeks)

#### 1.1 Unified Command Structure
```bash
# Create single entry point
media-processing-cli.sh process [options]

# Consolidate redundant commands:
- find-missing-* → find-media
- process-* → process
- transcribe-* → transcribe
```

#### 1.2 Configuration Management
```yaml
# config/media-processing.yaml
sources:
  google_drive:
    root: "/Users/.../GoogleDrive/.../My Drive"
    folders:
      - "200_Research Experts"
      - "Dynamic Healing Discussion Group"
  
processing:
  temp_dir: "./file_types"
  max_parallel: 3
  default_model: "whisper-large-v3"
  default_accelerator: "A10G"
  
storage:
  auto_cleanup: true
  max_cache_size: "50GB"
  retention_days: 7
```

#### 1.3 Status Tracking Consolidation
- Create single `media_processing_status` table
- Unified status: `pending → downloading → converting → transcribing → summarizing → complete`
- Single source of truth for all operations

### Phase 2: Core Improvements (2-3 weeks)

#### 2.1 Smart File Management
```typescript
class MediaFileManager {
  // Check if file exists locally before downloading
  async getFile(driveId: string): Promise<string> {
    const localPath = await this.checkLocalCache(driveId);
    if (localPath) return localPath;
    
    const gdrivePath = await this.checkGoogleDriveDesktop(driveId);
    if (gdrivePath) return this.createSymlink(gdrivePath);
    
    return this.downloadFromDrive(driveId);
  }
  
  // Auto-cleanup after processing
  async cleanup(keepDays: number = 7) {
    const processed = await this.getProcessedFiles();
    for (const file of processed) {
      if (file.age > keepDays) {
        await this.deleteLocal(file);
      }
    }
  }
}
```

#### 2.2 M4A Upload Pipeline
```typescript
interface M4AUploadConfig {
  sourceMP4: string;      // Drive ID of source MP4
  localM4A: string;       // Local path to M4A file
  targetFolder: string;   // Google Drive folder ID
}

class M4AUploader {
  async upload(config: M4AUploadConfig) {
    // 1. Upload M4A to same folder as MP4
    const m4aId = await this.googleDrive.upload(
      config.localM4A,
      config.targetFolder
    );
    
    // 2. Create database entry
    await this.createSourceEntry(m4aId, config.sourceMP4);
    
    // 3. Link to expert document
    await this.linkToDocument(m4aId, config.sourceMP4);
    
    // 4. Update media_content_files
    await this.updateMediaContent(m4aId, 'audio');
  }
}
```

#### 2.3 Error Recovery & Retry Logic
```typescript
class ProcessingQueue {
  async processWithRetry(fileId: string, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.process(fileId);
        break;
      } catch (error) {
        await this.logError(fileId, error, i + 1);
        if (i === maxRetries - 1) {
          await this.markFailed(fileId);
        } else {
          await this.exponentialBackoff(i);
        }
      }
    }
  }
}
```

### Phase 3: Advanced Features (3-4 weeks)

#### 3.1 Intelligent Caching
- Implement LRU cache with configurable size limits
- Predictive pre-fetching based on processing patterns
- Automatic space management

#### 3.2 Parallel Processing Optimization
- Dynamic worker pool based on system resources
- Smart batching for Modal API calls
- Progress tracking with ETA calculation

#### 3.3 Google Drive Desktop Integration
```typescript
class GoogleDriveDesktopIntegration {
  // Auto-detect Google Drive Desktop paths
  async findDriveRoot(): Promise<string> {
    const possiblePaths = [
      '~/Library/CloudStorage/GoogleDrive-*/My Drive',
      '~/Google Drive/My Drive',
      'G:/My Drive' // Windows
    ];
    
    for (const path of possiblePaths) {
      if (await this.exists(path)) {
        return path;
      }
    }
  }
  
  // Create efficient symlinks for processing
  async setupWorkspace(files: string[]) {
    const workspace = './file_types/workspace';
    await this.ensureDir(workspace);
    
    for (const file of files) {
      const source = await this.findInDrive(file);
      const target = path.join(workspace, path.basename(file));
      await this.symlink(source, target);
    }
  }
}
```

### Phase 4: Future Enhancements (Optional)

#### 4.1 Streaming Architecture
- Implement Google Drive streaming URLs
- Direct Modal integration with Drive API
- Zero local storage processing

#### 4.2 Web Dashboard
- Real-time processing status
- Queue management interface
- Processing analytics

#### 4.3 Auto-Processing Pipeline
- Watch folders for new uploads
- Automatic processing triggers
- Configurable processing rules

## Implementation Priorities

### Immediate Actions (Week 1)
1. Consolidate commands into unified structure
2. Implement configuration file system
3. Create unified status tracking
4. Add M4A upload capability

### Short Term (Weeks 2-3)
1. Implement smart file management
2. Add retry and error recovery
3. Integrate with Google Drive Desktop
4. Optimize parallel processing

### Medium Term (Weeks 4-6)
1. Build intelligent caching system
2. Create monitoring dashboard
3. Implement predictive pre-fetching
4. Add comprehensive logging

### Long Term (Future)
1. Explore streaming architecture
2. Build distributed processing
3. Create web-based management UI
4. Implement ML-based optimization

## Success Metrics

1. **Efficiency Metrics**
   - Reduce average processing time by 50%
   - Eliminate manual file copying steps
   - Achieve 95%+ success rate on first attempt

2. **Storage Metrics**
   - Reduce local storage requirements by 80%
   - Implement automatic cleanup of processed files
   - Maintain cache hit rate above 70%

3. **Developer Experience**
   - Reduce command complexity from 20+ to 5 commands
   - Single configuration file for all settings
   - Clear error messages and recovery paths

4. **Business Metrics**
   - Enable streaming of all processed audio files
   - Complete M4A generation for existing library
   - Support real-time processing of new uploads

## Conclusion

This phased approach prioritizes immediate value delivery while building toward a more sophisticated system. By starting with command consolidation and configuration management, we can quickly improve the developer experience. Adding M4A upload capabilities addresses the immediate business need for streaming audio. The intelligent caching and Google Drive Desktop integration in later phases will dramatically improve efficiency without requiring complex infrastructure changes.

The key is to maintain backward compatibility while progressively enhancing the system, ensuring that each phase delivers tangible benefits without disrupting ongoing operations.