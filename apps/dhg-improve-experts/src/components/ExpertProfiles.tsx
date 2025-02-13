import { useState } from 'react';
import { populateSourcesGoogle } from '../integrations/google-drive';
import { toast } from 'react-hot-toast';
import { SourcesView } from './SourcesView';

export function ExpertProfiles() {
  const [isLoading, setIsLoading] = useState(false);

  async function handlePopulateSourcesGoogle() {
    setIsLoading(true);
    try {
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      const expertId = 'test-expert-id'; // TODO: Get from selection
      
      const count = await populateSourcesGoogle(expertId, folderId);
      
      toast.success(`Successfully populated ${count} Google sources`);
      
    } catch (error) {
      console.error('Error populating sources:', error);
      toast.error('Failed to populate Google sources');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button 
          onClick={handlePopulateSourcesGoogle}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {isLoading ? 'Processing...' : 'Populate Sources (First 100)'}
        </button>
      </div>

      <SourcesView />
    </div>
  );
} 