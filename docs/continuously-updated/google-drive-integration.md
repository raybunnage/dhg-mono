# Google Drive Integration - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 23, 2025 (14 days)  
**Status**: Active  
**Priority**: High  
**Related Archives**: 4 documents  

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

Google Drive integration is operational with core features working. Audio streaming is optimized with local Drive detection, and the classification pipeline is being consolidated.

**What's Working Well**:
- ✅ Audio proxy server (Port 3006) bypasses browser restrictions
- ✅ Local Google Drive optimization (10-100x speed improvement)
- ✅ Service Account authentication for API access
- ✅ Basic metadata sync to `sources_google` table
- ✅ Multi-format file support (documents, audio, video)

**Current Priority**:
- **Immediate Focus**: Complete unified classification command consolidation
- **Blocking Issues**: 92 commands need consolidation to ~15-20
- **Next Milestone**: Unified classification system by June 30, 2025

### 📚 Lessons Learned

1. **Local Drive detection is a game-changer** - 5-20ms vs 200-1000ms response
2. **Browser restrictions require proxy** - CORS and tracking prevention block direct access
3. **Batch processing saves costs** - 40-60% reduction with Claude Batch API
4. **Command proliferation hurts UX** - 92 commands is too many
5. **Service Account > OAuth** - More reliable for server-side operations

### ✅ Recent Actions Taken
- Implemented audio proxy server with range request support
- Added local Google Drive detection and optimization
- Started command consolidation project
- Integrated with prompt service for classification

---

## Recent Updates

- **June 9, 2025**: Created this living documentation from 4 technical specs
- **June 2025**: Local Drive optimization deployed (10-100x speed boost)
- **May 2025**: Audio proxy server implemented to fix browser issues
- **May 2025**: Command consolidation project initiated

---

## Next Phase

### 🚀 Phase: Unified Classification System
**Target Date**: June 30, 2025  
**Status**: In Progress  

- [ ] Consolidate 92 commands to ~15-20 core commands
- [ ] Complete prompt service integration
- [ ] Implement batch processing for all file types
- [ ] Create unified error handling
- [ ] Deploy new streamlined CLI interface

---

## Upcoming Phases

### Phase 2: AI Processing Enhancement (July 2025)
- Claude Batch API integration
- Multi-modal analysis for all formats
- Expert profile extraction
- Cost optimization strategies

### Phase 3: Search & Discovery (August 2025)
- PostgreSQL full-text search
- Vector embeddings for semantic search
- Expert knowledge graph
- Advanced filtering UI

### Phase 4: Real-time Updates (September 2025)
- WebSocket notifications
- Change detection optimization
- Incremental sync improvements
- Collaboration features

---

## Priorities & Trade-offs

### Current Priorities
1. **Simplify command interface** - UX over feature completeness
2. **Optimize for local performance** - Speed matters for audio/video
3. **Reduce AI processing costs** - Batch API saves 40-60%

### Pros & Cons Analysis
**Pros:**
- ✅ Fast local file access without API calls
- ✅ Reliable audio streaming through proxy
- ✅ Flexible three-tier storage architecture
- ✅ Cost-effective batch processing

**Cons:**
- ❌ Complex setup with Service Account
- ❌ Command proliferation needs cleanup
- ❌ Local Drive requires specific paths
- ❌ Sync can be slow for large drives

---

## Original Vision

Create a seamless integration between Google Drive and the DHG learning platform that enables AI-powered analysis of documents while maintaining performance and cost-effectiveness. The system should feel native and fast, with intelligent syncing that minimizes API calls and processing costs.

---

## ⚠️ Important Callouts

⚠️ **Service Account required** - OAuth alone isn't sufficient for server operations

⚠️ **Local Drive paths platform-specific** - macOS: `~/Library/CloudStorage/GoogleDrive-*`

⚠️ **Audio proxy required** - Direct browser access blocked by security policies

⚠️ **Batch processing delays** - Claude Batch API has 24-hour SLA

---

## Full Documentation

