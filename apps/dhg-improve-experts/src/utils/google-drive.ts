import { supabase } from '@/integrations/supabase/client';
import mammoth from 'mammoth';

async function getValidAccessToken(): Promise<string> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  
  // Log token (first few characters only for security)
  console.log('Using access token:', accessToken.substring(0, 10) + '...');
  
  // First try the current access token
  try {
    // Test the token with a simple metadata request
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (response.ok) {
      return accessToken;
    }

    // Log the error response if not ok
    const errorText = await response.text();
    console.log('Token validation response:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });

  } catch (error) {
    console.log('Access token validation failed:', error);
  }

  throw new Error('Access token validation failed');
}

export async function getGoogleDocContent(fileId: string): Promise<string> {
  const accessToken = await getValidAccessToken();
  
  // Export Google Doc as plain text
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to export Google Doc: ${await response.text()}`);
  }

  return await response.text();
}

export async function getPdfContent(fileId: string): Promise<ArrayBuffer> {
  const accessToken = await getValidAccessToken();
  
  // Download PDF file
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${await response.text()}`);
  }

  return await response.arrayBuffer();
}

export async function listDriveFiles(): Promise<any[]> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,webViewLink)`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list files: ${await response.text()}`);
  }

  const data = await response.json();
  return data.files;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  parentId?: string;
  path?: string;
  isFolder: boolean;
  fullName: string;
}

export async function listAllDriveFiles(folderId: string, parentPath: string = ''): Promise<any[]> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  let allFiles: DriveFile[] = [];

  // First get the root folder's info
  const rootResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,webViewLink`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!rootResponse.ok) {
    throw new Error(`Failed to get root folder: ${await rootResponse.text()}`);
  }

  const rootFolder = await rootResponse.json();
  console.log('Root folder:', rootFolder.name);

  // Add the root folder itself to our files list
  allFiles.push({
    ...rootFolder,
    path: rootFolder.name,
    parentPath: null,
    isFolder: true,
    fullName: rootFolder.name
  });

  async function getFilesInFolder(currentFolderId: string, currentPath: string) {
    let nextPageToken: string | undefined = undefined;

    do {
      const baseUrl = 'https://www.googleapis.com/drive/v3/files';
      const query = `'${currentFolderId}' in parents`;
      const fields = 'nextPageToken,files(id,name,mimeType,webViewLink,parents)';
      const pageSize = 100;
      
      const url = `${baseUrl}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}${nextPageToken ? '&pageToken=' + encodeURIComponent(nextPageToken) : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to list files: ${errorText}`);
      }

      const data = await response.json();
      nextPageToken = data.nextPageToken;
      
      for (const file of data.files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const fullName = file.name;
        
        // For files, use the current folder's path as parent_path
        // For folders, set their own path and use current folder as parent_path
        const filePath = isFolder ? `${currentPath}/${fullName}` : null;
        const parentPath = currentPath;

        console.log(`Processing: "${fullName}" (${isFolder ? 'folder' : 'file'})`);
        console.log(`Parent path: ${parentPath}`);
        console.log(`File path: ${filePath || 'N/A'}`);

        allFiles.push({
          ...file,
          path: filePath,
          parentPath: parentPath,
          isFolder: isFolder,
          fullName: fullName
        });

        if (isFolder) {
          await getFilesInFolder(file.id, `${currentPath}/${fullName}`);
        }
      }
    } while (nextPageToken);
  }

  // Now process all children starting from root
  await getFilesInFolder(folderId, rootFolder.name);
  console.log(`Total files found: ${allFiles.length}`);
  
  return allFiles;
}

export async function getDocxContent(driveId: string) {
  try {
    console.log('🔍 Starting DOCX content extraction:', {
      driveId,
      timestamp: new Date().toISOString()
    });

    const accessToken = await getValidAccessToken();

    // Construct Google Drive API URL
    const url = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
    
    console.log('📡 Fetching from Google Drive:', {
      url,
      hasAccessToken: !!accessToken
    });

    // Make request with token
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    // Get the binary content as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    console.log('Converting DOCX content with mammoth...', {
      driveId,
      bufferSize: arrayBuffer.byteLength
    });

    // Use mammoth with more options to get better content
    const result = await mammoth.extractRawText({
      arrayBuffer,
      options: {
        includeDefaultStyleMap: true,
        preserveCharacterStyles: true,
        preserveParagraphs: true,
        preserveImages: false,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p => p:fresh",
          "r => span"
        ]
      }
    });

    if (!result.value || result.value.length < 100) {  // Minimum content check
      console.error('Extraction produced insufficient content:', {
        driveId,
        contentLength: result.value?.length,
        content: result.value,
        warnings: result.messages
      });
      throw new Error('Extracted content too short or empty');
    }

    // Clean up the content
    const cleanedContent = result.value
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\u0000/g, '')  // Remove null bytes
      .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    console.log('✅ Successfully extracted content:', {
      driveId,
      originalLength: result.value.length,
      cleanedLength: cleanedContent.length,
      preview: cleanedContent.slice(0, 100) + '...',
      warnings: result.messages
    });

    return cleanedContent;

  } catch (error) {
    console.error('❌ DOCX extraction error:', {
      error,
      message: error.message,
      stack: error.stack,
      driveId
    });
    throw error;
  }
} 