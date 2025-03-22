// Service for interacting with the script file server
const API_BASE_URL = 'http://localhost:3002/api';

export interface ScriptFileResponse {
  file_path: string;
  title: string;
  content: string;
  size?: number;
  created_at?: string;
  updated_at?: string;
}

// Class to handle interactions with the script file server
class ScriptFileService {
  // Get file content by path
  async getFileContent(filePath: string): Promise<ScriptFileResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/script-file?path=${encodeURIComponent(filePath)}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch script file');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching script file:', error);
      throw error;
    }
  }
  
  // Delete a script file from disk
  async deleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/script-file?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete script file');
      }
      
      return {
        success: true,
        message: data.message || 'File deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting script file:', error);
      throw error;
    }
  }
  
  // List available script files
  async listScriptFiles(): Promise<{ total: number; files: string[] }> {
    try {
      const response = await fetch(`${API_BASE_URL}/script-files`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch script files list');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching script files list:', error);
      throw error;
    }
  }
}

export const scriptFileService = new ScriptFileService();