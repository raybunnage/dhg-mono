# Running dhg-audio on Your iPhone

This guide shows you how to access the dhg-audio app from your iPhone browser while developing locally on your Mac.

## Prerequisites

- Your Mac and iPhone must be on the same WiFi network
- You need the Google service account file (`.service-account.json`) in the project root
- Both servers (Vite and audio proxy) must be running

## Step-by-Step Instructions

### 1. Start the Servers on Your Mac

**Important for Multiple Worktrees:**
If you're using multiple worktrees, start all servers from the main dhg-mono directory (not from individual worktrees):

```bash
# Terminal 1: From main dhg-mono directory
cd /path/to/dhg-mono  # The original repo, not a worktree
pnpm servers          # Starts all servers with correct paths

# Terminal 2: From your worktree
cd apps/dhg-audio
pnpm dev:network      # Start Vite in network mode
```

**For Single Worktree Setup:**
```bash
# Terminal 1: Start the audio proxy server
cd apps/dhg-audio
pnpm server

# Terminal 2: Start Vite in network mode  
cd apps/dhg-audio
pnpm dev:network
```

You should see output like:
```
➜  Local:   http://localhost:5194/
➜  Network: http://192.168.1.123:5194/  ← Use this on your iPhone
```

### 2. Find Your Mac's IP Address

The network URL shown by Vite includes your Mac's IP address. You can also find it:

**Option A: From Terminal**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Option B: From System Settings**
- Open System Settings → Network → Wi-Fi
- Click "Details" for your network
- Look for "IP address" (e.g., 192.168.1.123)

### 3. Access from Your iPhone

1. Open Safari on your iPhone
2. Enter the network URL: `http://[YOUR-MAC-IP]:5194`
   - Example: `http://192.168.1.123:5194`
3. The app should load!

## Troubleshooting

### Can't Connect from iPhone?

1. **Check Firewall Settings**
   - Mac: System Settings → Network → Firewall
   - Make sure "Block all incoming connections" is OFF
   - You may need to allow incoming connections for Node.js

2. **Verify Both Devices on Same Network**
   - Both devices must be on the same WiFi network
   - Corporate networks may block device-to-device connections

3. **Try Using Your Mac's Hostname**
   - Instead of IP, try: `http://[your-mac-name].local:5194`
   - Find your Mac's name in System Settings → General → About

### Audio Not Playing?

The app now includes comprehensive debugging tools to help identify audio playback issues:

**1. Audio Server Status Panel (Top of Page)**
- Shows if the audio proxy server is running
- Displays service account file status (found/missing)
- Lists checked file paths
- Click "Refresh" to update status

**Common Issues:**
- **Red Status**: Server not running → Run `pnpm servers` from main dhg-mono directory
- **Wrong Path Errors**: If using worktrees → Start servers from main dhg-mono, not worktrees
- **Service Account Missing**: Ensure `.service-account.json` exists in project root
- **Green Status but Audio Fails**: Check individual file debug info

**2. Audio URL Debug (Per File)**
Each audio file shows debug information:
- **Proxy URL**: The URL the browser uses (`/api/audio/...`)
- **Direct URL**: The original Google Drive URL
- **Drive ID**: The Google Drive file ID

Click "Test Proxy Connection" to:
- Test if the proxy server can access the file
- See detailed error messages if it fails
- Common errors:
  - `500 Internal Server Error` + "service account key file not found" → Missing `.service-account.json`
  - `403 Access denied` → Service account lacks permission to the file
  - `404 File not found` → File deleted or ID incorrect

**3. Server Terminal Output**
Watch the terminal running `pnpm server` for:
```
[timestamp] Proxying audio file: [fileId]
[ERROR] Error proxying audio file: [error details]
```

**Setup Checklist:**
1. ✅ Audio proxy server running (`pnpm server`)
2. ✅ Service account file exists (`.service-account.json` in project root)
3. ✅ Service account has access to Google Drive files
4. ✅ No errors in proxy server terminal
5. ✅ Audio URL Debug shows successful connection

### Network Security Warning?

Your browser may warn about insecure connection. This is normal for local development:
- Click "Visit Website" or "Continue" to proceed
- For production, you'd use HTTPS with proper certificates

## Quick Start Script

Create this helper script for easy startup:

```bash
#!/bin/bash
# Save as: start-phone-dev.sh

echo "Starting dhg-audio for phone access..."
echo "Starting audio proxy server..."
cd apps/dhg-audio && pnpm server &

echo "Waiting for proxy server to start..."
sleep 3

echo "Starting Vite in network mode..."
pnpm dev:network

echo ""
echo "✅ Ready! Access the app on your iPhone at the Network URL shown above"
```

Make it executable: `chmod +x start-phone-dev.sh`

## Important Notes

- **Development Only**: This setup is for local development only
- **Security**: Don't expose your development server to the public internet
- **Performance**: Audio streaming may be slower over WiFi than wired connection
- **Battery**: Running servers will use more battery on your Mac

## Alternative: Using ngrok (Optional)

For testing over the internet or if local network access doesn't work:

```bash
# Install ngrok
brew install ngrok

# Start your servers normally
cd apps/dhg-audio
pnpm server & pnpm dev

# In another terminal, create a tunnel
ngrok http 5194
```

This gives you a public URL like `https://abc123.ngrok.io` that works from anywhere.