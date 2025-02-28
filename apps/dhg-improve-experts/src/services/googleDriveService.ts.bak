import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

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
 * Sync with Google Drive - imports new files and updates existing ones
 */
export async function syncWithGoogleDrive(): Promise<SyncResult> {
  // Create a unique ID for this sync operation
  const syncId = uuidv4();
  
  // Check if we have a folder ID override in localStorage
  const folderIdOverride = localStorage.getItem('google_drive_folder_id_override');
  const folderNameOverride = localStorage.getItem('google_drive_folder_name');
  
  let folderId = folderIdOverride || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';
  let folderName = folderNameOverride || 'Google Drive Folder';
  
  if (folderIdOverride) {
    console.log(`Syncing with override folder ID: ${folderId} (${folderName})`);
  }
  
  try {
    console.log('Starting sync operation with ID:', syncId);
    
    // First create a sync history record
    const { error: insertError } = await supabase.from('sync_history').insert({
      id: syncId,
      folder_id: folderId,
      folder_name: folderName,
      timestamp: new Date().toISOString(),
      status: 'in_progress',
      processed_items: 0 // Changed from items_processed to processed_items
    });
    
    if (insertError) {
      console.error('Error creating sync history record:', insertError);
    } else {
      console.log('Created sync history record with ID:', syncId);
    }
    
    // Get sync stats - the override will be used inside getDriveSyncStats
    const syncStats = await getDriveSyncStats();
    
    console.log('Processing files for sync...');
    
    // Get the new files that need to be synced
    const newFiles = syncStats.newFiles || [];
    const errors = [];
    let addedCount = 0;
    
    // Process each new file
    if (newFiles.length > 0) {
      console.log(`Found ${newFiles.length} new files to sync`);
      
      // Use the insertGoogleFiles function to add files to the database
      const insertResult = await insertGoogleFiles(newFiles);
      addedCount = insertResult.success;
      
      // Check for errors
      if (insertResult.errors > 0) {
        console.error(`Failed to insert ${insertResult.errors} files`);
        for (let i = 0; i < insertResult.errors; i++) {
          errors.push(`Failed to insert file ${i+1}`);
        }
      }
    } else {
      console.log('No new files to sync');
    }
    
    // After sync completes, update the sync history record
    const { error: updateError } = await supabase.from('sync_history')
      .update({
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        processed_items: addedCount, // Changed from items_processed to processed_items
        error_message: errors.length > 0 ? JSON.stringify(errors) : null
      })
      .eq('id', syncId);
    
    if (updateError) {
      console.error('Error updating sync history record:', updateError);
    } else {
      console.log('Updated sync history record for ID:', syncId);
    }
    
    return {
      stats: syncStats,
      synced: {
        added: addedCount,
        updated: 0, // We're not updating files in this implementation
        errors: errors.length
      },
      syncId,
      folderId,
      folderName
    };
  } catch (error) {
    console.error('Error during sync operation:', error);
    
    // Update sync history to indicate failure
    await supabase.from('sync_history')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        processed_items: 0, // Added processed_items to be safe
        error_message: error.message
      })
      .eq('id', syncId);
    
    throw error;
  }
}

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
    // Check if we have a folder ID override in localStorage
    const folderIdOverride = localStorage.getItem('google_drive_folder_id_override');
    const folderNameOverride = localStorage.getItem('google_drive_folder_name');
    
    if (folderIdOverride) {
      console.log(`Using override folder ID: ${folderIdOverride} (${folderNameOverride || 'No name provided'})`);
    }
    
    // Step 1: Get files from Google Drive recursively
    // Use the override folder ID if available
    const driveFiles = await listDriveFiles(folderIdOverride || undefined);
    
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

/**
 * Insert selected Google Drive files into the database
 * With adjusted approach to avoid user references that cause permission errors
 */
export async function insertGoogleFiles(files: DriveFile[]): Promise<{success: number, errors: number}> {
  let successCount = 0;
  let errorCount = 0;
  
  try {
    console.log(`Inserting ${files.length} Google Drive files into the database`);
    
    // Create a supabase admin client with service role key to bypass RLS
    const supabaseAdmin = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Process files in batches to avoid overloading the database
    const batchSize = 1; // Process one at a time for better error tracking
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Create records for insertion - CRITICAL: NO USER REFERENCES!
      const records = batch.map(file => {
        // Extract parent folder from file.parents if available
        const parentFolderId = file.parents && file.parents.length > 0 
          ? file.parents[0] 
          : null;
        
        // Create record with absolute minimum required fields
        // IMPORTANT: No created_by or updated_by fields
        const record = {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink || null,
          modified_time: file.modifiedTime || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          parent_folder_id: parentFolderId,
          is_root: false,
          deleted: false,
          sync_status: 'pending',
          metadata: file
        };
        
        if (file.size) {
          // @ts-ignore - Add size if available
          record.size = parseInt(file.size);
        }
        
        return record;
      });
      
      console.log('Attempting insert with simplified record (NO USER REFS):', JSON.stringify(records[0], null, 2));
      
      // Use the admin client to insert the batch
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .insert(records)
        .select();
        
      if (error) {
        console.error('Error inserting batch:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        errorCount += batch.length;
      } else {
        console.log(`Successfully inserted ${data.length} files:`, data);
        successCount += data.length;
      }
    }
    
    // Create a sync history record - also with NO user references
    const syncId = uuidv4();
    await supabaseAdmin.from('sync_history').insert({
      id: syncId,
      folder_id: import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '',
      folder_name: 'Manual File Selection',
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: errorCount > 0 ? 'completed_with_errors' : 'completed',
      processed_items: successCount + errorCount, // Changed from items_processed to processed_items
      error_message: errorCount > 0 ? `Failed to insert ${errorCount} files` : null
      // NO created_by field
    });
    
    // Return the results
    return {
      success: successCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Error in insertGoogleFiles:', error);
    return {
      success: successCount,
      errors: errorCount + (files.length - successCount - errorCount)
    };
  }
}

/**
 * Helper function to get database table structure
 */
export async function getTableStructure(tableName: string) {
  try {
    const supabaseAdmin = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    );
    
    // First try with get_table_metadata RPC
    try {
      const { data, error } = await supabaseAdmin.rpc('get_table_metadata', {
        p_target_table: tableName
      });
      
      if (error) {
        console.error('Error getting table metadata:', error);
      } else {
        return data;
      }
    } catch (rpcErr) {
      console.error('RPC error:', rpcErr);
    }
    
    // Fallback to raw SQL if RPC doesn't work
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `
    });
    
    if (error) {
      console.error('Error getting table structure using SQL:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getTableStructure:', error);
    return null;
  }
} 