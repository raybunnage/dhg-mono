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
}

export async function listAllDriveFiles(folderId: string, parentPath: string = ''): Promise<any[]> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  let allFiles: DriveFile[] = [];

  async function getFilesInFolder(currentFolderId: string, currentPath: string) {
    let nextPageToken: string | undefined = undefined;

    do {
      // Build the query URL
      const baseUrl = 'https://www.googleapis.com/drive/v3/files';
      const query = `'${currentFolderId}' in parents`;
      const fields = 'nextPageToken,files(id,name,mimeType,webViewLink,parents)';
      const pageSize = 100;
      
      const url = `${baseUrl}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}${nextPageToken ? '&pageToken=' + encodeURIComponent(nextPageToken) : ''}`;

      console.log(`Fetching files from folder "${currentPath || 'root'}"${nextPageToken ? ' (continued)' : ''}`);
      
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
      nextPageToken = data.nextPageToken; // Store for next iteration
      
      console.log(`Found ${data.files.length} files in this batch`);
      
      for (const file of data.files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        
        // Only build nested paths for actual folders
        const filePath = isFolder ? (currentPath ? `${currentPath}/${file.name}` : file.name) : null;
        
        allFiles.push({
          ...file,
          path: filePath,         // Only set path for folders
          parentPath: currentPath // Parent path shows which folder contains this file
        });

        if (isFolder) {
          console.log(`Found folder: "${file.name}"`);
          await getFilesInFolder(file.id, filePath);
        }
      }
    } while (nextPageToken);
  }

  console.log('Starting file listing from root folder...');
  await getFilesInFolder(folderId, parentPath);
  console.log(`Total files found: ${allFiles.length}`);
  
  return allFiles;
} 