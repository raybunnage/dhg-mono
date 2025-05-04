import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';

interface FolderOption {
  id: string;
  name: string;
}

interface LastSyncSummaryProps {
  refreshKey?: string; // Optional prop to force refresh
}

export function LastSyncSummary({ refreshKey }: LastSyncSummaryProps) {
  const [syncStats, setSyncStats] = useState({
    googleDriveDocuments: 0,
    googleDriveFolders: 0,
    totalGoogleDriveItems: 0,
    localFiles: 0,
    matchingFiles: 0,
    newFiles: 0,
    localOnlyFiles: 0,
    mp4Files: 0,
    totalMp4Size: '0 GB',
    lastSyncTime: null,
    lastSyncFolder: '',
    folderId: '',
    folderName: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);

  // Fetch available folders on component mount and refresh
  useEffect(() => {
    fetchFolders();
    fetchSyncStats();
  }, [refreshKey]); // Re-fetch when refreshKey changes

  // Fetch available folders
  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, drive_id')
        .is('parent_path', null)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .order('name');
        
      if (error) throw error;
      
      if (data) {
        const folders = data.map(folder => ({
          id: folder.drive_id || folder.id,
          name: folder.name
        }));
        
        setFolderOptions(folders);
        
        // If no folder is selected yet and we have sync history, select the most recently synced folder
        if (!selectedFolderId) {
          const { data: syncHistory } = await supabase
            .from('sync_history')
            .select('folder_id, folder_name')
            .order('timestamp', { ascending: false })
            .limit(1);
            
          if (syncHistory && syncHistory.length > 0 && syncHistory[0].folder_id) {
            setSelectedFolderId(syncHistory[0].folder_id);
          } else if (folders.length > 0) {
            // If no sync history, select the first folder
            setSelectedFolderId(folders[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  // Fetch sync stats, optionally for a specific folder
  const fetchSyncStats = async (folderId2?: string) => {
    try {
      setIsLoading(true);
      
      // Use the provided folder ID or fall back to the selected one
      const targetFolderId = folderId2 !== undefined ? folderId2 : selectedFolderId;
      
      // Get the most recent sync for the selected folder
      const syncQuery = supabase
        .from('sync_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);
        
      // If a specific folder is selected, filter by it
      if (targetFolderId) {
        syncQuery.eq('folder_id', targetFolderId);
      }
      
      const { data: syncHistory, error: syncError } = await syncQuery;
      
      if (syncError) {
        console.error('Error fetching sync history:', syncError);
        throw syncError;
      }
      
      // Try to get sync statistics but handle gracefully if table doesn't exist
      let statData = null;
      try {
        const statQuery = supabase
          .from('sync_statistics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
          
        // If a specific folder is selected, filter by it
        if (targetFolderId) {
          statQuery.eq('folder_id', targetFolderId);
        }
        
        const { data, error: statError } = await statQuery;
        
        if (!statError) {
          statData = data;
        }
      } catch (e) {
        // Silent catch - table might not exist
      }
      
      // Declare variables at function level
      let folderCount = 0;
      let docCount = 0;
      
      // Instead of using RPC which might not exist, query directly
      try {
        let folderQuery = supabase
          .from('sources_google')
          .select('id', { count: 'exact' })
          .eq('mime_type', 'application/vnd.google-apps.folder');
          
        // If a specific folder is selected, filter by parent_folder_id
        if (targetFolderId) {
          folderQuery.eq('parent_folder_id', targetFolderId);
        }
        
        const { count: folderCountResult } = await folderQuery;
        folderCount = folderCountResult || 0;
        
        // Count non-folder documents (total - folders)
        let totalQuery = supabase
          .from('sources_google')
          .select('id', { count: 'exact' });
          
        // If a specific folder is selected, filter by parent_folder_id
        if (targetFolderId) {
          totalQuery.eq('parent_folder_id', targetFolderId);
        }
        
        const { count: totalCountResult } = await totalQuery;
        const totalCount = totalCountResult || 0;
        docCount = totalCount - folderCount;
        
      } catch (countError) {
        // Silent fail
      }
      
      // Get MP4 stats directly from the database if not in sync_statistics
      let mp4Count = statData?.[0]?.mp4_files;
      let mp4Size = statData?.[0]?.mp4_total_size;
      
      if (!mp4Count || !mp4Size) {
        try {
          let mp4Query = supabase
            .from('sources_google')
            .select('id', { count: 'exact' })
            .ilike('mime_type', '%mp4%');
            
          // If a specific folder is selected, filter by parent_folder_id
          if (targetFolderId) {
            mp4Query.eq('parent_folder_id', targetFolderId);
          }
          
          const { count } = await mp4Query;
          
          mp4Count = count || 0;
          mp4Size = '0 GB';
        } catch (e) {
          mp4Count = 0;
          mp4Size = '0 GB';
        }
      }
      
      // Get folder details from the most recent sync
      const folderName = syncHistory?.[0]?.folder_name || statData?.[0]?.folder_name || 'Unknown Folder';
      const folderId = syncHistory?.[0]?.folder_id || statData?.[0]?.folder_id || targetFolderId || '';

      // If we have a folder ID but no selected folder ID, update the selected folder
      if (folderId && !selectedFolderId) {
        setSelectedFolderId(folderId);
      }

      // Format the data - prefer statistics table but fall back to calculated values
      // Use field names that match the actual database schema
      setSyncStats({
        googleDriveDocuments: statData?.[0]?.google_drive_documents || docCount || 0,
        googleDriveFolders: statData?.[0]?.google_drive_folders || folderCount || 0,
        totalGoogleDriveItems: statData?.[0]?.total_google_drive_items || (docCount + folderCount) || 0,
        localFiles: statData?.[0]?.local_files || syncHistory?.[0]?.files_processed || 0,
        matchingFiles: statData?.[0]?.matching_files || syncHistory?.[0]?.files_processed || 0,
        newFiles: statData?.[0]?.new_files || 0,
        localOnlyFiles: statData?.[0]?.local_only_files || 0,
        mp4Files: mp4Count || 0,
        totalMp4Size: mp4Size || '0 GB',
        lastSyncTime: syncHistory?.[0]?.timestamp 
          ? new Date(syncHistory[0].timestamp).toLocaleString() 
          : 'Never',
        lastSyncFolder: syncHistory?.[0]?.folder_name || statData?.[0]?.folder_name || '',
        folderId: folderId,
        folderName: folderName
      });
      
      console.log('Sync stats updated successfully for folder:', folderName);
      
    } catch (error) {
      console.error('Error fetching sync stats:', error);
      toast.error('Failed to fetch sync statistics');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle folder selection change
  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFolderId = e.target.value;
    setSelectedFolderId(newFolderId);
    fetchSyncStats(newFolderId);
  };

  if (isLoading) {
    return <div className="p-4 bg-gray-100 rounded-lg animate-pulse">Loading sync statistics...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h2 className="text-lg font-semibold">Sync Statistics</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Folder selector */}
          <div className="relative">
            <select
              value={selectedFolderId}
              onChange={handleFolderChange}
              className="border rounded-lg px-3 py-2 pr-8 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Folders</option>
              {folderOptions.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={() => fetchSyncStats(selectedFolderId)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Check Sync Status
          </button>
        </div>
      </div>
      
      {/* Current folder indicator */}
      {selectedFolderId && (
        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="flex items-center gap-2">
            <span className="text-blue-800 font-medium">Current Folder:</span>
            <span className="text-blue-700">{syncStats.folderName || 'Unknown'}</span>
            {/* Folder ID shown in smaller text */}
            <span className="text-blue-500 text-xs ml-2">
              (ID: {selectedFolderId.substring(0, 8)}...)
            </span>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="font-medium">Google Drive Documents:</div>
        <div>{syncStats.googleDriveDocuments}</div>
        
        <div className="font-medium">Google Drive Folders:</div>
        <div>{syncStats.googleDriveFolders}</div>
        
        <div className="font-medium">Total Google Drive Items:</div>
        <div>{syncStats.totalGoogleDriveItems}</div>
        
        <div className="font-medium">Local Files:</div>
        <div>{syncStats.localFiles}</div>
        
        <div className="font-medium">Matching Files:</div>
        <div>{syncStats.matchingFiles}</div>
        
        <div className="font-medium">New Files:</div>
        <div>{syncStats.newFiles}</div>
        
        <div className="font-medium">Local-only Files:</div>
        <div>{syncStats.localOnlyFiles}</div>
        
        <div className="font-medium text-blue-600">MP4 Files:</div>
        <div className="text-blue-600">{syncStats.mp4Files}</div>
        
        <div className="font-medium text-blue-600">Total MP4 Size:</div>
        <div className="text-blue-600">{syncStats.totalMp4Size}</div>
        
        <div className="col-span-2 mt-4 pt-4 border-t">
          <div className="font-medium">Last Sync: </div>
          <div>{syncStats.lastSyncTime}</div>
        </div>
      </div>
      
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">Debug Information</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(syncStats, null, 2)}
        </pre>
      </details>
      
      <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => {
            // Simple debug info without potentially erroring calls
            console.log('===== LAST SYNC SUMMARY DEBUG =====');
            console.log('Current syncStats:', syncStats);
            console.log('Selected folder ID:', selectedFolderId);
            
            // Safely check sync_history - this table should always exist
            supabase
              .from('sync_history')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(1)
              .then(({ data, error }) => {
                if (!error && data) {
                  console.log('Latest sync_history record:', data);
                }
              })
              .catch(() => {});
            
            toast.success('Debug info logged to console');
          }}
          className="text-xs bg-gray-200 px-2 py-1 rounded"
        >
          Debug Sync Stats
        </button>
      </div>
    </div>
  );
} 