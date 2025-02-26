import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { GoogleTokenStatus } from '@/components/GoogleTokenStatus';
import { GoogleDriveSync } from '@/components/GoogleDriveSync';

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
}

// Main Sync component
function Sync() {
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
  const [newFolderId, setNewFolderId] = useState('');
  const [existingFolderId, setExistingFolderId] = useState('');
  const [folderOptions, setFolderOptions] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [documentStats, setDocumentStats] = useState<DocumentTypeStats[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<{
    id: string;
    folder_id: string;
    folder_name: string;
    timestamp: string;
    status: string;
    items_processed: number;
  }[]>([]);
  const [isTokenValid, setIsTokenValid] = useState<boolean>(false);

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

    // Load sync history
    async function fetchSyncHistory() {
      try {
        const { data, error } = await supabase
          .from('sync_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (error) throw error;
        
        if (data) {
          setSyncHistory(data.map(item => ({
            id: item.id,
            folder_id: item.folder_id,
            folder_name: item.folder_name || 'Unknown Folder',
            timestamp: new Date(item.created_at).toLocaleString(),
            status: item.status,
            items_processed: item.items_processed || 0
          })));
        }
      } catch (err) {
        console.error('Error fetching sync history:', err);
      }
    }

    fetchSyncHistory();
  }, []);

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
      // This would call a backend function to start the sync process
      const { data, error } = await supabase.functions.invoke('sync-google-folder', {
        body: { 
          folderId: newFolderId,
          isNew: true 
        }
      });
      
      if (error) throw error;
      
      // Mock progress updates - in a real implementation, you'd use websockets or polling
      simulateProgressUpdates();
      
      toast.success('Sync process started successfully');
      
      // Fetch updated stats once sync is complete
      fetchDocumentStats(newFolderId);
      
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error('Failed to start sync process');
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
      // This would call a backend function to start the sync process
      const { data, error } = await supabase.functions.invoke('sync-google-folder', {
        body: { 
          folderId: existingFolderId,
          isNew: false 
        }
      });
      
      if (error) throw error;
      
      // Mock progress updates - in a real implementation, you'd use websockets or polling
      simulateProgressUpdates();
      
      toast.success('Sync process started successfully');
      
      // Fetch updated stats once sync is complete
      fetchDocumentStats(existingFolderId);
      
    } catch (err) {
      console.error('Error starting sync:', err);
      toast.error('Failed to start sync process');
      setIsLoading(false);
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

  // Tab switching
  const renderTabContent = () => {
    if (activeTab === 'new') {
      return (
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
          
          <button
            onClick={handleNewFolderSync}
            disabled={isLoading || !newFolderId}
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              isLoading || !newFolderId 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isLoading ? 'Syncing...' : 'Start Sync'}
          </button>
        </div>
      );
    } else {
      return (
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
            disabled={isLoading || !existingFolderId}
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              isLoading || !existingFolderId 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isLoading ? 'Syncing...' : 'Update Files'}
          </button>
        </div>
      );
    }
  };

  // Update token status when GoogleTokenStatus reports changes
  const handleTokenStatusChange = (isValid: boolean) => {
    console.log('Token status changed:', isValid);
    setIsTokenValid(isValid);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Google Drive Sync</h1>
      
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Google Authentication</h2>
        <GoogleTokenStatus 
          onTokenExpired={handleTokenExpired}
          onStatusChange={handleTokenStatusChange}
          useMockData={false}
        />
      </div>
      
      <GoogleDriveSync isTokenValid={isTokenValid} />
      
      {/* Tabs */}
      <div className="flex mb-6">
        <button
          className={`px-4 py-2 font-medium rounded-tl-lg rounded-bl-lg ${
            activeTab === 'new' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab('new')}
        >
          New Folder
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-tr-lg rounded-br-lg ${
            activeTab === 'existing' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          onClick={() => setActiveTab('existing')}
        >
          Existing Folder
        </button>
      </div>
      
      {/* Tab content */}
      {renderTabContent()}
      
      {/* Progress indicator */}
      {isLoading && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
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
        <div className="mt-8 bg-white rounded-lg shadow p-6">
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
      
      {/* Document type statistics */}
      {documentStats.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Document Type Statistics</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left">Document Type</th>
                  <th className="py-3 px-4 text-right">Count</th>
                  <th className="py-3 px-4">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documentStats.map((stat, index) => (
                  <tr key={index}>
                    <td className="py-3 px-4">{stat.document_type || 'Unclassified'}</td>
                    <td className="py-3 px-4 text-right">{stat.count}</td>
                    <td className="py-3 px-4">
                      <div className="w-full h-4 bg-gray-200 rounded-full">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ 
                            width: `${(stat.count / documentStats.reduce((acc, s) => acc + s.count, 0)) * 100}%` 
                          }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Sync history */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Sync History</h3>
        
        {syncHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-4 text-left">Folder</th>
                  <th className="py-3 px-4 text-left">Time</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-right">Items Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {syncHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 px-4">{item.folder_name}</td>
                    <td className="py-3 px-4">{item.timestamp}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.status === 'completed' ? 'bg-green-100 text-green-800' :
                        item.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{item.items_processed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No sync history available</p>
        )}
      </div>
    </div>
  );
}

export default Sync; 