# Scenario: Add Proxy Server

**Purpose**: Add a new proxy server to the monorepo  
**Time Estimate**: 15-30 minutes  
**Complexity**: Low

## Pre-flight Checks (2 minutes)

```bash
# 1. Check existing proxy servers
ls scripts/cli-pipeline/proxy/start-*.ts

# 2. Check port availability in CLAUDE.md
grep -A 20 "Proxy Servers:" CLAUDE.md

# 3. Verify not duplicating functionality
# Ask yourself: Does this proxy do something new?
```

## Steps

### 1. Reserve Port in CLAUDE.md (2 minutes)
Add to the proxy servers section:
```
- your-proxy-name: 98XX (Brief description)
```

### 2. Create Proxy Script (10 minutes)
```bash
# Copy from a simple existing proxy
cp scripts/cli-pipeline/proxy/start-script-viewer-proxy.ts \
   scripts/cli-pipeline/proxy/start-your-proxy.ts

# Edit the new file:
# - Update port number
# - Update service name
# - Update endpoints
# - Remove unneeded functionality
```

### 3. Add to Package.json (2 minutes)
```json
"scripts": {
  "proxy:your-name": "ts-node scripts/cli-pipeline/proxy/start-your-proxy.ts"
}
```

### 4. Add to Start-All Script (2 minutes)
Edit `scripts/cli-pipeline/proxy/start-all-proxy-servers.ts`:
- Import your new proxy
- Add to the proxies array

### 5. Test Manually (5 minutes)
```bash
# Start your proxy
npm run proxy:your-name

# In another terminal, test health
curl http://localhost:98XX/health

# Test basic functionality
```

## Verification Checklist
- [ ] Proxy starts without errors
- [ ] Health endpoint returns 200
- [ ] No port conflicts
- [ ] Added to CLAUDE.md
- [ ] Added to package.json
- [ ] Added to start-all script
- [ ] Basic functionality works

## Git Checkpoint
```bash
git add -A && git commit -m "add: {proxy-name} proxy server

- Port: {port}
- Purpose: {one-line description}
- Endpoints: {list main endpoints}

Tested: Health check passes, basic functionality works

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Rollback if Needed
```bash
# If something went wrong
git reset --hard HEAD
rm scripts/cli-pipeline/proxy/start-your-proxy.ts
# Remove from CLAUDE.md, package.json, start-all
```

## Common Issues
1. **Port already in use**: Check CLAUDE.md and `lsof -i :98XX`
2. **Import errors**: Check the service exists and exports match
3. **CORS issues**: Add proper CORS middleware if needed

## Next Steps
- If proxy needs authentication, add it incrementally
- If proxy needs complex logic, extract to a service
- Monitor usage - remove if unused after 30 days