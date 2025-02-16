import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExpertProfileExtractor } from '@/components/ExpertProfileExtractor';
import { syncGoogleDriveFiles } from '@/utils/google-drive-sync';
import { toast } from 'react-hot-toast';

export default function ExpertProfilerPage() {
  const navigate = useNavigate();

  // Add a sync function that uses env variables
  const handleSync = async () => {
    const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

    if (!accessToken || !folderId) {
      toast.error('Missing access token or folder ID');
      return;
    }

    toast.loading('Syncing files...');
    const result = await syncGoogleDriveFiles(accessToken, folderId);
    
    if (result.success) {
      toast.success(result.message);
      // Refresh the file list
      // You might need to call your file loading function here
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/experts')}
            className="text-primary-600 hover:text-primary-800"
          >
            ← Back to Experts
          </button>
          <h1 className="text-3xl font-serif text-primary-900">
            Expert Profile Extractor
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <ExpertProfileExtractor />
        <button
          onClick={handleSync}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Sync Google Drive Files
        </button>
      </div>
    </div>
  );
} 