### Architecture Overview

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Google Drive API  │────▶│  Proxy Server    │────▶│    Browser      │
│  (Service Account)  │     │   (Port 3006)    │     │  (Audio/Video)  │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────┐     ┌──────────────────┐
│  Local Google Drive │     │  Supabase DB     │
│  (10-100x faster)   │     │  (Metadata)      │
└─────────────────────┘     └──────────────────┘
```

### Storage Tiers

| Tier | Purpose | Examples | Performance |
|------|---------|----------|-------------|
| **Tier 1** | Metadata & AI results | File info, expert profiles | Fast queries |
| **Tier 2** | Binary data | PDFs, images | Direct access |
| **Tier 3** | Backups | Configs, environments | Archive |

### Audio Proxy Server

**Location**: `apps/dhg-audio/server.js`  
**Port**: 3006  
**Features**:
- HTTP range request support
- CORS handling
- Service Account authentication
- Local file detection
- Streaming optimization

**Usage**:
```javascript
// Audio element configuration
<audio 
  src={`http://localhost:3006/audio/${fileId}`}
  controls
  preload="metadata"
/>
```

### Local Drive Optimization

**Detection**:
```typescript
const localPaths = [
  '~/Library/CloudStorage/GoogleDrive-*',  // macOS
  '%USERPROFILE%\\Google Drive',           // Windows
  '~/Google Drive'                          // Linux
];
```

**Performance Impact**:
- API call: 200-1000ms
- Local file: 5-20ms
- Improvement: 10-100x

### CLI Commands (Current)

```bash
# Start audio proxy server
pnpm audio-server

# Sync Google Drive metadata
./scripts/cli-pipeline/google_sync/google-sync-cli.sh sync-sources

# Process specific file
./scripts/cli-pipeline/google_sync/google-sync-cli.sh process-file [fileId]

# Batch process files
./scripts/cli-pipeline/google_sync/google-sync-cli.sh batch-process
```

### CLI Commands (After Consolidation)

```bash
# Unified classification
pnpm gsync classify [fileId|folderId] [options]

# Sync operations
pnpm gsync sync [--full|--incremental]

# Search
pnpm gsync search "query" [--type=pdf|audio|video]

# Export
pnpm gsync export [--format=json|csv]
```

### Database Schema

**Core Tables**:
```sql
-- Lightweight file index
sources_google (
  id, name, mime_type, size, 
  created_time, modified_time,
  parent_id, is_folder, hash
)

-- AI-processed content
expert_content (
  id, source_id, expert_id,
  content_type, extracted_data,
  ai_analysis, processed_at
)

-- Processing pipeline
processing_queue (
  id, file_id, status, priority,
  attempts, error_message
)
```

### Batch Processing Strategy

```typescript
// Cost optimization through batching
const batchConfig = {
  maxBatchSize: 100,
  maxWaitTime: '6 hours',
  costReduction: '40-60%',
  processingTime: '24 hours'
};
```

### Security Configuration

**Service Account Setup**:
1. Create project in Google Cloud Console
2. Enable Drive API
3. Create Service Account
4. Download JSON credentials
5. Save as `.service-account.json`

**Environment Variables**:
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-root-folder-id
```

### Troubleshooting

**Problem**: Audio won't play in browser  
**Solution**: Ensure proxy server is running on port 3006

**Problem**: Local files not detected  
**Solution**: Check Google Drive Desktop is running and synced

**Problem**: API rate limits  
**Solution**: Use batch processing and implement exponential backoff

**Problem**: Service Account can't access files  
**Solution**: Share Drive folder with Service Account email

### Performance Metrics

| Operation | Without Optimization | With Optimization | Improvement |
|-----------|---------------------|-------------------|-------------|
| Audio Stream | 200-1000ms | 5-20ms | 10-100x |
| Metadata Sync | 5-10 min | 1-2 min | 5x |
| Batch Process | $10/1000 docs | $4-6/1000 docs | 40-60% |

### Future Enhancements

1. **DeepSeek Integration** - Lower cost alternative to Claude
2. **Vector Search** - Semantic similarity queries
3. **Real-time Sync** - WebSocket-based updates
4. **Offline Mode** - Local-first architecture
5. **Team Folders** - Shared workspace support

### Related Documentation

**Archived Specs**:
- `google-drive-integration.md` - Original integration design
- `google-sync-reorganization-spec.md` - Command consolidation plan
- `google-drive-audio-fix-implementation.md` - Audio proxy details
- `local-google-drive-audio-optimization.md` - Local optimization

**Active References**:
- `/scripts/cli-pipeline/google_sync/` - Current CLI implementation
- `/apps/dhg-audio/server.js` - Audio proxy server
- `prompt-service-implementation-progress.md` - Prompt integration

**Code References**:
- `packages/shared/services/google-drive-service.ts` - Core service
- `apps/dhg-audio/src/App.tsx` - Audio player implementation
- `.service-account.json` - Service Account credentials (git-ignored)

---

*This is part of the continuously updated documentation system. It is reviewed every 14 days to ensure accuracy and relevance.*