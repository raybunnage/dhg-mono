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
      console.log('DEV MODE: Using dummy data for listDriveFiles since token validation is skipped');
      // Return dummy data in dev mode when skipping validation
      return [
        {
          id: 'dummy-folder-1',
          name: 'Example Folder 1',
          mimeType: 'application/vnd.google-apps.folder',
          modifiedTime: new Date().toISOString()
        },
        {
          id: 'dummy-doc-1',
          name: 'Example Document 1.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          modifiedTime: new Date().toISOString(),
          size: '1024'
        },
        {
          id: 'dummy-doc-2',
          name: 'Example PDF.pdf',
          mimeType: 'application/pdf',
          modifiedTime: new Date().toISOString(),
          size: '2048'
        }
      ];
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
    
    // Sync history is disabled - recording only locally
    console.log('Starting sync operation with ID:', syncId);
    
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
      folderId,
      folderName
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
export const getDriveSyncStats = async (): Promise<SyncStats> => {
  try {
    // Check if we have a folder ID override in localStorage
    const folderIdOverride = localStorage.getItem('google_drive_folder_id_override');
    const folderNameOverride = localStorage.getItem('google_drive_folder_name');
    
    // Check if we're in development mode with validation skipped
    const skipValidation = import.meta.env.DEV && localStorage.getItem('skip_token_validation') === 'true';
    
    if (folderIdOverride) {
      console.log(`Using override folder ID: ${folderIdOverride} (${folderNameOverride || 'No name provided'})`);
    } else {
      console.log('No folder ID override found - using default folder ID');
    }
    
    // Add timestamp for tracking
    const timestamp = new Date().toISOString();
    
    // No longer using mock data, even in dev mode
    if (skipValidation) {
      console.log('DEV MODE: Token validation is skipped, but we still need valid data');
      
      // Even in dev mode with skip_token_validation, we need a proper token
      if (!localStorage.getItem('google_access_token')) {
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
    }
    
    // Validate we have a folder ID to use
    if (!folderIdOverride && !GOOGLE_DRIVE_FOLDER_ID) {
      console.error('No folder ID available - neither override nor default');
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
 */
export async function insertGoogleFiles(files: DriveFile[]): Promise<{success: number, errors: number, details: {newFiles: string[], updatedFiles: string[], errorFiles: string[]}}>  {
  let successCount = 0;
  let errorCount = 0;
  const newFiles: string[] = [];
  const updatedFiles: string[] = [];
  const errorFiles: string[] = [];
  const errorDetails: {id: string, message: string}[] = [];
  
  try {
    console.log(`INSERTING FILES: Starting to insert ${files.length} Google Drive files into the database`);
    
    // Check if we have valid environment variables for Supabase connection
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('ERROR: Missing Supabase URL or service role key in environment variables');
      throw new Error('Missing required environment variables for database connection');
    }
    
    console.log(`INSERTING FILES: Connecting to Supabase at ${supabaseUrl.substring(0, 20)}...`);
    
    // Create a supabase admin client with service role key to bypass RLS
    // Use a different storage key to avoid the warning about multiple clients
    const supabaseAdmin = createClient<Database>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          storageKey: 'dhg-supabase-admin-auth',
          persistSession: false  // Don't persist admin sessions
        }
      }
    );

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
      
      // Create records for insertion or update
      const records = batch.map(file => {
        // Extract parent folder from file.parents if available
        const parentFolderId = file.parents && file.parents.length > 0 
          ? file.parents[0] 
          : null;
          
        // Calculate file path based on parent folders
        let fullPath = null;
        if (parentFolderId) {
          // For simplicity, just use parent ID as path for now
          fullPath = `/folders/${parentFolderId}`;
        }
        
        // Build a simplified record with basic metadata to avoid errors with missing fields
        const record: any = {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          web_view_link: file.webViewLink || null,
          modified_time: file.modifiedTime || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          parent_folder_id: parentFolderId,
          parent_path: fullPath,
          is_root: parentFolderId === null, // Mark as root if no parent
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
    const supabaseAdmin = createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          storageKey: 'dhg-supabase-admin-auth',
          persistSession: false  // Don't persist admin sessions
        }
      }
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

/**
 * Recursively search files and folders in a specific Google Drive folder
 * Robust version with detailed logging to help debug search issues
 */
export async function searchSpecificFolder(folderId: string): Promise<{
  files: DriveFile[],
  totalCount: number, 
  hasExceededLimit: boolean
}> {
  try {
    console.log(`=======================================`);
    console.log(`STARTING RECURSIVE SEARCH FOR FOLDER: ${folderId}`);
    console.log(`=======================================`);
    
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
    const MAX_FILES = 5000; // Increased limit to allow finding all files and folders in the hierarchy
    
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
    const folderQueue: string[] = [folderId];
    const processedFolders = new Set<string>();
    
    // Track the allowed folder hierarchy to prevent following shortcuts
    // This is the whitelist of folder IDs that are directly part of the hierarchy
    // starting with the root folder
    const allowedFolderIds = new Set<string>([folderId]);
    
    // Process all folders in the queue using a breadth-first approach
    while (folderQueue.length > 0 && allFiles.length < MAX_FILES) {
      const currentFolderId = folderQueue.shift()!;
      
      // Skip if we've already processed this folder
      if (processedFolders.has(currentFolderId)) {
        console.log(`Skipping already processed folder: ${currentFolderId}`);
        continue;
      }
      
      processedFolders.add(currentFolderId);
      console.log(`Processing folder contents: ${currentFolderId}`);
      
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
              console.log(`Adding subfolder to queue: ${folder.name} (${folder.id})`);
              folderQueue.push(folder.id);
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