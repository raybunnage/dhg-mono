/**
 * Google Drive Browser Service
 * 
 * Browser-specific implementation of Google Drive utilities
 * Uses OAuth2 access tokens for authentication
 */

import { envConfig } from '../env-config-service';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
}

/**
 * Browser-compatible Google Drive service
 */
export class GoogleDriveBrowserService {
  private static instance: GoogleDriveBrowserService;
  private accessToken: string | null = null;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): GoogleDriveBrowserService {
    if (!GoogleDriveBrowserService.instance) {
      GoogleDriveBrowserService.instance = new GoogleDriveBrowserService();
    }
    return GoogleDriveBrowserService.instance;
  }
  
  /**
   * Validate and get Google Drive access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      // Check if we have a cached token
      if (this.accessToken) {
        // TODO: Add token expiry check
        return this.accessToken;
      }
      
      // Try to get from environment
      // @ts-ignore - import.meta.env is available in Vite
      const token = import.meta?.env?.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (!token) {
        throw new Error('No Google access token found. Please set VITE_GOOGLE_ACCESS_TOKEN');
      }
      
      // Validate the token
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=1',
        {
          headers: {
            'Authorization': `Bearer ${token}`
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
      this.accessToken = token;
      return token;
    } catch (error) {
      console.error('Google Drive token validation error:', error);
      throw error;
    }
  }
  
  /**
   * Get file metadata
   */
  public async getFileMetadata(fileId: string): Promise<GoogleDriveFile> {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,webContentLink`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Get text file content
   */
  public async getTextFileContent(fileId: string): Promise<string> {
    console.log(`🔄 Fetching text file content for ID: ${fileId}`);
    const accessToken = await this.getAccessToken();
    
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
  }
  
  /**
   * Get Google Docs content as text
   */
  public async getDocsContent(fileId: string): Promise<string> {
    console.log(`🔄 Fetching Google Docs content for ID: ${fileId}`);
    const accessToken = await this.getAccessToken();
    
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
        return await this.getTextFileContent(fileId);
      }
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`✅ Retrieved Docs content: ${content.length} characters`);
    return content;
  }
  
  /**
   * Get file content based on mime type
   */
  public async getFileContent(fileId: string, mimeType: string): Promise<string> {
    if (mimeType.includes('text/plain')) {
      return await this.getTextFileContent(fileId);
    } else if (
      mimeType.includes('wordprocessingml.document') || 
      mimeType.includes('application/vnd.google-apps.document')
    ) {
      return await this.getDocsContent(fileId);
    } else if (mimeType.includes('pdf')) {
      // PDF extraction would require additional processing
      console.warn('PDF content extraction not yet implemented in browser');
      return '';
    } else {
      console.warn(`Unsupported mime type for content extraction: ${mimeType}`);
      return '';
    }
  }
  
  /**
   * List files in a folder
   */
  public async listFiles(folderId?: string, pageToken?: string): Promise<{
    files: GoogleDriveFile[];
    nextPageToken?: string;
  }> {
    const accessToken = await this.getAccessToken();
    
    let query = '';
    if (folderId) {
      query = `'${folderId}' in parents`;
    }
    
    const params = new URLSearchParams({
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)',
      pageSize: '100',
      ...(query && { q: query }),
      ...(pageToken && { pageToken })
    });
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Search files
   */
  public async searchFiles(query: string, pageToken?: string): Promise<{
    files: GoogleDriveFile[];
    nextPageToken?: string;
  }> {
    const accessToken = await this.getAccessToken();
    
    const params = new URLSearchParams({
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)',
      pageSize: '100',
      q: query,
      ...(pageToken && { pageToken })
    });
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Clean content for database storage
   */
  public cleanContent(content: string): string {
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
}

// Export singleton instance
export const googleDriveBrowser = GoogleDriveBrowserService.getInstance();