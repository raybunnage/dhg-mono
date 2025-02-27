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

/**
 * Fetches binary content from Google Drive
 * @param driveId Google Drive file ID
 * @returns ArrayBuffer of file content
 */
export async function fetchDriveFileContent(driveId: string): Promise<ArrayBuffer> {
  console.log('Fetching file content for:', driveId);
  
  // First, check if the access token is still valid
  try {
    const token = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    console.log('🔐 Checking token validity...');
    const testResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!testResponse.ok) {
      console.error('❌ Google token validation failed:', testResponse.status, testResponse.statusText);
      throw new Error(`Token validation failed: ${testResponse.status} ${testResponse.statusText}`);
    }
    
    console.log('✅ Google token appears valid');
  } catch (error) {
    console.error('❌ Error validating token:', error);
  }
  
  // First, try our existing API endpoint if it exists
  try {
    const response = await fetch(`/api/google/files/${driveId}/content`);
    if (response.ok) {
      const data = await response.arrayBuffer();
      const validation = validateAudioData(data);
      if (!validation.isValid) {
        console.error('❌ Received invalid audio data:', validation);
        throw new Error(validation.reason);
      }
      return data;
    }
    console.log('Regular API endpoint failed, trying alternative method');
  } catch (error) {
    console.warn('API endpoint not available:', error);
  }

  // Fallback: Direct download using token
  try {
    const token = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`, 
      { 
        headers: { 
          'Authorization': `Bearer ${token}`
        } 
      }
    );
    
    if (response.ok) {
      const data = await response.arrayBuffer();
      console.log('🔍 Checking downloaded data format...');
      const validation = validateAudioData(data);
      
      if (!validation.isValid) {
        if (validation.isHTML) {
          console.error('❌ Received HTML instead of audio data. Token may have expired.');
          // Get some of the HTML to see what error message it contains
          const textDecoder = new TextDecoder('utf-8');
          const htmlSample = textDecoder.decode(data.slice(0, 200));
          console.error('HTML sample:', htmlSample);
        } else {
          console.error('❌ Invalid audio data:', validation);
        }
        throw new Error(validation.reason);
      }
      
      console.log('✅ Downloaded valid audio data:', validation);
      return data;
    } else {
      throw new Error(`Failed to download: ${response.status}`);
    }
  } catch (error) {
    console.error('Direct download failed:', error);
    throw new Error('Could not fetch file content from Google Drive');
  }
}

/**
 * Checks if binary data is actually audio and not HTML/error page
 * @param data The binary data to check
 * @returns Object with validity check and reason
 */
export function validateAudioData(data: ArrayBuffer): { 
  isValid: boolean; 
  reason?: string;
  isHTML?: boolean;
  detectedFormat?: string;
} {
  // Convert first bytes to a string to check for HTML
  const firstBytes = new Uint8Array(data.slice(0, 20));
  let textVersion = '';
  for (let i = 0; i < firstBytes.length; i++) {
    textVersion += String.fromCharCode(firstBytes[i]);
  }
  
  // Check for HTML response (error page)
  if (textVersion.includes('<!DOCTYPE') || 
      textVersion.includes('<html') || 
      textVersion.includes('HTTP/')) {
    return {
      isValid: false,
      reason: 'Received HTML instead of audio data. Authentication may have expired.',
      isHTML: true
    };
  }
 
  // Check for various audio format signatures
  // M4A/AAC signature check
  if (firstBytes[4] === 0x66 && firstBytes[5] === 0x74 && 
      firstBytes[6] === 0x79 && firstBytes[7] === 0x70) {
    return { 
      isValid: true,
      detectedFormat: 'M4A/AAC'
    };
  }
  
  // MP3 signature check - often starts with ID3
  if (firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33) {
    return { 
      isValid: true,
      detectedFormat: 'MP3'
    };
  }
  
  // WAV signature check
  if (firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && 
      firstBytes[2] === 0x46 && firstBytes[3] === 0x46) {
    return { 
      isValid: true,
      detectedFormat: 'WAV'
    };
  }
 
  // If we get here, it's not a recognized audio format or HTML
  return {
    isValid: false,
    reason: 'Unknown format - not a recognized audio file'
  };
}

/**
 * Fetches metadata for a Google Drive file
 * @param driveId Google Drive file ID
 * @returns File metadata including size and mimeType
 */
export async function fetchDriveFileMetadata(driveId: string): Promise<{
  name: string;
  mimeType: string;
  size: number;
  id: string;
}> {
  console.log('🔍 Fetching metadata for:', driveId);
  
  const token = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}?fields=name,mimeType,size,id`, 
    { 
      headers: { 
        'Authorization': `Bearer ${token}`
      } 
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('✅ File metadata:', data);
  
  return {
    name: data.name,
    mimeType: data.mimeType,
    size: parseInt(data.size, 10),
    id: data.id
  };
}

/**
 * Fetches top-level folders from Google Drive
 * Uses existing token authentication
 */
export async function fetchFolders() {
  try {
    const token = await getValidAccessToken(); // Assuming this function exists
    
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name,mimeType,parents)',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching folders:', error);
    throw error;
  }
}

/**
 * Fetches all files within a specific folder
 * @param folderId The Google Drive folder ID
 */
export async function fetchFilesInFolder(folderId: string) {
  try {
    const token = await getValidAccessToken(); // Assuming this function exists
    
    // Query for files that have the specified folder as parent
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime)`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching files in folder:', error);
    throw error;
  }
}

/**
 * Recursively fetches a folder and all its contents (sub-folders and files)
 * @param folderId The Google Drive folder ID
 */
export async function fetchFolderTree(folderId: string) {
  try {
    // Get the folder info first
    const token = await getValidAccessToken();
    const folderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (!folderResponse.ok) {
      throw new Error(`Failed to fetch folder: ${folderResponse.status}`);
    }
    
    const folder = await folderResponse.json();
    
    // Get all items in this folder
    const files = await fetchFilesInFolder(folderId);
    
    // Separate folders and regular files
    const subFolders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
    const regularFiles = files.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
    
    // Recursively process subfolders
    const subFolderTrees = await Promise.all(
      subFolders.map(async subFolder => {
        return await fetchFolderTree(subFolder.id);
      })
    );
    
    // Construct the tree
    return {
      ...folder,
      files: regularFiles,
      subFolders: subFolderTrees
    };
  } catch (error) {
    console.error(`Error fetching folder tree for ${folderId}:`, error);
    throw error;
  }
} 