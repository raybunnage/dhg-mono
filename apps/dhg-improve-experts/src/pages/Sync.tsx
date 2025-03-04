import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { GoogleTokenStatus } from '@/components/GoogleTokenStatus';
import GoogleDriveDebug from '@/components/GoogleDriveDebug';
import { BatchManager } from '@/components/BatchManager';
import { BatchProcessingMonitor } from '@/components/BatchProcessingMonitor';
import { getDriveSyncStats, syncWithGoogleDrive, listFilesInFolder, authenticatedFetch, insertGoogleFiles, searchSpecificFolder } from '@/services/googleDriveService';
import { refreshGoogleToken } from '@/services/googleAuth';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'folders' | 'batches' | 'auth'>('dashboard');
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
  const [specificFolderId, setSpecificFolderId] = useState('1CTs-XEEE_LQGoyEhO0p6hixaEJBcV8hP'); // Default ID but can be changed
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

  // Check if the sync_statistics table has the required structure
  useEffect(() => {
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
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, drive_id')
        .is('parent_path', null)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .order('name');
        
      if (error) throw error;
      
          // Only get folders from sources_google
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
      
      setFolderOptions(folderArray);
      
      // If we have folders but no selected folder, select the first one
      if (folderArray.length > 0 && !existingFolderId) {
        setExistingFolderId(folderArray[0].id);
      }
      
      return folderArray;
    } catch (err) {
      console.error('Error fetching root folders:', err);
      toast.error('Failed to load existing folders');
      return [];
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchRootFolders();
    fetchFileStats();
  }, []);

  // Handle token status change from GoogleTokenStatus
  const handleTokenStatusChange = (isValid: boolean, token?: string) => {
    console.log('Token status changed:', isValid);
    setIsTokenValid(isValid);
    
    // Log the token change event
    try {
      const events = JSON.parse(localStorage.getItem('google_token_events') || '[]');
      events.unshift({
        type: isValid ? 'TOKEN_VALID' : 'TOKEN_INVALID',
        message: isValid ? 'Token is now valid' : 'Token is now invalid',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('google_token_events', JSON.stringify(events.slice(0, 20)));
    } catch (e) {
      console.error('Error logging token event:', e);
    }
    
    // If we have a valid token, store it in localStorage for our search function to use
    if (isValid && token) {
      localStorage.setItem('google_access_token', token);
      console.log('Stored new access token in localStorage');
      
      // Also store the expiration time if it's available in the localStorage
      const expiresAt = localStorage.getItem('google_token_expires_at');
      if (expiresAt) {
        // Parse the expiration time to see if it's valid
        try {
          const expiration = new Date(expiresAt);
          const now = new Date();
          const timeUntilExpiry = expiration.getTime() - now.getTime();
          
          // If the token is about to expire (less than 5 minutes), refresh it
          if (timeUntilExpiry < 5 * 60 * 1000) {
            console.log('Token is about to expire. Refreshing...');
            
            // Log the automatic refresh attempt
            const refreshEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
            refreshEvents.unshift({
              type: 'AUTO_REFRESH',
              message: 'Token is about to expire, auto-refreshing',
              timestamp: new Date().toISOString()
            });
            localStorage.setItem('google_token_events', JSON.stringify(refreshEvents.slice(0, 20)));
            
            refreshGoogleToken()
              .then(result => {
                if (result.success && result.access_token) {
                  localStorage.setItem('google_access_token', result.access_token);
                  console.log('Token refreshed successfully');
                  
                  // Log successful refresh
                  const successEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                  successEvents.unshift({
                    type: 'AUTO_REFRESH_SUCCESS',
                    message: 'Token automatically refreshed',
                    timestamp: new Date().toISOString()
                  });
                  localStorage.setItem('google_token_events', JSON.stringify(successEvents.slice(0, 20)));
                } else {
                  console.warn('Failed to refresh token:', result.error);
                  
                  // Log failed refresh
                  const failEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                  failEvents.unshift({
                    type: 'AUTO_REFRESH_FAIL',
                    message: `Failed: ${result.error}`,
                    timestamp: new Date().toISOString()
                  });
                  localStorage.setItem('google_token_events', JSON.stringify(failEvents.slice(0, 20)));
                }
              })
              .catch(err => {
                console.error('Error refreshing token:', err);
                
                // Log error
                const errorEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                errorEvents.unshift({
                  type: 'AUTO_REFRESH_ERROR',
                  message: err.message,
                  timestamp: new Date().toISOString()
                });
                localStorage.setItem('google_token_events', JSON.stringify(errorEvents.slice(0, 20)));
              });
          }
        } catch (e) {
          console.error('Error parsing token expiration:', e);
        }
      }
    }
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
      
      // Temporarily override the folder ID for syncing
      localStorage.setItem('google_drive_folder_id_override', newFolderId);
      localStorage.setItem('google_drive_folder_name', folderDisplayName);
      
      toast.success(`Checking status of folder: ${folderDisplayName}`);
      
      // Get stats for the new folder using the temporary override
      const stats = await getDriveSyncStats();
      setSyncStats(stats);
      
      if (!stats.isValid) {
        throw new Error(`Failed to check sync status: ${stats.error}`);
      }
      
      // Check if there are new files to sync
      if (stats.newFiles && Array.isArray(stats.newFiles) && stats.newFiles.length > 0) {
        toast.success(`Found ${stats.newFiles.length} new files to sync. Starting sync...`);
        
        // Perform the sync operation
        const result = await syncWithGoogleDrive();
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
        const { data: folderData } = await supabase
          .from('sources_google')
          .select('id, name, drive_id')
          .is('parent_path', null)
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .order('name');
          
        if (folderData) {
          setFolderOptions(folderData.map(folder => ({
            id: folder.drive_id || folder.id,
            name: folder.name
          })));
        }
      } else {
        toast.success('Folder is already in sync! No new files to add.');
      }
      
      // Clean up the temporary override
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
      
      // Fetch document stats for the new folder
      fetchDocumentStats(newFolderId);
      
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error(`Failed to start sync process: ${err.message}`);
      
      // Clean up in case of error
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
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
          
          // Simulate progress and show completion
          simulateProgressUpdates();
          toast.success('Sync process completed successfully');
          
          // Fetch updated stats once sync is complete
          fetchDocumentStats(existingFolderId);
          
          // Force refresh the sync summary
          setSyncSummaryKey(`sync-${Date.now()}`);
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
    if (!isTokenValid && localStorage.getItem('skip_token_validation') !== 'true') {
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
      
      // In development mode, make sure we have token validation skip enabled
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('skip_token_validation', 'true');
      }
      
      // Check if token is available and log it
      const token = localStorage.getItem('google_access_token');
      if (!token && localStorage.getItem('skip_token_validation') !== 'true') {
        console.error('No token in localStorage when trying to sync');
        toast.error('Token not found in localStorage. Try refreshing the token.');
        setIsLoading(false);
        return;
      }
      
      // Log a message about the check
      console.log(`Checking sync status for folder: ${folderName} (${existingFolderId})`);
      toast.loading(`Checking sync status for ${folderName}...`);
      
      // Set the folder override in localStorage
      localStorage.setItem('google_drive_folder_id_override', existingFolderId);
      localStorage.setItem('google_drive_folder_name', folderName);
      
      // Get the sync stats
      const stats = await getDriveSyncStats();
      setSyncStats(stats);
      
      // Clear any temporary folder override
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
      
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
      
      // Make sure to clean up temporary overrides in case of error
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle synchronizing with Google Drive
  const handleSync = async () => {
    if (!isTokenValid && localStorage.getItem('skip_token_validation') !== 'true') {
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
      
      // Set the folder override in localStorage
      localStorage.setItem('google_drive_folder_id_override', existingFolderId);
      localStorage.setItem('google_drive_folder_name', folderName);
      
      toast.loading(`Syncing ${folderName} with Google Drive...`);
      
      // In development mode, make sure we have token validation skip enabled
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('skip_token_validation', 'true');
      }
      
      const result = await syncWithGoogleDrive();
      setSyncResult(result);
      
      // Store the result locally only
      await storeLocalSyncResult(result);
      
      // Clear any temporary folder override
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
      
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
      
      // Re-set the folder override to get stats for this folder
      localStorage.setItem('google_drive_folder_id_override', existingFolderId);
      localStorage.setItem('google_drive_folder_name', folderName);
      
      const newStats = await getDriveSyncStats();
      setSyncStats(newStats);
      
      // Clear folder override again
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
      
      fetchFileStats();
      
      // Force refresh the sync summary
      setSyncSummaryKey(`sync-${Date.now()}`);
      
      toast.dismiss();
    } catch (error) {
      console.error('Error syncing with Google Drive:', error);
      toast.dismiss();
      toast.error(`Sync failed: ${error.message || 'Unknown error'}`);
      
      // Make sure to clean up temporary overrides in case of error
      localStorage.removeItem('google_drive_folder_id_override');
      localStorage.removeItem('google_drive_folder_name');
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

  // Simulate progress updates for testing
  const simulateProgressUpdates = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 1;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsLoading(false);
        
        // Mock sync stats after completion
        setSyncStats({
          total: 324,
          new: 15,
          updated: 42,
          deleted: 3,
          errors: 1
        });
      }
      setSyncProgress(progress);
    }, 800);
  };

  // Fetch document stats for a folder
  const fetchDocumentStats = async (folderId: string) => {
    try {
      // In a real implementation, you'd fetch this data from your database
      // For now, we'll use mock data
      setDocumentStats([
        { document_type: 'Transcript', count: 56 },
        { document_type: 'Report', count: 43 },
        { document_type: 'Presentation', count: 29 },
        { document_type: 'Research Paper', count: 18 },
        { document_type: 'Meeting Notes', count: 64 },
        { document_type: 'Email', count: 114 }
      ]);
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

  // These functions have been deprecated with removal of sync history
  
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
          <GoogleTokenStatus 
            onTokenExpired={handleTokenExpired}
            onStatusChange={handleTokenStatusChange}
            useMockData={false}
          />
          
          <div className="mt-4 flex flex-wrap space-x-2">
            <button
              onClick={handleSyncCheck}
              disabled={!isTokenValid || isLoading}
              className={`px-4 py-2 mb-2 rounded ${
                isTokenValid 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Checking...' : 'Check Sync Status'}
            </button>
            
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
            
            <button
              onClick={() => setActiveTab('folders')}
              className="px-4 py-2 mb-2 rounded bg-purple-500 text-white hover:bg-purple-600"
            >
              Manage Sync Folders
            </button>
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
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Specific Folder Analysis</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={specificFolderId}
              onChange={(e) => setSpecificFolderId(e.target.value)}
              placeholder="Enter Google Drive Folder ID"
              className="border px-3 py-2 rounded w-64 text-sm"
              disabled={isSearchingFolder}
            />
            <button
              onClick={handleSpecificFolderSearch}
              disabled={isSearchingFolder || !isTokenValid || !specificFolderId}
              className={`px-4 py-2 rounded ${
                isSearchingFolder || !isTokenValid || !specificFolderId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
              }`}
            >
              {isSearchingFolder ? 'Searching...' : 'Search Folder'}
            </button>
          </div>
        </div>
        
        <div className="mb-2 text-sm">
          <p>
            Enter a Google Drive folder ID to recursively search all files and folders within it
          </p>
          <p className="text-gray-500 text-xs mt-1">
            This scan will find up to 100 files and folders, skipping shortcuts to other folders
          </p>
        </div>
        
        {/* Search Results */}
        {specificFolderStats && (
          <div className="mt-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
              <h3 className="text-lg font-medium text-blue-800 mb-2">Search Results</h3>
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
                <span className="ml-4 text-green-600 font-medium">
                  ✓ Files automatically added to database
                </span>
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
        
        <button
          onClick={handleNewFolderSync}
          disabled={isNewFolderLoading || !newFolderId || !isTokenValid}
          className={`w-full px-4 py-2 rounded-lg text-white font-medium ${
            isNewFolderLoading || !newFolderId || !isTokenValid
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isNewFolderLoading ? 'Adding New Folder...' : 'Add & Sync New Folder'}
        </button>
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
        
        <button
          onClick={handleExistingFolderSync}
          disabled={isExistingFolderLoading || !existingFolderId || !isTokenValid}
          className={`w-full px-4 py-2 rounded-lg text-white font-medium ${
            isExistingFolderLoading || !existingFolderId || !isTokenValid
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isExistingFolderLoading ? 'Syncing...' : 'Sync Selected Folder'}
        </button>
        
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
        
        <div className="mb-6">
          <GoogleTokenStatus 
            onTokenExpired={handleTokenExpired}
            onStatusChange={handleTokenStatusChange}
            useMockData={false}
          />
        </div>
        
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p>A valid Google token is required to perform sync operations with Google Drive.</p>
          <p>The token typically expires after 1 hour, but it will be automatically refreshed when needed.</p>
          <p>If you're having issues with authentication, try clicking the "Refresh" button above.</p>
        </div>
      </div>
      
      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-medium mb-3">Recent Authentication Events</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-xs overflow-auto" style={{ maxHeight: '200px' }}>
            {/* Display last few token events from localStorage */}
            {(() => {
              try {
                const tokenEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                return tokenEvents.length > 0 
                  ? tokenEvents.map((event: any, i: number) => 
                      `[${new Date(event.timestamp).toLocaleString()}] ${event.type}: ${event.message}`
                    ).join('\n')
                  : 'No recent authentication events.';
              } catch (e) {
                return 'Error loading authentication events.';
              }
            })()}
          </pre>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            // Log token refresh attempt
            const events = JSON.parse(localStorage.getItem('google_token_events') || '[]');
            events.unshift({
              type: 'MANUAL_REFRESH',
              message: 'User requested manual token refresh',
              timestamp: new Date().toISOString()
            });
            localStorage.setItem('google_token_events', JSON.stringify(events.slice(0, 20)));
            
            // Attempt to refresh token
            refreshGoogleToken()
              .then(result => {
                if (result.success) {
                  toast.success('Token refreshed successfully.');
                  
                  // Update events log
                  const updatedEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                  updatedEvents.unshift({
                    type: 'REFRESH_SUCCESS',
                    message: 'Token refreshed successfully',
                    timestamp: new Date().toISOString()
                  });
                  localStorage.setItem('google_token_events', JSON.stringify(updatedEvents.slice(0, 20)));
                } else {
                  toast.error(`Failed to refresh token: ${result.error}`);
                  
                  // Update events log
                  const updatedEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                  updatedEvents.unshift({
                    type: 'REFRESH_ERROR',
                    message: `Failed: ${result.error}`,
                    timestamp: new Date().toISOString()
                  });
                  localStorage.setItem('google_token_events', JSON.stringify(updatedEvents.slice(0, 20)));
                }
              })
              .catch(error => {
                toast.error('Error refreshing token.');
                
                // Update events log
                const updatedEvents = JSON.parse(localStorage.getItem('google_token_events') || '[]');
                updatedEvents.unshift({
                  type: 'REFRESH_EXCEPTION',
                  message: error.message,
                  timestamp: new Date().toISOString()
                });
                localStorage.setItem('google_token_events', JSON.stringify(updatedEvents.slice(0, 20)));
              });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Force Token Refresh
        </button>
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