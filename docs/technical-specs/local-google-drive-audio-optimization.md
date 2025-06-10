# Local Google Drive Audio Optimization

## Overview

The enhanced audio server (`server-enhanced.js`) can serve audio files directly from your local Google Drive folder, providing significant performance improvements over fetching from the Google Drive API.

## Benefits

1. **Speed**: Local file access is 10-100x faster than API calls
2. **No API Rate Limits**: Unlimited local file access
3. **Offline Support**: Works without internet for synced files
4. **Lower Latency**: No network round trips
5. **Bandwidth Savings**: No data transfer over the internet

## How It Works

### 1. Detection of Local Google Drive

The server automatically detects Google Drive locations on different platforms:

**macOS:**
- `~/Google Drive`
- `~/Library/CloudStorage/GoogleDrive-*`
- `~/My Drive`

**Windows:**
- `%USERPROFILE%\Google Drive`
- `G:\My Drive`

**Linux:**
- `~/GoogleDrive`

**Custom Path:**
Set the `GOOGLE_DRIVE_PATH` environment variable to specify a custom location.

### 2. File Path Resolution

1. When an audio file is requested by Drive ID, the server:
   - Queries the `google_sources` table for the file's path
   - Constructs the full local path: `<google_drive_base>/<file_path>`
   - Checks if the file exists locally

2. If found locally:
   - Serves directly from disk
   - Adds `X-Served-From: local-google-drive` header
   - Handles range requests for streaming

3. If not found locally:
   - Falls back to Google Drive API
   - Adds `X-Served-From: google-drive-api` header

### 3. Performance Comparison

Typical performance improvements:

| Source | Average Response Time | Notes |
|--------|---------------------|-------|
| Local Google Drive | 5-20ms | Near instant |
| Google Drive API | 200-1000ms | Network dependent |

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/dhg-audio
pnpm install  # This will install the glob package
```

### 2. Enable Google Drive Desktop Sync

1. Install [Google Drive for Desktop](https://www.google.com/drive/download/)
2. Sign in with your Google account
3. Choose which folders to sync (ensure audio files are included)
4. Wait for initial sync to complete

### 3. Configure Environment

Add Supabase credentials to `.env.development`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optionally set custom Google Drive path:
```env
GOOGLE_DRIVE_PATH=/custom/path/to/Google Drive
```

### 4. Start the Enhanced Server

```bash
# From apps/dhg-audio directory
pnpm server:enhanced

# Or with build
pnpm start:enhanced
```

### 5. Verify Setup

Check the health endpoint:
```bash
curl http://localhost:3006/api/health
```

Response should show:
```json
{
  "status": "running",
  "localGoogleDrive": "found",
  "localGoogleDrivePath": "/Users/you/Google Drive",
  "supabaseConnected": true
}
```

## Testing Performance

Use the media analytics CLI to test performance:

```bash
# Test specific files
./scripts/cli-pipeline/media-analytics/media-analytics-cli.sh test-performance \
  --files FILE_ID_1 FILE_ID_2 FILE_ID_3

# Compare standard vs enhanced server
# (Run both servers on different ports first)
./scripts/cli-pipeline/media-analytics/media-analytics-cli.sh test-performance \
  --compare
```

## Monitoring

The enhanced server provides additional monitoring:

1. **Console Logs**: Shows whether files are served locally or via API
2. **Response Headers**: Check `X-Served-From` header
3. **Stats Endpoint**: `GET /api/stats` for configuration info

## Troubleshooting

### Google Drive Not Found

1. Check if Google Drive Desktop is running
2. Verify sync is complete for audio folders
3. Try setting `GOOGLE_DRIVE_PATH` manually
4. Check console output on server start

### Files Not Found Locally

1. Ensure files are selected for offline sync in Google Drive
2. Check if `path` column in database is correct
3. Verify file exists at expected location
4. Wait for Google Drive sync to complete

### Performance Not Improved

1. Confirm files are being served locally (check X-Served-From header)
2. Ensure no antivirus is scanning files during access
3. Check disk performance (SSD vs HDD)
4. Verify database connection is working

## Security Considerations

1. **Local Access Only**: Files are only served to authenticated users
2. **Path Validation**: Server validates all file paths
3. **No Directory Traversal**: Paths are sanitized
4. **Same Security**: Uses same authentication as API version

## Future Enhancements

1. **Caching Layer**: Add memory cache for frequently accessed files
2. **Preloading**: Preload next track while current is playing
3. **Sync Status**: Show which files are available locally
4. **Background Sync**: Trigger Google Drive sync for specific files
5. **Metrics Collection**: Track performance improvements