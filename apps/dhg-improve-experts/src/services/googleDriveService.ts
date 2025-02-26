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
  parents?: string[];
}

interface SyncStats {
  matchingFiles: DriveFile[];
  newFiles: DriveFile[];
  localOnlyFiles: string[];
  totalGoogleDriveFiles: number;
  totalGoogleDriveFolders: number;
  totalLocalFiles: number;
  isValid: boolean;
  error?: string;
}

/**
 * Lists files in the specified Google Drive folder recursively
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
    
    return await listAllFilesRecursively(folderId, accessToken);
  } catch (error) {
    console.error('Error listing Drive files:', error);
    toast.error(`Failed to list Google Drive files: ${error.message}`);
    return [];
  }
};

/**
 * Recursively list all files in a folder and its subfolders
 */
async function listAllFilesRecursively(folderId: string, accessToken: string): Promise<DriveFile[]> {
  let allFiles: DriveFile[] = [];
  let pageToken: string | null = null;
  
  // Create a queue of folder IDs to process
  const folderQueue: string[] = [folderId];
  const processedFolders = new Set<string>();
  
  // Process all folders in the queue
  while (folderQueue.length > 0) {
    const currentFolderId = folderQueue.shift()!;
    
    // Skip if we've already processed this folder
    if (processedFolders.has(currentFolderId)) {
      continue;
    }
    
    processedFolders.add(currentFolderId);
    console.log(`Processing folder: ${currentFolderId}`);
    
    // Keep fetching pages until there are no more
    do {
      // Query for files in the current folder
      const query = `'${currentFolderId}' in parents and trashed=false`;
      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)&pageSize=1000`;
      
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const files = data.files || [];
      
      // Add all files to our results
      allFiles = allFiles.concat(files);
      
      // Add any folders to our queue for processing
      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          folderQueue.push(file.id);
        }
      }
      
      // Update page token for next page
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  
  console.log(`Found ${allFiles.length} total files in Drive (including folders)`);
  return allFiles;
}

/**
 * Get statistics for syncing between local files and Google Drive
 */
export const getDriveSyncStats = async (): Promise<SyncStats> => {
  try {
    // Step 1: Get files from Google Drive recursively
    const driveFiles = await listDriveFiles();
    
    // Step 2: Get local files from Supabase
    const localFiles = await getLocalSourceFiles();
    
    // Separate folders and documents from Google Drive files
    const driveFolders = driveFiles.filter(file => 
      file.mimeType === 'application/vnd.google-apps.folder'
    );
    
    const driveDocuments = driveFiles.filter(file => 
      file.mimeType !== 'application/vnd.google-apps.folder'
    );
    
    console.log(`Found ${driveDocuments.length} documents and ${driveFolders.length} folders in Drive`);
    
    // Similarly filter local files to exclude any folder entries
    const localDocuments = localFiles.filter(file => 
      file.mime_type !== 'application/vnd.google-apps.folder'
    );
    
    console.log(`Found ${localDocuments.length} documents in local database`);
    
    // Step 3: Compare files and generate statistics
    // Use drive_id for matching if available, otherwise fall back to name
    const matchingFiles: DriveFile[] = [];
    const newFiles: DriveFile[] = [];
    const localOnlyFiles: string[] = [];
    
    // Create maps for faster lookup
    const localFileMap = new Map(
      localDocuments.map(file => [file.drive_id || file.name, file])
    );
    
    // Find matching and new files
    for (const file of driveDocuments) {
      if (localFileMap.has(file.id) || localFileMap.has(file.name)) {
        matchingFiles.push(file);
      } else {
        newFiles.push(file);
      }
    }
    
    // Find local-only files
    const driveFileIds = new Set(driveDocuments.map(file => file.id));
    const driveFileNames = new Set(driveDocuments.map(file => file.name));
    
    for (const file of localDocuments) {
      // If neither the drive_id nor name exists in the drive files
      if (
        (!file.drive_id || !driveFileIds.has(file.drive_id)) && 
        !driveFileNames.has(file.name)
      ) {
        localOnlyFiles.push(file.name);
      }
    }
    
    return {
      matchingFiles,
      newFiles,
      localOnlyFiles,
      totalGoogleDriveFiles: driveDocuments.length,
      totalGoogleDriveFolders: driveFolders.length,
      totalLocalFiles: localDocuments.length,
      isValid: true
    };
  } catch (error) {
    console.error('Error getting sync stats:', error);
    return {
      matchingFiles: [],
      newFiles: [],
      localOnlyFiles: [],
      totalGoogleDriveFiles: 0,
      totalGoogleDriveFolders: 0,
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
      drive_id: file.drive_id,
      mime_type: file.mime_type
    })) || [];
  } catch (error) {
    console.error('Error fetching local source files:', error);
    toast.error(`Failed to fetch local files: ${error.message}`);
    
    // Return empty array instead of placeholder data
    return [];
  }
} 