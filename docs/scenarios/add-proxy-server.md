# Scenario: Add Proxy Server

## Critical Evaluation Gates ⚠️ COMPLETE FIRST

### Gate 1: Necessity Check (30 seconds max)
- [ ] **Duplication Search**: 
  ```bash
  # Copy/paste these exact commands:
  ls scripts/cli-pipeline/proxy/start-*.ts
  grep -i "proxy\|server\|endpoint" scripts/cli-pipeline/proxy/
  find . -name "*proxy*" -type f | grep -v node_modules
  ```
- [ ] **What did you find?**: ____________________
- [ ] **Usage Justification**: Is there clear evidence this is needed vs enhancing existing proxy?
- [ ] **Complexity Check**: Will this add significant maintenance burden to proxy ecosystem?

### Gate 2: Simplicity Assessment (2 minutes max)
- [ ] **Enhancement Alternative**: Could an existing proxy be enhanced with new endpoints instead?
  - If yes: **STOP HERE** - enhance existing rather than create new
- [ ] **Consolidation Opportunity**: Are there old/unused proxies we should remove first?
- [ ] **Right-Sized Solution**: Is a dedicated proxy the simplest approach vs other options?

### Gate 3: Quick Code Review (5 minutes max)
```bash
# Required searches (run these commands):
rg -i "file.upload\|upload.handler\|multipart" scripts/
grep -r "express.*upload\|multer\|formidable" .
find scripts/cli-pipeline/proxy/ -name "*.ts" | xargs grep -l "upload\|file"
```

**Document your findings**:
- Similar upload/file handling found: ____________________
- Usage patterns of existing proxies: ____________________
- Port conflicts or naming conflicts: ____________________

### Gate 4: Go/No-Go Decision
- [ ] **Technical**: All searches completed, no major conflicts identified
- [ ] **Architectural**: Fits our Express.js proxy patterns and port allocation strategy
- [ ] **Value**: Clear benefit that justifies adding another proxy to maintain
- [ ] **Timing**: Right priority vs other proxy improvements needed

**Decision**: APPROVE / REJECT / NEEDS_REVIEW

**If REJECT or NEEDS_REVIEW**: Document why and explore alternatives before proceeding.

---

## Implementation Steps (Only if APPROVED above)

### Step 1: Reserve Port Number
**Human Action**: Find next available port in CLAUDE.md and reserve it
**Claude Code Translation**: 
```typescript
// Read CLAUDE.md
// Find proxy servers section
// Identify next available port (9876-9899 range)
// Add new entry: "- file-upload-proxy: 9892 (File upload handling with multipart support)"
// Update reserved range
```
**Verification**: Check that port appears in CLAUDE.md and isn't used elsewhere
**Checkpoint**: 
```bash
git add CLAUDE.md && git commit -m "reserve: port 9892 for file-upload proxy

Added port reservation in CLAUDE.md
Next available: 9893

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 2: Create Proxy Server Script
**Human Action**: Create `scripts/cli-pipeline/proxy/start-file-upload-proxy.ts` from template
**Claude Code Translation**:
```typescript
// Create new file with Express.js setup
// Add health endpoint
// Add file upload endpoints with multer
// Add CORS configuration
// Add error handling
// Add graceful shutdown
```
**Verification**: Script runs without errors and health endpoint responds
**Checkpoint**:
```bash
git add scripts/cli-pipeline/proxy/start-file-upload-proxy.ts && git commit -m "create: file upload proxy server

Port: 9892
Features: multipart file upload, health check
Framework: Express.js with multer

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 3: Add to Package.json Scripts
**Human Action**: Add `"proxy:file-upload": "ts-node scripts/cli-pipeline/proxy/start-file-upload-proxy.ts"` to package.json
**Claude Code Translation**:
```typescript
// Read package.json
// Parse scripts section
// Add new script entry in alphabetical order with other proxy scripts
// Write updated package.json with proper formatting
```
**Verification**: `pnpm run proxy:file-upload --help` works
**Checkpoint**:
```bash
git add package.json && git commit -m "config: add file-upload proxy to pnpm scripts

Added proxy:file-upload command
Allows: pnpm run proxy:file-upload

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 4: Add to All Proxy Servers Script
**Human Action**: Add proxy to `scripts/cli-pipeline/proxy/start-all-proxy-servers.ts`
**Claude Code Translation**:
```typescript
// Read start-all-proxy-servers.ts
// Find proxy definitions array
// Add new entry: { name: 'file-upload-proxy', port: 9892, script: 'start-file-upload-proxy.ts' }
// Update type definitions if needed
```
**Verification**: `pnpm servers` includes the new proxy in startup
**Checkpoint**:
```bash
git add scripts/cli-pipeline/proxy/start-all-proxy-servers.ts && git commit -m "integrate: file-upload proxy into startup system

Added to start-all-proxy-servers.ts
Enables: pnpm servers includes file upload proxy

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 5: Add Database Registry Entry
**Human Action**: Create migration to add proxy to `sys_server_ports_registry`
**Claude Code Translation**:
```typescript
// Create migration file with timestamp
// Add INSERT statement for new proxy with metadata
// Include proxy category, features, endpoints in JSONB metadata
```
**Verification**: Migration runs successfully and proxy appears in registry
**Checkpoint**:
```bash
git add supabase/migrations/20250615_add_file_upload_proxy.sql && git commit -m "database: register file-upload proxy in system

Added to sys_server_ports_registry
Port: 9892, Status: active

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 6: Add to Health Check Tests
**Human Action**: Add proxy to health check test array
**Claude Code Translation**:
```typescript
// Find proxy health test file
// Add new entry to PROXY_SERVERS array
// Include name, port, and script path for testing
```
**Verification**: Health check tests pass for new proxy
**Checkpoint**:
```bash
git add packages/shared/services/proxy-server/__tests__/proxy-server-health.test.ts && git commit -m "test: add file-upload proxy to health checks

Added to automated health testing
Ensures proxy startup and endpoint availability

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Post-Implementation Validation
- [ ] Proxy starts successfully: `pnpm run proxy:file-upload`
- [ ] Health endpoint responds: `curl http://localhost:9892/health`
- [ ] Included in all proxies: `pnpm servers` shows file-upload proxy starting
- [ ] Tests pass: `pnpm test proxy-server-health`
- [ ] Database entry exists: Check `sys_server_ports_registry` table
- [ ] Port conflicts resolved: No other services using port 9892

## 30-Day Retrospective Schedule
```bash
# Add to calendar for 30 days from now:
echo "$(date -d '+30 days'): Review file-upload-proxy - is it being used? Was it worth it?"
```

**Retrospective Questions**:
- Is the file upload proxy actually being used by apps?
- Did it solve the intended file handling problems?
- Was the complexity cost of another proxy justified?
- Would we make the same decision knowing what we know now?
- Should this be continued/optimized/consolidated/deprecated?

## Common Issues & Solutions

**Port Already in Use**:
- Check `lsof -i :9892` to see what's using the port
- Choose different port and update all references

**Proxy Won't Start**:
- Check TypeScript compilation errors
- Verify all dependencies are installed
- Check for port permission issues

**Health Check Fails**:
- Ensure proxy is running before testing
- Check firewall settings
- Verify health endpoint implementation

**File Upload Not Working**:
- Check multer configuration
- Verify file size limits
- Check CORS settings for cross-origin uploads