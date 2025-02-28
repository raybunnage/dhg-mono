import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';

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
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    fetchSyncStats();
  }, [refreshKey]); // Re-fetch when refreshKey changes

  const fetchSyncStats = async () => {
    try {
      setIsLoading(true);
      
      console.log('Fetching sync statistics...');
      
      // Get the most recent sync
      const { data: syncHistory, error: syncError } = await supabase
        .from('sync_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);
        
      if (syncError) {
        console.error('Error fetching sync history:', syncError);
        throw syncError;
      }
      
      console.log('Latest sync history:', syncHistory);
      
      // Get the most recent sync statistics
      const { data: statData, error: statError } = await supabase
        .from('sync_statistics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (statError) {
        console.error('Error fetching sync statistics:', statError);
        // Don't throw here, just log and continue with fallback values
        // This allows the component to still work even if the table doesn't exist
        
        // Check if it's a "table doesn't exist" error
        if (statError.code === '42P01') {
          console.log('The sync_statistics table does not exist yet. Using only document counts.');
          toast.success('Setting up sync statistics. Please run a sync to populate data.');
        }
      }
      
      console.log('Latest sync statistics:', statData);
      
      // Declare variables at function level
      let folderCount = 0;
      let docCount = 0;
      
      // Get document type counts
      const { data: docStats, error: docError } = await supabase
        .rpc('get_document_type_counts');
        
      if (docError) {
        console.error('Error getting document type counts:', docError);
        
        // Check if it's a column ambiguity error
        if (docError.code === '42702' && docError.message.includes('mime_type')) {
          console.warn('Database function needs to be updated. Using fallback values.');
          toast.warning('A database function needs to be updated. Contact administrator.');
          
          // Use fallback values (already initialized above)
          console.log('Using fallback counts - Folders: 0, Documents: 0');
        } else {
          // For other errors, we'll use fallback values but log the error
          console.error('Unexpected error getting document counts:', docError);
        }
      } else {
        // Process docStats normally
        folderCount = docStats?.find(item => item.mime_type === 'application/vnd.google-apps.folder')?.count || 0;
        docCount = (docStats?.reduce((sum, item) => sum + (parseInt(item.count) || 0), 0) || 0) - folderCount;
        console.log('Calculated counts - Folders:', folderCount, 'Documents:', docCount);
      }
      
      // Get MP4 stats directly from the database if not in sync_statistics
      let mp4Count = statData?.[0]?.mp4_files;
      let mp4Size = statData?.[0]?.mp4_total_size;
      
      if (!mp4Count || !mp4Size) {
        console.log('MP4 stats not found in sync_statistics, querying directly...');
        
        const { count, error: mp4Error } = await supabase
          .from('sources_google')
          .select('id', { count: 'exact' })
          .ilike('mime_type', '%mp4%');
        
        if (!mp4Error) {
          mp4Count = count || 0;
        }
        
        // Don't try to calculate size here - it's complex
        mp4Size = '0 GB';
      }
      
      // Get folder details from the most recent sync
      const folderName = syncHistory?.[0]?.folder_name || statData?.[0]?.folder_name || 'Unknown Folder';
      const folderId = syncHistory?.[0]?.folder_id || statData?.[0]?.folder_id || '';

      // Format the data - prefer statistics table but fall back to calculated values
      setSyncStats({
        googleDriveDocuments: statData?.[0]?.google_drive_documents || docCount || 0,
        googleDriveFolders: statData?.[0]?.google_drive_folders || folderCount || 0,
        totalGoogleDriveItems: statData?.[0]?.total_google_drive_items || (docCount + folderCount) || 0,
        localFiles: statData?.[0]?.local_files || syncHistory?.[0]?.processed_items || 0,
        matchingFiles: statData?.[0]?.matching_files || syncHistory?.[0]?.processed_items || 0,
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
      
      console.log('Sync stats updated successfully');
      
    } catch (error) {
      console.error('Error fetching sync stats:', error);
      toast.error('Failed to fetch sync statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 bg-gray-100 rounded-lg animate-pulse">Loading sync statistics...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Sync Statistics</h2>
        <button 
          onClick={() => fetchSyncStats()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Check Sync Status
        </button>
      </div>
      
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
          
          <div className="font-medium mt-2">Folder Name:</div>
          <div>{syncStats.folderName || 'Unknown'}</div>
          
          <div className="font-medium mt-2">Folder ID:</div>
          <div className="font-mono text-xs bg-gray-100 p-1 rounded overflow-auto">
            {syncStats.folderId || 'N/A'}
          </div>
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
            console.log('===== LAST SYNC SUMMARY DEBUG =====');
            console.log('Current syncStats:', syncStats);
            
            // Fetch the most recent sync_statistics record
            supabase
              .from('sync_statistics')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error fetching latest sync_statistics:', error);
                  toast.error('Error fetching sync records');
                } else {
                  console.log('Latest sync_statistics record:', data);
                  if (data && data.length > 0) {
                    const record = data[0];
                    console.log('Record fields:');
                    Object.keys(record).forEach(key => {
                      console.log(`- ${key}: ${record[key]} (type: ${typeof record[key]})`);
                    });
                  } else {
                    console.log('No sync_statistics records found');
                  }
                }
              });
            
            // Check the sync_history table too
            supabase
              .from('sync_history')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(1)
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error fetching latest sync_history:', error);
                } else {
                  console.log('Latest sync_history record:', data);
                }
              });
            
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