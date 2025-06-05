// Google Drive content extraction utilities

// Helper function to validate Google Drive access token
export async function validateGoogleToken(): Promise<string> {
  try {
    const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('No Google access token found in environment variables');
    }
    
    // Test the token with a simple metadata request
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Google Drive token is invalid or expired (401 Unauthorized)');
      } else if (response.status === 403) {
        throw new Error('Google Drive token lacks required permissions (403 Forbidden)');
      } else {
        throw new Error(`Token validation failed: ${response.status} - ${response.statusText}`);
      }
    }
    
    console.log('✅ Google Drive token validated successfully');
    return accessToken;
  } catch (error) {
    console.error('Google Drive token validation error:', error);
    throw error;
  }
}

// Get text file content from Google Drive
export async function getTextFileContent(fileId: string): Promise<string> {
  try {
    console.log(`🔄 Fetching text file content for ID: ${fileId}`);
    const accessToken = await validateGoogleToken();
    
    // Get the file directly using alt=media parameter
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'text/plain'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`✅ Retrieved text content: ${content.length} characters`);
    return content;
  } catch (error) {
    console.error('Error fetching text file:', error);
    throw error;
  }
}

// Get DOCX content from Google Drive
export async function getDocxContent(fileId: string): Promise<string> {
  try {
    console.log(`🔄 Fetching DOCX content for ID: ${fileId}`);
    const accessToken = await validateGoogleToken();
    
    // Export Google Docs to plain text
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    
    const response = await fetch(exportUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      // If export fails, try to get it as a regular file
      if (response.status === 403 || response.status === 400) {
        console.log('Export failed, trying direct download...');
        return await getTextFileContent(fileId);
      }
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`✅ Retrieved DOCX content: ${content.length} characters`);
    return content;
  } catch (error) {
    console.error('Error fetching DOCX file:', error);
    throw error;
  }
}

// Get PDF content (requires additional processing)
export async function getPdfContent(fileId: string): Promise<string> {
  try {
    console.log(`🔄 Fetching PDF content for ID: ${fileId}`);
    // Note: PDF extraction would require a PDF parsing library
    // For now, we'll return a placeholder
    console.warn('PDF content extraction not yet implemented');
    return '';
  } catch (error) {
    console.error('Error fetching PDF file:', error);
    throw error;
  }
}

// Get any supported file content
export async function getFileContent(fileId: string, mimeType: string): Promise<string> {
  try {
    if (mimeType.includes('text/plain')) {
      return await getTextFileContent(fileId);
    } else if (mimeType.includes('wordprocessingml.document') || 
               mimeType.includes('application/vnd.google-apps.document')) {
      return await getDocxContent(fileId);
    } else if (mimeType.includes('pdf')) {
      return await getPdfContent(fileId);
    } else {
      console.warn(`Unsupported mime type for content extraction: ${mimeType}`);
      return '';
    }
  } catch (error) {
    console.error('Error getting file content:', error);
    throw error;
  }
}

// Clean content for database storage
export function cleanContent(content: string): string {
  if (!content) return '';
  
  // First clean HTML if present
  let cleaned = content;
  if (content.includes('<')) {
    cleaned = content
      .replace(/<p>/g, '')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<li>/g, '• ')
      .replace(/<\/li>/g, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3}/g, '\n\n');
  }

  // Clean for PostgreSQL text compatibility
  cleaned = cleaned
    .replace(/\u0000/g, '')  // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove non-printable chars
    .replace(/\r\n/g, '\n')  // Normalize newlines
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim();

  return cleaned;
}