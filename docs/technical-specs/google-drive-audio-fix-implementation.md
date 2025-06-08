# Google Drive Audio Loading Fix Implementation

## Issue
The dhg-audio app was failing to load audio files from Google Drive with the error:
> "Failed to load audio. Browser tracking prevention may be blocking access to Google Drive."

## Root Cause
Browser tracking prevention and Content Security Policy (CSP) restrictions were blocking direct access to Google Drive `web_view_link` URLs in audio elements.

## Solution Implemented: Audio Proxy Server

### 1. Leveraged Existing Audio Proxy Server

The project already includes a dedicated proxy server (`apps/dhg-audio/server.js`) that:
- Uses Google Drive Service Account authentication
- Bypasses browser CORS and tracking prevention
- Handles HTTP range requests for audio streaming
- Serves files at `/api/audio/:fileId` endpoint
- Runs on port 3006 (configured in `start-all-servers.js`)

### 2. Updated Google Drive URL Utilities (`apps/dhg-audio/src/utils/google-drive-utils.ts`)

Implemented utility functions that prioritize the proxy server:

- **`extractDriveId()`** - Extracts Google Drive file ID from web_view_link
- **`getAudioProxyUrl()`** - Creates proxy server URL (`/api/audio/{driveId}`)
- **`getAudioProxyBaseUrl()`** - Gets proxy server base URL (localhost:3006 in dev)
- **`getAudioUrlOptions()`** - Returns URL options with proxy server as first choice

### 3. Enhanced AudioPlayer Component

Updated `apps/dhg-audio/src/components/AudioPlayer.tsx`:

- **Proxy-First URL System**: Tries URLs in optimal order:
  1. **Audio Proxy Server**: `http://localhost:3006/api/audio/{driveId}` (development)
  2. **Direct download URL**: `drive.google.com/uc?export=download&id=`
  3. **Preview URL**: `drive.google.com/file/d/.../preview`
  4. **Original web_view_link**: Final fallback

- **Automatic Retry**: If proxy fails, automatically tries direct Google Drive URLs
- **Improved Error Messages**: References proxy server status
- **Better Recovery**: Retry button resets to proxy server

### 4. Enhanced TrackedAudioPlayer Component

Applied the same proxy-first improvements to `apps/dhg-audio/src/components/TrackedAudioPlayer.tsx`:

- Same proxy-first URL fallback system as AudioPlayer
- Maintains all media tracking functionality
- Consistent error handling and user experience

### 5. Server Configuration Updates

- **Fixed port configuration**: Server now uses port 3006 (matches CLAUDE.md)
- **Environment variable support**: `AUDIO_PROXY_PORT` can override default
- **Automatic startup**: Included in `pnpm servers` command

## Implementation Details

**URL Priority Order**:
1. **Audio Proxy Server**: `http://localhost:3006/api/audio/{driveId}`
   - Uses Service Account authentication
   - Bypasses all browser restrictions
   - Supports HTTP range requests for streaming
   
2. **Direct Download**: `https://drive.google.com/uc?export=download&id={driveId}`
   - Fallback for when proxy is unavailable
   
3. **Preview Endpoint**: `https://drive.google.com/file/d/{driveId}/preview`
   - Additional fallback option
   
4. **Original web_view_link**: Final fallback

**Proxy Server Features**:
- Service Account authentication with Google Drive API
- Proper CORS headers for browser compatibility
- HTTP range request support for audio seeking
- Automatic content-type detection
- Error handling for missing files

## Benefits

1. **Complete Browser Bypass**: Proxy server eliminates all browser restrictions
2. **Reliable Authentication**: Service Account provides consistent access
3. **Streaming Support**: HTTP range requests enable proper audio seeking
4. **Automatic Fallback**: Still works if proxy server is down
5. **Development Ready**: Easy to start with `pnpm servers`

## Usage

### Starting the Proxy Server
```bash
# Start all servers including audio proxy
pnpm servers

# Or start just the audio proxy
cd apps/dhg-audio
node server.js
```

### Testing
1. Ensure proxy server is running on port 3006
2. Load audio files in dhg-audio app
3. Check browser console - should show proxy URLs being used
4. Audio should load without browser tracking prevention errors

## Troubleshooting

- **"Check that the audio proxy server is running"**: Run `pnpm servers`
- **Service account errors**: Ensure `.service-account.json` exists in project root
- **Port conflicts**: Check no other service is using port 3006
- **CORS errors**: Proxy server handles CORS automatically

This solution provides a robust, server-side workaround for browser restrictions while maintaining all existing functionality.