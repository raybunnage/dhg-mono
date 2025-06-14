# Audio Server Consolidation

## Date: 2025-06-10

## Problem
There appeared to be 3 audio servers but actually there were only 2 server implementations being referenced inconsistently:
- `server.js` - Basic web API server
- `server-enhanced.js` - Enhanced server with local Google Drive support
- Both were trying to use port 3006
- Different startup scripts used different servers

## Solution
Implemented dual audio servers running simultaneously on different ports:

### 1. Server Selector
Created `server-selector.js` that:
- Chooses between the two implementations based on `AUDIO_SERVER_MODE`
- Defaults to 'local' mode (enhanced server)
- Can be switched to 'web' mode (basic server)

### 2. Unified Configuration
- Single service name: `audio-server`
- Single port: 3006
- Single entry point: `server-selector.js`
- Mode controlled by environment variable

### 3. Mode Selection
```bash
# Local mode (default) - uses server-enhanced.js
AUDIO_SERVER_MODE=local pnpm servers

# Web mode - uses server.js
AUDIO_SERVER_MODE=web pnpm servers
```

## Benefits
1. **No more confusion** - One audio server, two modes
2. **Easy switching** - Change mode without code changes
3. **Consistent naming** - All references use 'audio-server'
4. **Backward compatible** - Port 3006 remains the same

## Files Changed
- Created `apps/dhg-audio/server-selector.js`
- Updated `scripts/start-all-servers.js`
- Updated `scripts/start-all-servers-dynamic.js`
- Updated `packages/shared/services/ports-management-service.ts`
- Updated `packages/shared/services/server-registry-service.ts`
- Updated kill server scripts
- Created migration to update database

## Server Modes Explained

### Local Mode (Enhanced)
- **Best for**: Development with Google Drive desktop app
- **Performance**: 10-100x faster for local files
- **Fallback**: Uses API if local file not found

### Web Mode (Basic)
- **Best for**: Production, remote access
- **Performance**: Consistent, depends on internet
- **Requirements**: Just needs API credentials

## Usage in dhg-audio App
The dhg-audio app will automatically use whichever server is running on port 3006, regardless of mode. The app doesn't need to know which implementation is being used.