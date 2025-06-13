# Proxy Server Migration Plan

## Overview
Migrate 12 existing proxy/server implementations to the new standardized infrastructure.

## Migration Priority

### Phase 1: Core Infrastructure ✅
- [x] vite-fix-proxy (9876) - COMPLETED
- [x] proxy-manager-proxy (9878) - COMPLETED  
- [x] continuous-monitoring-proxy (9877) - COMPLETED

### Phase 2: Development Tools (High Priority)
- [ ] git-server.cjs → git-operations-proxy (9879)
  - Location: apps/dhg-admin-code/git-server.cjs
  - Extract: GitOperationsService
  - Features: Worktree management, git commands
  
- [ ] file-browser/server.js → file-browser-proxy (9880)
  - Location: html/server.js
  - Extract: FileSystemService
  - Features: Safe file browsing, search
  
- [ ] continuous-docs-server.cjs → continuous-docs-proxy (9881)
  - Location: apps/dhg-admin-code/continuous-docs-server.cjs
  - Extract: DocsMonitoringService
  - Features: Documentation tracking

### Phase 3: Media Services (Medium Priority)
- [ ] audio/server.js → audio-streaming-proxy (9882)
  - Location: apps/dhg-audio/server.js
  - Extract: AudioStreamingService
  - Features: Google Drive audio streaming
  
- [ ] audio/server-enhanced.js → (merge with audio-streaming-proxy)
  - Location: apps/dhg-audio/server-enhanced.js
  - Merge enhanced features into main proxy
  
### Phase 4: Utility Services (Lower Priority)
- [ ] git-history-server.js → git-history-proxy (9885)
  - Location: scripts/cli-pipeline/dev_tasks/git-history-server.js
  - Extract: GitHistoryService
  
- [ ] worktree-switcher-server.js → worktree-ui-proxy (9886)
  - Location: scripts/cli-pipeline/viewers/worktree-switcher-server.js
  - Extract: WorktreeUIService
  
- [ ] docs-archive-server.js → docs-archive-proxy (9887)
  - Location: scripts/cli-pipeline/viewers/docs-archive-server.js
  - Extract: DocsArchiveService
  
- [ ] simple-md-server.js → markdown-viewer-proxy (9888)
  - Location: scripts/cli-pipeline/viewers/simple-md-server.js
  - Extract: MarkdownViewerService
  
- [ ] simple-script-server.js → script-viewer-proxy (9889)
  - Location: scripts/cli-pipeline/viewers/simple-script-server.js
  - Extract: ScriptViewerService

## Migration Steps for Each Server

1. **Create Service Class**
   ```typescript
   // In packages/shared/services/
   export class GitOperationsService {
     // Extract business logic from old server
   }
   ```

2. **Create Proxy Class**
   ```typescript
   // In packages/proxy-servers/servers/git-operations/
   export class GitOperationsProxy extends ProxyServerBase {
     private service: GitOperationsService;
     // Implement routes using service
   }
   ```

3. **Update Imports**
   - Find all references to old server
   - Update to use new proxy

4. **Test Migration**
   - Start new proxy
   - Verify all endpoints work
   - Check consuming apps/scripts

5. **Archive Old Code**
   - Move to `.archived_scripts/`
   - Add date suffix

## Service Tracking

New services to create:
- [ ] GitOperationsService
- [ ] FileSystemService (safe file access)
- [ ] DocsMonitoringService
- [ ] AudioStreamingService
- [ ] GitHistoryService
- [ ] WorktreeUIService
- [ ] DocsArchiveService
- [ ] MarkdownViewerService
- [ ] ScriptViewerService

## Port Updates for CLAUDE.md

Already reserved:
- 9876-9878: ✅ Infrastructure proxies
- 9879-9889: Reserved for migrations

Legacy ports to retire:
- 3001-3011: Various old servers

## Integration Points

### dhg-admin-code
- Will host proxy management UI
- Needs access to: git-operations, continuous-docs, file-browser

### dhg-admin-google/suite  
- Will host media proxy management
- Needs access to: audio-streaming, google-drive

### dhg-service-test
- Will host proxy testing dashboard
- Needs access to: ALL proxies for testing

## Success Criteria

- [ ] All 12 servers migrated to new infrastructure
- [ ] Legacy ports (3000-3999) no longer in use
- [ ] All proxies registered and manageable
- [ ] UI dashboards in appropriate apps
- [ ] Old implementations archived
- [ ] Documentation updated

## Next Steps

1. Start with Phase 2 (Development Tools)
2. Create GitOperationsService first
3. Migrate git-server.cjs
4. Continue with file-browser
5. Update consuming apps as we go