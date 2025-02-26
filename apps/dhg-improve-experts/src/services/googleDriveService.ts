import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';

// Get Google Drive folder ID from environment variables
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

// Use the actual type from Supabase schema
type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

interface SyncStats {
  matchingFiles: DriveFile[];
  newFiles: DriveFile[];
  localOnlyFiles: string[];
  totalGoogleDriveFiles: number;
  totalLocalFiles: number;
  isValid: boolean;
  error?: string;
}

/**
 * Lists files in the specified Google Drive folder
 */
export const listDriveFiles = async (folderId = GOOGLE_DRIVE_FOLDER_ID): Promise<DriveFile[]> => {
  try {
    // First try from localStorage
    let accessToken = localStorage.getItem('google_access_token');
    
    // If not in localStorage, try from environment variables
    if (!accessToken) {
      accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (accessToken) {
        // Store it in localStorage for future use
        localStorage.setItem('google_access_token', accessToken);
      }
    }
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    console.log('Using token (first 10 chars):', accessToken.substring(0, 10) + '...');
    
    // Query for files in the specified folder
    const query = `'${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=1000`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing Drive files:', error);
    toast.error(`Failed to list Google Drive files: ${error.message}`);
    return [];
  }
};

/**
 * Get statistics for syncing between local files and Google Drive
 */
export const getDriveSyncStats = async (): Promise<SyncStats> => {
  try {
    // Step 1: Get files from Google Drive
    const driveFiles = await listDriveFiles();
    
    // Step 2: Get local files from Supabase or local storage
    // This is a placeholder - replace with actual local file listing
    const localFiles = await getLocalSourceFiles();
    
    // Step 3: Compare files and generate statistics
    const driveFileMap = new Map(driveFiles.map(file => [file.name, file]));
    const localFileMap = new Map(localFiles.map(file => [file.name, file]));
    
    const matchingFiles: DriveFile[] = [];
    const newFiles: DriveFile[] = [];
    const localOnlyFiles: string[] = [];
    
    // Find matching and new files
    driveFiles.forEach(file => {
      if (localFileMap.has(file.name)) {
        matchingFiles.push(file);
      } else {
        newFiles.push(file);
      }
    });
    
    // Find local-only files
    localFiles.forEach(file => {
      if (!driveFileMap.has(file.name)) {
        localOnlyFiles.push(file.name);
      }
    });
    
    return {
      matchingFiles,
      newFiles,
      localOnlyFiles,
      totalGoogleDriveFiles: driveFiles.length,
      totalLocalFiles: localFiles.length,
      isValid: true
    };
  } catch (error) {
    console.error('Error getting sync stats:', error);
    return {
      matchingFiles: [],
      newFiles: [],
      localOnlyFiles: [],
      totalGoogleDriveFiles: 0,
      totalLocalFiles: 0,
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Get local source files from the system
 */
async function getLocalSourceFiles() {
  try {
    // Fetch source files from Supabase
    const { data, error } = await supabase
      .from('sources_google')
      .select('*')
      .eq('deleted', false)
      .not('mime_type', 'is', null); // Filter out entries without mime_type
    
    if (error) {
      throw error;
    }
    
    console.log('Found local files:', data?.length || 0);
    
    // Map to a simplified structure matching our interface
    return data?.map(file => ({
      name: file.name,
      path: file.parent_path || '',
      id: file.id,
      drive_id: file.drive_id
    })) || [];
  } catch (error) {
    console.error('Error fetching local source files:', error);
    toast.error(`Failed to fetch local files: ${error.message}`);
    
    // Return empty array instead of placeholder data
    return [];
  }
} 