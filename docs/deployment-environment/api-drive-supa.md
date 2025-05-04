# API Integration Documentation

This document explains how the various buttons in the application interact with Supabase and Google Drive.

## Button Overview

### 1. Sync Sources Button
- **Purpose**: Syncs documents from Google Drive to Supabase
- See detailed documentation in [Google Drive Sync Process](#google-drive-sync-process) section

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
  4. Creates expert_documents record:
     ```typescript
     await supabase.from('expert_documents').insert({
       expert_id: doc.expert_id,
       source_id: doc.id,
       document_type_id: doc.document_type_id,
       raw_content: extractedContent,
       processed_content: { text: extractedContent },
       processing_status: 'pending',
       word_count: 0,
       language: 'en',
       version: 1,
       is_latest: true,
       classification_metadata: {
         is_test_record: true,
         test_created_at: new Date().toISOString(),
         original_mime_type: doc.mime_type
       }
     })
     ```
  5. Updates source record:
     ```typescript
     await supabase
       .from('sources_google')
       .update({
         content_extracted: true,
         extracted_content: { text: extractedContent },
         updated_at: new Date().toISOString()
       })
       .eq('id', doc.id)
     ```

   The created expert_documents record includes:
   - Link to original source via source_id
   - Raw extracted content
   - Processing metadata
   - Test record flag for tracking test extractions
   - Version control fields for future updates

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

## Google Drive Sync Process

### Sync Sources Button (Blue)
- **Function**: `handleSyncSources` in `SourceButtons.tsx`
- **Purpose**: Syncs files from Google Drive folder to `sources_google` table

### Process Flow
1. Calls `listDriveFiles()` from `google-drive.ts`:
```typescript
// Gets files from specified folder
const response = await fetch(
  `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,webViewLink)`
);
```

2. For each file, checks for duplicates:
```typescript
const { data: existing } = await supabase
  .from('sources_google')
  .select('id, drive_id')
  .eq('drive_id', file.id)
  .single();
```

3. Inserts new records to `sources_google`:
```typescript
await supabase.from('sources_google').insert({
  drive_id: file.id,        // Google Drive's file ID
  name: file.name,          // Original filename
  mime_type: file.mimeType, // File type (PDF, Google Doc, etc)
  web_view_link: file.webViewLink, // Link to view in browser
  content_extracted: false,  // Tracks extraction status
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
```

4. Cleans up orphaned records:
```typescript
await supabase
  .from('sources_google')
  .delete()
  .not('drive_id', 'in', validDriveIds)
  .is('content_extracted', false);
```

### Database Fields (sources_google table)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| drive_id | Text | Google Drive file ID |
| name | Text | Original filename |
| mime_type | Text | File type (PDF, Doc, etc) |
| web_view_link | Text | Browser view URL |
| content_extracted | Boolean | Extraction status |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |
| extraction_error | Text | Error message if extraction failed |

### Error Handling
- Skips duplicate files (same drive_id)
- Logs insertion errors
- Removes orphaned records
- Shows toast notifications for success/failure 