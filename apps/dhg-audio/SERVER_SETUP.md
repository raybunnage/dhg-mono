# Audio Server Setup

## Overview

The dhg-audio app has two audio server implementations that can be selected based on your needs:

1. **Enhanced Server** (`server-enhanced.js`) - Local Google Drive + Web API
   - Checks for local Google Drive files first (10-100x faster)
   - Falls back to Google Drive API if local file not found
   - Requires local Google Drive desktop app installed
   - Best for development and when you have files synced locally

2. **Basic Server** (`server.js`) - Web API only
   - Uses Google Drive API exclusively
   - Works from anywhere with internet
   - No local file system requirements
   - Best for production or remote access

## Server Selection

The `server-selector.js` script automatically chooses which server to run.

### Configuration Methods

1. **Environment Variable** (Recommended)
   ```bash
   # For local mode (default)
   AUDIO_SERVER_MODE=local pnpm servers
   
   # For web API mode
   AUDIO_SERVER_MODE=web pnpm servers
   ```

2. **Command Line**
   ```bash
   # Run directly with mode
   cd apps/dhg-audio
   node server-selector.js local  # or 'web'
   ```

3. **Default Behavior**
   - If no mode is specified, defaults to 'local' (enhanced server)

## Server Modes

### Local Mode (Enhanced Server)
- **When to use**: Development, when you have Google Drive desktop app
- **Benefits**: 10-100x faster for local files
- **Features**:
  - Checks local file system first
  - Falls back to API if needed
  - Shows which source was used in logs

### Web Mode (Basic Server)
- **When to use**: Production, remote access, no local Google Drive
- **Benefits**: Works anywhere with internet
- **Features**:
  - Pure API implementation
  - No local file dependencies
  - Consistent performance

## Switching Between Modes

### Temporary Switch
```bash
# Just for this session
AUDIO_SERVER_MODE=web pnpm servers
```

### Permanent Switch
Add to your `.env.development`:
```env
AUDIO_SERVER_MODE=web  # or 'local'
```

## Health Check

Both servers support health checks at:
```
http://localhost:3006/health
```

## Troubleshooting

### Local mode not finding files
- Ensure Google Drive desktop app is installed and running
- Check that files are synced locally
- Verify the path detection in server logs

### Web mode authentication issues
- Ensure `.service-account.json` exists in project root
- Check Google Drive API permissions
- Verify service account has access to the files

## Port Configuration

Default port: 3006

To change:
```bash
AUDIO_PROXY_PORT=3007 pnpm servers
```