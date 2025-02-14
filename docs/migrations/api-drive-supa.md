# API Integration Documentation

This document explains how the various buttons in the application interact with Supabase and Google Drive.

## Button Overview

### 1. Sync Sources Button
- **Purpose**: Syncs documents from Google Drive to Supabase
- **Process**:
  1. Calls Supabase Edge Function `sync-google-sources`
  2. Edge function fetches files from specified Google Drive folder
  3. Stores file metadata in `sources_google` table

### 2. Extract Content Button
- **Purpose**: Processes unextracted documents in batch
- **Process**:
  1. Queries `sources_google` for unprocessed documents
  2. For each document:
     - Downloads content from Google Drive
     - Creates record in `expert_documents`
     - Updates `sources_google` status

### 3. Test Extract Button
- **Purpose**: Tests extraction on a single document
- **Process**:
  1. Finds first unprocessed PDF or Google Doc
  2. Attempts content extraction
  3. Shows success/failure message

### 4. Test Env Button
- **Purpose**: Validates environment configuration
- **Process**:
  1. Checks Google Drive API token
  2. Makes test request to Google Drive API
  3. Verifies authentication works

### 5. Test Drive Button
- **Purpose**: Tests Google Drive folder access
- **Process**:
  1. Verifies basic API connectivity
  2. Lists files in configured folder
  3. Shows file count if successful

## Required Environment Variables

```bash
# Google Drive Configuration
VITE_GOOGLE_ACCESS_TOKEN=     # OAuth2 access token
VITE_GOOGLE_REFRESH_TOKEN=    # OAuth2 refresh token
VITE_GOOGLE_DRIVE_FOLDER_ID=  # Target folder ID
VITE_GOOGLE_SCOPES=          # Required API scopes

# Supabase Configuration
VITE_SUPABASE_URL=          # Your Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Public anon key
```

## Database Tables

### sources_google
- Stores metadata about files in Google Drive
- Tracks extraction status
- Key fields:
  - `id`: UUID
  - `drive_id`: Google Drive file ID
  - `content_extracted`: Boolean
  - `extraction_error`: Text (nullable)

### expert_documents
- Stores processed document content
- Key fields:
  - `id`: UUID
  - `source_id`: References sources_google
  - `raw_content`: Text
  - `processed_content`: JSONB
  - `processing_status`: Text

## Common Issues

1. **Token Expiration**
   - Access tokens expire after 1 hour
   - Use refresh token to get new access token
   - Update `.env.development` with new token

2. **File Type Support**
   - Currently supports:
     - PDF files
     - Google Docs
   - Other file types will be skipped

3. **Processing Status**
   - Valid states: 'pending', 'processing', 'completed', 'error'
   - Check `extraction_error` for failure details

## Testing Flow

1. Start with "Test Env" to verify configuration
2. Use "Test Drive" to check folder access
3. Run "Sync Sources" to populate database
4. Try "Test Extract" on single document
5. Use "Extract Content" for batch processing

## Security Notes

- Keep `.env.development` out of source control
- Refresh tokens are long-lived - protect them
- Use `.env.example` for template values only