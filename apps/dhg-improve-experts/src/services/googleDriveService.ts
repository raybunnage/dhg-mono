import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';

// Get Google Drive folder ID from environment variables
const GOOGLE_DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

// Use the actual type from Supabase schema
type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];
type SourceGoogleInsert = Database['public']['Tables']['sources_google']['Insert'];

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
}

interface SyncStats {
  matchingFiles: DriveFile[];
  newFiles: DriveFile[];
  localOnlyFiles: string[];
  totalGoogleDriveFiles: number;
  totalGoogleDriveFolders: number;
  totalLocalFiles: number;
  totalMP4Files: number;
  totalMP4SizeGB: number;
  isValid: boolean;
  error?: string;
}

interface SyncResult {
  stats: SyncStats;
  synced: {
    added: number;
    updated: number;
    errors: number;
  };
  syncId: string;
}

/**
 * Retrieves the latest access token from storage
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    // Get the most recent token from the database
    const { data, error } = await supabase
      .from('google_auth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) throw error;
    if (!data) return null;
    
    return data.access_token;
  } catch (err) {
    console.error('Error getting access token:', err);
    return null;
  }
};

// Creates a fetch wrapper that handles auth errors and retries
export const authenticatedFetch = async (
  url: string, 
  options: RequestInit = {}
): Promise<Response> => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }
    
    // Add token to headers
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    // Make the API call
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      // Try to refresh the token first
      const refreshResult = await refreshGoogleToken();
      
      if (refreshResult.success) {
        // Retry with new token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${refreshResult.access_token}`
          }
        });
      } else {
        // Token refresh failed, need to re-authenticate
        toast.error('Google Drive access expired. Please reconnect your account.');
        throw new Error('Authentication failed after token refresh attempt');
      }
    }
    
    return response;
  } catch (err) {
    console.error('Error in authenticated fetch:', err);
    throw err;
  }
};

// Refreshes the Google token explicitly
export const refreshGoogleToken = async (): Promise<{ 
  success: boolean; 
  access_token?: string;
  expires_at?: string;
  error?: string;
}> => {
  try {
    // Call our Supabase function to refresh the token
    const { data, error } = await supabase.functions.invoke('refresh-google-token', {
      body: {}  // No need to pass the refresh token, our function gets it from the database
    });
    
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('Failed to refresh token:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error refreshing token'
    };
  }
};

/**
 * Lists files in a Google Drive folder with retry logic
 */
export const listFilesInFolder = async (
  folderId: string,
  pageToken?: string,
  fields = 'nextPageToken, files(id, name, mimeType, parents, webViewLink, modifiedTime)'
): Promise<any> => {
  try {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=${fields}`;
    
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    const response = await authenticatedFetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list files: ${response.status} ${errorText}`);
    }
    
    return response.json();
  } catch (err) {
    console.error(`Error listing files in folder ${folderId}:`, err);
    throw err;
  }
};

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
 * Performs a full sync with Google Drive
 * This will update existing files and add new ones
 */
export const syncWithGoogleDrive = async (folderId = GOOGLE_DRIVE_FOLDER_ID): Promise<SyncResult> => {
  try {
    // Start by getting the comparison stats
    const stats = await getDriveSyncStats();
    
    if (!stats.isValid) {
      throw new Error('Failed to get sync stats: ' + stats.error);
    }
    
    // Initialize counters
    let added = 0;
    let updated = 0;
    let errors = 0;
    
    // 1. Get detailed metadata for new files
    const newFiles = stats.newFiles;
    const token = localStorage.getItem('google_access_token');
    
    if (!token) {
      throw new Error('No access token available for syncing');
    }
    
    console.log(`Beginning sync of ${newFiles.length} new files`);
    
    // Create sync history entry
    const { data: syncHistoryData, error: syncHistoryError } = await supabase
      .from('sync_history')
      .insert({
        folder_id: folderId,
        folder_name: 'Google Drive',
        status: 'in_progress',
        items_processed: 0,
      })
      .select()
      .single();
    
    if (syncHistoryError) {
      console.error('Error creating sync history:', syncHistoryError);
    }
    
    const syncId = syncHistoryData?.id || crypto.randomUUID();
    
    // Process each new file
    for (const file of newFiles) {
      try {
        // Skip folders, we only want to sync actual files
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          continue;
        }
        
        // Get detailed metadata with webViewLink
        const fileMetadata = await getFileMetadata(file.id, token);
        
        if (fileMetadata) {
          // Insert into sources_google table
          const { error: insertError } = await supabase
            .from('sources_google')
            .insert({
              name: fileMetadata.name,
              drive_id: fileMetadata.id,
              mime_type: fileMetadata.mimeType,
              web_view_link: fileMetadata.webViewLink || null,
              parent_id: fileMetadata.parents?.[0] || null,
              modified_time: fileMetadata.modifiedTime,
              size: fileMetadata.size ? parseInt(fileMetadata.size) : null,
              deleted: false,
              sync_id: syncId
            });
          
          if (insertError) {
            console.error(`Error inserting file ${file.name}:`, insertError);
            errors++;
          } else {
            added++;
            console.log(`Added file: ${file.name}`);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors++;
      }
    }
    
    // Update sync history with results
    const { error: updateHistoryError } = await supabase
      .from('sync_history')
      .update({
        status: errors > 0 ? 'completed_with_errors' : 'completed',
        items_processed: added + updated,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncId);
    
    if (updateHistoryError) {
      console.error('Error updating sync history:', updateHistoryError);
    }
    
    return {
      stats,
      synced: {
        added,
        updated,
        errors
      },
      syncId
    };
  } catch (error) {
    console.error('Error syncing with Google Drive:', error);
    toast.error(`Sync failed: ${error.message}`);
    
    // Update sync history with failure
    try {
      const syncId = crypto.randomUUID();
      await supabase
        .from('sync_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', syncId);
    } catch (historyError) {
      console.error('Error updating sync history after failure:', historyError);
    }
    
    return {
      stats: {
        matchingFiles: [],
        newFiles: [],
        localOnlyFiles: [],
        totalGoogleDriveFiles: 0,
        totalGoogleDriveFolders: 0,
        totalLocalFiles: 0,
        totalMP4Files: 0,
        totalMP4SizeGB: 0,
        isValid: false,
        error: error.message
      },
      synced: {
        added: 0,
        updated: 0,
        errors: 1
      },
      syncId: 'error'
    };
  }
};

/**
 * Get detailed metadata for a file
 */
async function getFileMetadata(fileId: string, token: string): Promise<DriveFile | null> {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,parents,webViewLink`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error getting metadata for file ${fileId}:`, error);
    return null;
  }
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
    
    // Calculate MP4 stats
    const mp4Files = driveDocuments.filter(file => 
      file.mimeType === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')
    );
    
    // Calculate total size in GB
    const totalSizeBytes = mp4Files.reduce((total, file) => {
      const size = file.size ? parseInt(file.size) : 0;
      return total + size;
    }, 0);
    
    const totalSizeGB = totalSizeBytes / (1024 * 1024 * 1024);
    
    return {
      matchingFiles,
      newFiles,
      localOnlyFiles,
      totalGoogleDriveFiles: driveDocuments.length,
      totalGoogleDriveFolders: driveFolders.length,
      totalLocalFiles: localDocuments.length,
      totalMP4Files: mp4Files.length,
      totalMP4SizeGB: parseFloat(totalSizeGB.toFixed(2)),
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
      totalMP4Files: 0,
      totalMP4SizeGB: 0,
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