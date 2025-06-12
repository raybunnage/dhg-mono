# Server Registry Population Fix

## Date: 2025-06-11

## Summary
Fixed a critical issue preventing servers from starting through the registry-based server manager. The problem was that the `sys_server_ports_registry` table lacked the necessary startup configuration metadata. Implemented scripts to populate and activate server configurations, enabling successful server startup.

## Problem Description
When running `pnpm servers`, all servers failed to start with the error:
```
⚠️ [Server Name]: No startup configuration found
```

The registry-based server manager (`scripts/start-all-servers-registry.js`) expects each server entry to have metadata containing either:
- `script_path`: Path to the server script file
- `startup_command`: Full command to start the server
- `env_var`: Optional environment variable for port configuration

## Solution Implemented

### 1. Created populate-registry.ts
**File**: `scripts/cli-pipeline/servers/commands/populate-registry.ts`

This script updates the `sys_server_ports_registry` table with proper startup metadata for all known servers:
- Markdown Server (port 3001)
- Script Server (port 3002)
- Docs Archive Server (port 3003)
- Git Server (port 3005)
- Web Audio Server (port 3006)
- Local Audio Server (port 3007)
- Living Docs Server (port 3008)
- Git API Server (port 3009)
- Worktree Switcher (port 3010)
- Git History Analysis Server (port 3011)
- Test Runner Server (port 3012)

### 2. Created activate-servers.ts
**File**: `scripts/cli-pipeline/servers/commands/activate-servers.ts`

This script activates all core servers by updating their status from 'inactive' to 'active' in the registry.

### 3. Execution Steps
```bash
# Populate server metadata
./scripts/cli-pipeline/servers/servers-cli.sh populate

# Activate servers
ts-node scripts/cli-pipeline/servers/commands/activate-servers.ts

# Start all servers
pnpm servers
```

## Technical Details

### Server Configuration Structure
Each server in the registry now includes:
```typescript
{
  service_name: string,
  display_name: string,
  port: number,
  description: string,
  metadata: {
    script_path: string,     // Path to the server file
    env_var?: string         // Optional environment variable name
  },
  status: 'active' | 'inactive',
  environment: 'development' | 'production'
}
```

### How the Registry Manager Works
1. Reads active servers from `sys_server_ports_registry`
2. Extracts startup configuration from the `metadata` field
3. Spawns each server process with appropriate working directory and environment
4. Monitors server health and updates status in the database
5. Provides unified management for all development servers

## Impact
- All development servers now start successfully with `pnpm servers`
- Server configurations are centralized in the database
- Dynamic port discovery works correctly for frontend applications
- Server health monitoring is enabled

## Files Modified
- Created: `scripts/cli-pipeline/servers/commands/populate-registry.ts`
- Created: `scripts/cli-pipeline/servers/commands/activate-servers.ts`

## Future Improvements
1. The populate-registry.ts script should be updated when new servers are added
2. Consider adding a validation step to ensure all registered servers have valid metadata
3. Could implement auto-discovery of server configurations from package.json files

## Category
bug_fix

## Tags
server-registry, infrastructure, server-management, development-tools