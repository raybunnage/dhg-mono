import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import GoogleDriveDebug from '@/components/GoogleDriveDebug';
import { BatchManager } from '@/components/BatchManager';
import { BatchProcessingMonitor } from '@/components/BatchProcessingMonitor';
import { getDriveSyncStats, syncWithGoogleDrive, listFilesInFolder, authenticatedFetch, insertGoogleFiles, searchSpecificFolder } from '@/services/googleDriveService';
import { isGoogleTokenValid, refreshGoogleToken } from '@/services/googleAuth';
import { createClient } from '@supabase/supabase-js';

// Define types for document statistics
interface DocumentTypeStats {
  document_type: string;
  count: number;
}

interface SyncStats {
  total: number;
  new: number;
  updated: number;
  deleted: number;
  errors: number;
  isValid?: boolean;
  error?: string;
  newFiles?: DriveFile[];
}

// We're no longer using sync history interface

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  _isPreview?: boolean; // Flag for files that are only for preview
}

interface FolderOption {
  id: string;
  name: string;
}

// Define SyncResult interface for updateSyncStats typing
interface SyncResult {
  totalItems?: number;
  stats?: {
    totalGoogleDriveFiles?: number;
  };
  synced?: {
    added?: number;
    updated?: number;
    processed?: number;
    errors?: number;
  };
  itemsAdded?: number;
  folderId?: string;
  folderName?: string;
}

