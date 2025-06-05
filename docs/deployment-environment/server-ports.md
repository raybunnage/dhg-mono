# Server Port Assignments

This document lists all development servers in the monorepo and their assigned ports to avoid conflicts.

## Port Assignments

| Port | Server Name | Location | Purpose |
|------|-------------|----------|---------|
| 3001 | Markdown Server | `/scripts/cli-pipeline/viewers/simple-md-server.js` | Serves markdown files for all apps |
| 3002 | Script Server | `/scripts/cli-pipeline/viewers/simple-script-server.js` | Serves script files (.sh, .js, .ts, .py) |
| 3003 | Docs Archive Server | `/scripts/cli-pipeline/viewers/docs-archive-server.js` | Document archiving and retrieval |
| 3004 | File Browser Server | `/html/server.js` | File browser API |
| 3005 | Git Server | `/apps/dhg-admin-code/git-server.js` | Git worktree management |
| 3006 | Audio Proxy Server | `/apps/dhg-audio/server.js` | Google Drive proxy for audio files |
| 3007 | Experts Markdown Server | `/apps/dhg-improve-experts/md-server.mjs` | Markdown server for dhg-improve-experts |
| 3008 | Continuous Docs Server | `/apps/dhg-admin-code/continuous-docs-server.cjs` | Continuous documentation tracking |

## Starting All Servers

From the root directory, run:

```bash
pnpm servers
# or
pnpm servers:start
```

This will start all available servers with their assigned ports. The script will:
- Check if each server file exists before starting
- Prefix all output with the server name
- Handle graceful shutdown on Ctrl+C
- Skip servers that don't exist

## Individual Server Commands

If you need to start servers individually:

```bash
# Markdown Server (port 3001)
node scripts/cli-pipeline/viewers/simple-md-server.js

# Script Server (port 3002)
node scripts/cli-pipeline/viewers/simple-script-server.js

# Git Server (port 3005)
cd apps/dhg-admin-code && node git-server.js

# Audio Proxy (port 3006)
cd apps/dhg-audio && PORT=3006 node server.js
```

## Environment Variables

Some servers support environment variables for port configuration:
- `FILE_BROWSER_PORT` - File browser server port (default: 3004)
- `GIT_SERVER_PORT` - Git server port (default: 3005)
- `PORT` - Audio proxy server port (default: 3006)

## Notes

- All servers include CORS support for local development
- The master startup script (`pnpm servers`) handles all port assignments automatically
- If a server file doesn't exist, it will be skipped without affecting other servers