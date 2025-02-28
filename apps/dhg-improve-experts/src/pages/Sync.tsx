import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { GoogleTokenStatus } from '@/components/GoogleTokenStatus';
import DatabaseInspector from '@/components/DatabaseInspector';
import { createTestSyncHistoryEntry, storeLatestSyncResult } from '@/services/syncHistoryService';
import { LastSyncSummary } from '@/components/LastSyncSummary';
import DebugSyncHistory from '@/components/DebugSyncHistory';
import GoogleDriveDebug from '@/components/GoogleDriveDebug';
import { BatchManager } from '@/components/BatchManager';
import { BatchProcessingMonitor } from '@/components/BatchProcessingMonitor';
import { getDriveSyncStats, syncWithGoogleDrive, listFilesInFolder, authenticatedFetch, insertGoogleFiles } from '@/services/googleDriveService';

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

// Update the sync history interface to match our database
interface SyncHistoryItem {
  id: string;
  folder_id: string;
  folder_name: string;
  timestamp: string;
  completed_at: string | null;
  status: string;
  processed_items: number; // Changed from items_processed to processed_items
  error_message: string | null;
}

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'folders' | 'batches' | 'history' | 'inspector'>('dashboard');
  const [newFolderId, setNewFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [existingFolderId, setExistingFolderId] = useState('');
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncSummaryKey, setSyncSummaryKey] = useState(`sync-${Date.now()}`);
  const [documentStats, setDocumentStats] = useState<DocumentTypeStats[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
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

  // File processing refs
  const syncingRef = useRef<boolean>(false);
  const extractionRef = useRef<boolean>(false);

  // Check if the sync_statistics table has the required structure
  useEffect(() => {
    const checkAndUpdateSyncStatisticsTable = async () => {
      try {
        console.log('Checking if sync_statistics table needs updating...');
        
        // Try to fetch one record to check if table exists
        const { data, error } = await supabase
          .from('sync_statistics')
          .select('*')
          .limit(1);
        
        // If there's an error other than "relation does not exist", log it
        if (error && !error.message.includes('relation "sync_statistics" does not exist')) {
          console.error('Error checking sync_statistics table:', error);
        }
        
        // Check if google_drive_documents column exists in the first record
        // If the table exists but that column doesn't, we need to add it
        if (data && data.length > 0 && !('google_drive_documents' in data[0])) {
          console.log('Sync statistics table exists but needs to be updated with new columns');
          toast.success('Your sync statistics table needs to be updated. Please contact the administrator.');
        }
      } catch (e) {
        console.error('Error in checkAndUpdateSyncStatisticsTable:', e);
      }
    };
    
    checkAndUpdateSyncStatisticsTable();
  }, []);

  // Handle token expiration
  const handleTokenExpired = () => {
    setIsTokenValid(false);
    if (isLoading) {
      setIsLoading(false);
      toast.error('Google authentication expired during sync operation');
    }
  };

  // Fetch existing root folders on component mount
  useEffect(() => {
    async function fetchRootFolders() {
      try {
        const { data, error } = await supabase
          .from('sources_google')
          .select('id, name, drive_id')
          .is('parent_path', null)
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .order('name');
          
        if (error) throw error;
        
        if (data) {
          setFolderOptions(data.map(folder => ({
            id: folder.drive_id || folder.id,
            name: folder.name
          })));
        }
      } catch (err) {
        console.error('Error fetching root folders:', err);
        toast.error('Failed to load existing folders');
      }
    }

    fetchRootFolders();
    fetchSyncHistory();
    fetchFileStats();
  }, []);

  // Handle token status change from GoogleTokenStatus
  const handleTokenStatusChange = (isValid: boolean) => {
    console.log('Token status changed:', isValid);
    setIsTokenValid(isValid);
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

  // Fetch sync history
  const fetchSyncHistory = async () => {
    try {
      console.log('Fetching sync history...');
      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);
        
      if (error) {
        console.error('Error fetching sync history:', error);
        throw error;
      }
      
      console.log('Sync history retrieved:', data?.length || 0, 'records');
      setSyncHistory(data || []);
    } catch (err) {
      console.error('Error fetching sync history:', err);
      toast.error('Failed to load sync history');
    }
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
    
    setIsLoading(true);
    setSyncProgress(0);
    
    try {
      // Store the original folder ID from environment
      const originalFolderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      const folderDisplayName = newFolderName || 'New Folder';
      
      // Temporarily override the folder ID for syncing
      // Since we can't modify env vars at runtime, use localStorage
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
        
        // Store the result
        await storeLatestSyncResult(result);
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
        
        // Mock progress updates for visual feedback
        simulateProgressUpdates();
        
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
      
      setIsLoading(false);
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
    
    setIsLoading(true);
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
          setIsLoading(false);
          toast.success('Folder is already in sync! No new files to add.');
        }
      }, 1000);
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error('Failed to start sync process');
      setIsLoading(false);
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
      
      // Check if token is available and log it
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        console.error('No token in localStorage when trying to sync');
        toast.error('Token not found in localStorage. Try refreshing the token.');
        setIsLoading(false);
        return;
      }
      
      console.log('Token before sync check (first 10 chars):', token.substring(0, 10) + '...');
      
      const stats = await getDriveSyncStats();
      setSyncStats(stats);
      
      if (stats.isValid) {
        toast.success('Successfully checked sync status');
        // Force refresh the sync summary after checking sync status
        setSyncSummaryKey(`sync-${Date.now()}`);
      } else {
        toast.error(`Failed to check sync status: ${stats.error}`);
      }
    } catch (error) {
      console.error('Error checking sync:', error);
      toast.error(`Error checking sync: ${error.message}`);
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
    
    try {
      setIsSyncing(true);
      syncingRef.current = true;
      toast.loading('Syncing with Google Drive...');
      
      const result = await syncWithGoogleDrive();
      setSyncResult(result);
      
      // Store the result both in service and locally
      await storeLatestSyncResult(result);
      await storeLocalSyncResult(result);
      
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
      const newStats = await getDriveSyncStats();
      setSyncStats(newStats);
      fetchFileStats();
      
      // Force refresh the sync summary
      setSyncSummaryKey(`sync-${Date.now()}`);
    } catch (error) {
      console.error('Error syncing with Google Drive:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
      toast.dismiss();
    }
  };

  // Handle sync complete
  const handleSyncComplete = async (result: any) => {
    // Refresh sync history
    fetchSyncHistory();
    
    // Update stats display
    setSyncStats({
      total: result.stats?.totalGoogleDriveFiles || 0,
      new: result.synced?.added || 0,
      updated: result.synced?.updated || 0,
      deleted: 0,
      errors: result.synced?.errors || 0
    });

    // Get the folder name from the result object or use a default
    const folderId = result.folderId || existingFolderId;
    const folderName = result.folderName || await getFolderName(folderId);
    
    // Update sync statistics with proper folder name
    await updateSyncStats(folderId, folderName, result);
    
    // Force refresh the LastSyncSummary component
    console.log('Sync complete, statistics updated');
    setSyncSummaryKey(`sync-${Date.now()}`); // This will trigger a re-fetch in LastSyncSummary
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

  // View sync details
  const viewSyncDetails = async (syncId: string) => {
    try {
      // Fetch files related to this sync operation
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('sync_id', syncId)
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      // For now, just show a toast with the count
      toast.success(`Found ${data?.length || 0} files from this sync operation`);
    } catch (err) {
      console.error('Error fetching sync details:', err);
      toast.error('Failed to load sync details');
    }
  };

  // Rerun sync
  const rerunSync = (folderId: string) => {
    // Set the folder ID and switch to folders tab
    setExistingFolderId(folderId);
    setActiveTab('folders');
    
    // Scroll to the form
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    toast.success('Ready to re-sync folder. Click "Sync Existing Folder" to begin.');
  };

  // Debug function to check sync_statistics table structure
  const checkSyncStatisticsStructure = async (): Promise<void> => {
    try {
      console.log('===== CHECKING SYNC_STATISTICS TABLE STRUCTURE =====');
      try {
        const { data, error } = await supabase.rpc('show_table_structure', {
          table_name: 'sync_statistics'
        });
        
        if (error) {
          console.error('Error checking table structure:', error);
          return;
        }
        
        console.log('Table structure:', data);
      } catch (err) {
        console.error('RPC show_table_structure failed:', err);
        // Continue execution even if this fails
      }
      
      // Check most recent entry
      try {
        const { data: recentData, error: recentError } = await supabase
          .from('sync_statistics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (recentError) {
          console.error('Error checking recent records:', recentError);
          return;
        }
        
        console.log('Most recent sync_statistics record:', recentData);
      } catch (err) {
        console.error('Error fetching recent sync_statistics:', err);
      }
      
    } catch (e) {
      console.error('Error in checkSyncStatisticsStructure:', e);
      // Don't let this error block the sync process
    }
  };

  // Update sync statistics with improved error handling and typing
  const updateSyncStats = async (
    folderId: string, 
    folderName: string, 
    result: SyncResult
  ): Promise<boolean> => {
    console.log('=============================================');
    console.log('UPDATING SYNC STATISTICS - DETAILED DEBUG LOG');
    console.log('=============================================');
    console.log('Folder ID:', folderId);
    console.log('Folder Name:', folderName);
    console.log('Full result object:', JSON.stringify(result, null, 2));

    // Check table structure before proceeding
    try {
      await checkSyncStatisticsStructure();
    } catch (e) {
      console.error('Failed to check table structure, but continuing:', e);
    }
    
    try {
      // Get document type counts
      console.log('Calling get_document_type_counts RPC...');
      const { data: docStats, error: docError } = await supabase
        .rpc('get_document_type_counts');
        
      if (docError) {
        console.error('Error getting document type counts:', docError);
        throw docError;
      }
      
      if (!docStats || !Array.isArray(docStats)) {
        console.error('Invalid document stats data:', docStats);
        throw new Error('Invalid document stats data');
      }
      
      console.log('Document stats (raw):', JSON.stringify(docStats, null, 2));
      
      // Calculate folder count and document count
      const folderCount = docStats.find(item => item.mime_type === 'application/vnd.google-apps.folder')?.count || 0;
      const docCount = (docStats.reduce((sum, item) => sum + (parseInt(item.count) || 0), 0) || 0) - folderCount;
      
      console.log('Calculated counts:');
      console.log('- Folders:', folderCount);
      console.log('- Documents:', docCount);
      console.log('- Total Items:', docCount + folderCount);
      
      // Get MP4 stats
      console.log('Querying MP4 files...');
      const { count: mp4Count, error: mp4CountError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact' })
        .ilike('mime_type', '%mp4%');
      
      if (mp4CountError) {
        console.error('Error getting MP4 count:', mp4CountError);
        throw mp4CountError;
      }
      
      console.log('MP4 count:', mp4Count);
      
      // Calculate MP4 size
      console.log('Fetching MP4 size data...');
      const { data: mp4Data, error: mp4DataError } = await supabase
        .from('sources_google')
        .select('size, name')
        .ilike('mime_type', '%mp4%')
        .order('size', { ascending: false });
        
      if (mp4DataError) {
        console.error('Error getting MP4 data:', mp4DataError);
        throw mp4DataError;
      }
      
      if (!mp4Data) {
        console.warn('No MP4 data returned');
      }
      
      console.log('MP4 files found:', mp4Data?.length || 0);
      
      if (mp4Data && mp4Data.length > 0) {
        console.log('Sample MP4 files:');
        mp4Data.slice(0, 3).forEach((file, i) => {
          console.log(`  ${i+1}. ${file.name} - Size: ${file.size || 'unknown'}`);
        });
      }
      
      // Calculate total size in GB
      let totalMp4Size = '0 GB';
      let totalBytes = 0;
      
      try {
        console.log('Calculating total MP4 size...');
        
        // Check if size exists and log data types
        if (mp4Data && mp4Data.length > 0) {
          console.log('First MP4 file size:', mp4Data[0].size);
          console.log('Size data type:', typeof mp4Data[0].size);
          
          const sizeSamples = mp4Data.slice(0, 5).map(f => f.size);
          console.log('Sample sizes:', sizeSamples);
          
          // Try to parse each size
          totalBytes = mp4Data.reduce((sum, file) => {
            let fileSize = 0;
            
            try {
              if (file.size) {
                // Handle string or number
                fileSize = typeof file.size === 'number' ? file.size : parseInt(file.size);
                if (isNaN(fileSize)) {
                  console.warn(`Could not parse size for ${file.name}: ${file.size}`);
                  fileSize = 0;
                }
              }
            } catch (e) {
              console.warn(`Error parsing size for ${file.name}:`, e);
            }
            
            return sum + fileSize;
          }, 0);
          
          console.log('Total bytes calculated:', totalBytes);
          
          if (totalBytes > 0) {
            const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
            totalMp4Size = `${totalGB} GB`;
            console.log('Total MP4 size in GB:', totalMp4Size);
          }
        } else {
          console.log('No MP4 files with size data found');
        }
      } catch (e) {
        console.error('Error calculating MP4 size:', e);
        // Continue execution even if size calculation fails
      }
      
      // Calculate total files
      console.log('Calculating file counts from result object...');
      console.log('- result.totalItems:', result.totalItems);
      console.log('- result.stats?.totalGoogleDriveFiles:', result.stats?.totalGoogleDriveFiles);
      console.log('- docCount + folderCount:', docCount + folderCount);
      
      console.log('Calculating processed items...');
      console.log('- result.itemsAdded:', result.itemsAdded);
      console.log('- result.synced?.processed:', result.synced?.processed);
      
      const totalItems = result.totalItems || result.stats?.totalGoogleDriveFiles || (docCount + folderCount);
      const processedItems = result.itemsAdded || result.synced?.processed || 0;
      const newFiles = result.synced?.added || 0;
      
      console.log('Final calculated values:');
      console.log('- Total items:', totalItems);
      console.log('- Processed items:', processedItems);
      console.log('- New files:', newFiles);
      console.log('- Local-only files:', Math.max(0, totalItems - processedItems));
      
      // Insert into sync_statistics
      console.log('Preparing to insert sync statistics record...');
      const recordToInsert = {
        folder_id: folderId,
        folder_name: folderName,
        local_files: totalItems,
        matching_files: processedItems,
        new_files: newFiles,
        local_only_files: Math.max(0, totalItems - processedItems),
        mp4_files: mp4Count || 0,
        mp4_total_size: totalMp4Size,
        google_drive_documents: docCount,
        google_drive_folders: folderCount,
        total_google_drive_items: docCount + folderCount
      };
      
      console.log('Record to insert:', recordToInsert);
      
      const { data: statsData, error: statsError } = await supabase
        .from('sync_statistics')
        .insert(recordToInsert)
        .select();
        
      if (statsError) {
        console.error('Error inserting sync statistics:', statsError);
        throw statsError;
      }
      
      console.log('Sync statistics saved successfully. New record:', statsData);
      
      // Force a refresh of the statistics display
      toast.success('Sync statistics updated');
      
      // Check most recent entry
      const { data: recentData, error: recentError } = await supabase
        .from('sync_statistics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (recentError) {
        console.error('Error checking recent records after insert:', recentError);
      } else {
        console.log('Verified most recent sync_statistics record:', recentData);
      }
      
      console.log('=============================================');
      console.log('SYNC STATISTICS UPDATE COMPLETE');
      console.log('=============================================');
      
      return true;
    } catch (error) {
      console.error('Error updating sync statistics:', error);
      console.error('Error details:', error.message);
      if (error.stack) console.error('Stack trace:', error.stack);
      toast.error('Failed to update sync statistics');
      return false;
    }
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
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Google Authentication</h2>
          <GoogleTokenStatus 
            onTokenExpired={handleTokenExpired}
            onStatusChange={handleTokenStatusChange}
            useMockData={false}
          />
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleSyncCheck}
              disabled={!isTokenValid || isLoading}
              className={`px-4 py-2 rounded ${
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
                className={`px-4 py-2 rounded ${
                  isSyncing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isSyncing ? 'Syncing...' : `Sync ${syncStats.newFiles.length} New Files`}
              </button>
            )}
          </div>
        </div>
        
        <div>
          <LastSyncSummary refreshKey={syncSummaryKey} />
        </div>
      </div>
      
      {/* Recent Sync History */}
      {syncHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Recent Sync Operations</h3>
            <button
              onClick={fetchSyncHistory}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
            >
              <span>🔄</span> Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Files
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncHistory.slice(0, 5).map((sync) => {
                  // Calculate duration if completed
                  const startDate = new Date(sync.timestamp);
                  const endDate = sync.completed_at ? new Date(sync.completed_at) : null;
                  const duration = endDate ? ((endDate.getTime() - startDate.getTime()) / 1000).toFixed(1) + 's' : 'In progress';
                  
                  return (
                    <tr key={sync.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sync.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sync.folder_name || 'Unknown folder'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${sync.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            sync.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            sync.status === 'completed_with_errors' ? 'bg-yellow-100 text-yellow-800' :
                            sync.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {sync.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sync.processed_items || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button 
                          onClick={() => viewSyncDetails(sync.id)}
                          className="text-indigo-600 hover:text-indigo-900 mr-2"
                        >
                          View
                        </button>
                        {sync.status !== 'in_progress' && sync.folder_id && (
                          <button 
                            onClick={() => rerunSync(sync.folder_id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Re-sync
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {syncHistory.length > 5 && (
            <div className="text-center mt-4">
              <button
                onClick={() => setActiveTab('history')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View All Sync History
              </button>
            </div>
          )}
        </div>
      )}
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Batch Processing</h2>
        <BatchManager />
      </div>
    </div>
  );

  // Render folders view
  const renderFolders = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          disabled={isLoading || !newFolderId || !isTokenValid}
          className={`px-4 py-2 rounded-lg text-white font-medium ${
            isLoading || !newFolderId || !isTokenValid
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLoading ? 'Syncing...' : 'Sync New Folder'}
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Update Existing Folder</h2>
        <p className="text-gray-600 mb-4">
          Sync an existing folder to update file records, add new files, and mark deleted ones.
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
            disabled={isLoading}
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
          disabled={isLoading || !existingFolderId || !isTokenValid}
          className={`px-4 py-2 rounded-lg text-white font-medium ${
            isLoading || !existingFolderId || !isTokenValid
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isLoading ? 'Syncing...' : 'Sync Existing Folder'}
        </button>
      </div>
      
      {/* Progress indicator */}
      {isLoading && (
        <div className="col-span-1 md:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Sync Progress</h3>
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
        <h3 className="text-lg font-semibold mb-4">Managed Folders</h3>
        
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {folderOptions.map((folder) => (
                  <tr key={folder.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {folder.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {folder.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button 
                        onClick={() => {
                          setExistingFolderId(folder.id);
                          toast.success(`Selected "${folder.name}" for sync`);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-2"
                      >
                        Select for Sync
                      </button>
                    </td>
                  </tr>
                ))}
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Sync History</h3>
        <button
          onClick={fetchSyncHistory}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
        >
          <span>🔄</span> Refresh
        </button>
      </div>
      
      {syncHistory.length === 0 ? (
        <p className="text-gray-500">No sync history found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Folder
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Files Processed
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {syncHistory.map((sync) => {
                // Calculate duration if completed
                const startDate = new Date(sync.timestamp);
                const endDate = sync.completed_at ? new Date(sync.completed_at) : null;
                const duration = endDate ? ((endDate.getTime() - startDate.getTime()) / 1000).toFixed(1) + 's' : 'In progress';
                
                return (
                  <tr key={sync.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sync.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sync.folder_name || 'Unknown folder'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${sync.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          sync.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          sync.status === 'completed_with_errors' ? 'bg-yellow-100 text-yellow-800' :
                          sync.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {sync.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.processed_items || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button 
                        onClick={() => viewSyncDetails(sync.id)}
                        className="text-indigo-600 hover:text-indigo-900 mr-2"
                      >
                        View Details
                      </button>
                      {sync.status !== 'in_progress' && sync.folder_id && (
                        <button 
                          onClick={() => rerunSync(sync.folder_id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Re-sync
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
      case 'history':
        return renderHistory();
      case 'inspector':
        return <DatabaseInspector />;
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
            onClick={() => setActiveTab('history')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'history'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sync History
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
              activeTab === 'inspector'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Database Inspector
          </button>
        </nav>
      </div>
      
      {/* Render content based on active tab */}
      {renderTabContent()}
    </div>
  );
}

export default Sync;