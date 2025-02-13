import { useState } from "react";
import { listDriveContents, getFileContent } from "@/lib/google-drive";
import { insertGoogleDriveFolder } from '../lib/supabase/sources-google'
import { getGoogleDriveFolder } from '@/lib/google-drive/sync'
import { syncGoogleFolderWithDepth } from '@/lib/google-drive/sync'
import ExpertFolderAnalysis from "@/components/ExpertFolderAnalysis";
import { SourcesView } from "@/components/SourcesView";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

interface FilePreview {
  id: string;
  name: string;
  content: string;
  mimeType: string;
}

export default function ExpertProfiles() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  async function handlePopulateSourcesGoogle() {
    setLoading(true);
    setStatus('');
    try {
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      const expertId = 'test-expert-id'; // TODO: Get from selection
      
      await syncGoogleFolderWithDepth(folderId, 2);
      console.log('Successfully populated Google sources');
      setStatus('Successfully populated Google sources');
      
    } catch (error) {
      console.error('Error populating sources:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl mb-4">Expert Profiles</h1>
        
        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={handlePopulateSourcesGoogle}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {loading ? 'Processing...' : 'Populate All Sources'}
          </button>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`p-2 rounded ${
            status.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {status}
          </div>
        )}

        {/* Sources View with Search */}
        <div className="border rounded-lg">
          <SourcesView />
        </div>

        <ExpertFolderAnalysis />
      </div>
    </div>
  );
} 