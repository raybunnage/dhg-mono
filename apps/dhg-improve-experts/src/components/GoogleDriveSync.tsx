import React, { useState, useEffect } from 'react';
import { getDriveSyncStats, syncWithGoogleDrive, listFilesInFolder, authenticatedFetch } from '@/services/googleDriveService';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';

interface GoogleDriveSyncProps {
  isTokenValid: boolean;
  onSyncComplete?: (result: any) => void;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ 
  isTokenValid, 
  onSyncComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  
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
      toast.loading('Syncing with Google Drive...');
      
      const result = await syncWithGoogleDrive();
      setSyncResult(result);
      
      if (result.synced.errors > 0) {
        toast.error(`Sync completed with ${result.synced.errors} errors`);
      } else {
        toast.success(`Successfully added ${result.synced.added} new files from Google Drive`);
      }
      
      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete(result);
      }
      
      // Refresh stats
      const newStats = await getDriveSyncStats();
      setSyncStats(newStats);
    } catch (error) {
      console.error('Error syncing with Google Drive:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
      toast.dismiss();
    }
  };
  
  const processFolderRecursively = async (folderId: string, path = '') => {
    try {
      // Use our enhanced service with retry logic
      const folderData = await listFilesInFolder(folderId);
      
      // Process the results as before...
      
    } catch (err) {
      console.error(`Error processing folder ${folderId}:`, err);
      
      // If we've exhausted our retries, log it properly
      if (err.message.includes('Authentication failed after token refresh')) {
        setSyncError('Authentication failed. Please reconnect your Google account.');
      } else {
        setSyncError(`Failed to process folder: ${err.message}`);
      }
      
      updateSyncStatus('failed', { error_message: err.message });
    }
  };
  
  return (
    <div className="mt-6 bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Google Drive Sync</h2>
      
      <div className="mb-4 flex space-x-2">
        <button
          onClick={handleSyncCheck}
          disabled={!isTokenValid || isLoading}
          className={`px-4 py-2 rounded ${
            isTokenValid 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Checking...
            </span>
          ) : (
            'Check Sync Status'
          )}
        </button>
        
        {syncStats && syncStats.newFiles.length > 0 && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`px-4 py-2 rounded ${
              isSyncing 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isSyncing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </span>
            ) : (
              `Sync ${syncStats.newFiles.length} New Files`
            )}
          </button>
        )}
      </div>
      
      {/* Stats display */}
      {syncStats && (
        <div className="border rounded p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Sync Statistics</h3>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-blue-500 hover:text-blue-700 text-sm"
            >
              {expanded ? 'Show Less' : 'Show More'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>Google Drive Documents:</div>
            <div>{syncStats.totalGoogleDriveFiles}</div>
            
            <div>Google Drive Folders:</div>
            <div>{syncStats.totalGoogleDriveFolders}</div>
            
            <div>Total Google Drive Items:</div>
            <div>{syncStats.totalGoogleDriveFiles + syncStats.totalGoogleDriveFolders}</div>
            
            <div>Local Files:</div>
            <div>{syncStats.totalLocalFiles}</div>
            
            <div>Matching Files:</div>
            <div>{syncStats.matchingFiles.length}</div>
            
            <div>New Files:</div>
            <div>{syncStats.newFiles.length}</div>
            
            <div>Local-only Files:</div>
            <div>{syncStats.localOnlyFiles.length}</div>
            
            {/* Add MP4 specific stats */}
            <div className="font-medium text-blue-800">MP4 Files:</div>
            <div className="font-medium text-blue-800">{syncStats.totalMP4Files}</div>
            
            <div className="font-medium text-blue-800">Total MP4 Size:</div>
            <div className="font-medium text-blue-800">{syncStats.totalMP4SizeGB} GB</div>
          </div>
          
          {/* Always show new files, they're important */}
          {syncStats.newFiles.length > 0 && (
            <div className="mb-3 bg-yellow-50 p-3 rounded border border-yellow-200">
              <h4 className="font-medium mb-1 text-yellow-800">New Files on Google Drive:</h4>
              <ul className="text-xs bg-white p-2 rounded max-h-40 overflow-y-auto">
                {syncStats.newFiles.map((file: any) => (
                  <li key={file.id} className="mb-1 flex justify-between">
                    <span>{file.name}</span>
                    <span className="text-gray-500">
                      {new Date(file.modifiedTime).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-700 mt-2">
                These files exist in Google Drive but not in your local database.
              </p>
            </div>
          )}
          
          {syncStats.localOnlyFiles.length > 0 && expanded && (
            <div className="mb-3">
              <h4 className="font-medium mb-1">Files Only in Local System:</h4>
              <ul className="text-xs bg-white p-2 rounded max-h-32 overflow-y-auto">
                {syncStats.localOnlyFiles.map((fileName: string) => (
                  <li key={fileName} className="mb-1">{fileName}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Show sync result if available */}
          {syncResult && expanded && (
            <div className="mt-3 border-t pt-3">
              <h4 className="font-medium">Last Sync Result:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div>Files Added:</div>
                <div>{syncResult.synced.added}</div>
                
                <div>Files Updated:</div>
                <div>{syncResult.synced.updated}</div>
                
                <div>Errors:</div>
                <div className={syncResult.synced.errors > 0 ? 'text-red-600' : 'text-green-600'}>
                  {syncResult.synced.errors}
                </div>
                
                <div>Sync ID:</div>
                <div className="text-xs">{syncResult.syncId}</div>
              </div>
            </div>
          )}
          
          {/* Debug information */}
          <div className="mt-3 border-t pt-3">
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              <div className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-60">
                <div><strong>Drive Folder ID:</strong> {import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || 'Not set'}</div>
                <div><strong>Token Status:</strong> {localStorage.getItem('google_access_token') ? 'Present in localStorage' : 'Missing from localStorage'}</div>
                <div><strong>Request Time:</strong> {new Date().toISOString()}</div>
                {syncStats.error && (
                  <div className="text-red-600 mt-1"><strong>Error:</strong> {syncStats.error}</div>
                )}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}; 