import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { 
  FolderOpen, 
  FileText, 
  Film,
  RefreshCw,
  Calendar,
  TrendingUp
} from 'lucide-react';

interface SyncStatistics {
  id: string;
  folder_id: string;
  folder_name: string;
  root_drive_id: string | null;
  google_drive_count: number;
  google_drive_documents: number;
  google_drive_folders: number;
  mp4_files: number;
  mp4_total_size: string;
  new_files: number;
  total_google_drive_items: number;
  updated_at: string;
}

interface AggregatedStats {
  totalFolders: number;
  totalFiles: number;
  totalDocuments: number;
  totalSubfolders: number;
  totalMp4Files: number;
  totalMp4Size: number;
  totalNewFiles: number;
  lastUpdated: string | null;
}

interface FilterProfile {
  id: string;
  name: string;
  is_active: boolean;
}

interface FilterProfileDrive {
  id: string;
  profile_id: string;
  root_drive_id: string;
  profile?: FilterProfile;
}

export const Statistics: React.FC = () => {
  const [statistics, setStatistics] = useState<SyncStatistics[]>([]);
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats>({
    totalFolders: 0,
    totalFiles: 0,
    totalDocuments: 0,
    totalSubfolders: 0,
    totalMp4Files: 0,
    totalMp4Size: 0,
    totalNewFiles: 0,
    lastUpdated: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profileDrives, setProfileDrives] = useState<FilterProfileDrive[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState<FilterProfile[]>([]);

  useEffect(() => {
    fetchFilterProfiles();
  }, []);

  useEffect(() => {
    if (selectedDriveId) {
      fetchStatistics();
    }
  }, [selectedDriveId]);

  const fetchFilterProfiles = async () => {
    try {
      // Fetch all filter profiles with their drives
      const { data: profiles, error: profilesError } = await supabase
        .from('filter_user_profiles')
        .select('*')
        .order('name');

      if (profilesError) throw profilesError;

      if (profiles) {
        setAllProfiles(profiles);
        
        // Fetch all drives with their profile relationships
        const { data: drives, error: drivesError } = await supabase
          .from('filter_user_profile_drives')
          .select('*');

        if (drivesError) throw drivesError;

        if (drives && drives.length > 0) {
          // Attach profile information to each drive
          const drivesWithProfiles = drives.map(drive => ({
            ...drive,
            profile: profiles.find(p => p.id === drive.profile_id)
          }));
          
          setProfileDrives(drivesWithProfiles);
          
          // Set the active profile's drive as selected by default
          const activeProfile = profiles.find(p => p.is_active);
          if (activeProfile) {
            const activeDrive = drivesWithProfiles.find(d => d.profile_id === activeProfile.id);
            if (activeDrive) {
              setSelectedDriveId(activeDrive.root_drive_id);
            }
          } else if (drivesWithProfiles.length > 0) {
            // If no active profile, select the first drive
            setSelectedDriveId(drivesWithProfiles[0].root_drive_id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching filter profiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch filter profiles');
    }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('google_sync_statistics')
        .select('*')
        .order('google_drive_count', { ascending: false })
        .limit(200); // Increased limit to ensure we get all folders + TOTAL entry

      // Filter by selected drive ID if available
      if (selectedDriveId) {
        query = query.eq('root_drive_id', selectedDriveId);
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      if (data) {
        // Find the TOTAL entry
        const totalEntry = data.find(stat => stat.folder_name === 'TOTAL FILES IN DRIVE');
        
        // Filter out the TOTAL entry from the regular statistics
        const folderStats = data.filter(stat => stat.folder_name !== 'TOTAL FILES IN DRIVE');
        setStatistics(folderStats);
        
        // Use TOTAL entry for aggregated stats if available, otherwise sum up folders
        if (totalEntry) {
          setAggregatedStats({
            totalFolders: folderStats.length,
            totalFiles: totalEntry.total_google_drive_items || totalEntry.google_drive_count,
            totalDocuments: totalEntry.google_drive_documents,
            totalSubfolders: totalEntry.google_drive_folders,
            totalMp4Files: totalEntry.mp4_files,
            totalMp4Size: parseInt(totalEntry.mp4_total_size || '0'),
            totalNewFiles: totalEntry.new_files,
            lastUpdated: totalEntry.updated_at
          });
        } else {
          // Fallback: calculate aggregated stats from individual folders
          const aggregated = folderStats.reduce((acc, stat) => {
            acc.totalFolders += 1;
            acc.totalFiles += stat.google_drive_count;
            acc.totalDocuments += stat.google_drive_documents;
            acc.totalSubfolders += stat.google_drive_folders;
            acc.totalMp4Files += stat.mp4_files;
            acc.totalMp4Size += parseInt(stat.mp4_total_size || '0');
            acc.totalNewFiles += stat.new_files;
            
            if (!acc.lastUpdated || new Date(stat.updated_at) > new Date(acc.lastUpdated)) {
              acc.lastUpdated = stat.updated_at;
            }
            
            return acc;
          }, {
            totalFolders: 0,
            totalFiles: 0,
            totalDocuments: 0,
            totalSubfolders: 0,
            totalMp4Files: 0,
            totalMp4Size: 0,
            totalNewFiles: 0,
            lastUpdated: null as string | null
          });
          
          setAggregatedStats(aggregated);
        }
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatistics = async () => {
    setRefreshing(true);
    
    // Here you would normally call the populate-statistics command
    // For now, we'll just refetch the data
    await fetchStatistics();
    
    setRefreshing(false);
  };


  const formatFileSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading statistics...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchStatistics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Refresh Button and Drive Selector */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Google Drive Statistics</h2>
            <p className="text-gray-600 mt-1">
              {(() => {
                const selectedDrive = profileDrives.find(d => d.root_drive_id === selectedDriveId);
                const profileName = selectedDrive?.profile?.name || 'Unknown Profile';
                const isActive = selectedDrive?.profile?.is_active;
                return (
                  <span>
                    Viewing: {profileName}
                    {isActive && <span className="ml-2 text-xs text-green-600">(Active Profile)</span>}
                  </span>
                );
              })()}
            </p>
            {selectedDriveId && (
              <p className="text-xs text-gray-500 mt-1">
                Root Drive ID: {selectedDriveId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Drive Selector */}
            {profileDrives.length > 0 && (
              <div className="min-w-[300px]">
                <label htmlFor="drive-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Profile
                </label>
                <select
                  id="drive-select"
                  value={selectedDriveId || ''}
                  onChange={(e) => setSelectedDriveId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                >
                  {profileDrives.map((drive) => (
                    <option key={drive.id} value={drive.root_drive_id}>
                      {drive.profile?.name || 'Unknown Profile'}
                      {drive.profile?.is_active && ' (Active)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={refreshStatistics}
              disabled={refreshing || !selectedDriveId}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Folders</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalFolders}</p>
              </div>
              <FolderOpen className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalFiles.toLocaleString()}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">MP4 Files</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalMp4Files}</p>
                <p className="text-xs text-gray-500">{formatFileSize(aggregatedStats.totalMp4Size)}</p>
              </div>
              <Film className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Files (7d)</p>
                <p className="text-2xl font-bold text-gray-900">{aggregatedStats.totalNewFiles}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Last Updated */}
        {aggregatedStats.lastUpdated && (
          <div className="text-sm text-gray-600">
            <Calendar className="inline h-4 w-4 mr-1" />
            Last updated: {formatDate(aggregatedStats.lastUpdated)}
          </div>
        )}

        {/* Detailed Statistics Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Folder Statistics ({statistics.length} folders)</h3>
            <p className="text-sm text-gray-600 mt-1">Showing file counts per folder (sorted by size)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folder Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Folders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MP4 Files
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MP4 Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New (7d)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.map((stat) => (
                  <tr key={stat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.folder_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_documents.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.google_drive_folders.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.mp4_files}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(parseInt(stat.mp4_total_size || '0'))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.new_files > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {stat.new_files}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};