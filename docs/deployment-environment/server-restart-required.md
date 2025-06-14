# Server Restart Required

## Date: 2025-06-10

## Issue
After adding health endpoints to all servers and renaming continuous-docs-server to living-docs-server, the servers are still running the old code and showing as unhealthy.

## Root Cause
The servers are running with the old code that doesn't have the health endpoints. A restart is required to load the updated code.

## Solution
Restart all servers to apply the changes:

```bash
# Option 1: Using the servers CLI
./scripts/cli-pipeline/servers/servers-cli.sh restart

# Option 2: Stop and start manually
# Stop servers (Ctrl+C in the terminal running servers)
# Then start again:
pnpm servers

# Option 3: If using pm2 or similar
pm2 restart all
```

## Expected Result After Restart
All servers should report as healthy:
- ✅ Markdown Server (port 3001)
- ✅ Script Server (port 3002)  
- ✅ Docs Archive Server (port 3003)
- ✅ Git Server (port 3005)
- ✅ Living Docs Server (port 3008) - renamed from Continuous Docs Server
- ✅ Git API Server (port 3009)
- ✅ Audio Proxy Server (port 3006)

## Health Check Endpoints
After restart, these endpoints will be available:
- http://localhost:3001/health
- http://localhost:3002/health
- http://localhost:3003/health
- http://localhost:3005/health
- http://localhost:3006/health
- http://localhost:3008/health
- http://localhost:3009/health