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

export async function listAllDriveFiles(rootFolderId: string): Promise<DriveFile[]> {
  const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  let allFiles: DriveFile[] = [];
  const folderPaths = new Map<string, string>();
  
  async function getFilesInFolder(folderId: string, parentPath: string = '') {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&fields=files(id,name,mimeType,webViewLink)&pageSize=1000`,
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
    
    // Process each file/folder
    for (const file of data.files) {
      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
      const currentPath = parentPath ? `${parentPath} / ${file.name}` : file.name;
      
      // Save folder path for later reference
      if (isFolder) {
        folderPaths.set(file.id, currentPath);
      }
      
      // Add file with path info
      allFiles.push({
        ...file,
        parentId: folderId,
        path: currentPath
      });

      // Recursively process subfolders
      if (isFolder) {
        await getFilesInFolder(file.id, currentPath);
      }
    }
  }

  await getFilesInFolder(rootFolderId);
  return allFiles;
} 