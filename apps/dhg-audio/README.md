# DHG Audio App with Proxy Server

A web application for streaming audio files from Google Drive without tracking prevention issues.

## Features

- Browse audio files from your Google Drive
- Stream audio directly without browser tracking prevention issues
- View transcripts (when available)
- Download audio files
- Mobile-friendly interface

## Setup and Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Make sure your `.env.development` file has the correct Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Make sure you have a Google Service Account key file (`.service-account.json`) in one of these locations:
   - `/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-audio/.service-account.json`
   - `/Users/raybunnage/Documents/github/dhg-mono/.service-account.json`
   - Environment variable `GOOGLE_SERVICE_ACCOUNT_PATH` or `GOOGLE_APPLICATION_CREDENTIALS`

## Running the App with Proxy Server

To run the app with the proxy server (recommended for audio streaming):

1. Build the app:
   ```
   npm run build
   ```

2. Start the server with proxy:
   ```
   npm run start:proxy
   ```

3. Open your browser to:
   ```
   http://localhost:3001
   ```

The proxy server will handle audio file requests through the `/api/audio/:fileId` endpoint, avoiding browser tracking prevention issues.

## Development Mode

For development without the proxy server:

```
npm run dev
```

Note: Audio streaming may not work in Safari and other browsers with tracking prevention when running in development mode.

## How It Works

The audio streaming works by:

1. Client requests an audio file through our proxy endpoint `/api/audio/:fileId`
2. Server authenticates with Google Drive API using service account
3. Server streams the file data directly to the client
4. Browser plays the audio without tracking prevention issues

This approach is more reliable than direct Google Drive links, which can be blocked by browser tracking prevention.