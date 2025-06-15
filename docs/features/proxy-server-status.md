# Proxy Server Status Dashboard

## Overview

The Proxy Server Status page in dhg-service-test provides a comprehensive dashboard for monitoring and managing all proxy servers in the DHG monorepo. It shows real-time status, health checks, and provides controls for starting/stopping servers.

## Features

### Real-Time Status Monitoring
- **Live Health Checks**: Automatic health checks every 30 seconds
- **Visual Status Indicators**: 
  - 🟢 Online - Server is running and healthy
  - 🔴 Offline - Server is not responding
  - 🟡 Checking - Health check in progress
- **Response Time Tracking**: Shows server response times in milliseconds
- **Error Details**: Displays connection errors for offline servers

### Server Management
- **Start All Servers**: Launch all proxy servers with one click
- **Stop All Servers**: Shutdown all running servers
- **Individual Controls**: Start/stop specific servers
- **Open Server UI**: Direct links to each server's web interface

### Comprehensive Server List

All 13 proxy servers are monitored:

1. **Vite Fix Proxy** (9876) - Vite environment fix commands
2. **Continuous Monitoring** (9877) - System health monitoring
3. **Proxy Manager** (9878) - Start/stop/manage other proxies
4. **Git Operations** (9879) - Git operations and worktree management
5. **File Browser** (9880) - File system operations
6. **Continuous Docs** (9882) - Documentation tracking
7. **Audio Streaming** (9883) - Audio file streaming from Google Drive
8. **Script Viewer** (9884) - View/archive/delete script files
9. **Markdown Viewer** (9885) - View/archive/delete markdown files
10. **Docs Archive** (9886) - Document file management
11. **Worktree Switcher** (9887) - Visual git worktree switcher
12. **HTML File Browser** (8080) - Web-based file browser UI
13. **CLI Test Runner** (9890) - CLI pipeline test runner for ALPHA/BETA/GAMMA groups

## Usage

### Starting the Dashboard

1. **Start dhg-service-test**:
   ```bash
   cd apps/dhg-service-test
   pnpm dev
   ```

2. **Navigate to Proxy Server Status**:
   - Click the "🔌 Proxy Server Status" button in the app

### Managing Servers

1. **Start All Servers**:
   - Click "🚀 Start All Servers" button
   - Or run `pnpm servers` from the command line

2. **Control Individual Servers**:
   - Use the Start/Stop buttons in the Actions column
   - Click "Open" to access a running server's interface

3. **Monitor Health**:
   - Enable "Auto-refresh" for continuous monitoring
   - Manual refresh available with the "🔄 Refresh" button

### Proxy Manager Integration

The dashboard integrates with the Proxy Manager (port 9878):
- Batch operations require Proxy Manager to be running
- Click "📊 Proxy Manager Dashboard" for advanced controls
- Individual server controls work through the Proxy Manager API

## Architecture

### Components
- **ProxyServerStatus.tsx**: React component with health monitoring
- **start-all-proxy-servers.ts**: CLI script to launch all servers
- **Individual startup scripts**: One for each proxy server

### Health Check Implementation
```typescript
// Each server is checked via HTTP GET
const response = await axios.get(
  `http://localhost:${server.port}/health`,
  { timeout: 3000 }
);
```

### Port Registry
All ports are documented in CLAUDE.md:
- **9876-9887**: Primary proxy server range
- **9890**: CLI Test Runner
- **8080**: HTML File Browser (legacy port)

## Reconciliation Status

✅ **All proxy servers are reconciled**:
- CLAUDE.md port registry updated
- start-all-proxy-servers.ts includes all servers
- ProxyServerStatus component lists all servers
- CLI Test Runner (9890) added to all registries

## Command Line Usage

### Start all proxy servers:
```bash
pnpm servers
```

### Start individual proxy:
```bash
./scripts/cli-pipeline/proxy/start-[proxy-name]-proxy.ts
```

### Check status via CLI:
```bash
./scripts/cli-pipeline/proxy/proxy-cli.sh status
```

## Benefits

- **Centralized Management**: All proxy servers in one dashboard
- **Visual Feedback**: Instantly see which servers are running
- **Quick Actions**: Start/stop servers without terminal commands
- **Health Monitoring**: Proactive detection of server issues
- **Response Time Tracking**: Performance monitoring
- **Error Visibility**: Clear error messages for troubleshooting

## Future Enhancements

- Server logs viewer
- CPU/memory usage metrics
- Auto-restart on failure
- Server configuration editor
- Batch start by category (infrastructure, development, media)
- Historical uptime tracking