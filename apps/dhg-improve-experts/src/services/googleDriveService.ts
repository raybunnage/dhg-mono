import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../../supabase/types';
import { v4 as uuidv4 } from 'uuid';

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
  timestamp?: string; // ISO string timestamp
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
    // First try to get token from localStorage (which we might have from successful auth)
    const localToken = localStorage.getItem('google_access_token');
    if (localToken) {
      console.log('Using token from localStorage');
      return localToken;
    }
    
    // Try to get the most recent token from the database
    const { data, error } = await supabase
      .from('google_auth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
      
    // Note: Removed .single() to handle empty result set more gracefully
    
    if (error) {
      console.error('Database error fetching token:', error);
      return null;
    }
    
    // Check if we have data and it has at least one record
    if (!data || data.length === 0) {
      console.log('No access token found in database');
      return null;
    }
    
    // We should have the most recent token as the first item
    const token = data[0].access_token;
    
    // Store it in localStorage for future use
    if (token) {
      localStorage.setItem('google_access_token', token);
    }
    
    return token;
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
    // Check if we're in development mode with validation skipped
    const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
    
    if (skipValidation) {
      console.log('DEV MODE: Token validation is skipped, but we still need actual data');
      // Don't use dummy data even in dev mode - this was causing ghost records to appear
      // Instead, just check for a token and fail if none exists
      if (!localStorage.getItem('google_access_token') && !import.meta.env.VITE_GOOGLE_ACCESS_TOKEN) {
        console.error('No access token available, even with skip_token_validation');
        throw new Error('No access token available. Please authenticate with Google first.');
      }
    }
    
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
    
    // If folderId is provided but is empty string, use default
    if (folderId === '') {
      folderId = GOOGLE_DRIVE_FOLDER_ID;
      console.log('Empty folder ID provided, using default:', folderId);
    }
    
    // If no folderId still, throw error
    if (!folderId) {
      throw new Error('No Google Drive folder ID available. Please select a folder first.');
    }
    
    console.log('Listing files in folder ID:', folderId);
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
export async function syncWithGoogleDrive(folderId?: string, folderName?: string): Promise<SyncResult> {
  // Create a unique ID for this sync operation
  const syncId = uuidv4();
  
  // Use provided folder ID or fall back to default
  const effectiveFolderId = folderId || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '';
  const effectiveFolderName = folderName || 'Google Drive Folder';
  
  // Store the explicitly requested folder ID in a global variable
  // This will help ensure this specific folder is marked as a root when inserted
  if (folderId) {
    console.log(`Syncing with provided folder ID: ${effectiveFolderId} (${effectiveFolderName})`);
    // If we need to pass this information to other functions, we'd do it explicitly
  }
  
  try {
    console.log('Starting sync operation with ID:', syncId);
    
    // Sync history is disabled - recording only locally
    console.log('Starting sync operation with ID:', syncId);
    
    // Get sync stats using the provided folder ID
    const syncStats = await getDriveSyncStats(effectiveFolderId, effectiveFolderName);
    
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
    
    // Sync history tracking disabled
    console.log('Sync completed with ID:', syncId, 'Added:', addedCount, 'Errors:', errors.length);
    
    return {
      stats: syncStats,
      synced: {
        added: addedCount,
        updated: 0, // We're not updating files in this implementation
        errors: errors.length
      },
      syncId,
      folderId: effectiveFolderId,
      folderName: effectiveFolderName
    };
  } catch (error) {
    console.error('Error during sync operation:', error);
    
    // Sync history tracking disabled
    console.error('Sync failed with ID:', syncId, 'Error:', error.message);
    
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
export const getDriveSyncStats = async (folderId?: string, folderName?: string): Promise<SyncStats> => {
  try {
    // Check if we're in development mode with validation skipped
    const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
    
    if (folderId) {
      console.log(`Using provided folder ID: ${folderId} (${folderName || 'No name provided'})`);
    } else {
      console.log('No folder ID provided - using default folder ID');
    }
    
    // Add timestamp for tracking
    const timestamp = new Date().toISOString();
    
    // Ensure we have a valid token in all cases, even in dev mode
    if (!localStorage.getItem('google_access_token') && !import.meta.env.VITE_GOOGLE_ACCESS_TOKEN) {
      console.error('No access token available for sync stats');
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
        error: 'No valid Google token found. Please authenticate with Google first.',
        timestamp
      };
    }
    
    // Validate we have a folder ID to use
    if (!folderId && !GOOGLE_DRIVE_FOLDER_ID) {
      console.error('No folder ID available - neither provided nor default');
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
        error: 'No folder ID selected. Please select a folder first.',
        timestamp
      };
    }
    
    // Step 1: Get files from Google Drive recursively
    // Use the provided folder ID if available
    const driveFiles = await listDriveFiles(folderId || undefined);
    
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
      isValid: true,
      timestamp
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
      error: error.message,
      timestamp: new Date().toISOString()
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
 * Timeout has been increased to 10 minutes (600000ms) for long-running operations
 */
export async function insertGoogleFiles(files: DriveFile[], timeout = 600000): Promise<{success: number, errors: number, details: {newFiles: string[], updatedFiles: string[], errorFiles: string[]}}>  {
  let successCount = 0;
  let errorCount = 0;
  const newFiles: string[] = [];
  const updatedFiles: string[] = [];
  const errorFiles: string[] = [];
  const errorDetails: {id: string, message: string}[] = [];
  
  try {
    console.log(`INSERTING FILES: Starting to insert ${files.length} Google Drive files into the database`);
    
    // Using existing supabase client from client.ts which is already SupabaseClientService
    // This has proper handling for authentication and permissions
    console.log(`INSERTING FILES: Using existing Supabase client with proper authentication...`);
    
    // Use the existing supabase client which already has the service role key
    const supabaseAdmin = supabase;

    // Test the connection first
    try {
      const { data: testData, error: testError } = await supabaseAdmin
        .from('sources_google')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('ERROR: Failed to connect to sources_google table:', testError);
        throw new Error(`Database connection test failed: ${testError.message}`);
      } else {
        console.log('INSERTING FILES: Database connection test successful');
      }
    } catch (testErr) {
      console.error('ERROR: Exception during connection test:', testErr);
      throw new Error(`Failed to establish database connection: ${testErr.message}`);
    }

    // Process files in batches to avoid overloading the database
    const batchSize = 5; // Process in smaller batches to be more careful
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      console.log(`INSERTING FILES: Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(files.length/batchSize)}`);
      
      // First check which files already exist in the database
      const fileIds = batch.map(file => file.id);
      
      // Log the file IDs we're checking
      console.log(`INSERTING FILES: Checking existing files with these IDs: ${fileIds.join(', ')}`);
      
      const { data: existingFiles, error: existingError } = await supabaseAdmin
        .from('sources_google')
        .select('drive_id')
        .in('drive_id', fileIds);
      
      if (existingError) {
        console.error('ERROR: Failed to check existing files:', existingError);
        throw new Error(`Failed to check existing files: ${existingError.message}`);
      }
        
      const existingFileIds = new Set(existingFiles?.map(f => f.drive_id) || []);
      console.log(`INSERTING FILES: Found ${existingFileIds.size} existing files in this batch of ${batch.length}`);
      
      // First build proper hierarchical paths for all files in the batch
      console.log('INSERTING FILES: Building proper hierarchical paths for all files...');
      const pathMap = await buildProperFilePaths(batch, supabaseAdmin);
      
      // Find the original folder ID that was requested to sync
      // This is the root folder ID that should be marked as is_root = true
      let rootFolderId = null;
      
      // First check if any folder has been explicitly marked as the root
      // This happens when searchSpecificFolder is used
      const folders = batch.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      
      // Check for the custom property we added in searchSpecificFolder
      const explicitRootFolder = batch.find(file => 
        // @ts-ignore - Checking for our custom property
        file._isRootFolder === true && file.mimeType === 'application/vnd.google-apps.folder'
      );
      
      if (explicitRootFolder) {
        rootFolderId = explicitRootFolder.id;
        console.log(`INSERTING FILES: Found explicitly marked root folder: ${rootFolderId}`);
      } else if (folders.length === 1) {
        // If there's only one folder, it's the root
        rootFolderId = folders[0].id;
        console.log(`INSERTING FILES: Single folder in batch, marking as root: ${rootFolderId}`);
      } else if (folders.length > 1) {
        // Look for folders without parents, or that are at the top level
        const rootFolders = folders.filter(folder => !folder.parents || folder.parents.length === 0);
        
        if (rootFolders.length === 1) {
          rootFolderId = rootFolders[0].id;
          console.log(`INSERTING FILES: Found single top-level folder, marking as root: ${rootFolderId}`);
        } else if (rootFolders.length === 0) {
          // If we don't have any folders without parents, look for the one that's a parent to others
          // Count how many times each folder appears as a parent
          const parentCount = new Map<string, number>();
          
          batch.forEach(file => {
            if (file.parents && file.parents.length > 0) {
              file.parents.forEach(parentId => {
                // Only count parents that are folders in our batch
                if (folders.some(f => f.id === parentId)) {
                  parentCount.set(parentId, (parentCount.get(parentId) || 0) + 1);
                }
              });
            }
          });
          
          // Find the folder that's most commonly a parent (likely the root)
          let maxCount = 0;
          folders.forEach(folder => {
            const count = parentCount.get(folder.id) || 0;
            if (count > maxCount) {
              maxCount = count;
              rootFolderId = folder.id;
            }
          });
          
          if (rootFolderId) {
            console.log(`INSERTING FILES: Inferred root folder from parent relationships: ${rootFolderId}`);
          }
        } else {
          console.log(`INSERTING FILES: Found ${rootFolders.length} possible root folders, using the first one`);
          rootFolderId = rootFolders[0].id;
        }
      }
      
      if (!rootFolderId && folders.length > 0) {
        // Fallback: if we couldn't determine the root but we have folders, use the first one
        rootFolderId = folders[0].id;
        console.log(`INSERTING FILES: Fallback to first folder as root: ${rootFolderId}`);
      }
      
      if (rootFolderId) {
        console.log(`INSERTING FILES: Root folder identified: ${rootFolderId}`);
      } else {
        console.log('INSERTING FILES: No folders found, cannot determine root folder');
      }
      
      // Create records for insertion or update
      const records = batch.map(file => {
        // Extract parent folder from file.parents if available
        const parentFolderId = file.parents && file.parents.length > 0 
          ? file.parents[0] 
          : null;
          
        // Get the proper hierarchical path from our path map
        let fullPath = pathMap.get(file.id);
        
        // If no path was generated, fall back to a simple path
        if (!fullPath) {
          if (parentFolderId) {
            // First, try to find this parent in our batch to get its name
            const parentInBatch = batch.find(f => f.id === parentFolderId);
            const parentName = parentInBatch?.name || 'folder';
            // Create a simple fallback path
            fullPath = `/folders/${parentFolderId}/${parentName}`;
          }
        }
        
        // Determine if this is a root folder
        const isRoot = rootFolderId === file.id || 
                      (!parentFolderId && file.mimeType === 'application/vnd.google-apps.folder');
        
        // Get the current date in local time (not UTC)
        const now = new Date();
        
        // Format date as YYYY-MM-DD HH:MM:SS in local timezone
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
          .toISOString()
          .replace('T', ' ')
          .replace(/\.\d+Z$/, '');
          
        // FIXING FILE PATHS: Correctly set parent_path and path for better FileTree compatibility
        
        // CRITICAL FIX: This is exactly how old records are structured - we must match this format
        // 1. path - This is THE MOST IMPORTANT field for the file tree (folders need this)
        // 2. parent_path - This is how children find their parents (children need this)
        // 3. parent_folder_id - This is a backup/alternative way to find parents
        
        // For path consistency, files need their own path and parent paths need to be set properly
        let filePath = null;
        let parentPath = null;
        
        if (parentFolderId) {
          // Look up the parent folder in our set of files, or in pathMap
          const parentFolder = batch.find(f => f.id === parentFolderId);
          if (parentFolder) {
            // If we have the parent's full path, use it as parent_path
            const parentFullPath = pathMap.get(parentFolderId);
            if (parentFullPath) {
              // CRITICAL: Parent's path becomes the child's parent_path
              parentPath = parentFullPath;
              
              // CRITICAL: Child's path is parent path + child name
              filePath = `${parentFullPath}/${file.name}`;
              
              console.log(`SUCCESS - Found complete path info for ${file.name}: path=${filePath}, parent_path=${parentPath}`);
            } else {
              // If we know the parent name but not full path, construct a basic one
              parentPath = `/${parentFolder.name}`;
              filePath = `${parentPath}/${file.name}`;
              console.log(`PARTIAL - Using parent name for ${file.name}: path=${filePath}, parent_path=${parentPath}`);
            }
          } else {
            // We can't use await here since we're not in an async function
            // Just use a simple fallback approach for now
            console.log(`Need parent folder info for ID: ${parentFolderId} - child: ${file.name}`);
            
            // Generic fallback with just the ID - this ensures paths work
            parentPath = `/folders/${parentFolderId}`;
            filePath = `${parentPath}/${file.name}`;
            console.log(`SIMPLIFIED PATH - Using generic path for ${file.name}: path=${filePath}, parent_path=${parentPath}`);
          }
        } else if (isRoot) {
          // Root folders get a special path format
          filePath = `/${file.name}`;
          parentPath = null; // Root folders have no parent
          console.log(`ROOT FOLDER - Setting path for root: ${filePath}`);
        } else {
          // Files with no parent and not roots - these shouldn't normally exist
          filePath = `/${file.name}`;
          parentPath = null;
          console.log(`WARNING - File with no parent and not root: ${file.name}`);
        }
        
        // Strict validation to ensure we have a path
        if (!filePath) {
          console.error(`ERROR - Failed to set path for ${file.name} - using name as fallback`);
          filePath = `/${file.name}`;
        }
        
        console.log(`FINAL PATHS for "${file.name}": path=${filePath}, parent_path=${parentPath}, parent_folder_id=${parentFolderId}`);
        
        // Build a simplified record with basic metadata to avoid errors with missing fields
        const record: any = {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink || null,
          modified_time: file.modifiedTime || localDate,
          created_at: localDate,
          updated_at: localDate,
          parent_folder_id: parentFolderId,
          parent_path: parentPath,
          path: filePath, // FIXED: Properly distinct path from parent_path
          is_root: isRoot, // Mark as root based on our earlier identification
          deleted: false,
          sync_status: 'synced', // Mark as synced since we're directly inserting
          metadata: JSON.stringify(file) // Store whatever metadata we have as JSON
        };
        
        // Convert size to number if available
        if (file.size) {
          record.size = parseInt(file.size);
        }
        
        // If the file has a description, add it
        if (file.description) {
          record.description = file.description;
        }
        
        // Track which files are new vs. updates
        if (existingFileIds.has(file.id)) {
          updatedFiles.push(file.id);
        } else {
          newFiles.push(file.id);
        }
        
        return record;
      });
      
      console.log(`INSERTING FILES: Prepared ${records.length} records for database (${newFiles.length - (newFiles.length - records.filter(r => !existingFileIds.has(r.drive_id)).length)} new, ${updatedFiles.length - (updatedFiles.length - records.filter(r => existingFileIds.has(r.drive_id)).length)} updates)`);

      // Split into new records and updates
      const newRecords = records.filter(record => !existingFileIds.has(record.drive_id));
      const updateRecords = records.filter(record => existingFileIds.has(record.drive_id));
      
      // Log a sample record structure (with sensitive fields omitted)
      if (newRecords.length > 0) {
        const sampleRecord = { ...newRecords[0] };
        delete sampleRecord.metadata; // Too verbose
        console.log('INSERTING FILES: Sample record structure:', JSON.stringify(sampleRecord));
      }
      
      // Insert new records
      if (newRecords.length > 0) {
        console.log(`INSERTING FILES: Inserting ${newRecords.length} new files into sources_google table`);
        try {
          const { data: insertedData, error: insertError } = await supabaseAdmin
            .from('sources_google')
            .insert(newRecords)
            .select();
            
          if (insertError) {
            console.error('ERROR: Error inserting new files:', insertError);
            
            // If the error is related to RLS policies, try to diagnose
            if (insertError.message.includes('policy')) {
              console.error('ERROR: This appears to be an RLS policy error. Check that you are using the service role key correctly.');
            }
            
            errorCount += newRecords.length;
            // Track which files had errors
            newRecords.forEach(record => {
              errorFiles.push(record.drive_id);
              errorDetails.push({
                id: record.drive_id,
                message: insertError.message
              });
            });
          } else {
            if (!insertedData || insertedData.length === 0) {
              console.warn('WARNING: Insert succeeded but no data was returned. This may indicate a partial success.');
              console.log('INSERTING FILES: Verifying insertions by querying...');
              
              // Verify the insertions were successful by querying for the records
              const newDriveIds = newRecords.map(record => record.drive_id);
              const { data: verificationData, error: verificationError } = await supabaseAdmin
                .from('sources_google')
                .select('id, drive_id, name')
                .in('drive_id', newDriveIds);
                
              if (verificationError) {
                console.error('ERROR: Failed to verify insertions:', verificationError);
              } else {
                console.log(`INSERTING FILES: Verification found ${verificationData?.length || 0} of ${newDriveIds.length} expected records`);
                
                // Use verification data to count successes
                if (verificationData) {
                  const verifiedIds = new Set(verificationData.map(f => f.drive_id));
                  let verifiedSuccess = 0;
                  let verifiedMissing = 0;
                  
                  for (const driveId of newDriveIds) {
                    if (verifiedIds.has(driveId)) {
                      verifiedSuccess++;
                    } else {
                      verifiedMissing++;
                      errorFiles.push(driveId);
                      errorDetails.push({
                        id: driveId,
                        message: 'Insert appeared to succeed but record was not found on verification'
                      });
                    }
                  }
                  
                  console.log(`INSERTING FILES: Verification results: ${verifiedSuccess} confirmed, ${verifiedMissing} missing`);
                  successCount += verifiedSuccess;
                  errorCount += verifiedMissing;
                }
              }
            } else {
              console.log(`INSERTING FILES: Successfully inserted ${insertedData?.length || 0} new files`);
              successCount += insertedData?.length || 0;
              
              // Log the first few inserted IDs for verification
              if (insertedData && insertedData.length > 0) {
                console.log(`INSERTING FILES: First few inserted IDs: ${insertedData.slice(0, 3).map(d => d.id).join(', ')}`);
              }
            }
          }
        } catch (insertException) {
          console.error('ERROR: Exception during insert operation:', insertException);
          errorCount += newRecords.length;
          // Track which files had exceptions
          newRecords.forEach(record => {
            errorFiles.push(record.drive_id);
            errorDetails.push({
              id: record.drive_id,
              message: insertException.message || 'Unknown error during insert'
            });
          });
        }
      }
      
      // Update existing records
      if (updateRecords.length > 0) {
        console.log(`INSERTING FILES: Updating ${updateRecords.length} existing files`);
        
        // We need to update one by one since Supabase doesn't support bulk upsert
        for (const record of updateRecords) {
          try {
            console.log(`INSERTING FILES: Updating file ${record.drive_id} (${record.name})`);
            
            const { data: updateData, error: updateError } = await supabaseAdmin
              .from('sources_google')
              .update({
                name: record.name,
                mime_type: record.mime_type,
                web_view_link: record.web_view_link,
                modified_time: record.modified_time,
                updated_at: record.updated_at,
                parent_folder_id: record.parent_folder_id,
                parent_path: record.parent_path,
                path: record.path, // Also update path field
                sync_status: 'synced',
                metadata: record.metadata,
                size: record.size
              })
              .eq('drive_id', record.drive_id)
              .select();
              
            if (updateError) {
              console.error(`ERROR: Error updating file ${record.drive_id}:`, updateError);
              errorCount++;
              errorFiles.push(record.drive_id);
              errorDetails.push({
                id: record.drive_id,
                message: updateError.message
              });
            } else {
              successCount++;
              console.log(`INSERTING FILES: Successfully updated ${record.drive_id}`);
            }
          } catch (updateErr) {
            console.error(`ERROR: Exception updating file ${record.drive_id}:`, updateErr);
            errorCount++;
            errorFiles.push(record.drive_id);
            errorDetails.push({
              id: record.drive_id,
              message: updateErr.message || 'Unknown error during update'
            });
          }
        }
      }
      
      // Add a small delay between batches to reduce database load
      if (i + batchSize < files.length) {
        console.log('INSERTING FILES: Pausing briefly between batches...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`INSERTING FILES: Completed insertion: ${successCount} successful, ${errorCount} errors`);
    
    // If we have error details, log them
    if (errorDetails.length > 0) {
      console.error('ERROR DETAILS:');
      errorDetails.forEach(err => {
        console.error(`File ${err.id}: ${err.message}`);
      });
    }
    
    // Return the results with detailed information
    return {
      success: successCount,
      errors: errorCount,
      details: {
        newFiles,
        updatedFiles,
        errorFiles
      }
    };
  } catch (error) {
    console.error('ERROR: Exception in insertGoogleFiles:', error);
    return {
      success: successCount,
      errors: errorCount + (files.length - successCount - errorCount),
      details: {
        newFiles,
        updatedFiles,
        errorFiles
      }
    };
  }
}
/**
 * Helper function to get database table structure
 */
export async function getTableStructure(tableName: string) {
  try {
    // Use existing Supabase client instead of creating a new one
    const supabaseAdmin = supabase;
    
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

/**
 * Recursively search files and folders in a specific Google Drive folder
 * Robust version with detailed logging to help debug search issues
 */
/**
 * Helper function to build proper file paths
 * This constructs hierarchical paths compatible with the FileTree component
 */
/**
 * Improved version of buildProperFilePaths that generates both path and parent_path correctly
 * This is key to ensuring file tree compatibility for both old and new files
 */
async function buildProperFilePaths(
  files: DriveFile[], 
  supabaseAdmin: any
): Promise<Map<string, string>> {
  console.log("IMPROVED: Building comprehensive file paths with both path and parent_path...");
  
  // Create a map of drive_id to path
  const pathMap = new Map<string, string>();
  
  // First, create a map of files by ID for quick lookup
  const filesById = new Map<string, DriveFile>();
  files.forEach(file => filesById.set(file.id, file));
  
  // Also create a map to track folder names
  const folderNames = new Map<string, string>();
  files.forEach(file => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      folderNames.set(file.id, file.name);
    }
  });
  
  // Check if we need to fetch additional folder names AND paths from the database
  const allParentIds = new Set<string>();
  files.forEach(file => {
    if (file.parents && file.parents.length > 0) {
      file.parents.forEach(parentId => {
        if (!folderNames.has(parentId)) {
          allParentIds.add(parentId);
        }
      });
    }
  });
  
  // Fetch existing paths and folder info from database
  const existingPaths = new Map<string, string>();
  
  // Fetch any missing folder names AND paths from the database
  if (allParentIds.size > 0) {
    console.log(`Fetching ${allParentIds.size} missing folder data from database...`);
    try {
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .select('drive_id, name, path')
        .in('drive_id', Array.from(allParentIds))
        .eq('mime_type', 'application/vnd.google-apps.folder');
        
      if (error) {
        console.error('Error fetching folder data:', error);
      } else if (data) {
        data.forEach(folder => {
          if (folder.drive_id && folder.name) {
            folderNames.set(folder.drive_id, folder.name);
            
            // Also store the existing path if available
            if (folder.path) {
              existingPaths.set(folder.drive_id, folder.path);
              pathMap.set(folder.drive_id, folder.path); // Add to our path map
            }
          }
        });
        console.log(`Found ${data.length} folder names in database (${existingPaths.size} with paths)`);
      }
    } catch (err) {
      console.error('Exception fetching folder data:', err);
    }
  }
  
  // First pass: build paths for root folders
  for (const file of files) {
    // Root folders (they have no parents)
    if (!file.parents || file.parents.length === 0) {
      // Root folders get a simple path with just their name
      pathMap.set(file.id, `/${file.name}`);
      console.log(`Root folder path: ${file.name} -> ${pathMap.get(file.id)}`);
    }
  }
  
  // Do multiple passes to allow child paths to build on their parents
  // This addresses folders at any level of nesting
  const MAX_PASSES = 5; // Limit passes to handle deep hierarchies without infinite loops
  
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let pathsAdded = 0;
    
    // Process each file
    for (const file of files) {
      // Skip if we've already built a path for this file
      if (pathMap.has(file.id)) continue;
      
      // Skip files with no parents (should have been handled as roots)
      if (!file.parents || file.parents.length === 0) continue;
      
      // Get parent ID
      const parentId = file.parents[0];
      
      // If this is a folder, make sure it's in our folder names map
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folderNames.set(file.id, file.name);
      }
      
      // Try to find the parent path - either from our map or existing paths
      let parentPath = pathMap.get(parentId) || existingPaths.get(parentId);
      
      // If we have a parent path, we can build this file's path
      if (parentPath) {
        // Build this file's path
        let filePath = `${parentPath}/${file.name}`;
        
        // Store the path
        pathMap.set(file.id, filePath);
        pathsAdded++;
        
        // Debug
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          console.log(`Folder path: ${file.name} -> ${filePath} (parent: ${parentPath})`);
        }
      }
    }
    
    console.log(`Pass ${pass+1}: Added ${pathsAdded} paths`);
    
    // If we didn't add any paths in this pass, no need to continue
    if (pathsAdded === 0) break;
  }
  
  // Final pass: handle any remaining files without paths using a fallback approach
  for (const file of files) {
    if (!pathMap.has(file.id) && file.parents && file.parents.length > 0) {
      const parentId = file.parents[0];
      const parentName = folderNames.get(parentId) || '';
      
      // Create the fallback path without leading slash or "unknown-folder"
      const fallbackPath = parentName ? `${parentName}/${file.name}` : `${file.name}`;
      
      pathMap.set(file.id, fallbackPath);
      console.log(`Fallback path for ${file.name}: ${fallbackPath}`);
    }
  }
  
  console.log(`IMPROVED: Built ${pathMap.size} file paths of ${files.length} total files`);
  return pathMap;
}

/**
 * Fix paths for files in the database
 * This is a special function to help repair/rebuild the path hierarchy
 * It's especially useful for fixing files that don't appear in the file tree
 */
export async function fixPathsInDatabase(rootFolderId?: string): Promise<{
  fixed: number;
  errors: number;
  details: string[];
}> {
  try {
    console.log('Starting path fixing operation...');
    
    // Use existing Supabase client
    console.log('Using existing Supabase client for path fixing...');
    
    // Reuse the existing supabase client which already has proper auth
    const supabaseAdmin = supabase;
    
    // Get all records that need to be fixed
    let query = supabaseAdmin
      .from('sources_google')
      .select('id, drive_id, name, mime_type, parent_folder_id, is_root');
    
    // If root folder ID is provided, limit to that subtree
    if (rootFolderId) {
      // First get the root folder
      const { data: rootFolder } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type, path')
        .eq('drive_id', rootFolderId)
        .single();
        
      if (!rootFolder) {
        return {
          fixed: 0,
          errors: 1,
          details: [`Root folder with ID ${rootFolderId} not found`]
        };
      }
      
      // Set this as the starting point
      console.log(`Starting path fixing from root folder: ${rootFolder.name}`);
    }
    
    // Get all files in the database
    const { data: allFiles, error } = await query;
    
    if (error) {
      console.error('Error fetching files:', error);
      return {
        fixed: 0,
        errors: 1,
        details: [`Error fetching files: ${error.message}`]
      };
    }
    
    if (!allFiles || allFiles.length === 0) {
      return {
        fixed: 0,
        errors: 0,
        details: ['No files found to fix']
      };
    }
    
    console.log(`Found ${allFiles.length} files to process`);
    
    // First identify all folders
    const folders = allFiles.filter(f => f.mime_type === 'application/vnd.google-apps.folder');
    console.log(`Found ${folders.length} folders`);
    
    // Create lookup maps
    const filesByDriveId = new Map();
    allFiles.forEach(file => {
      if (file.drive_id) {
        filesByDriveId.set(file.drive_id, file);
      }
    });
    
    // Create path maps
    const pathMap = new Map();
    const pathUpdates = [];
    const errors = [];
    
    // First pass: Set root folder paths
    const rootFolders = allFiles.filter(f => 
      f.mime_type === 'application/vnd.google-apps.folder' && 
      f.is_root === true
    );
    
    console.log(`Found ${rootFolders.length} root folders`);
    
    for (const folder of rootFolders) {
      const path = `/${folder.name}`;
      pathMap.set(folder.drive_id, path);
      
      // Prepare update for this root folder
      pathUpdates.push({
        id: folder.id,
        drive_id: folder.drive_id,
        path: path,
        parent_path: null,
        is_root: true
      });
    }
    
    // Multiple passes to handle nested folders
    let pathsAdded = 1; // Start with a non-zero value to enter the loop
    let pass = 0;
    const MAX_PASSES = 10;
    
    while (pathsAdded > 0 && pass < MAX_PASSES) {
      pass++;
      pathsAdded = 0;
      
      console.log(`Path fixing pass ${pass}...`);
      
      for (const file of allFiles) {
        // Skip if we already have a path for this file
        if (pathMap.has(file.drive_id)) continue;
        
        // Skip files with no parent
        if (!file.parent_folder_id) continue;
        
        // Get parent path
        const parentPath = pathMap.get(file.parent_folder_id);
        if (!parentPath) continue; // Skip if parent path not yet known
        
        // Build this file's path
        const path = `${parentPath}/${file.name}`;
        pathMap.set(file.drive_id, path);
        pathsAdded++;
        
        // Prepare update
        pathUpdates.push({
          id: file.id,
          drive_id: file.drive_id,
          path: path,
          parent_path: parentPath,
          parent_folder_id: file.parent_folder_id
        });
      }
      
      console.log(`Pass ${pass}: Added ${pathsAdded} paths`);
      
      // If we didn't add any paths, we're done
      if (pathsAdded === 0) break;
    }
    
    // Now update all the paths in the database
    console.log(`Updating ${pathUpdates.length} files with new paths...`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    // Update in batches for better performance
    const BATCH_SIZE = 50;
    for (let i = 0; i < pathUpdates.length; i += BATCH_SIZE) {
      const batch = pathUpdates.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(pathUpdates.length/BATCH_SIZE)}`);
      
      for (const update of batch) {
        try {
          // Update this file
          const { error } = await supabaseAdmin
            .from('sources_google')
            .update({
              path: update.path,
              parent_path: update.parent_path,
              parent_folder_id: update.parent_folder_id,
              is_root: update.is_root || false
            })
            .eq('id', update.id);
            
          if (error) {
            console.error(`Error updating file ${update.id}:`, error);
            errors.push(`Error updating file ${update.id}: ${error.message}`);
            errorCount++;
          } else {
            fixedCount++;
          }
        } catch (err) {
          console.error(`Exception updating file ${update.id}:`, err);
          errors.push(`Exception updating file ${update.id}: ${err.message}`);
          errorCount++;
        }
      }
      
      // Add a small delay between batches
      if (i + BATCH_SIZE < pathUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Path fixing complete: ${fixedCount} files fixed, ${errorCount} errors`);
    
    return {
      fixed: fixedCount,
      errors: errorCount,
      details: errors
    };
  } catch (error) {
    console.error('Error in fixPathsInDatabase:', error);
    return {
      fixed: 0,
      errors: 1,
      details: [`Error in fixPathsInDatabase: ${error.message}`]
    };
  }
}

export async function searchSpecificFolder(folderId: string): Promise<{
  files: DriveFile[],
  totalCount: number, 
  hasExceededLimit: boolean
}> {
  try {
    console.log(`=======================================`);
    console.log(`STARTING RECURSIVE SEARCH FOR FOLDER: ${folderId}`);
    console.log(`=======================================`);
    
      console.log(`SEARCH: Will search ONLY the exact folder ID provided: ${folderId}`);
    
    // Get access token (either from localStorage or try using authenticatedFetch helper)
    let accessToken = localStorage.getItem('google_access_token');
    if (!accessToken) {
      console.log('No token in localStorage, will try using authenticatedFetch');
    } else {
      console.log('Using token from localStorage');
    }
    
    // Create holders for our results
    let allFiles: DriveFile[] = [];
    let hasExceededLimit = false;
    const MAX_FILES = 1000; // Reduced limit to prevent excessive searching
    const MAX_FOLDER_DEPTH = 3; // Limit how deep we go into folder hierarchies
    
    // 1. First, verify the folder exists by fetching its details directly
    console.log(`Step 1: Verifying folder ${folderId} exists...`);
    try {
      // Try two different approaches to get folder info
      // First with direct fetch (if we have token)
      if (accessToken) {
        try {
          const rootUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,modifiedTime,size,parents,webViewLink`;
          const rootResponse = await fetch(rootUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (rootResponse.ok) {
            const rootFolder = await rootResponse.json();
            
            // Skip if this is a shortcut
            if (rootFolder.mimeType === 'application/vnd.google-apps.shortcut') {
              console.warn(`⚠️ Warning: The root folder ID ${folderId} is a shortcut, not a real folder. Recursive search may not work as expected.`);
            }
            
            console.log(`✓ Found root folder: "${rootFolder.name}" (${rootFolder.id}) - Type: ${rootFolder.mimeType}`);
            
            // Normalize the parents field
            if (!rootFolder.parents) {
              rootFolder.parents = [];
            }
            
            // Add to our results only if not a shortcut
            if (rootFolder.mimeType !== 'application/vnd.google-apps.shortcut') {
              allFiles.push(rootFolder);
            }
          } else {
            console.warn(`× Failed to get folder via direct fetch: ${rootResponse.status} ${rootResponse.statusText}`);
            throw new Error('Direct fetch failed, will try authenticatedFetch');
          }
        } catch (directFetchError) {
          console.warn('Error with direct fetch, will try authenticatedFetch:', directFetchError.message);
          // Fall through to authenticatedFetch approach
        }
      }
      
      // If direct fetch failed or we had no token, try with authenticatedFetch
      if (allFiles.length === 0) {
        console.log('Trying authenticatedFetch to get folder details...');
        const rootUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,modifiedTime,size,parents,webViewLink`;
        const rootResponse = await authenticatedFetch(rootUrl);
        
        if (rootResponse.ok) {
          let folderData = await rootResponse.json();
          
          // Skip if this is a shortcut
          if (folderData.mimeType === 'application/vnd.google-apps.shortcut') {
            console.warn(`⚠️ Warning: The root folder ID ${folderId} is a shortcut, not a real folder.`);
            
            // For shortcut, try to resolve the target folder
            try {
              // If it's a shortcut, try to find the target
              const shortcutTargetUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=shortcutDetails`;
              const shortcutResponse = await authenticatedFetch(shortcutTargetUrl);
              
              if (shortcutResponse.ok) {
                const shortcutData = await shortcutResponse.json();
                if (shortcutData.shortcutDetails && shortcutData.shortcutDetails.targetId) {
                  console.log(`Shortcut resolves to target ID: ${shortcutData.shortcutDetails.targetId}`);
                  // Replace the folder ID with the target ID
                  folderId = shortcutData.shortcutDetails.targetId;
                  
                  // Get the target folder info
                  const targetUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,modifiedTime,size,parents,webViewLink`;
                  const targetResponse = await authenticatedFetch(targetUrl);
                  
                  if (targetResponse.ok) {
                    folderData = await targetResponse.json();
                    console.log(`✓ Using shortcut target: "${folderData.name}" (${folderData.id}) - Type: ${folderData.mimeType}`);
                  }
                }
              }
            } catch (shortcutError) {
              console.error('Error resolving shortcut:', shortcutError);
            }
          } else {
            console.log(`✓ Found root folder with authenticatedFetch: "${folderData.name}" (${folderData.id}) - Type: ${folderData.mimeType}`);
          }
          
          // Normalize the parents field
          if (!folderData.parents) {
            folderData.parents = [];
          }
          
          // Add to our results if not already added and not a shortcut
          if (!allFiles.some(f => f.id === folderData.id) && folderData.mimeType !== 'application/vnd.google-apps.shortcut') {
            allFiles.push(folderData);
          }
        } else {
          const errorText = await rootResponse.text();
          console.error(`× Failed to find folder with both methods: ${rootResponse.status} ${errorText}`);
          throw new Error(`Folder ID ${folderId} not found or not accessible`);
        }
      }
    } catch (rootFolderError) {
      console.error('Error getting root folder:', rootFolderError);
      throw rootFolderError; // Re-throw to stop the process
    }
    
    // 2. Now do a recursive traversal starting from the root folder
    console.log(`Step 2: Starting recursive traversal from folder ${folderId}...`);
    
    // Create a queue of folders to process and a set to track processed folders
    // Each queue entry will be an object with the folder ID and its depth in the hierarchy
    const folderQueue: Array<{id: string, depth: number}> = [{id: folderId, depth: 0}];
    const processedFolders = new Set<string>();
    
    // Track the allowed folder hierarchy to prevent following shortcuts
    // This is the whitelist of folder IDs that are directly part of the hierarchy
    // starting with the root folder
    const allowedFolderIds = new Set<string>([folderId]);
    
    // Process all folders in the queue using a breadth-first approach
    while (folderQueue.length > 0 && allFiles.length < MAX_FILES) {
      const folderItem = folderQueue.shift()!;
      const currentFolderId = folderItem.id;
      const currentDepth = folderItem.depth;
      
      // Skip if we've already processed this folder
      if (processedFolders.has(currentFolderId)) {
        console.log(`Skipping already processed folder: ${currentFolderId}`);
        continue;
      }
      
      // Skip if we've exceeded our max depth
      if (currentDepth > MAX_FOLDER_DEPTH) {
        console.log(`⚠️ Skipping folder at depth ${currentDepth} (exceeds max depth of ${MAX_FOLDER_DEPTH}): ${currentFolderId}`);
        continue;
      }
      
      processedFolders.add(currentFolderId);
      console.log(`Processing folder contents: ${currentFolderId} (depth: ${currentDepth}/${MAX_FOLDER_DEPTH})`);
      
      // Process all pages of results for this folder
      let pageToken: string | null = null;
      let pageCount = 0;
      
      do {
        pageCount++;
        try {
          // Build the query to find all files and folders with this parent
          const query = `'${currentFolderId}' in parents and trashed=false`;
          let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,size,parents,webViewLink)&pageSize=100`;
          
          if (pageToken) {
            url += `&pageToken=${pageToken}`;
          }
          
          // Use authenticatedFetch which handles token refreshing
          console.log(`Fetching page ${pageCount} of folder ${currentFolderId}...`);
          const response = await authenticatedFetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`× Failed to list files in folder ${currentFolderId}: ${response.status} ${errorText}`);
            // Continue to next folder rather than failing completely
            break;
          }
          
          const data = await response.json();
          const files = data.files || [];
          pageToken = data.nextPageToken || null;
          
          console.log(`✓ Found ${files.length} items in folder ${currentFolderId} (page ${pageCount})${pageToken ? ' with more pages available' : ''}`);
          
          if (files.length === 0) {
            console.log(`Empty folder or no access to contents of ${currentFolderId}`);
            continue;
          }
          
          // Filter out shortcuts and normalize remaining files
          const normalizedFiles = files
            .filter(file => {
              // Skip shortcuts
              if (file.mimeType === 'application/vnd.google-apps.shortcut') {
                return false;
              }
              
              // Also skip any files that are not in the folder we're currently processing
              // This should already be handled by the query, but just to be sure
              if (file.parents && !file.parents.includes(currentFolderId)) {
                console.log(`Skipping file ${file.name} (${file.id}) - not in current folder`);
                return false;
              }
              
              return true;
            })
            .map(file => {
              if (!file.parents) {
                return { ...file, parents: [] };
              }
              return file;
            });
            
          // Log if any shortcuts were skipped
          const shortcutsCount = files.filter(file => file.mimeType === 'application/vnd.google-apps.shortcut').length;
          if (shortcutsCount > 0) {
            console.log(`Skipped ${shortcutsCount} shortcuts in folder ${currentFolderId}`);
          }
          
          // Check if we'll exceed our file limit
          if (allFiles.length + normalizedFiles.length > MAX_FILES) {
            console.log(`Will exceed limit of ${MAX_FILES} files, taking partial results`);
            const remainingSlots = MAX_FILES - allFiles.length;
            allFiles = allFiles.concat(normalizedFiles.slice(0, remainingSlots));
            hasExceededLimit = true;
            console.log(`Reached max file limit of ${MAX_FILES}. Stopping search.`);
            break;
          }
          
          // Add all files to our results
          allFiles = allFiles.concat(normalizedFiles);
          
          // Queue up subfolders for processing, but check carefully
          const foldersFound = normalizedFiles.filter(f => {
            // Only include actual folders, not shortcuts
            if (f.mimeType !== 'application/vnd.google-apps.folder') {
              return false;
            }
            
            // Skip any "Shared with me" folders and folders with "shortcut" in the name
            if (f.name.toLowerCase().includes('shortcut') || 
                f.name.toLowerCase().includes('shared with me')) {
              console.log(`🚫 Skipping potential shortcut folder: ${f.name} (${f.id})`);
              return false;
            }
            
            // Make sure it's a direct child of the current folder
            if (f.parents && !f.parents.includes(currentFolderId)) {
              console.log(`Skipping folder ${f.name} (${f.id}) - not a direct child of current folder`);
              return false;
            }
            
            // Add to our allowed folder whitelist
            allowedFolderIds.add(f.id);
            return true;
          });
          
          console.log(`Found ${foldersFound.length} valid subfolders in ${currentFolderId}`);
          
          for (const folder of foldersFound) {
            if (!processedFolders.has(folder.id)) {
              const nextDepth = currentDepth + 1;
              if (nextDepth <= MAX_FOLDER_DEPTH) {
                console.log(`Adding subfolder to queue: ${folder.name} (${folder.id}) at depth ${nextDepth}`);
                folderQueue.push({id: folder.id, depth: nextDepth});
              } else {
                console.log(`📂 Not adding subfolder (exceeds max depth): ${folder.name} (${folder.id})`);
              }
            } else {
              console.log(`Skipping already processed subfolder: ${folder.name} (${folder.id})`);
            }
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageCount} for folder ${currentFolderId}:`, pageError);
          // Continue with next folder rather than failing the whole operation
          break;
        }
      } while (pageToken && allFiles.length < MAX_FILES);
      
      // Break out if we've hit the limit
      if (hasExceededLimit) {
        console.log(`Hit file limit of ${MAX_FILES}, stopping traversal`);
        break;
      }
    }
    
    // 3. Final filtering - make sure we only include items that are truly part of this folder hierarchy
    console.log(`=======================================`);
    console.log(`PERFORMING FINAL FILTER TO ENSURE WE ONLY HAVE ITEMS FROM THE RIGHT FOLDER HIERARCHY`);
    
    // ⚠️ IMPORTANT - We will only use the explicitly allowed folder IDs that we verified
    // during traversal, not all folders that were found (which might include shortcuts)
    // This is more restrictive than building from allFiles
    console.log(`Number of verified folder IDs in allowed whitelist: ${allowedFolderIds.size}`);
    
    // Print the list of allowed folders for debugging
    console.log('Verified folder IDs:');
    allowedFolderIds.forEach(id => {
      const folder = allFiles.find(f => f.id === id);
      if (folder) {
        console.log(`- ${folder.name} (${folder.id})`);
      } else {
        console.log(`- Unknown folder (${id})`);
      }
    });
    
    // Only keep files that have a parent in our ALLOWED folder hierarchy
    const filteredFiles = allFiles.filter(file => {
      // Always keep the root folder
      if (file.id === folderId) {
        return true;
      }
      
      // If it's a folder, only keep it if it's in our allowed list
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const isAllowed = allowedFolderIds.has(file.id);
        if (!isAllowed) {
          console.log(`🧹 Filtering out folder that's not in allowed list: ${file.name} (${file.id})`);
        }
        return isAllowed;
      }
      
      // For all other files, check if they have a parent in our ALLOWED folder hierarchy
      const hasAllowedParent = file.parents && file.parents.some(parentId => allowedFolderIds.has(parentId));
      if (!hasAllowedParent) {
        console.log(`🧹 Filtering out file that's outside our hierarchy: ${file.name} (${file.id})`);
      }
      return hasAllowedParent;
    });
    
    // See if our filtering removed any files
    if (filteredFiles.length < allFiles.length) {
      console.log(`Filtered out ${allFiles.length - filteredFiles.length} files that weren't part of the hierarchy`);
      allFiles = filteredFiles;
    } else {
      console.log(`No files needed to be filtered out - all items are part of the correct hierarchy`);
    }
    
    // ADDITIONAL FILTERING - Hard exclude any items that have certain keywords
    // that indicate they might be shortcuts or outside our intended hierarchy
    const excludeKeywords = [
      'dynamic healing group', 
      'mp4s',
      'shared with me'
    ];
    
    const beforeCount = allFiles.length;
    allFiles = allFiles.filter(file => {
      const nameLower = file.name.toLowerCase();
      for (const keyword of excludeKeywords) {
        if (nameLower.includes(keyword.toLowerCase())) {
          console.log(`🚫 Excluding file with banned keyword "${keyword}": ${file.name} (${file.id})`);
          return false;
        }
      }
      return true;
    });
    
    if (allFiles.length < beforeCount) {
      console.log(`Excluded ${beforeCount - allFiles.length} files with banned keywords`);
    }
    
    // 4. Final reporting
    console.log(`=======================================`);
    console.log(`RECURSIVE SEARCH SUMMARY:`);
    console.log(`Total files & folders found: ${allFiles.length}`);
    
    const folders = allFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    console.log(`Folders: ${folders.length}`);
    
    const files = allFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    console.log(`Files: ${files.length}`);
    
    // Make sure the root folder is properly marked
    // Find the original requested folder in our results
    const rootFolderIndex = allFiles.findIndex(f => f.id === folderId);
    if (rootFolderIndex >= 0) {
      // Tag this folder with a special property so it's marked as root on insertion
      console.log(`Marking folder ${folderId} as root folder`);
      
      // We'll add a non-standard property to the DriveFile object
      // This will be used in insertGoogleFiles to identify the root folder
      // @ts-ignore - Adding custom property
      allFiles[rootFolderIndex]._isRootFolder = true;
    } else {
      console.log(`Root folder ${folderId} not found in results! This will cause issues with proper root marking.`);
    }
    
    // Display extra info about limits used for this search
    console.log(`Search settings: MAX_FILES=${MAX_FILES}, MAX_FOLDER_DEPTH=${MAX_FOLDER_DEPTH}`);
    console.log(`Reached file limit? ${hasExceededLimit ? 'Yes' : 'No'}`);
    
    // Display depth statistics
    console.log(`Folder hierarchy depth statistics:`);
    const folderDepths = new Map<string, number>();
    
    // Start with root folder at depth 0
    folderDepths.set(folderId, 0);
    
    // Calculate depths for all other folders
    let anyUpdated = true;
    // Iterate until no more depths are updated
    while (anyUpdated) {
      anyUpdated = false;
      for (const folder of folders) {
        if (folder.id === folderId) continue; // Skip root
        
        // If we already know this folder's depth, skip it
        if (folderDepths.has(folder.id)) continue;
        
        // If we know the parent's depth, we can calculate this folder's depth
        if (folder.parents && folder.parents.length > 0) {
          const parentId = folder.parents[0];
          if (folderDepths.has(parentId)) {
            folderDepths.set(folder.id, folderDepths.get(parentId)! + 1);
            anyUpdated = true;
          }
        }
      }
    }
    
    // Count folders at each depth
    const depthCounts = new Map<number, number>();
    folderDepths.forEach((depth) => {
      depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
    });
    
    // Display the counts
    console.log(`Folder depth distribution:`);
    Array.from(depthCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([depth, count]) => {
        console.log(`  Depth ${depth}: ${count} folders`);
      });
    
    // Count by file type
    const fileTypes: Record<string, number> = {};
    allFiles.forEach(file => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    console.log('File types:', fileTypes);
    
    // Verify no shortcuts in final results
    const shortcutCount = allFiles.filter(file => file.mimeType === 'application/vnd.google-apps.shortcut').length;
    if (shortcutCount > 0) {
      console.warn(`WARNING: ${shortcutCount} shortcuts were found in results - removing them now`);
      // Remove any shortcuts that might have slipped through
      allFiles = allFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.shortcut');
    } else {
      console.log('✓ No shortcuts in results (correctly filtered)');
    }
    
    // Check if root folder is in results
    const rootInResults = allFiles.some(f => f.id === folderId);
    console.log(`Root folder in results: ${rootInResults ? 'Yes' : 'No'}`);
    console.log(`=======================================`);
    
    return {
      files: allFiles,
      totalCount: allFiles.length,
      hasExceededLimit
    };
  } catch (error) {
    console.error('Error in searchSpecificFolder:', error);
    return {
      files: [],
      totalCount: 0,
      hasExceededLimit: false
    };
  }
} 