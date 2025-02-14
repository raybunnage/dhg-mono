import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import toast from 'react-hot-toast';
import { processUnextractedDocuments } from '@/utils/document-processing';

export function SourceButtons() {
  const [loading, setLoading] = useState(false);

  const handleSyncSources = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('sync-google-sources');
      if (error) throw error;
      toast.success('Started syncing sources');
    } catch (error) {
      console.error('Error syncing sources:', error);
      toast.error('Failed to sync sources');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractContent = async () => {
    setLoading(true);
    try {
      const result = await processUnextractedDocuments();
      
      if (result.success) {
        toast.success(result.message);
        if (result.errors?.length) {
          console.warn('Some documents had errors:', result.errors);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error processing documents:', error);
      toast.error('Failed to process documents');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleSyncSources}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Sync Sources'}
      </button>
      <button
        onClick={handleExtractContent}
        disabled={loading}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Extract Content'}
      </button>
    </div>
  );
} 