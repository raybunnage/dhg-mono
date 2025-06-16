# Vite Environment Fix Proxy Server

## What is this?
A local proxy server that allows you to fix Vite environment issues directly from your browser, without copying/pasting terminal commands.

## Quick Start

### 1. Start the Proxy Server
```bash
# In a new terminal window:
./start-vite-fix-proxy.sh

# Or manually:
ts-node scripts/cli-pipeline/utilities/vite-fix-proxy-server.ts
```

The server will start on port 9876.

### 2. Use the Fix Page
1. Visit http://localhost:5180
2. Click "🚨 Fix Env Issues"
3. The page will detect if the proxy is running
4. If proxy is online, you'll see browser-based fix buttons!

### 3. Click to Fix
When the proxy is running, you can:
- Click "🚀 Quick Fix" to clear Vite cache
- Click "💣 Nuclear Fix" to reinstall dependencies
- No terminal commands needed!

## How It Works
1. Browser sends fix request to proxy server
2. Proxy executes the fix scripts on your system
3. Results are returned to the browser
4. Page refreshes to show updated status

## API Endpoints

- `GET /` - Server info
- `GET /health` - Check if server is running
- `GET /apps` - List available apps
- `POST /fix` - Execute a fix
  ```json
  {
    "appName": "dhg-service-test",
    "action": "fix" | "nuclear-fix" | "diagnose" | "check-env"
  }
  ```

## Port Configuration
Default port: 9876
To use a different port:
```bash
VITE_FIX_PROXY_PORT=8765 ts-node scripts/cli-pipeline/utilities/vite-fix-proxy-server.ts
```

## Security Note
This proxy only runs locally and is meant for development use only. It executes system commands based on browser requests, so only run it on your local machine.