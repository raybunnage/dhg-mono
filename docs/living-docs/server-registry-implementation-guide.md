# Server Registry Implementation Guide

**Last Updated**: 2025-06-10  
**Next Review**: 2025-06-11 (Daily Review)  
**Status**: Active - Implementation Planning  
**Priority**: High  
**Category**: Infrastructure  

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Implementation Plan](#implementation-plan)
3. [Migration Examples](#migration-examples)
4. [Server Registration](#server-registration)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)

---

## Overview

The `sys_server_ports_registry` provides dynamic server port discovery, eliminating hardcoded URLs in frontend components. This allows servers to run on any available port while frontends automatically discover the correct endpoints.

### Benefits:
- ✅ No more hardcoded ports in UI components
- ✅ Servers can use any available port
- ✅ Easy environment-specific configuration
- ✅ Graceful fallback to defaults
- ✅ Health check monitoring built-in

---

## Implementation Plan

### Phase 1: Database Setup (Day 1)
1. Apply migration to create `sys_server_ports_registry` table
2. Verify default entries are created
3. Test RLS policies

### Phase 2: Service Implementation (Day 2)
1. Deploy ServerRegistryService
2. Add to shared services exports
3. Test service discovery

### Phase 3: UI Migration (Days 3-5)
1. Update each UI component one at a time
2. Test fallback behavior
3. Monitor for issues

### Phase 4: Server Updates (Day 6)
1. Update servers to register their actual ports
2. Add health check endpoints
3. Enable dynamic port assignment

---

## Migration Examples

### Before (Hardcoded):
```typescript
// AIPage.tsx
const response = await fetch(`http://localhost:3008/api/cli-command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command, docId })
});
```

### After (Dynamic):
```typescript
// AIPage.tsx
import { serverRegistry } from '@shared/services/server-registry-service';

// At component level
const continuousDocsUrl = await serverRegistry.getServerUrl('continuous-docs-server');

// In the function
const response = await fetch(`${continuousDocsUrl}/api/cli-command`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ command, docId })
});
```

### Component Update Pattern:
```typescript
// Add to component
const [serverUrls, setServerUrls] = useState<Record<string, string>>({});

// In useEffect
useEffect(() => {
  const loadServerUrls = async () => {
    const urls = {
      gitApi: await serverRegistry.getServerUrl('git-api-server'),
      continuousDocs: await serverRegistry.getServerUrl('continuous-docs-server'),
      markdown: await serverRegistry.getServerUrl('md-server'),
    };
    setServerUrls(urls);
  };
  
  loadServerUrls();
}, []);

// Use in fetch calls
const response = await fetch(`${serverUrls.gitApi}/api/execute-command`, {
  // ... rest of config
});
```

---

## Server Registration

### Automatic Registration on Startup:
```javascript
// In server startup (e.g., git-server.cjs)
const { createClient } = require('@supabase/supabase-js');

async function registerServer(port) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  const { error } = await supabase
    .from('sys_server_ports_registry')
    .upsert({
      service_name: 'git-server',
      port: port,
      status: 'active',
      last_health_check: new Date().toISOString(),
      last_health_status: 'healthy'
    }, {
      onConflict: 'service_name'
    });
    
  if (error) {
    console.error('Failed to register server:', error);
  } else {
    console.log(`Git server registered on port ${port}`);
  }
}

// On server start
const PORT = process.env.GIT_SERVER_PORT || 3005;
app.listen(PORT, () => {
  console.log(`Git server running on port ${PORT}`);
  registerServer(PORT);
});
```

---

## Migration Order

### Recommended UI Component Update Order:
1. **LivingDocsPage.tsx** - Single server reference (lowest risk)
2. **ScriptsManagement.tsx** - Single server reference
3. **AIPage.tsx** - Two server references
4. **GitManagement.tsx** - Multiple references (highest complexity)
5. **git-api-client.ts** - Service layer update
6. **vite.config.ts** - Proxy configuration

### Files to Update:
```bash
# Frontend Components (7 files)
apps/dhg-admin-code/src/pages/AIPage.tsx
apps/dhg-admin-code/src/pages/ScriptsManagement.tsx
apps/dhg-admin-code/src/pages/GitManagement.tsx
apps/dhg-admin-code/src/pages/LivingDocsPage.tsx
apps/dhg-admin-code/src/services/git-api-client.ts
apps/dhg-admin-code/vite.config.ts
apps/dhg-audio/src/pages/AudioDetailPage.tsx

# Backend Servers (6 files)
scripts/cli-pipeline/viewers/simple-md-server.js
scripts/cli-pipeline/viewers/simple-script-server.js
scripts/cli-pipeline/viewers/docs-archive-server.js
apps/dhg-admin-code/git-server.cjs
apps/dhg-admin-code/continuous-docs-server.cjs
apps/dhg-admin-code/git-api-server.cjs
```

---

## Testing Strategy

### 1. Unit Tests for ServerRegistryService:
```typescript
describe('ServerRegistryService', () => {
  it('should return correct URL for known service', async () => {
    const url = await serverRegistry.getServerUrl('git-api-server');
    expect(url).toMatch(/http:\/\/localhost:\d+/);
  });
  
  it('should fallback to default when registry unavailable', async () => {
    // Mock supabase failure
    const url = await serverRegistry.getServerUrl('git-api-server');
    expect(url).toBe('http://localhost:3009');
  });
});
```

### 2. Integration Tests:
- Test each UI component with dynamic URLs
- Verify fallback behavior
- Test with servers on non-default ports

### 3. Manual Testing Checklist:
- [ ] Start servers on different ports
- [ ] Update registry with new ports
- [ ] Verify UI components connect correctly
- [ ] Test with registry service down
- [ ] Verify fallback to defaults

---

## Rollback Plan

### If Issues Occur:
1. **Immediate**: ServerRegistryService returns hardcoded defaults
2. **Quick Fix**: Update defaults in ServerRegistryService
3. **Full Rollback**: Revert UI components to hardcoded values

### Monitoring:
- Watch for failed API calls in browser console
- Monitor server logs for connection attempts
- Check Supabase logs for registry queries

---

## Environment Variables

### New Variables for Servers:
```bash
# Server ports (with defaults)
MD_SERVER_PORT=3001
SCRIPT_SERVER_PORT=3002
DOCS_ARCHIVE_SERVER_PORT=3003
GIT_SERVER_PORT=3005
CONTINUOUS_DOCS_PORT=3008
GIT_API_SERVER_PORT=3009

# Registry settings
SERVER_REGISTRY_CACHE_TIMEOUT=300000  # 5 minutes
SERVER_REGISTRY_ENVIRONMENT=development
```

---

## Success Criteria

- [ ] All 7 UI components use dynamic server discovery
- [ ] No hardcoded ports remain in frontend code
- [ ] Servers can start on any available port
- [ ] Fallback behavior works when registry unavailable
- [ ] Zero downtime during migration
- [ ] Performance impact < 100ms on initial load

---

## Next Steps

1. **Review and approve** migration plan
2. **Apply database migration** to create registry table
3. **Deploy ServerRegistryService** to shared services
4. **Start migrating** UI components (begin with LivingDocsPage)
5. **Update servers** to register their ports
6. **Test thoroughly** before full rollout

**Estimated Timeline**: 6 days for complete implementation