// Main Sync component
function Sync() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'folders' | 'batches' | 'auth' | 'roots' | 'cleanup'>('dashboard');
  const [newFolderId, setNewFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [existingFolderId, setExistingFolderId] = useState('');
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNewFolderLoading, setIsNewFolderLoading] = useState(false);
  const [isExistingFolderLoading, setIsExistingFolderLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSummaryKey, setSyncSummaryKey] = useState(`sync-${Date.now()}`);
  const [documentStats, setDocumentStats] = useState<DocumentTypeStats[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [isTokenValid, setIsTokenValid] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [isInserting, setIsInserting] = useState(false);
  const [insertResult, setInsertResult] = useState<{success: number, errors: number} | null>(null);
  const [tokenExpiryKey, setTokenExpiryKey] = useState(`token-expiry-${Date.now()}`);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [fileStats, setFileStats] = useState<{
    totalFiles: number,
    docxFiles: number,
    textFiles: number,
    pdfFiles: number,
    mp4Files: number,
    m4aFiles: number,
  }>({
    totalFiles: 0,
    docxFiles: 0,
    textFiles: 0,
    pdfFiles: 0,
    mp4Files: 0,
    m4aFiles: 0,
  });
  
  // State for specific folder search
  const [isSearchingFolder, setIsSearchingFolder] = useState(false);
  const [specificFolderFiles, setSpecificFolderFiles] = useState<DriveFile[]>([]);
  const [specificFolderId, setSpecificFolderId] = useState(''); // No default ID, must be selected by user
  const [specificFolderStats, setSpecificFolderStats] = useState<{
    totalCount: number;
    folderCount: number;
    fileCount: number;
    fileTypes: Record<string, number>;
    hasExceededLimit: boolean;
  } | null>(null);

  // File processing refs
  const syncingRef = useRef<boolean>(false);
  const extractionRef = useRef<boolean>(false);

  // Check essential configuration on component mount
  useEffect(() => {
    // Check for service role key
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("CRITICAL ERROR: Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable");
      toast.error(
        <div>
          <p className="font-bold">Missing Service Role Key</p>
          <p className="text-sm mt-1">Database additions will not work without a service role key</p>
          <p className="text-xs mt-2">Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file</p>
        </div>,
        { duration: 10000, id: 'missing-service-role-key' }
      );
    }
    
    // Check if the sync_statistics table has the required structure
    const checkAndUpdateSyncStatisticsTable = async () => {
      try {
        // Try to fetch one record to check if table exists
        const { data, error } = await supabase
          .from('sync_statistics')
          .select('*')
          .limit(1)
          .maybeSingle();
        
        if (!error && data) {
          // Table exists and we got a record
          // No need to check columns or show any toast
        }
      } catch (e) {
        // Silent fail - don't block app loading
      }
    };
    
    // We'll check this after initial render
    setTimeout(checkAndUpdateSyncStatisticsTable, 1000);
  }, []);

  // Handle token expiration
  const handleTokenExpired = () => {
    setIsTokenValid(false);
    if (isLoading) {
      setIsLoading(false);
      toast.error('Google authentication expired during sync operation');
    }
  };

  // Fetch existing root folders
  const fetchRootFolders = async () => {
    try {
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return [];
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createSupabaseAdmin();
      
      // Supabase may store booleans differently in the database, try both true and 1
      const { data: data1, error: error1 } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type')
        .eq('is_root', true)
        .order('name');
        
      if (error1) {
        console.error('Error with is_root=true query:', error1);
      }
      
      // Try with is_root = 1 as well
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type')
        .eq('is_root', 1)
        .order('name');
        
      if (error2) {
        console.error('Error with is_root=1 query:', error2);
      }
      
      // Combine both result sets, removing duplicates by id
      const data = [...(data1 || []), ...(data2 || [])];
      const folders = new Map<string, FolderOption>();
      
      // Add folders from sources_google
      if (data) {
        data.forEach(folder => {
          const folderId = folder.drive_id || folder.id;
          folders.set(folderId, {
            id: folderId,
            name: folder.name
          });
        });
      }
      
      // Convert map to array
      const folderArray = Array.from(folders.values());
      
      // Sort by name
      folderArray.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('Root folders for combobox:', folderArray);
      setFolderOptions(folderArray);
      
      // Return the array for further processing
      return folderArray;
    } catch (err) {
      console.error('Error fetching root folders:', err);
      toast.error('Failed to load existing folders');
      return [];
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    // Fetch root folders and then set first folder as selected if none is set
    const loadFolders = async () => {
      const folders = await fetchRootFolders();
      
      // If we have folders but no selected folder, select the first one
      if (folders.length > 0 && !existingFolderId) {
        console.log('Auto-selecting first folder:', folders[0].id);
        setExistingFolderId(folders[0].id);
      }
    };
    
    loadFolders();
    fetchFileStats();
    
    // Check token validity on mount
    checkTokenValidity();
    
    // Set up an interval to check token validity every 5 minutes
    const interval = setInterval(() => {
      checkTokenValidity();
    }, 5 * 60 * 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);
  
  // Token timer effect
  useEffect(() => {
    // Check if there's a saved expiry timestamp
    const expiryTime = localStorage.getItem('google_token_expiry');
    
    if (expiryTime) {
      // Declare intervalId variable first
      let intervalId: number | null = null;
      
      // Function to update time remaining
      const updateTimeRemaining = () => {
        const expiry = parseInt(expiryTime, 10);
        const now = new Date().getTime();
        const diff = expiry - now;
        
        if (diff <= 0) {
          // Timer expired
          setTimeRemaining(0);
          localStorage.removeItem('google_token_expiry');
          // Clear interval if we're at 0
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        } else {
          // Convert milliseconds to minutes
          const minutesRemaining = Math.ceil(diff / (60 * 1000));
          setTimeRemaining(minutesRemaining);
        }
      };
      
      // Initial update
      updateTimeRemaining();
      
      // Set interval to update every minute
      intervalId = window.setInterval(updateTimeRemaining, 60 * 1000);
      
      // Clean up
      return () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
    } else {
      setTimeRemaining(null);
    }
  }, [tokenExpiryKey]); // Re-run when the key changes (reset timer)

  // Check token validity at intervals
  const checkTokenValidity = async () => {
    // Force the token to be read from env variables, not localStorage
    const valid = await isGoogleTokenValid(true);
    console.log('Token validity check:', valid ? 'valid' : 'invalid');
    setIsTokenValid(valid);
    return valid;
  };

  // Fetch summary stats for files
  const fetchFileStats = async () => {
    try {
      // Get total files
      const { count: totalCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      // Get docx files
      const { count: docxCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('mime_type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      // Get text files
      const { count: textCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('mime_type', 'text/plain');
      
      // Get PDF files
      const { count: pdfCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('mime_type', 'application/pdf');
      
      // Get MP4 files
      const { count: mp4Count } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .ilike('mime_type', '%mp4%');
      
      // Get M4A files
      const { count: m4aCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .ilike('mime_type', '%m4a%');
      
      setFileStats({
        totalFiles: totalCount || 0,
        docxFiles: docxCount || 0,
        textFiles: textCount || 0,
        pdfFiles: pdfCount || 0,
        mp4Files: mp4Count || 0,
        m4aFiles: m4aCount || 0,
      });
    } catch (error) {
      console.error('Error fetching file stats:', error);
    }
  };

  // Placeholder for fetch sync history (removed)
  const fetchSyncHistory = async () => {
    // Functionality removed
    return;
  };

  // Handle new folder sync
  const handleNewFolderSync = async () => {
    if (!isTokenValid) {
      toast.error('Google authentication token is invalid or expired');
      return;
    }

    if (!newFolderId) {
      toast.error('Please enter a Google folder ID');
      return;
    }
    
    setIsNewFolderLoading(true);
    setSyncProgress(0);
    
    try {
      const folderDisplayName = newFolderName || 'New Folder';
      
      toast.success(`Checking status of folder: ${folderDisplayName}`);
      
      // Get stats for the new folder by passing ID and name directly
      const stats = await getDriveSyncStats(newFolderId, folderDisplayName);
      setSyncStats(stats);
      
      if (!stats.isValid) {
        throw new Error(`Failed to check sync status: ${stats.error}`);
      }
      
      // Check if there are new files to sync
      if (stats.newFiles && Array.isArray(stats.newFiles) && stats.newFiles.length > 0) {
        toast.success(`Found ${stats.newFiles.length} new files to sync. Starting sync...`);
        
        // Perform the sync operation
        const result = await syncWithGoogleDrive(newFolderId, folderDisplayName);
        setSyncResult(result);
        
        // Store the result locally only
        await storeLocalSyncResult(result);
        
        // Show appropriate messages
        if (result.synced && result.synced.errors > 0) {
          toast.error(`Sync completed with ${result.synced.errors} errors`);
        } else if (result.synced) {
          toast.success(`Successfully added ${result.synced.added} new files from Google Drive`);
        } else {
          toast.success('Sync completed successfully');
        }
        
        // Update sync history and stats
        handleSyncComplete(result);
        
        // Update folder options to include the new folder
        fetchRootFolders();
      } else {
        toast.success('Folder is already in sync! No new files to add.');
      }
      
      // Fetch document stats for the new folder
      fetchDocumentStats(newFolderId);
      
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error(`Failed to start sync process: ${err.message}`);
    } finally {
      setIsNewFolderLoading(false);
    }
  };

  // Handle existing folder sync
  const handleExistingFolderSync = async () => {
    if (!isTokenValid) {
      toast.error('Google authentication token is invalid or expired');
      return;
    }

    if (!existingFolderId) {
      toast.error('Please select a folder to sync');
      return;
    }
    
    setIsExistingFolderLoading(true);
    setSyncProgress(0);
    
    try {
      // Just directly use the existing sync functionality
      // First check sync status to see if there are files to sync
      await handleSyncCheck();
      
      // If we have new files, check sync status again after a moment
      // to allow the state to update
      setTimeout(async () => {
        if (syncStats && syncStats.newFiles && Array.isArray(syncStats.newFiles) && syncStats.newFiles.length > 0) {
          // If we have new files, perform the sync
          await handleSync();
          
          // Update progress to show completion
          updateProgressToComplete();
          toast.success('Sync process completed successfully');
          
          // Fetch updated stats once sync is complete
          fetchDocumentStats(existingFolderId);
          
          // Force refresh the sync summary
          setSyncSummaryKey(`sync-${Date.now()}`);
          
          // After sync completes, set the active tab to dashboard to show the results
          setActiveTab('dashboard');
        } else {
          toast.success('Folder is already in sync! No new files to add.');
        }
        
        // Always set loading state to false when done
        setIsExistingFolderLoading(false);
      }, 1000);
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error('Failed to start sync process');
      setIsExistingFolderLoading(false);
    }
  };

  // Handle checking sync status
  const handleSyncCheck = async () => {
    if (!isTokenValid) {
      toast.error('Please authenticate with Google Drive first');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // If no folder is selected, show error
      if (!existingFolderId) {
        console.error('No folder selected for sync check');
        toast.error('Please select a folder to check sync status');
        setIsLoading(false);
        return;
      }
      
      // Get the selected folder name
      const folderName = folderOptions.find(f => f.id === existingFolderId)?.name || 'Selected Folder';
      
      // We no longer automatically enable skip_token_validation in development mode
      // A valid token is always required
      
      // Check if token is available and log it
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        console.error('No token in localStorage when trying to sync');
        toast.error('Token not found in localStorage. Try refreshing the token.');
        setIsLoading(false);
        return;
      }
      
      // Log a message about the check
      console.log(`Checking sync status for folder: ${folderName} (${existingFolderId})`);
      toast.loading(`Checking sync status for ${folderName}...`);
      
      // Get the sync stats - pass folder ID and name directly
      const stats = await getDriveSyncStats(existingFolderId, folderName);
      setSyncStats(stats);
      
      // Dismiss all toasts
      toast.dismiss();
      
      if (stats.isValid) {
        toast.success(`Successfully checked sync status for ${folderName}`);
        
        // If we have new files, show a more detailed message
        if (stats.newFiles && stats.newFiles.length > 0) {
          toast.success(`Found ${stats.newFiles.length} new files to sync!`);
        }
        
        // Force refresh the sync summary after checking sync status
        setSyncSummaryKey(`sync-${Date.now()}`);
      } else {
        toast.error(`Failed to check sync status: ${stats.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error checking sync:', error);
      toast.dismiss();
      toast.error(`Error checking sync: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle synchronizing with Google Drive
  const handleSync = async () => {
    if (!isTokenValid) {
      toast.error('Please authenticate with Google Drive first');
      return;
    }
    
    if (!syncStats) {
      toast.error('Please check sync status first');
      return;
    }
    
    // If no folder is selected, show error
    if (!existingFolderId) {
      console.error('No folder selected for sync');
      toast.error('Please select a folder to sync');
      return;
    }
    
    try {
      setIsSyncing(true);
      syncingRef.current = true;
      
      // Get the selected folder name
      const folderName = folderOptions.find(f => f.id === existingFolderId)?.name || 'Selected Folder';
      
      toast.loading(`Syncing ${folderName} with Google Drive...`);
      
      // We no longer automatically enable skip_token_validation in development mode
      // A valid token is always required
      
      const result = await syncWithGoogleDrive(existingFolderId, folderName);
      setSyncResult(result);
      
      // Store the result locally only
      await storeLocalSyncResult(result);
      
      // Dismiss all toasts
      toast.dismiss();
      
      if (result.synced && result.synced.errors > 0) {
        toast.error(`Sync completed with ${result.synced.errors} errors`);
      } else if (result.synced) {
        toast.success(`Successfully added ${result.synced.added} new files from Google Drive`);
      } else {
        toast.success('Sync completed successfully');
      }
      
      // Update internal state with result
      handleSyncComplete(result);
      
      // Refresh stats
      toast.loading('Refreshing stats...');
      
      const newStats = await getDriveSyncStats(existingFolderId, folderName);
      setSyncStats(newStats);
      
      fetchFileStats();
      
      // Force refresh the sync summary
      setSyncSummaryKey(`sync-${Date.now()}`);
      
      toast.dismiss();
    } catch (error) {
      console.error('Error syncing with Google Drive:', error);
      toast.dismiss();
      toast.error(`Sync failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  };

  // Handle sync complete
  const handleSyncComplete = async (result: any) => {
    // Update stats display
    setSyncStats({
      total: result.stats?.totalGoogleDriveFiles || 0,
      new: result.synced?.added || 0,
      updated: result.synced?.updated || 0,
      deleted: 0,
      errors: result.synced?.errors || 0
    });

    // Force refresh the UI with new sync summary key
    console.log('Sync complete, statistics updated');
    setSyncSummaryKey(`sync-${Date.now()}`);
  };
  
  // Helper function to safely handle execute_sql errors
  const handleExecuteSqlError = (error: any, fallbackMessage: string = "Error executing SQL"): boolean => {
    if (error.message.includes('Could not find the function') || 
        error.message.includes('not found') || 
        error.code === '42883') {
      console.error('The execute_sql function is not available:', error);
      toast.error(
        'The execute_sql function is not available in this database. Some database operations may fail.',
        { duration: 10000 }
      );
      return true; // Was an execute_sql specific error
    }
    console.error(fallbackMessage, error);
    return false; // Was not an execute_sql specific error
  };

  // Helper function to get folder name
  const getFolderName = async (folderId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select('name')
        .eq('drive_id', folderId)
        .single();
        
      if (error) throw error;
      return data?.name || 'Unknown Folder';
    } catch (err) {
      console.error('Error getting folder name:', err);
      return 'Unknown Folder';
    }
  };

  // Helper function to store local copy of sync result
  const storeLocalSyncResult = async (result: any) => {
    try {
      // Store in localStorage for easy access
      localStorage.setItem('latest_sync_result', JSON.stringify(result));
      return true;
    } catch (error) {
      console.error('Error storing sync result in localStorage:', error);
      return false;
    }
  };

  // Update progress
  const updateProgressToComplete = () => {
    // Simply set progress to 100% when sync is complete
    setSyncProgress(100);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  // Fetch document stats for a folder
  const fetchDocumentStats = async (folderId: string) => {
    try {
      // Get actual stats from the database instead of mock data
      const { data, error } = await supabase
        .from('sources_google')
        .select('mime_type')
        .eq('parent_folder_id', folderId);
      
      if (error) {
        console.error('Error fetching document stats:', error);
        return;
      }
      
      // Count document types based on mime types
      const typeCounts: Record<string, number> = {};
      data.forEach(item => {
        const mimeType = item.mime_type || 'unknown';
        // Create a more user-friendly document type from mime type
        let docType = 'Other';
        
        if (mimeType.includes('pdf')) docType = 'PDF';
        else if (mimeType.includes('word') || mimeType.includes('docx')) docType = 'Document';
        else if (mimeType.includes('text')) docType = 'Text';
        else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx')) docType = 'Spreadsheet';
        else if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('pptx')) docType = 'Presentation';
        else if (mimeType.includes('audio') || mimeType.includes('m4a')) docType = 'Audio';
        else if (mimeType.includes('video') || mimeType.includes('mp4')) docType = 'Video';
        else if (mimeType.includes('image')) docType = 'Image';
        
        typeCounts[docType] = (typeCounts[docType] || 0) + 1;
      });
      
      // Convert to array format needed for state
      const statsArray = Object.entries(typeCounts).map(([document_type, count]) => ({
        document_type,
        count
      }));
      
      setDocumentStats(statsArray);
    } catch (err) {
      console.error('Error fetching document stats:', err);
    }
  };

  // Handle file selection
  const handleFileSelection = (file: DriveFile, isSelected: boolean) => {
    if (isSelected) {
      setSelectedFiles(prev => [...prev, file]);
    } else {
      setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
    }
  };

  // Handle inserting selected files
  const handleInsertSelected = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to insert');
      return;
    }
    
    try {
      setIsInserting(true);
      const result = await insertGoogleFiles(selectedFiles);
      setInsertResult(result);
      
      // Clear selection after successful insert
      setSelectedFiles([]);
      
      // Refresh sync stats to reflect the changes
      handleSyncCheck();
      
      toast.success(`Successfully inserted ${result.success} files into the database`);
    } catch (error) {
      console.error('Error inserting files:', error);
      toast.error(`Error inserting files: ${error.message}`);
    } finally {
      setIsInserting(false);
    }
  };
  
  // Handle inserting files from preview
  const handleInsertFiles = async (files: DriveFile[]) => {
    if (files.length === 0) {
      toast.error('No files to insert');
      return;
    }
    
    try {
      setIsInserting(true);
      const toastId = toast.loading(`Inserting ${files.length} files into database...`);
      
      console.log(`Preparing to insert ${files.length} files from preview`);
      
      // Verify Supabase URL and service role key are set
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.dismiss(toastId);
        toast.error('Missing Supabase credentials. Please check your environment variables.');
        console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY environment variables');
        return;
      }
      
      // Insert the files
      const result = await insertGoogleFiles(files);
      
      toast.dismiss(toastId);
      
      // Check if any files were actually inserted
      if (result.success === 0) {
        // No successful insertions, show a more detailed error
        toast.error(
          <div>
            <p>Failed to insert files into database!</p>
            <p className="text-sm mt-1">Check console for details (F12)</p>
            <p className="text-xs mt-1 text-gray-300">
              Common issues: missing service role key or permissions
            </p>
          </div>,
          { duration: 6000 }
        );
        
        console.error('Insertion failed - no records were inserted successfully. Check your Supabase service role key and permissions.');
        
        // Keep the _isPreview flag so the user can try again
        return;
      }
      
      // Clear the _isPreview flag on all files
      const updatedFiles = specificFolderFiles.map(file => ({
        ...file,
        _isPreview: false
      }));
      setSpecificFolderFiles(updatedFiles);
      
      // Update file stats
      fetchFileStats();
      
      // Show successful toast
      toast.success(
        <div>
          <p>Successfully inserted {result.success} files</p>
          <p className="text-sm mt-1">
            {result.details.newFiles.length} new, {result.details.updatedFiles.length} updated
          </p>
        </div>,
        { duration: 5000 }
      );
      
      // Show error toast if there were any errors
      if (result.errors > 0) {
        toast.error(
          <div>
            <p>There were {result.errors} errors during insertion</p>
            <p className="text-sm mt-1">Check console for details (F12)</p>
          </div>,
          { duration: 5000 }
        );
        
        console.error('Error details for failed insertions:', result.details.errorFiles);
      }
    } catch (error) {
      console.error('Error inserting files:', error);
      toast.error(
        <div>
          <p>Error inserting files: {error.message}</p>
          <p className="text-sm mt-1">Check console for details (F12)</p>
        </div>,
        { duration: 6000 }
      );
    } finally {
      setIsInserting(false);
    }
  };

  // These functions have been deprecated with removal of sync history
  
  // Handle preview of folder contents without inserting
  const handlePreviewFolder = async (folderId: string): Promise<boolean> => {
    if (!folderId || folderId.trim() === '') {
      toast.error('Please enter a valid Google Drive folder ID');
      return false;
    }
    
    if (!isTokenValid) {
      toast.error('Please authenticate with Google Drive first');
      return false;
    }
    
    try {
      setIsSearchingFolder(true);
      const toastId = toast.loading(`Analyzing folder contents for ID: ${folderId}...`);
      
      console.log(`PREVIEW: Explicitly searching folder ${folderId}`);
      
      // Call the search function - it uses authenticatedFetch internally which handles token validation and refresh
      const result = await searchSpecificFolder(folderId);
      
      if (result.files.length === 0) {
        toast.error('No files found in the specified folder');
        setIsSearchingFolder(false);
        toast.dismiss(toastId);
        return false;
      }
      
      // Mark all files as preview mode
      const previewFiles = result.files.map(file => ({
        ...file,
        _isPreview: true // Add marker to indicate this is preview mode
      }));
      
      // Store the marked files
      setSpecificFolderFiles(previewFiles);
      
      // Calculate stats
      const folderCount = result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      ).length;
      
      const fileCount = result.files.length - folderCount;
      
      // Count file types
      const fileTypes: Record<string, number> = {};
      result.files.forEach(file => {
        const type = file.mimeType || 'unknown';
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });
      
      // Set stats
      setSpecificFolderStats({
        totalCount: result.totalCount,
        folderCount,
        fileCount,
        fileTypes,
        hasExceededLimit: result.hasExceededLimit
      });
      
      toast.dismiss(toastId);
      toast.success(`Analysis complete: Found ${result.totalCount} files and folders`);
      
      // Set active tab to dashboard to show results
      setActiveTab('dashboard');
      
      // Scroll to the folder analysis section
      setTimeout(() => {
        const folderAnalysisSection = document.getElementById('folder-analysis-section');
        if (folderAnalysisSection) {
          folderAnalysisSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      // DEBUG OUTPUT: Log details about files found
      console.log('==== FOLDER PREVIEW DETAILS ====');
      console.log(`Total count: ${result.files.length}`);
      console.log('First 10 files:'); 
      result.files.slice(0, 10).forEach(file => {
        console.log(`- ${file.name} (${file.id}) - Type: ${file.mimeType}`);
      });
      
      // Count file types and folders
      const fileTypeCounter: Record<string, number> = {};
      result.files.forEach(file => {
        const type = file.mimeType || 'unknown';
        fileTypeCounter[type] = (fileTypeCounter[type] || 0) + 1;
      });
      
      // Safely count folders at each level
      const foldersByParent: Record<string, number> = {};
      result.files.forEach(file => {
        if (file.parents && Array.isArray(file.parents) && file.parents.length > 0) {
          const parentId = file.parents[0];
          foldersByParent[parentId] = (foldersByParent[parentId] || 0) + 1;
        }
      });
      
      console.log('File types found:', fileTypeCounter);
      console.log('Files by parent folder:', foldersByParent);
      
      // Find the root folder
      const rootFolder = result.files.find(f => f.id === folderId);
      const foldersFound = result.files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
      const filesFound = result.files.length - foldersFound;
      
      // Add a more detailed toast with stats
      toast.success(
        `Folder contents: ${result.files.length} items\n` +
        `- ${foldersFound} folders\n` + 
        `- ${filesFound} files\n` +
        `Root folder: ${rootFolder?.name || 'Unknown'}`
      );
      
      console.log('=========================')
      return true; // Success
    } catch (error) {
      console.error('Error previewing folder:', error);
      toast.dismiss();
      toast.error(`Error: ${error.message}`);
      return false; // Failed
    } finally {
      setIsSearchingFolder(false);
    }
  };

  // Handle search for specific folder (using user-provided ID)
  const handleSpecificFolderSearch = async () => {
    // Use the folder ID from state
    if (!specificFolderId || specificFolderId.trim() === '') {
      toast.error('Please enter a valid Google Drive folder ID');
      return;
    }
    
    if (!isTokenValid) {
      toast.error('Please authenticate with Google Drive first');
      return;
    }
    
    try {
      setIsSearchingFolder(true);
      const toastId = toast.loading('Searching for files in the specific folder...');
      
      // Call the search function - it uses authenticatedFetch internally which handles token validation and refresh
      const result = await searchSpecificFolder(specificFolderId);
      
      if (result.files.length === 0) {
        toast.error('No files found in the specified folder');
        setIsSearchingFolder(false);
        toast.dismiss(toastId);
        return;
      }
      
      // Store the files
      setSpecificFolderFiles(result.files);
      
      // Calculate stats
      const folderCount = result.files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      ).length;
      
      const fileCount = result.files.length - folderCount;
      
      // Count file types
      const fileTypes: Record<string, number> = {};
      result.files.forEach(file => {
        const type = file.mimeType || 'unknown';
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      });
      
      // Set stats
      setSpecificFolderStats({
        totalCount: result.totalCount,
        folderCount,
        fileCount,
        fileTypes,
        hasExceededLimit: result.hasExceededLimit
      });
      
      toast.dismiss(toastId);
      toast.success(`Found ${result.totalCount} files and folders`);
      
      // We've fixed the recursive search, now we can insert the files
      toast.success('Files found! Inserting into database...');
      
      try {
        // Now insert the files into the database
        const insertResult = await insertGoogleFiles(result.files);
        toast.success(`Successfully inserted ${insertResult.success} files (${insertResult.details.newFiles.length} new, ${insertResult.details.updatedFiles.length} updated)`);
        
        if (insertResult.errors > 0) {
          toast.error(`There were ${insertResult.errors} errors during insertion.`);
        }
        
        // Refresh file stats
        fetchFileStats();
      } catch (insertError) {
        console.error('Error inserting files:', insertError);
        toast.error(`Error inserting files: ${insertError.message}`);
      }
      
      // DEBUG OUTPUT: Log details about files found and update UI with debug info
      console.log('==== DETAILED FILE LIST ====');
      console.log(`Total count: ${result.files.length}`);
      console.log('First 10 files:'); 
      result.files.slice(0, 10).forEach(file => {
        console.log(`- ${file.name} (${file.id}) - Type: ${file.mimeType}`);
      });
      
      // Count file types and folders
      const fileTypeCounter: Record<string, number> = {};
      result.files.forEach(file => {
        const type = file.mimeType || 'unknown';
        fileTypeCounter[type] = (fileTypeCounter[type] || 0) + 1;
      });
      
      // Safely count folders at each level
      const foldersByParent: Record<string, number> = {};
      result.files.forEach(file => {
        if (file.parents && Array.isArray(file.parents) && file.parents.length > 0) {
          const parentId = file.parents[0];
          foldersByParent[parentId] = (foldersByParent[parentId] || 0) + 1;
        }
      });
      
      console.log('File types found:', fileTypeCounter);
      console.log('Files by parent folder:', foldersByParent);
      
      // Update UI with detailed debug info
      const rootFolder = result.files.find(f => f.id === specificFolderId);
      const foldersFound = result.files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length;
      const filesFound = result.files.length - foldersFound;
      
      // Add a more detailed toast with stats
      toast.success(
        `Found ${result.files.length} items:\n` +
        `- ${foldersFound} folders\n` + 
        `- ${filesFound} files\n` +
        `Root folder: ${rootFolder?.name || 'Unknown'}`
      );
      
      console.log('=========================')
    } catch (error) {
      console.error('Error searching specific folder:', error);
      toast.dismiss();
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSearchingFolder(false);
    }
  };

  // Debug function to check sync_statistics table structure
  const checkSyncStatisticsStructure = async (): Promise<boolean> => {
    try {
      console.log('===== CHECKING SYNC_STATISTICS TABLE STRUCTURE =====');
      
      // First check if the table exists
      try {
        // Try direct SQL query to check if table exists
        const { data: testData, error: testError } = await supabase
          .from('sync_statistics')
          .select('id')
          .limit(1);
            
        if (testError) {
          // If error is about relation not existing, the table doesn't exist
          if (testError.code === '42P01' || testError.message?.includes('relation "sync_statistics" does not exist')) {
            console.log('sync_statistics table does not exist');
            return false;
          } else {
            console.error('Error checking if table exists:', testError);
          }
        } else {
          console.log('sync_statistics table exists (select test successful)');
          return true;
        }
      } catch (checkErr) {
        console.error('Error checking if table exists:', checkErr);
        // Continue to other checks
      }
      
      // We'll skip trying to get table structure with RPC since it's not available
      // Continue to next check using direct queries
      
      // Check most recent entry as final verification
      try {
        const { data: recentData, error: recentError } = await supabase
          .from('sync_statistics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (recentError) {
          // If error is about relation not existing, the table doesn't exist
          if (recentError.code === '42P01' || recentError.message?.includes('relation "sync_statistics" does not exist')) {
            console.log('sync_statistics table does not exist (confirmed by select)');
            return false;
          }
          
          console.error('Error checking recent records:', recentError);
          // Continue but don't confirm table exists
        } else {
          console.log('Most recent sync_statistics record:', recentData);
          return true; // Table exists since we could query it
        }
      } catch (err) {
        console.error('Error fetching recent sync_statistics:', err);
      }
      
      // If we get here without a definitive answer, default to assuming the table exists
      // to allow the insert operation to try
      console.log('Unable to definitively determine if sync_statistics table exists, assuming it does');
      return true;
      
    } catch (e) {
      console.error('Error in checkSyncStatisticsStructure:', e);
      // Don't let this error block the sync process
      return false; // Safer to assume table doesn't exist on error
    }
  };

  // Simplified function since we're not using sync history
  const updateSyncStats = async (
    folderId: string, 
    folderName: string, 
    result: SyncResult
  ): Promise<boolean> => {
    console.log('Sync completed for folder:', folderName);
    console.log('Sync results:', result);
    
    // Return success without updating any sync history
    return true;
  };

  // Render dashboard view
  const renderDashboard = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Sync Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">Total Files</div>
            <div className="text-2xl font-bold">{fileStats.totalFiles}</div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">Document Files</div>
            <div className="text-2xl font-bold">{fileStats.docxFiles + fileStats.textFiles + fileStats.pdfFiles}</div>
            <div className="text-xs text-gray-500 mt-1">
              DOCX: {fileStats.docxFiles} | TXT: {fileStats.textFiles} | PDF: {fileStats.pdfFiles}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-amber-500">
            <div className="text-sm text-gray-500 mb-1">Media Files</div>
            <div className="text-2xl font-bold">{fileStats.mp4Files + fileStats.m4aFiles}</div>
            <div className="text-xs text-gray-500 mt-1">
              MP4: {fileStats.mp4Files} | M4A: {fileStats.m4aFiles}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="text-sm text-gray-500 mb-1">Folders</div>
            <div className="text-2xl font-bold">{folderOptions.length}</div>
            <button 
              onClick={() => setActiveTab('folders')}
              className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded"
            >
              Manage Folders
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Authentication Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Google Authentication</h2>
          
          <div className="flex items-center flex-wrap px-3 py-2 rounded-full bg-gray-100 mb-4">
            <span className="font-medium text-xs text-gray-800 mr-2">Google Auth:</span>
            
            {isTokenValid ? (
              <>
                <span className="flex h-2 w-2 relative mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-700 mr-4">Valid</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
                <span className="text-xs text-red-700 mr-4">Invalid</span>
              </>
            )}
            
            <button
              onClick={async () => {
                // Clear localStorage first to ensure we're using the token from .env
                localStorage.removeItem('google_access_token');
                toast.success('Cleared localStorage, testing token from .env directly...');
                
                // Use the updated function with forceFromEnv = true
                const valid = await isGoogleTokenValid(true);
                
                if (valid) {
                  toast.success('Google token from .env is valid!');
                } else {
                  toast.error('Google token in .env file is invalid.');
                }
              }}
              className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              Test Token from .env
            </button>
            
            <button
              onClick={() => {
                // Get current timer value or set a new one
                const now = new Date().getTime();
                const expiry = localStorage.getItem('google_token_expiry');
                
                if (expiry) {
                  // If timer exists, just refresh UI
                  toast.success('Token timer active');
                } else {
                  // Set a new 60-minute timer
                  const expiryTime = now + (60 * 60 * 1000); // 60 minutes
                  localStorage.setItem('google_token_expiry', expiryTime.toString());
                  toast.success('60-minute token timer started');
                }
                
                // Force refresh of the timer display
                setTokenExpiryKey(`token-expiry-${Date.now()}`);
              }}
              className="ml-2 text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
            >
              Timer
            </button>
            
            {/* Token Timer Display */}
            {timeRemaining !== null && (
              <div className={`ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium 
                ${timeRemaining > 10 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : timeRemaining > 5 
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeRemaining === 0 ? 'Token expired' : `${timeRemaining}m`}
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-wrap space-x-2">
            {syncStats && syncStats.newFiles && Array.isArray(syncStats.newFiles) && syncStats.newFiles.length > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`px-4 py-2 mb-2 rounded ${
                  isSyncing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isSyncing ? 'Syncing...' : `Sync ${syncStats.newFiles.length} New Files`}
              </button>
            )}
          </div>
          
          {/* Current sync folder indicator */}
          {existingFolderId && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap items-center text-sm">
                <span className="font-medium mr-2">Current Sync Folder:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {folderOptions.find(f => f.id === existingFolderId)?.name || 'Unknown Folder'}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Sync Summary Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Sync Statistics</h2>
          <p className="text-sm text-gray-500">Sync history tracking has been temporarily disabled.</p>
        </div>
      </div>
      
      {/* Recent Sync History - disabled */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Recent Sync Operations</h3>
        </div>
        
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-500 mb-4">Sync history tracking has been temporarily disabled.</p>
          <p className="text-sm text-gray-400">History will be re-enabled once sync functionality is properly working.</p>
        </div>
      </div>
      
      {/* Specific Folder Search */}
      <div id="folder-analysis-section" className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Folder Content Analysis</h2>
        </div>
        
        <div className="mb-2 text-sm">
          <p>
            Enter a Google Drive folder ID to analyze or search contents
          </p>
          <p className="text-gray-500 text-xs mt-1">
            <strong>Preview:</strong> Count files and folders without adding to database<br/>
            <strong>Search:</strong> Find and insert files into the database (up to 5000 items)
          </p>
        </div>
        
        {/* Search Results */}
        {specificFolderStats && (
          <div className="mt-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
              <h3 className="text-lg font-medium text-blue-800 mb-2">
                Analysis Results
                {specificFolderFiles.some(f => f.id === specificFolderId) && (
                  <span className="ml-2 text-sm bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Preview Mode - Not Added to Database
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-sm text-gray-500">Total Items</div>
                  <div className="text-xl font-bold">{specificFolderStats.totalCount}</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-sm text-gray-500">Folders</div>
                  <div className="text-xl font-bold">{specificFolderStats.folderCount}</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-sm text-gray-500">Files</div>
                  <div className="text-xl font-bold">{specificFolderStats.fileCount}</div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="text-md font-medium">
                    {specificFolderStats.hasExceededLimit ? (
                      <span className="text-yellow-600">Limited (100+ items)</span>
                    ) : (
                      <span className="text-green-600">Complete</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* File types */}
              <div className="bg-white rounded-lg p-3 mt-2">
                <h4 className="text-sm font-medium mb-2">File types found:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(specificFolderStats.fileTypes).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="truncate" title={type}>{type.replace('application/', '')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="mt-4 mb-4">
              <div>
                <span className="text-gray-700 font-medium">Folder ID: </span>
                <code className="bg-gray-100 px-2 py-1 rounded">{specificFolderId}</code>
                
                {/* Conditionally display the file status */}
                {specificFolderFiles.some(f => f.id === specificFolderId) && (
                  <div className="flex items-center">
                    <span className={`ml-4 ${
                      specificFolderFiles[0]._isPreview 
                        ? 'text-amber-600'
                        : 'text-green-600'
                    } font-medium`}>
                      {specificFolderFiles[0]._isPreview 
                        ? '📊 Preview Analysis Only - Not Added to Database'
                        : '✓ Files automatically added to database'}
                    </span>
                    
                    {/* Add button to actually insert the files if this was just a preview */}
                    {specificFolderFiles[0]._isPreview && (
                      <button
                        onClick={() => {
                          const originalFiles = specificFolderFiles.map(({_isPreview, ...file}) => file);
                          handleInsertFiles(originalFiles);
                        }}
                        disabled={isInserting}
                        className="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 flex items-center"
                      >
                        {isInserting ? 'Inserting...' : (
                          <>
                            <span className="mr-1">Add Files to Database</span>
                            <span>→</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* File list with more detailed debugging info */}
            <div className="overflow-x-auto">
              <div className="bg-blue-50 p-4 mb-4 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">Recursive Search Debug Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <h4 className="font-medium text-gray-800 mb-2">Root Folder</h4>
                    {specificFolderFiles.find(f => f.id === specificFolderId) ? (
                      <div>
                        <p><span className="font-medium">Name:</span> {specificFolderFiles.find(f => f.id === specificFolderId)?.name}</p>
                        <p><span className="font-medium">ID:</span> {specificFolderId}</p>
                        <p><span className="font-medium">Type:</span> {specificFolderFiles.find(f => f.id === specificFolderId)?.mimeType}</p>
                      </div>
                    ) : (
                      <p className="text-red-500">Root folder not found in results!</p>
                    )}
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <h4 className="font-medium text-gray-800 mb-2">File Type Distribution</h4>
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left font-medium text-gray-500 pb-2">MIME Type</th>
                            <th className="text-right font-medium text-gray-500 pb-2">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {specificFolderStats && Object.entries(specificFolderStats.fileTypes || {})
                            .sort((a, b) => b[1] - a[1]) // Sort by count descending
                            .map(([type, count]) => (
                              <tr key={type} className="border-t border-gray-100">
                                <td className="py-1 pr-4 break-all">{type}</td>
                                <td className="py-1 text-right font-medium">{count}</td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 bg-white p-3 rounded-lg shadow-sm">
                  <h4 className="font-medium text-gray-800 mb-2">Folder Structure</h4>
                  <p className="mb-2">Total folders: {specificFolderFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length}</p>
                  <div className="pl-4 border-l-2 border-blue-200">
                    {specificFolderFiles
                      .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
                      .slice(0, 10) // Show only first 10 folders
                      .map((folder) => {
                        // Safely count files in this folder
                        const containsCount = specificFolderFiles.filter(f => 
                          f.parents && Array.isArray(f.parents) && f.parents.includes(folder.id)
                        ).length;
                        
                        return (
                          <div key={folder.id} className="mb-2">
                            <p className="font-medium">{folder.name}</p>
                            <p className="text-xs text-gray-500">{folder.id}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              Contains: {containsCount} items
                            </p>
                          </div>
                        );
                      })}
                    {specificFolderFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length > 10 && (
                      <p className="text-sm text-gray-500 italic">
                        ...and {specificFolderFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length - 10} more folders
                      </p>
                    )}
                  </div>
                </div>
              </div>
            
              <h3 className="text-lg font-medium mb-2">Files and Folders Found ({specificFolderFiles.length})</h3>
              
              {/* Hierarchical Tree View */}
              <div className="bg-white p-5 rounded-lg shadow-sm mb-6 overflow-x-auto">
                <h4 className="font-medium text-gray-800 mb-3">Hierarchical View</h4>
                
                {/* Root folder first */}
                {specificFolderFiles.find(f => f.id === specificFolderId) && (
                  <div className="mb-3">
                    <div className="font-medium flex items-start text-base">
                      <span className="mr-2 text-lg">📂</span> 
                      <span>{specificFolderFiles.find(f => f.id === specificFolderId)?.name}</span>
                    </div>
                    
                    {/* Direct children of root */}
                    <div className="ml-8 mt-2 border-l-2 border-gray-200">
                      {/* First show subfolders */}
                      {specificFolderFiles
                        .filter(f => f.mimeType === 'application/vnd.google-apps.folder' && 
                                 f.id !== specificFolderId && 
                                 f.parents && 
                                 f.parents.includes(specificFolderId))
                        .map(folder => (
                          <div key={folder.id} className="mb-4 pl-4 -ml-px border-l border-transparent hover:border-blue-300">
                            <div className="font-medium flex items-center">
                              <span className="mr-2">📂</span> {folder.name}
                              <span className="ml-2 text-xs text-gray-500">({
                                specificFolderFiles.filter(f => f.parents && f.parents.includes(folder.id)).length
                              } items)</span>
                            </div>
                            
                            {/* Files in this subfolder */}
                            <div className="ml-6 mt-1">
                              {specificFolderFiles
                                .filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && 
                                         f.parents && 
                                         f.parents.includes(folder.id))
                                .slice(0, 5) // Limit to first 5 files per folder
                                .map(file => (
                                  <div key={file.id} className="text-sm py-1 flex items-center text-gray-700">
                                    <span className="mr-2">📄</span> {file.name}
                                  </div>
                                ))}
                              
                              {/* Show count if there are more files */}
                              {specificFolderFiles.filter(f => 
                                f.mimeType !== 'application/vnd.google-apps.folder' && 
                                f.parents && 
                                f.parents.includes(folder.id)
                              ).length > 5 && (
                                <div className="text-xs text-gray-500 mt-1 italic">
                                  ...and {specificFolderFiles.filter(f => 
                                    f.mimeType !== 'application/vnd.google-apps.folder' && 
                                    f.parents && 
                                    f.parents.includes(folder.id)
                                  ).length - 5} more files
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      
                      {/* Then show root-level files */}
                      <div className="mt-2">
                        {specificFolderFiles
                          .filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && 
                                   f.parents && 
                                   f.parents.includes(specificFolderId))
                          .slice(0, 10) // Limit to first 10 files
                          .map(file => (
                            <div key={file.id} className="py-1 pl-4 -ml-px flex items-center text-gray-700 border-l border-transparent hover:border-blue-300">
                              <span className="mr-2">📄</span> {file.name}
                            </div>
                          ))}
                        
                        {/* Show count if there are more files */}
                        {specificFolderFiles.filter(f => 
                          f.mimeType !== 'application/vnd.google-apps.folder' && 
                          f.parents && 
                          f.parents.includes(specificFolderId)
                        ).length > 10 && (
                          <div className="text-sm text-gray-500 mt-1 pl-4 italic">
                            ...and {specificFolderFiles.filter(f => 
                              f.mimeType !== 'application/vnd.google-apps.folder' && 
                              f.parents && 
                              f.parents.includes(specificFolderId)
                            ).length - 10} more files
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Flat Table View (Original) */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-800 mb-3">Complete File List</h4>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {specificFolderFiles.map((file) => (
                      <tr key={file.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {file.mimeType === 'application/vnd.google-apps.folder' ? (
                            <span className="flex items-center">
                              <span className="mr-2">📂</span> {file.name}
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <span className="mr-2">📄</span> {file.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 break-all" style={{maxWidth: '300px'}}>
                          {file.mimeType}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {file.id.substring(0, 10)}...
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {file.parents && Array.isArray(file.parents) && file.parents.length > 0 ? (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {file.parents[0].substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-xs">No parent</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Batch Processing</h2>
        <BatchManager />
      </div>
    </div>
  );

  // Render folders view
  const renderFolders = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Add New Folder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sync New Google Drive Folder</h2>
        <p className="text-gray-600 mb-4">
          Add a new Google Drive folder to track and sync with the database.
        </p>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="new-folder-id">
            Google Drive Folder ID
          </label>
          <input
            id="new-folder-id"
            type="text"
            value={newFolderId}
            onChange={(e) => setNewFolderId(e.target.value)}
            placeholder="Enter Google Drive folder ID"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            The ID can be found in the URL: https://drive.google.com/drive/folders/FOLDER_ID_HERE
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="new-folder-name">
            Folder Name (Optional)
          </label>
          <input
            id="new-folder-name"
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter a descriptive name for this folder"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            If not provided, we'll use the folder name from Google Drive
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log("Preview using folder ID:", newFolderId);
              
              setSpecificFolderId(newFolderId);
              handlePreviewFolder(newFolderId);
            }}
            disabled={isSearchingFolder || !newFolderId || !isTokenValid}
            className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
              isSearchingFolder || !newFolderId || !isTokenValid
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {isSearchingFolder ? 'Analyzing...' : 'Preview Contents'}
          </button>
          
          <button
            onClick={async () => {
              try {
                setIsInserting(true);
                
                // Check if folder ID is provided
                if (!newFolderId) {
                  toast.error('Please enter a Google Drive folder ID first');
                  setIsInserting(false);
                  return;
                }
                
                // Instead of creating a mock file, perform an actual folder check to see if it's valid
                toast.loading(`Checking folder ID: ${newFolderId}...`);
                
                // Use Google Drive API to check if folder exists
                const result = await handlePreviewFolder(newFolderId);
                
                toast.dismiss();
                if (result) {
                  toast.success(`Folder verified successfully! Ready for sync.`);
                  // Set this as the current folder for sync
                  setExistingFolderId(newFolderId);
                  setActiveTab('folders');
                  
                  // Update the folder options if needed
                  fetchRootFolders();
                }
                
              } catch (error) {
                console.error("Error checking folder:", error);
                toast.error(`Folder check failed: ${error.message}`);
              } finally {
                setIsInserting(false);
              }
            }}
            disabled={isInserting || !isTokenValid}
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              isInserting || !isTokenValid
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-500 hover:bg-purple-600'
            }`}
          >
            {isInserting ? 'Checking...' : 'Verify Folder'}
          </button>
        </div>
      </div>
      
      {/* Update Existing Folder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sync Existing Folder</h2>
        <p className="text-gray-600 mb-4">
          Select a folder to view its statistics and sync new files.
        </p>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="existing-folder">
            Select Folder
          </label>
          <select
            id="existing-folder"
            value={existingFolderId}
            onChange={(e) => setExistingFolderId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isExistingFolderLoading}
          >
            <option value="">Select a folder</option>
            {folderOptions.map(folder => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleExistingFolderSync}
            disabled={isExistingFolderLoading || !existingFolderId || !isTokenValid}
            className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
              isExistingFolderLoading || !existingFolderId || !isTokenValid
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isExistingFolderLoading ? 'Syncing...' : 'Sync Selected Folder'}
          </button>
          
          <button
            onClick={() => {
              setSpecificFolderId(existingFolderId);
              handlePreviewFolder(existingFolderId);
            }}
            disabled={isSearchingFolder || !existingFolderId || !isTokenValid}
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              isSearchingFolder || !existingFolderId || !isTokenValid
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {isSearchingFolder ? 'Analyzing...' : 'View Folder Structure'}
          </button>
        </div>
        
        {existingFolderId && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Current folder selection:</p>
            <div className="flex items-center bg-blue-50 p-2 rounded-lg">
              <div className="flex-1">
                <p className="font-medium">{folderOptions.find(f => f.id === existingFolderId)?.name}</p>
                <p className="text-xs text-gray-500 font-mono">{existingFolderId}</p>
              </div>
              <button
                onClick={() => {
                  // Go to dashboard and trigger a refresh of the sync summary
                  setSyncSummaryKey(`sync-${Date.now()}`);
                  setActiveTab('dashboard');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View Stats
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Progress indicator */}
      {(isNewFolderLoading || isExistingFolderLoading) && (
        <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">
            {isNewFolderLoading ? 'New Folder Sync Progress' : 'Existing Folder Sync Progress'}
          </h3>
          <div className="w-full h-6 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
          <p className="text-right mt-1 text-sm text-gray-600">{syncProgress}% Complete</p>
        </div>
      )}
      
      {/* Sync results */}
      {syncStats && (
        <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Sync Results</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold">{syncStats.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-sm text-green-600">New Files</p>
              <p className="text-2xl font-bold text-green-600">{syncStats.new}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-sm text-blue-600">Updated</p>
              <p className="text-2xl font-bold text-blue-600">{syncStats.updated}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <p className="text-sm text-yellow-600">Deleted</p>
              <p className="text-2xl font-bold text-yellow-600">{syncStats.deleted}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-sm text-red-600">Errors</p>
              <p className="text-2xl font-bold text-red-600">{syncStats.errors}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* List of folders */}
      <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Managed Folders</h3>
          <button
            onClick={fetchRootFolders}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
        
        {folderOptions.length === 0 ? (
          <p className="text-gray-500">No folders have been synced yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {folderOptions.map((folder) => {
                  const isCurrentFolder = folder.id === existingFolderId;
                  
                  return (
                    <tr key={folder.id} className={isCurrentFolder ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {folder.name}
                        {isCurrentFolder && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {folder.id.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isCurrentFolder ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Selected
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isCurrentFolder ? (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => {
                                setSyncSummaryKey(`sync-${Date.now()}`);
                                setActiveTab('dashboard');
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View Dashboard
                            </button>
                            <button 
                              onClick={() => handleExistingFolderSync()}
                              className="text-green-600 hover:text-green-900"
                              disabled={isExistingFolderLoading}
                            >
                              Re-sync
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              setExistingFolderId(folder.id);
                              toast.success(`Selected "${folder.name}" for sync`);
                              
                              // Automatically refresh the sync summary with the new folder selected
                              setSyncSummaryKey(`sync-${Date.now()}`);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Select for Sync
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Render batches view
  const renderBatches = () => (
    <div>
      <BatchProcessingMonitor />
    </div>
  );

  // Render history view
  const renderHistory = () => (
    <div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Sync History</h3>
        </div>
        
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-500 mb-4">Sync history tracking has been temporarily disabled.</p>
          <p className="text-sm text-gray-400">History will be re-enabled once sync functionality is properly working.</p>
        </div>
      </div>
    </div>
  );

  // Render authentication tab
  const renderAuth = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Google Authentication Status</h2>
      
      <div className="p-4 border rounded-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Token Status</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isTokenValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isTokenValid ? 'Valid' : 'Invalid'}
          </span>
        </div>
        
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isTokenValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium text-sm">{isTokenValid ? 'Token is valid' : 'Token is invalid'}</span>
          </div>
          
          <button 
            onClick={async () => {
              const valid = await checkTokenValidity();
              if (valid) {
                toast.success('Google token is valid!');
              } else {
                toast.error('Google token is invalid. Check your .env file.');
              }
            }}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Test Token
          </button>
        </div>
        
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p>A valid Google token is required to perform sync operations with Google Drive.</p>
          <p>The token typically expires after 1 hour. To update your token:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Get a new access token from Google</li>
            <li>Update the VITE_GOOGLE_ACCESS_TOKEN in your .env.development file</li>
            <li>Click "Test Token" to validate it</li>
          </ol>
        </div>
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-md font-medium mb-2 text-blue-800">Token Information</h3>
        <div className="text-sm">
          {isTokenValid ? (
            <>
              <p>Token is currently valid and ready for API operations.</p>
              <p className="mt-2">Last verified: {new Date().toLocaleTimeString()}</p>
              {localStorage.getItem('google_access_token') && (
                <p className="mt-2 font-mono bg-white p-2 rounded border border-gray-200 text-xs overflow-x-auto">
                  {localStorage.getItem('google_access_token')?.substring(0, 20)}...
                </p>
              )}
            </>
          ) : (
            <p className="text-red-600">No valid token available. Please update your .env.development file with a valid token.</p>
          )}
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={async () => {
              localStorage.removeItem('google_access_token');
              const valid = await checkTokenValidity();
              if (valid) {
                toast.success('Token validated from .env file!');
              } else {
                toast.error('Token in .env file is invalid.');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Load Token from .env
          </button>
        </div>
      </div>
      
      {/* Database Configuration Status */}
      <div className="mt-6 p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">Database Configuration Status</h3>
        
        <div className="space-y-4">
          {/* Service Role Key */}
          <div className="p-3 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-medium text-sm">Supabase Service Role Key</span>
              </div>
              
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'}
              </span>
            </div>
            
            {!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                <p className="font-medium">Missing VITE_SUPABASE_SERVICE_ROLE_KEY!</p>
                <p className="mt-1">
                  The service role key is required for database operations like adding files.
                  Without this key, insertions will fail despite appearing to work in the UI.
                </p>
                <p className="mt-2 font-bold">
                  Add this key to your .env file to enable database operations.
                </p>
              </div>
            )}
          </div>
          
          {/* Supabase URL */}
          <div className="p-3 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  import.meta.env.VITE_SUPABASE_URL ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-medium text-sm">Supabase URL</span>
              </div>
              
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                import.meta.env.VITE_SUPABASE_URL 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {import.meta.env.VITE_SUPABASE_URL ? 'Present' : 'Missing'}
              </span>
            </div>
          </div>
          
          {/* Connection Test */}
          <div className="mt-3">
            <button
              onClick={async () => {
                const toastId = toast.loading('Testing database connection...');
                try {
                  // Check if we have the necessary environment variables
                  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
                    toast.dismiss(toastId);
                    toast.error('Missing environment variables. Check your .env file.');
                    return;
                  }
                  
                  // Create a supabase admin client
                  const supabaseAdmin = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
                    {
                      auth: {
                        storageKey: 'dhg-supabase-admin-auth-test',
                        persistSession: false
                      }
                    }
                  );
                  
                  // Test the connection
                  const { data, error } = await supabaseAdmin
                    .from('sources_google')
                    .select('id')
                    .limit(1);
                  
                  toast.dismiss(toastId);
                  
                  if (error) {
                    console.error('Database connection test failed:', error);
                    toast.error(`Connection test failed: ${error.message}`);
                  } else {
                    console.log('Database connection test successful:', data);
                    toast.success('Successfully connected to database!');
                  }
                } catch (err) {
                  toast.dismiss(toastId);
                  console.error('Error testing database connection:', err);
                  toast.error(`Connection error: ${err.message}`);
                }
              }}
              className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Test Database Connection
            </button>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <h4 className="font-medium text-yellow-800">Troubleshooting Database Issues</h4>
          <ul className="mt-2 list-disc pl-5 text-yellow-700 space-y-1">
            <li>Make sure your .env file has the VITE_SUPABASE_SERVICE_ROLE_KEY</li>
            <li>The service role key should start with "eyJh..." and be very long</li>
            <li>If insertions show success but no records appear, it's almost certainly a service role key issue</li>
            <li>Check console logs (F12) for detailed error messages during operations</li>
            <li>Try the "Test Database Connection" button to verify your credentials</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // State for Roots tab
  const [rootRecords, setRootRecords] = useState<any[]>([]);
  const [rootIdToSet, setRootIdToSet] = useState('');
  const [isRootUpdateLoading, setIsRootUpdateLoading] = useState(false);
  const [rootUpdateStatus, setRootUpdateStatus] = useState<{success?: boolean, message: string} | null>(null);
  const [rootsTabSelected, setRootsTabSelected] = useState(false); // Track if Roots tab is selected
  const [nameToSearch, setNameToSearch] = useState(''); // State for name search
  const [isSearchingByName, setIsSearchingByName] = useState(false); // Loading state for name search
  const [nameSearchResults, setNameSearchResults] = useState<any[]>([]); // Results for name search
  const [selectedRoots, setSelectedRoots] = useState<string[]>([]); // Track checked roots by ID
  const [rootContents, setRootContents] = useState<Record<string, any[]>>({}); // Files and folders for each root
  const [isLoadingRootContents, setIsLoadingRootContents] = useState<Record<string, boolean>>({}); // Loading state for root contents
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]); // Track expanded folders by ID
  const [folderContents, setFolderContents] = useState<Record<string, any[]>>({}); // Files and folders for each expanded folder
  const [isLoadingFolderContents, setIsLoadingFolderContents] = useState<Record<string, boolean>>({}); // Loading state for folder contents
  
  // Fetch root records
  const fetchRootRecords = async () => {
    try {
      setIsLoading(true);
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // Supabase may store booleans differently in the database, try both true and 1
      const { data: data1, error: error1 } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type, parent_path, is_root, sync_status, modified_time, created_at')
        .eq('is_root', true);
        
      if (error1) {
        console.error('Error with is_root=true query:', error1);
      }
      
      // Try with is_root = 1 as well
      const { data: data2, error: error2 } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type, parent_path, is_root, sync_status, modified_time, created_at')
        .eq('is_root', 1);
        
      if (error2) {
        console.error('Error with is_root=1 query:', error2);
      }
      
      // Combine both result sets, removing duplicates by drive_id
      const data = [...(data1 || []), ...(data2 || [])];
      const seen = new Set();
      const uniqueData = data.filter(record => {
        if (seen.has(record.id)) return false;
        seen.add(record.id);
        return true;
      });
      
      // For each root folder, count associated files and folders
      const rootDataWithCounts = await Promise.all(
        uniqueData.map(async (root) => {
          try {
            // Count files linked to this root (where parent_folder_id equals root's drive_id)
            const { count: filesCount, error: filesError } = await supabaseAdmin
              .from('sources_google')
              .select('*', { count: 'exact', head: true })
              .eq('parent_folder_id', root.drive_id)
              .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
              
            if (filesError) {
              console.error(`Error counting files for root ${root.id}:`, filesError);
            }
            
            // Count folders linked to this root
            const { count: foldersCount, error: foldersError } = await supabaseAdmin
              .from('sources_google')
              .select('*', { count: 'exact', head: true })
              .eq('parent_folder_id', root.drive_id)
              .eq('mime_type', 'application/vnd.google-apps.folder');
              
            if (foldersError) {
              console.error(`Error counting folders for root ${root.id}:`, foldersError);
            }
            
            // Return the root with counts added
            return {
              ...root,
              filesCount: filesCount || 0,
              foldersCount: foldersCount || 0,
              totalItems: (filesCount || 0) + (foldersCount || 0)
            };
          } catch (err) {
            console.error(`Error enriching root ${root.id} with counts:`, err);
            return {
              ...root,
              filesCount: 0,
              foldersCount: 0,
              totalItems: 0,
              countError: err.message
            };
          }
        })
      );
      
      // Log the raw results for debugging
      console.log('is_root=true query results:', data1);
      console.log('is_root=1 query results:', data2);
      console.log('Combined results with item counts:', rootDataWithCounts);
      
      // If both queries failed, create an error
      const error = error1 && error2 ? { message: `${error1.message} AND ${error2.message}` } : null;
        
      if (error) {
        console.error('Error fetching root records:', error);
        toast.error(`Failed to fetch root records: ${error.message}`);
        return;
      }
      
      console.log('Setting root records to:', rootDataWithCounts);
      setRootRecords(rootDataWithCounts || []);
      toast.success(`Found ${rootDataWithCounts?.length || 0} root records with item counts`);
    } catch (err) {
      console.error('Error in fetchRootRecords:', err);
      toast.error(`Error fetching root records: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Set a record as root
  const setRecordAsRoot = async () => {
    if (!rootIdToSet) {
      toast.error('Please enter a record ID');
      return;
    }
    
    try {
      setIsRootUpdateLoading(true);
      setRootUpdateStatus(null);
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // First check if record exists - use proper parameter binding
      let query = supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, is_root');
        
      // Try to determine if this is a UUID or a string
      if (rootIdToSet.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // This looks like a UUID, likely the internal ID
        query = query.eq('id', rootIdToSet);
      } else {
        // This is probably a drive_id
        query = query.eq('drive_id', rootIdToSet);
      }
      
      const { data: recordData, error: recordError } = await query.limit(1);
        
      if (recordError) {
        console.error('Error finding record:', recordError);
        setRootUpdateStatus({
          success: false,
          message: `Failed to find record: ${recordError.message}`
        });
        return;
      }
      
      if (!recordData || recordData.length === 0) {
        setRootUpdateStatus({
          success: false,
          message: `No record found with ID or drive_id: ${rootIdToSet}`
        });
        return;
      }
      
      const recordToUpdate = recordData[0];
      
      // Update the record - try with both true and 1 to make sure it works
      let updateResult;
      
      try {
        // First try with boolean true
        const { data, error } = await supabaseAdmin
          .from('sources_google')
          .update({ is_root: true })
          .eq('id', recordToUpdate.id)
          .select('id, drive_id, name, is_root');
          
        if (error) {
          console.error('Error updating with is_root=true:', error);
          throw error;
        }
        
        updateResult = { data, error };
      } catch (err) {
        console.log('Trying alternative update with is_root=1');
        // If the first approach fails, try with numeric 1
        const { data, error } = await supabaseAdmin
          .from('sources_google')
          .update({ is_root: 1 })
          .eq('id', recordToUpdate.id)
          .select('id, drive_id, name, is_root');
          
        updateResult = { data, error };
      }
      
      const { data, error } = updateResult;
        
      if (error) {
        console.error('Error updating record:', error);
        setRootUpdateStatus({
          success: false,
          message: `Failed to update record: ${error.message}`
        });
        return;
      }
      
      setRootUpdateStatus({
        success: true,
        message: `Successfully set record "${recordToUpdate.name}" as root`
      });
      
      // Refresh root records
      fetchRootRecords();
      
    } catch (err) {
      console.error('Error in setRecordAsRoot:', err);
      setRootUpdateStatus({
        success: false,
        message: `Error setting record as root: ${err.message}`
      });
    } finally {
      setIsRootUpdateLoading(false);
    }
  };
  
  // Function to search for records by name
  const searchRecordsByName = async () => {
    if (!nameToSearch) {
      toast.error('Please enter a name to search for');
      return;
    }
    
    try {
      setIsSearchingByName(true);
      setNameSearchResults([]);
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // Search for records with a name that contains the search string - select all fields
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .select('*')
        .ilike('name', `%${nameToSearch}%`)
        .limit(10);
        
      if (error) {
        console.error('Error searching records by name:', error);
        toast.error(`Search failed: ${error.message}`);
        return;
      }
      
      console.log('Name search results:', data);
      setNameSearchResults(data || []);
      
      if (data && data.length > 0) {
        toast.success(`Found ${data.length} records matching "${nameToSearch}"`);
      } else {
        toast.info(`No records found matching "${nameToSearch}"`);
      }
    } catch (err) {
      console.error('Error in searchRecordsByName:', err);
      toast.error(`Search error: ${err.message}`);
    } finally {
      setIsSearchingByName(false);
    }
  };
  
  // Handler to copy ID to the set root input
  const copyIdToRootInput = (id: string) => {
    setRootIdToSet(id);
    toast.success(`ID copied to input: ${id}`);
  };

  // Render Roots tab
  const renderRoots = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Root Records</h2>
          <button
            onClick={fetchRootRecords}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading ? 'Loading...' : 'Refresh Records'}
          </button>
        </div>
        
        <p className="mb-4 text-gray-600">
          These are the records marked as root folders in the sources_google table.
          Root folders are top-level folders that are directly synced from Google Drive.
        </p>
        
        {rootRecords.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Root Folders Summary</h3>
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      View
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folders</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rootRecords.map((record) => (
                    <tr key={record.id} className={selectedRoots.includes(record.id) ? "bg-blue-50" : ""}>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input 
                          type="checkbox" 
                          checked={selectedRoots.includes(record.id)}
                          onChange={() => {
                            if (selectedRoots.includes(record.id)) {
                              setSelectedRoots(selectedRoots.filter(id => id !== record.id));
                            } else {
                              setSelectedRoots([...selectedRoots, record.id]);
                              // Fetch contents for the root folder similar to "Preview Contents"
                              fetchRootContents(record.id);
                              
                              // If user checks a root, set active tab to 'roots' to show the result
                              if (activeTab !== 'roots') {
                                setActiveTab('roots');
                              }
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.drive_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.filesCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.foldersCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{record.totalItems}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {selectedRoots.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Selected Root Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedRoots.map(selectedId => {
                const record = rootRecords.find(r => r.id === selectedId);
                if (!record) return null;
                
                return (
                  <div key={`details-${record.id}`} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <h4 className="text-base font-medium mb-2 flex items-center">
                      <span className="mr-2">📂</span> {record.name}
                    </h4>
                    
                    <div className="mb-3 text-sm text-gray-500">
                      <div><span className="font-medium">ID:</span> {record.drive_id}</div>
                      <div><span className="font-medium">Type:</span> {record.mime_type}</div>
                      <div><span className="font-medium">Items:</span> {record.totalItems} ({record.filesCount} files, {record.foldersCount} folders)</div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h5 className="text-sm font-medium mb-1">Files and Folders</h5>
                      {isLoadingRootContents[record.id] ? (
                        <div className="text-xs text-gray-600 py-2 flex items-center">
                          <svg className="animate-spin h-4 w-4 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading files and folders...
                        </div>
                      ) : rootContents[record.id] && rootContents[record.id].length > 0 ? (
                        <div className="text-xs text-gray-600 max-h-[300px] overflow-y-auto border rounded p-2">
                          <div className="pl-2 border-l-2 border-blue-200">
                            {rootContents[record.id].map((item) => (
                              <FolderItem key={item.id} item={item} level={0} />
                            ))}
                            {rootContents[record.id].length < record.totalItems && (
                              <div className="py-1 text-gray-400 italic">
                                ... and {record.totalItems - rootContents[record.id].length} more items
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">No files or folders found</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="mb-6 overflow-hidden border border-gray-200 rounded-lg">
          <div className="max-h-[400px] overflow-auto bg-gray-50 p-4">
            <pre className="text-sm whitespace-pre-wrap break-words font-mono">
              {JSON.stringify(rootRecords, null, 2)}
            </pre>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Root Management</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Set Record as Root</h3>
            
            <p className="mb-3 text-gray-600 text-sm">
              Enter a record ID or drive_id to mark it as a root folder.
            </p>
            
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={rootIdToSet}
                onChange={(e) => setRootIdToSet(e.target.value)}
                placeholder="Enter record ID or drive_id"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <button
                onClick={setRecordAsRoot}
                disabled={isRootUpdateLoading || !rootIdToSet}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {isRootUpdateLoading ? 'Setting...' : 'Set as Root'}
              </button>
            </div>
            
            {rootUpdateStatus && (
              <div className={`p-3 rounded-lg ${rootUpdateStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={rootUpdateStatus.success ? 'text-green-800' : 'text-red-800'}>
                  {rootUpdateStatus.message}
                </p>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Find Record ID by Name</h3>
            
            <p className="mb-3 text-gray-600 text-sm">
              Enter a record name to search for matching records and get their IDs.
            </p>
            
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={nameToSearch}
                onChange={(e) => setNameToSearch(e.target.value)}
                placeholder="Enter record name to search"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <button
                onClick={searchRecordsByName}
                disabled={isSearchingByName || !nameToSearch}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
              >
                {isSearchingByName ? 'Searching...' : 'Search by Name'}
              </button>
            </div>
          </div>
        </div>
        
        {nameSearchResults.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Search Results</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {nameSearchResults.map((record) => (
                    <React.Fragment key={record.id}>
                      <tr className={expandedRecords[record.id] ? "bg-blue-50" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              checked={!!expandedRecords[record.id]}
                              onChange={() => {
                                setExpandedRecords(prev => ({
                                  ...prev,
                                  [record.id]: !prev[record.id]
                                }));
                              }}
                              className="h-4 w-4 mr-2 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            {record.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.mime_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{record.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => copyIdToRootInput(record.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Use ID
                          </button>
                        </td>
                      </tr>
                      {expandedRecords[record.id] && (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 bg-blue-50">
                            <div className="max-h-48 overflow-auto bg-white p-3 rounded border text-xs font-mono whitespace-pre">
                              {JSON.stringify(record, null, 2)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
  
  // Track when the Roots tab is selected
  useEffect(() => {
    if (activeTab === 'roots') {
      setRootsTabSelected(true);
      fetchRootRecords();
    } else {
      setRootsTabSelected(false);
    }
    
    // If cleanup tab is selected, fetch date groups
    if (activeTab === 'cleanup') {
      fetchRecordsByDate();
    }
  }, [activeTab]);
  
  // Debug logging for Roots tab
  useEffect(() => {
    if (rootsTabSelected) {
      console.log('Roots tab is active, rootRecords:', rootRecords);
    }
  }, [rootsTabSelected, rootRecords]);
  
  // Fetch contents for selected roots when they change
  useEffect(() => {
    // Only run if the Roots tab is selected
    if (!rootsTabSelected) return;
    
    // For each newly selected root, fetch its contents
    selectedRoots.forEach(rootId => {
      if (!rootContents[rootId] && !isLoadingRootContents[rootId]) {
        fetchRootContents(rootId);
      }
    });
  }, [selectedRoots, rootsTabSelected]);
  
  // Function to create Supabase admin client
  const createSupabaseAdmin = () => {
    // Check if we have the Service Role Key for admin operations
    if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Service Role Key is required for this operation');
    }
    
    // Create admin client to bypass RLS
    return createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  };
  
  // Function to fetch contents for a specific root
  const fetchRootContents = async (rootId: string) => {
    try {
      // Mark this root as loading
      setIsLoadingRootContents(prev => ({
        ...prev,
        [rootId]: true
      }));
      
      // Find the root record to get its drive_id
      const record = rootRecords.find(r => r.id === rootId);
      if (!record) {
        console.error(`Root record not found for ID: ${rootId}`);
        return;
      }
      
      const supabaseAdmin = createSupabaseAdmin();
      
      // Get files and folders that have this root as parent_folder_id
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type, parent_folder_id')
        .eq('parent_folder_id', record.drive_id)
        .order('mime_type', { ascending: false }) // Folders first
        .order('name', { ascending: true })
        .limit(50); // Limit to avoid performance issues
      
      if (error) {
        console.error(`Error fetching contents for root ${rootId}:`, error);
        toast.error(`Failed to fetch contents: ${error.message}`);
        return;
      }
      
      // Update the rootContents state with the fetched data
      setRootContents(prev => ({
        ...prev,
        [rootId]: data || []
      }));
      
      console.log(`Fetched ${data?.length || 0} items for root ${record.name}`);
    } catch (err) {
      console.error(`Error fetching contents for root ${rootId}:`, err);
      toast.error(`Error fetching contents: ${err.message}`);
    } finally {
      // Mark this root as no longer loading
      setIsLoadingRootContents(prev => ({
        ...prev,
        [rootId]: false
      }));
    }
  };
  
  // Function to fetch contents for a specific folder
  const fetchFolderContents = async (folderId: string, folderDriveId: string) => {
    try {
      // Mark this folder as loading
      setIsLoadingFolderContents(prev => ({
        ...prev,
        [folderId]: true
      }));
      
      const supabaseAdmin = createSupabaseAdmin();
      
      // Get files and folders that have this folder as parent_folder_id
      const { data, error } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, mime_type, parent_folder_id')
        .eq('parent_folder_id', folderDriveId)
        .order('mime_type', { ascending: false }) // Folders first
        .order('name', { ascending: true })
        .limit(50); // Limit to avoid performance issues
      
      if (error) {
        console.error(`Error fetching contents for folder ${folderId}:`, error);
        toast.error(`Failed to fetch folder contents: ${error.message}`);
        return;
      }
      
      // Update the folderContents state with the fetched data
      setFolderContents(prev => ({
        ...prev,
        [folderId]: data || []
      }));
      
      console.log(`Fetched ${data?.length || 0} items for folder ${folderId}`);
    } catch (err) {
      console.error(`Error fetching contents for folder ${folderId}:`, err);
      toast.error(`Error fetching folder contents: ${err.message}`);
    } finally {
      // Mark this folder as no longer loading
      setIsLoadingFolderContents(prev => ({
        ...prev,
        [folderId]: false
      }));
    }
  };
  
  // Handle toggling folder expansion
  const toggleFolderExpansion = (folderId: string, folderDriveId: string) => {
    if (expandedFolders.includes(folderId)) {
      // Collapse folder
      setExpandedFolders(expandedFolders.filter(id => id !== folderId));
    } else {
      // Expand folder and fetch contents if not already loaded
      setExpandedFolders([...expandedFolders, folderId]);
      if (!folderContents[folderId] && !isLoadingFolderContents[folderId]) {
        fetchFolderContents(folderId, folderDriveId);
      }
    }
  };
  
  // Helper component for recursive folder view
  const FolderItem = ({ item, level = 0 }) => {
    const isFolder = item.mime_type === 'application/vnd.google-apps.folder';
    const isExpanded = expandedFolders.includes(item.id);
    const isLoading = isLoadingFolderContents[item.id];
    const hasContents = folderContents[item.id] && folderContents[item.id].length > 0;
    
    const handleToggle = (e) => {
      e.stopPropagation();
      toggleFolderExpansion(item.id, item.drive_id);
    };
    
    return (
      <div>
        {isFolder ? (
          <div>
            <div 
              className="py-1 flex items-start cursor-pointer hover:bg-gray-100 rounded px-1"
              onClick={handleToggle}
            >
              <span className="mr-1 mt-0.5">
                {isExpanded ? '📂' : '📁'}
              </span>
              <span className={`truncate ${level === 0 ? 'font-medium' : ''}`}>
                {item.name}
              </span>
              {isLoading && (
                <svg className="animate-spin h-3 w-3 text-blue-500 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </div>
            
            {isExpanded && (
              <div className={`${level === 0 ? 'pl-4' : 'pl-3'} ml-2 border-l border-gray-200`}>
                {isLoading ? (
                  <div className="py-1 text-gray-400">Loading...</div>
                ) : hasContents ? (
                  folderContents[item.id].map(childItem => (
                    <FolderItem 
                      key={childItem.id} 
                      item={childItem} 
                      level={Math.min(level + 1, 4)} 
                    />
                  ))
                ) : (
                  <div className="py-1 text-gray-400 italic">Empty folder</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-1 flex items-start hover:bg-gray-100 rounded px-1">
            <span className="mr-1 mt-0.5">📄</span>
            <span className="truncate">{item.name}</span>
          </div>
        )}
      </div>
    );
  };
  
  // State for the cleanup tab
  const [isCleanupLoading, setIsCleanupLoading] = useState(false);
  const [cleanupStats, setCleanupStats] = useState<{
    totalRecords: number;
    recordsMissingPath: number;
    recordsFixed: number;
    recordsWithErrors: number;
    details: string;
  }>({
    totalRecords: 0,
    recordsMissingPath: 0,
    recordsFixed: 0,
    recordsWithErrors: 0,
    details: '',
  });
  const [cleanupResults, setCleanupResults] = useState<{
    success: boolean;
    message: string;
    details?: string[];
  } | null>(null);
  
  // State for date-based cleanup
  const [dateGroups, setDateGroups] = useState<{
    date: string; 
    count: number;
    isSelected: boolean;
  }[]>([]);
  const [isLoadingDateGroups, setIsLoadingDateGroups] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteResults, setDeleteResults] = useState<{
    success: boolean;
    message: string;
    deletedCount: number;
  } | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});

  // Function to fix parent_path issues
  const fixParentPaths = async () => {
    try {
      setIsCleanupLoading(true);
      setCleanupResults(null);
      const detailsLog: string[] = [];
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // 1. Get statistics on current state
      detailsLog.push("Step 1: Analyzing current database state...");
      const { count: totalCount } = await supabaseAdmin
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      const { data: missingPathData, error: missingPathError } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, parent_folder_id, parent_path')
        .is('parent_path', null)
        .not('parent_folder_id', 'is', null);
        
      if (missingPathError) {
        throw new Error(`Error checking for missing paths: ${missingPathError.message}`);
      }
      
      const recordsMissingPath = missingPathData?.length || 0;
      detailsLog.push(`Found ${totalCount} total records in sources_google`);
      detailsLog.push(`Found ${recordsMissingPath} records with missing parent_path but valid parent_folder_id`);
      
      // Set initial stats
      setCleanupStats({
        totalRecords: totalCount || 0,
        recordsMissingPath,
        recordsFixed: 0,
        recordsWithErrors: 0,
        details: detailsLog.join('\n')
      });
      
      // 2. First create a map of drive_id to path for all folders
      detailsLog.push("\nStep 2: Building folder path map...");
      const { data: folderData, error: folderError } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, parent_folder_id, path')
        .eq('mime_type', 'application/vnd.google-apps.folder');
        
      if (folderError) {
        throw new Error(`Error fetching folders: ${folderError.message}`);
      }
      
      // Create a map of drive_id to folder path
      const folderPathMap = new Map<string, string>();
      // Also create a map of folder names by drive_id for better path construction
      const folderNameMap = new Map<string, string>();
      
      // Add entries to maps
      folderData?.forEach(folder => {
        if (folder.path) {
          folderPathMap.set(folder.drive_id, folder.path);
        }
        if (folder.name) {
          folderNameMap.set(folder.drive_id, folder.name);
        }
      });
      
      detailsLog.push(`Built path map for ${folderPathMap.size} folders`);
      detailsLog.push(`Built name map for ${folderNameMap.size} folders`);
      
      // 3. Fix records with missing parent_path
      detailsLog.push("\nStep 3: Fixing records with missing parent_path...");
      
      let recordsFixed = 0;
      let recordsWithErrors = 0;
      
      // Process in batches for large datasets
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < missingPathData.length; i += BATCH_SIZE) {
        const batch = missingPathData.slice(i, i + BATCH_SIZE);
        detailsLog.push(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(missingPathData.length/BATCH_SIZE)} (${batch.length} records)`);
        
        // Process each record in the batch
        const updates = await Promise.all(batch.map(async record => {
          try {
            // Skip if we don't have parent_folder_id
            if (!record.parent_folder_id) {
              return null;
            }
            
            // Case 1: We already have the parent folder's path
            let parentPath = folderPathMap.get(record.parent_folder_id);
            
            // Case 2: We have the parent name but no path, construct a simple path
            if (!parentPath && folderNameMap.has(record.parent_folder_id)) {
              const parentName = folderNameMap.get(record.parent_folder_id);
              parentPath = `/folders/${record.parent_folder_id}`;
              
              // Also update the folderPathMap for future references
              folderPathMap.set(record.parent_folder_id, parentPath);
              
              detailsLog.push(`Created new path for folder: ${parentName} (${record.parent_folder_id}): ${parentPath}`);
            }
            
            // If we have a parent path, update the record
            if (parentPath) {
              return {
                id: record.id,
                parent_path: parentPath,
                updated_at: new Date().toISOString()
              };
            }
            
            // We couldn't determine the parent path
            detailsLog.push(`Could not determine parent path for record: ${record.name} (${record.id}), parent ID: ${record.parent_folder_id}`);
            return null;
          } catch (err) {
            recordsWithErrors++;
            detailsLog.push(`Error processing record ${record.id}: ${err.message}`);
            return null;
          }
        }));
        
        // Filter out null updates
        const validUpdates = updates.filter(Boolean);
        
        if (validUpdates.length > 0) {
          // Update the records in bulk
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('sources_google')
            .upsert(validUpdates);
            
          if (updateError) {
            recordsWithErrors += validUpdates.length;
            detailsLog.push(`Error updating batch: ${updateError.message}`);
          } else {
            recordsFixed += validUpdates.length;
            detailsLog.push(`Successfully updated ${validUpdates.length} records in batch`);
          }
        }
        
        // Update stats as we go
        setCleanupStats(prev => ({
          ...prev,
          recordsFixed,
          recordsWithErrors,
          details: detailsLog.join('\n')
        }));
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // 4. Final summary
      detailsLog.push("\nStep 4: Cleanup complete!");
      detailsLog.push(`Total records processed: ${missingPathData.length}`);
      detailsLog.push(`Records fixed: ${recordsFixed}`);
      detailsLog.push(`Records with errors: ${recordsWithErrors}`);
      
      // Set final stats
      setCleanupStats({
        totalRecords: totalCount || 0,
        recordsMissingPath,
        recordsFixed,
        recordsWithErrors,
        details: detailsLog.join('\n')
      });
      
      // Set results
      setCleanupResults({
        success: recordsFixed > 0,
        message: `Fixed ${recordsFixed} records with missing parent_path values`,
        details: detailsLog
      });
      
      toast.success(`Successfully fixed ${recordsFixed} records`);
      
    } catch (err) {
      console.error('Error fixing parent paths:', err);
      toast.error(`Error: ${err.message}`);
      
      setCleanupResults({
        success: false,
        message: `Error: ${err.message}`,
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };
  
  // Function to create a separate Viewer-compatible path column
  const createViewerPathColumn = async () => {
    try {
      setIsCleanupLoading(true);
      setCleanupResults(null);
      const detailsLog: string[] = [];
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // 1. Check if path column exists
      detailsLog.push("Step 1: Checking if path column exists...");
      
      // Try to check if column exists with direct query first (more compatible)
      let pathColumnExists = false;
      
      try {
        // First try direct method using Supabase's metadata API
        const { data: columnData, error: metadataError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'sources_google')
          .eq('column_name', 'path')
          .limit(1);
        
        if (metadataError) {
          console.error("Error using metadata API:", metadataError);
          // Continue to fallback
        } else {
          pathColumnExists = columnData && columnData.length > 0;
          detailsLog.push(`Checked for path column using direct query: ${pathColumnExists ? 'exists' : 'does not exist'}`);
          // Successfully determined column existence
          return;
        }
      } catch (directQueryErr) {
        console.error("Error with direct query method:", directQueryErr);
        // Continue to fallback
      }
      
      // Fallback to RPC method
      try {
        const { data: columnData, error: columnError } = await supabaseAdmin.rpc(
          'execute_sql', 
          { 
            sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'sources_google' AND column_name = 'path'" 
          }
        );
        
        if (columnError) {
          // If execute_sql function doesn't exist, show a more helpful error
          if (columnError.message.includes('Could not find the function') || 
              columnError.message.includes('not found') || 
              columnError.code === '42883') {
            detailsLog.push("The execute_sql function is not available. Assuming column doesn't exist and proceeding to create it.");
            pathColumnExists = false;
          } else {
            throw new Error(`Error checking for path column: ${columnError.message}`);
          }
        } else {
          pathColumnExists = columnData && columnData.length > 0;
          detailsLog.push(`Checked for path column using execute_sql: ${pathColumnExists ? 'exists' : 'does not exist'}`);
        }
      } catch (rpcErr) {
        console.error("Error with RPC method:", rpcErr);
        detailsLog.push("All methods to check column existence failed. Assuming column doesn't exist.");
        pathColumnExists = false;
      }
      
      if (!pathColumnExists) {
        detailsLog.push("Path column does not exist. Need to add it.");
        
        // Try to add the path column
        try {
          // First try using direct SQL via RPC
          const { error: alterError } = await supabaseAdmin.rpc(
            'execute_sql', 
            { 
              sql_query: "ALTER TABLE sources_google ADD COLUMN IF NOT EXISTS path TEXT" 
            }
          );
          
          if (alterError) {
            // If execute_sql function doesn't exist, show error but don't fail
            if (alterError.message.includes('Could not find the function') || 
                alterError.message.includes('not found') || 
                alterError.code === '42883') {
              detailsLog.push("The execute_sql function is not available. Cannot add path column automatically.");
              detailsLog.push("Please manually add a 'path' column of type TEXT to the sources_google table.");
              
              // Alert the user with a toast
              toast.error("Cannot add path column automatically. Please add it manually.", { duration: 10000 });
            } else {
              throw new Error(`Error adding path column: ${alterError.message}`);
            }
          } else {
            detailsLog.push("Successfully added path column");
          }
        } catch (err) {
          console.error("Error adding path column:", err);
          detailsLog.push(`Failed to add path column: ${err.message}`);
          
          // Continue anyway since other operations may work
          detailsLog.push("Continuing with other operations...");
        }
      } else {
        detailsLog.push("Path column already exists");
      }
      
      // 2. Get statistics on current state
      detailsLog.push("\nStep 2: Analyzing current database state...");
      
      // Count total records
      const { count: totalCount } = await supabaseAdmin
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      // Count records with null path
      const { count: nullPathCount } = await supabaseAdmin
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .is('path', null);
      
      detailsLog.push(`Found ${totalCount} total records in sources_google`);
      detailsLog.push(`Found ${nullPathCount} records with null path`);
      
      // 3. First handle folders - set their paths correctly
      detailsLog.push("\nStep 3: Setting folder paths...");
      
      // Get all folders
      const { data: folderData, error: folderError } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, parent_folder_id, parent_path')
        .eq('mime_type', 'application/vnd.google-apps.folder');
        
      if (folderError) {
        throw new Error(`Error fetching folders: ${folderError.message}`);
      }
      
      detailsLog.push(`Found ${folderData?.length || 0} folders to process`);
      
      // Create a helper map of parent folder_id to child folders
      const foldersByParent = new Map<string | null, any[]>();
      
      // Group folders by parent_folder_id
      folderData?.forEach(folder => {
        const parentId = folder.parent_folder_id || null;
        if (!foldersByParent.has(parentId)) {
          foldersByParent.set(parentId, []);
        }
        foldersByParent.get(parentId)?.push(folder);
      });
      
      // Recursively build paths for all folders starting with root folders
      const rootFolders = foldersByParent.get(null) || [];
      detailsLog.push(`Found ${rootFolders.length} root folders`);
      
      // Generate paths for all folders
      let processedFolders = 0;
      let errorFolders = 0;
      
      // Process folders level by level
      const processedFolderIds = new Set<string>();
      const folderPaths = new Map<string, string>();
      
      // Function to generate path for a folder
      const generateFolderPath = (folder: any, parentPath: string | null = null): string => {
        const path = parentPath 
          ? `${parentPath}/${folder.name}` 
          : `/${folder.name}`;
          
        return path;
      };
      
      // Start with root folders (no parent)
      rootFolders.forEach(folder => {
        try {
          const path = generateFolderPath(folder);
          folderPaths.set(folder.drive_id, path);
          processedFolderIds.add(folder.drive_id);
          processedFolders++;
        } catch (err) {
          errorFolders++;
          detailsLog.push(`Error processing root folder ${folder.name}: ${err.message}`);
        }
      });
      
      detailsLog.push(`Set paths for ${processedFolders} root folders`);
      
      // Process subsequent levels
      let currentLevel = [...rootFolders];
      let nextLevel: any[] = [];
      let level = 0;
      const MAX_LEVELS = 10; // Safety limit
      
      while (currentLevel.length > 0 && level < MAX_LEVELS) {
        level++;
        detailsLog.push(`Processing level ${level} with ${currentLevel.length} folders`);
        
        nextLevel = [];
        
        // For each folder in current level, process its children
        for (const folder of currentLevel) {
          const childFolders = foldersByParent.get(folder.drive_id) || [];
          const parentPath = folderPaths.get(folder.drive_id);
          
          if (!parentPath) continue;
          
          // Process each child folder
          for (const childFolder of childFolders) {
            if (processedFolderIds.has(childFolder.drive_id)) continue;
            
            try {
              const childPath = generateFolderPath(childFolder, parentPath);
              folderPaths.set(childFolder.drive_id, childPath);
              processedFolderIds.add(childFolder.drive_id);
              processedFolders++;
              nextLevel.push(childFolder);
            } catch (err) {
              errorFolders++;
              detailsLog.push(`Error processing child folder ${childFolder.name}: ${err.message}`);
            }
          }
        }
        
        currentLevel = nextLevel;
      }
      
      detailsLog.push(`Set paths for total of ${processedFolders} folders across ${level} levels`);
      
      // 4. Update all folder paths in the database
      detailsLog.push("\nStep 4: Updating folder paths in database...");
      
      let updatedFolders = 0;
      let folderErrors = 0;
      
      // Process in batches
      const folderEntries = Array.from(folderPaths.entries());
      for (let i = 0; i < folderEntries.length; i += 50) {
        const batch = folderEntries.slice(i, i + 50);
        
        // Create update objects
        const updates = batch.map(([drive_id, path]) => ({
          drive_id,
          path,
          updated_at: new Date().toISOString()
        }));
        
        // Perform update
        const { data, error } = await supabaseAdmin
          .from('sources_google')
          .upsert(updates, { onConflict: 'drive_id' });
          
        if (error) {
          folderErrors += batch.length;
          detailsLog.push(`Error updating folder batch: ${error.message}`);
        } else {
          updatedFolders += batch.length;
        }
      }
      
      detailsLog.push(`Updated ${updatedFolders} folder paths in database`);
      
      // 5. Update file paths
      detailsLog.push("\nStep 5: Setting file paths based on parent folders...");
      
      // Get all files (non-folders)
      const { data: fileData, error: fileError } = await supabaseAdmin
        .from('sources_google')
        .select('id, drive_id, name, parent_folder_id, path')
        .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
        
      if (fileError) {
        throw new Error(`Error fetching files: ${fileError.message}`);
      }
      
      detailsLog.push(`Found ${fileData?.length || 0} files to process`);
      
      // Update file paths
      let updatedFiles = 0;
      let fileErrors = 0;
      
      // Process files in batches
      for (let i = 0; i < fileData.length; i += 100) {
        const batch = fileData.slice(i, i + 100);
        
        // Create update objects
        const updates = batch.map(file => {
          // Skip if no parent folder ID
          if (!file.parent_folder_id) return null;
          
          // Get parent folder path
          const parentPath = folderPaths.get(file.parent_folder_id);
          if (!parentPath) return null;
          
          // Generate file path
          const filePath = `${parentPath}/${file.name}`;
          
          return {
            drive_id: file.drive_id,
            path: filePath,
            updated_at: new Date().toISOString()
          };
        }).filter(Boolean); // Remove nulls
        
        if (updates.length === 0) continue;
        
        // Perform update
        const { data, error } = await supabaseAdmin
          .from('sources_google')
          .upsert(updates, { onConflict: 'drive_id' });
          
        if (error) {
          fileErrors += updates.length;
          detailsLog.push(`Error updating file batch: ${error.message}`);
        } else {
          updatedFiles += updates.length;
        }
      }
      
      detailsLog.push(`Updated ${updatedFiles} file paths in database`);
      
      // 6. Final summary
      detailsLog.push("\nStep 6: File path generation complete!");
      detailsLog.push(`Total folders processed: ${processedFolders}`);
      detailsLog.push(`Total files processed: ${updatedFiles}`);
      detailsLog.push(`Total errors: ${errorFolders + fileErrors}`);
      
      // Set results
      setCleanupResults({
        success: true,
        message: `Successfully updated paths for ${updatedFolders} folders and ${updatedFiles} files`,
        details: detailsLog
      });
      
      toast.success(`Successfully updated paths for ${updatedFolders + updatedFiles} records`);
      
    } catch (err) {
      console.error('Error creating viewer path column:', err);
      toast.error(`Error: ${err.message}`);
      
      setCleanupResults({
        success: false,
        message: `Error: ${err.message}`,
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };
  
  // Function to check if execute_sql function exists
  const checkExecuteSqlExists = async (supabaseAdmin) => {
    try {
      // Try to get the function definition
      const { data, error } = await supabaseAdmin
        .from('pg_proc')
        .select('*')
        .eq('proname', 'execute_sql')
        .limit(1);
      
      if (error) {
        console.log('Error checking for execute_sql function:', error);
        return false;
      }
      
      return data && data.length > 0;
    } catch (err) {
      console.error('Error checking for execute_sql function:', err);
      return false;
    }
  };
  
  // Function to get counts of records by date
  const fetchRecordsByDate = async () => {
    try {
      setIsLoadingDateGroups(true);
      setDeleteResults(null);
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Use the helper function to create admin client
      const supabaseAdmin = createSupabaseAdmin();
      
      try {
        // First try the direct query method - more compatible
        const { data, error } = await supabaseAdmin
          .from('sources_google')
          .select('created_at')
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(`Error fetching records for date grouping: ${error.message}`);
        }

        // Process the data client-side to get date groups
        const dateMap = new Map();
        
        if (data) {
          data.forEach(record => {
            const date = new Date(record.created_at).toISOString().split('T')[0];
            dateMap.set(date, (dateMap.get(date) || 0) + 1);
          });
        }

        // Convert to array format for UI
        const dateGroupsData = Array.from(dateMap.entries())
          .map(([date, count]) => ({
            date,
            count: Number(count),
            isSelected: false
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        setDateGroups(dateGroupsData);
        toast.success(`Found ${dateGroupsData.length} date groups`);
        return;
      } catch (directQueryErr) {
        console.error('Error with direct query method:', directQueryErr);
        // Continue to try RPC method as fallback
      }
      
      // Fallback: Try RPC method
      const { data, error } = await supabaseAdmin.rpc(
        'execute_sql',
        {
          sql_query: `
            SELECT 
              TO_CHAR(created_at::date, 'YYYY-MM-DD') as date,
              COUNT(*) as count
            FROM 
              sources_google
            GROUP BY 
              TO_CHAR(created_at::date, 'YYYY-MM-DD')
            ORDER BY 
              date DESC
          `
        }
      );
      
      if (error) {
        // If execute_sql function doesn't exist, show a more helpful error
        if (error.message.includes('Could not find the function') || 
            error.message.includes('not found') || 
            error.code === '42883') {
          throw new Error('The execute_sql function is not available in this database. Please contact your administrator to install it, or use the direct query method.');
        }
        throw new Error(`Error fetching date groups: ${error.message}`);
      }
      
      // Transform data for UI
      const dateGroupsData = (data || []).map(group => ({
        date: group.date,
        count: parseInt(group.count, 10),
        isSelected: false
      }));
      
      setDateGroups(dateGroupsData);
      
      toast.success(`Found ${dateGroupsData.length} date groups`);
    } catch (err) {
      console.error('Error fetching date groups:', err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoadingDateGroups(false);
    }
  };
  
  // Function to toggle selection of a date group
  const toggleDateGroupSelection = (date: string) => {
    setDateGroups(dateGroups.map(group => 
      group.date === date 
        ? { ...group, isSelected: !group.isSelected } 
        : group
    ));
  };
  
  // Function to delete records for selected dates
  const deleteRecordsByDate = async () => {
    try {
      setIsDeleting(true);
      setDeleteResults(null);
      
      // First check if we have the Service Role Key for admin operations
      if (!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
        toast.error('Service Role Key is required for this operation');
        return;
      }
      
      // Get selected dates
      const selectedDates = dateGroups
        .filter(group => group.isSelected)
        .map(group => group.date);
      
      if (selectedDates.length === 0) {
        toast.error('Please select at least one date group to delete');
        return;
      }
      
      // Create admin client to bypass RLS
      const supabaseAdmin = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            storageKey: 'dhg-supabase-admin-auth',
            persistSession: false
          }
        }
      );
      
      // Calculate total number of records to delete
      const totalToDelete = dateGroups
        .filter(group => group.isSelected)
        .reduce((sum, group) => sum + group.count, 0);
      
      // Process each date one by one to avoid timeouts with large deletes
      let totalDeleted = 0;
      
      for (const date of selectedDates) {
        // First get IDs of records to delete
        const { data: recordsToDelete, error: fetchError } = await supabaseAdmin
          .from('sources_google')
          .select('id')
          .filter('created_at', 'gte', `${date}T00:00:00`)
          .filter('created_at', 'lt', `${date}T23:59:59.999`);
          
        if (fetchError) {
          console.error(`Error fetching records for date ${date}:`, fetchError);
          continue;
        }
        
        const idsToDelete = recordsToDelete?.map(r => r.id) || [];
        
        if (idsToDelete.length === 0) {
          console.log(`No records found for date ${date}`);
          continue;
        }
        
        // Delete in batches to avoid request size limitations
        const BATCH_SIZE = 100;
        
        for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
          const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);
          
          // Delete the batch
          const { error: deleteError } = await supabaseAdmin
            .from('sources_google')
            .delete()
            .in('id', batchIds);
            
          if (deleteError) {
            console.error(`Error deleting records for date ${date} (batch ${i/BATCH_SIZE + 1}):`, deleteError);
            continue;
          }
          
          totalDeleted += batchIds.length;
        }
      }
      
      // Refresh the date groups
      await fetchRecordsByDate();
      
      // Set results
      setDeleteResults({
        success: totalDeleted > 0,
        message: `Successfully deleted ${totalDeleted} records from ${selectedDates.length} date groups`,
        deletedCount: totalDeleted
      });
      
      toast.success(`Successfully deleted ${totalDeleted} records from ${selectedDates.length} date groups`);
      
    } catch (err) {
      console.error('Error deleting records:', err);
      toast.error(`Error: ${err.message}`);
      
      setDeleteResults({
        success: false,
        message: `Error: ${err.message}`,
        deletedCount: 0
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Render the cleanup tab
  const renderCleanup = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Database Cleanup Tools</h2>
        
        <div className="prose prose-sm mb-6">
          <p>
            These tools help fix issues with the database to ensure proper compatibility between the "Preview Contents" functionality
            and the FileTree viewer component.
          </p>
          <p className="text-amber-600 font-medium">
            Warning: These operations modify database records directly. Consider making a backup first.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-medium mb-2">Fix Missing Parent Paths</h3>
            <p className="text-sm text-gray-600 mb-4">
              This function repairs records that have a parent_folder_id but no parent_path,
              which prevents them from showing up correctly in hierarchical views.
            </p>
            <button
              onClick={fixParentPaths}
              disabled={isCleanupLoading}
              className={`w-full py-2 px-4 rounded ${
                isCleanupLoading 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isCleanupLoading ? 'Processing...' : 'Fix Missing Parent Paths'}
            </button>
          </div>
          
          <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-medium mb-2">Create Viewer-Compatible Paths</h3>
            <p className="text-sm text-gray-600 mb-4">
              This function adds and populates the 'path' field required by the FileTree component,
              creating proper hierarchical paths for all files and folders.
            </p>
            <button
              onClick={createViewerPathColumn}
              disabled={isCleanupLoading}
              className={`w-full py-2 px-4 rounded ${
                isCleanupLoading 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isCleanupLoading ? 'Processing...' : 'Create Viewer Paths'}
            </button>
          </div>
        </div>
        
        {isCleanupLoading && (
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <h3 className="text-lg font-medium text-blue-800 mb-2">Processing...</h3>
            <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse"></div>
            </div>
            
            <div className="mt-4 max-h-48 overflow-y-auto bg-white p-3 rounded border text-xs font-mono whitespace-pre">
              {cleanupStats.details}
            </div>
          </div>
        )}
        
        {cleanupResults && (
          <div className={`mt-6 p-4 border rounded-lg ${
            cleanupResults.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <h3 className={`text-lg font-medium mb-2 ${
              cleanupResults.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {cleanupResults.success ? 'Operation Successful' : 'Operation Failed'}
            </h3>
            <p className="mb-2">{cleanupResults.message}</p>
            
            {cleanupResults.details && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    // Toggle showing details
                    const detailsEl = document.getElementById('cleanup-details');
                    if (detailsEl) {
                      detailsEl.classList.toggle('hidden');
                    }
                  }}
                  className="text-sm underline"
                >
                  Show/Hide Details
                </button>
                <div id="cleanup-details" className="hidden mt-2 max-h-48 overflow-y-auto bg-white p-3 rounded border text-xs font-mono whitespace-pre">
                  {cleanupResults.details.join('\n')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Date-based Record Deletion */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Delete Records by Created Date</h2>
        
        <div className="prose prose-sm mb-6">
          <p>
            This tool allows you to delete records from the <code>sources_google</code> table based on their creation date.
            This is useful for cleaning up records before re-importing them with proper path information.
          </p>
          <p className="text-red-600 font-medium">
            Warning: This operation permanently deletes records from the database. This action cannot be undone.
          </p>
        </div>
        
        <div className="mb-4">
          <button
            onClick={fetchRecordsByDate}
            disabled={isLoadingDateGroups}
            className={`px-4 py-2 rounded ${
              isLoadingDateGroups 
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoadingDateGroups ? 'Loading...' : 'Fetch Records by Date'}
          </button>
        </div>
        
        {/* Date Groups */}
        {dateGroups.length > 0 && (
          <div className="mt-4">
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Select
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Record Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dateGroups.map((group) => (
                    <tr key={group.date} className={group.isSelected ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          checked={group.isSelected}
                          onChange={() => toggleDateGroupSelection(group.date)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {group.date}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {group.count.toLocaleString()} records
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Delete Selected Button */}
            <div className="mt-4">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || dateGroups.filter(g => g.isSelected).length === 0}
                className={`px-4 py-2 rounded ${
                  isDeleting || dateGroups.filter(g => g.isSelected).length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Selected Records'}
              </button>
              
              {/* Selection summary */}
              {dateGroups.some(g => g.isSelected) && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {dateGroups.filter(g => g.isSelected).length} date groups,{' '}
                  {dateGroups
                    .filter(g => g.isSelected)
                    .reduce((sum, g) => sum + g.count, 0).toLocaleString()}{' '}
                  records
                </div>
              )}
            </div>
            
            {/* Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                  <h3 className="text-lg font-medium text-red-600 mb-4">Confirm Deletion</h3>
                  <p className="mb-4">
                    Are you sure you want to delete{' '}
                    <span className="font-bold">
                      {dateGroups
                        .filter(g => g.isSelected)
                        .reduce((sum, g) => sum + g.count, 0).toLocaleString()}
                    </span>{' '}
                    records from{' '}
                    <span className="font-bold">
                      {dateGroups.filter(g => g.isSelected).length}
                    </span>{' '}
                    date groups?
                  </p>
                  <p className="text-sm text-red-500 mb-4">
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteRecordsByDate}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                    >
                      Delete Records
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Delete Results */}
            {deleteResults && (
              <div className={`mt-4 p-4 border rounded-lg ${
                deleteResults.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <h3 className={`text-lg font-medium mb-2 ${
                  deleteResults.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {deleteResults.success ? 'Deletion Successful' : 'Deletion Failed'}
                </h3>
                <p className="mb-2">{deleteResults.message}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Loading State */}
        {isLoadingDateGroups && !dateGroups.length && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2">Loading date groups...</span>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Viewer Component Explanation</h2>
        
        <div className="prose prose-sm">
          <h3>Understanding the FileTree and Viewer Components</h3>
          
          <p>
            The <code>FileTree</code> component and <code>Viewer</code> page were designed to show files stored in the <code>sources_google</code> table.
            They rely on specific fields:
          </p>
          
          <ul>
            <li><code>path</code>: Used to build the hierarchical folder structure</li>
            <li><code>parent_path</code>: Used to determine parent-child relationships</li>
          </ul>
          
          <p>
            When files are added via "Preview Contents", they might not have these fields populated
            correctly, causing them to not appear in the hierarchy.
          </p>
          
          <h3>The expert_documents Coupling Issue</h3>
          
          <p>
            The current <code>Viewer</code> component joins the <code>sources_google</code> table with the <code>expert_documents</code> table
            to show processing status information. This creates tight coupling between the two tables.
          </p>
          
          <p>
            This design works well when most files will be processed by experts, but creates issues when:
          </p>
          
          <ul>
            <li>You have files that will never be processed by experts</li>
            <li>You want to view files that haven't been processed yet</li>
            <li>You add source files from different Google Drive folders</li>
          </ul>
          
          <h3>FileTree Component and expert_documents Records</h3>
          
          <p>
            The current <code>Viewer</code> page will successfully show files that don't have associated <code>expert_documents</code> records.
            The left join query used in the component handles this gracefully, making the <code>expertDocument</code> property <code>null</code>
            when no matching record exists.
          </p>
          
          <p>
            This allows you to view all files in the <code>sources_google</code> table in the file hierarchy, even if they don't have
            expert document processing, as long as they have proper <code>path</code> and <code>parent_path</code> values.
          </p>
          
          <p>
            The cleanup tools on this page help ensure that all files have the proper path fields, making them visible in the Viewer
            regardless of their expert document status.
          </p>
        </div>
      </div>
    </div>
  );

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'folders':
        return renderFolders();
      case 'batches':
        return renderBatches();
      case 'roots':
        return renderRoots();
      case 'cleanup':
        return renderCleanup();
      // History tab is disabled
      case 'history':
        return renderDashboard();
      case 'auth':
        return renderAuth();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Google Drive Sync Dashboard</h1>
      
      {/* Tab navigation */}
      <div className="mb-8 border-b">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'dashboard'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('folders')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'folders'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Folders
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'batches'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Batch Processing
          </button>
          <button
            onClick={() => setActiveTab('roots')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'roots'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Roots
          </button>
          <button
            onClick={() => setActiveTab('cleanup')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'cleanup'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              Cleanup
              <span className="ml-1.5 px-1 py-0.5 text-xs bg-green-200 text-green-800 rounded">New</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              false // This tab is disabled
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-300 border-transparent cursor-not-allowed'
            }`}
          >
            <div className="flex items-center">
              Sync History
              <span className="ml-1.5 px-1 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">Disabled</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'auth'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              Authentication
              <span className={`ml-1.5 w-2 h-2 rounded-full ${isTokenValid ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </div>
          </button>
        </nav>
      </div>
      
      {/* Render content based on active tab */}
      {renderTabContent()}
    </div>
  );
}

export default Sync;