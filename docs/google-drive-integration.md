# Google Drive Integration Guide

## Overview
We integrated Google Drive using direct REST API calls instead of the Google Drive SDK, implemented file viewing capabilities with Mammoth.js for DOCX files, and added a PDF viewer for PDF files.

## Key Components

### 1. Google Drive Authentication
```typescript
// Environment Variables Required
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_CLIENT_SECRET=your_client_secret
VITE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_GOOGLE_ACCESS_TOKEN=your_access_token
VITE_GOOGLE_REFRESH_TOKEN=your_refresh_token
VITE_GOOGLE_DRIVE_FOLDER_ID=your_root_folder_id
```

### 2. Drive API Integration
```typescript
// Direct REST API calls
export async function listDriveContents(folderId?: string, pageSize = 20, pageToken?: string) {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const query = `'${folderId || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID}' in parents`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}${pageToken ? `&pageToken=${pageToken}` : ''}&fields=files(id,name,mimeType,webViewLink),nextPageToken`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch drive contents');
  }

  return response.json();
}
```

### 3. File Viewers
```typescript
// DOCX Viewer using Mammoth
import mammoth from 'mammoth';

async function renderDocx(buffer: ArrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return result.value;
}

// PDF Viewer using react-pdf
import { Document, Page } from 'react-pdf';

function PDFViewer({ url }: { url: string }) {
  return (
    <Document file={url}>
      <Page pageNumber={1} />
    </Document>
  );
}
```

### 4. Database Integration
```sql
-- Supabase table for tracking Google Drive sources
CREATE TABLE sources_google (
  id uuid default uuid_generate_v4() primary key,
  drive_id text not null unique,
  name text not null,
  mime_type text not null,
  web_view_link text,
  parent_folder_id text references public.sources_google(drive_id),
  is_root boolean default false,
  path text[],
  metadata jsonb
);
```

## Best Practices

1. Token Management
   - Store tokens securely in environment variables
   - Implement token refresh mechanism
   - Keep access tokens short-lived

2. Error Handling
   - Handle API rate limits
   - Implement retry logic for failed requests
   - Provide clear error messages to users

3. Performance
   - Use pagination for large folders
   - Implement virtual scrolling for long lists
   - Cache frequently accessed data

4. Security
   - Never expose tokens in client-side code
   - Use RLS policies in Supabase
   - Validate file types before rendering

## Common Tasks

### Syncing a Folder
```typescript
async function syncGoogleFolder(folderId: string) {
  const folder = await getGoogleDriveFolder(folderId);
  await insertGoogleDriveFolder(folder);
}
```

### Viewing Files
```typescript
async function handleFileView(fileId: string, mimeType: string) {
  const content = await getFileContent(fileId);
  
  switch(mimeType) {
    case 'application/pdf':
      return <PDFViewer content={content} />;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await renderDocx(content);
    default:
      return <pre>{content}</pre>;
  }
}
```

## Troubleshooting

1. Token Expiration
   - Check token expiry in environment variables
   - Use auth endpoint to refresh: /auth/google
   - Update .env.development with new tokens

2. File Access Issues
   - Verify folder permissions in Google Drive
   - Check access token scopes
   - Ensure correct folder ID is configured

3. Rendering Problems
   - Verify supported file types
   - Check file size limits
   - Inspect CORS configurations 