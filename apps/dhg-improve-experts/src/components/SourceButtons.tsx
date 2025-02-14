import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import toast from 'react-hot-toast';
import { processUnextractedDocuments, testSingleDocument } from '@/utils/document-processing';

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

  const handleTestExtraction = async () => {
    setLoading(true);
    try {
      // Get first unprocessed PDF or Google Doc
      const { data: doc } = await supabase
        .from('sources_google')
        .select('id')
        .eq('content_extracted', false)
        .in('mime_type', [
          'application/pdf',
          'application/vnd.google-apps.document'
        ])
        .limit(1)
        .single();

      if (!doc) {
        toast.error('No unprocessed PDF or Google Doc found');
        return;
      }

      await testSingleDocument(doc.id);
      toast.success('Test extraction completed');
    } catch (error) {
      console.error('Test failed:', error);
      toast.error(error instanceof Error ? error.message : 'Test extraction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEnvironment = async () => {
    setLoading(true);
    try {
      // Test Google token
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      console.log('Access token starts with:', accessToken.substring(0, 10) + '...');
      console.log('Full token length:', accessToken.length);
      
      // Log the full request details
      const url = 'https://www.googleapis.com/drive/v3/files?pageSize=1';
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      };
      
      console.log('Making request to:', url);
      console.log('With headers:', {
        ...headers,
        'Authorization': 'Bearer ' + accessToken.substring(0, 10) + '...'
      });

      const response = await fetch(url, { headers });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Full response:', data);

      if (response.ok) {
        toast.success('Google token is valid!');
      } else {
        toast.error(`Token error: ${data.error?.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Environment test failed:', error);
      toast.error('Environment test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestGoogleDrive = async () => {
    setLoading(true);
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
      
      // Log what we're using
      console.log('Token starts with:', accessToken?.substring(0, 15) + '...');
      console.log('Token length:', accessToken?.length);
      
      // Make a simpler test request first
      const testUrl = 'https://www.googleapis.com/drive/v3/about?fields=user';
      console.log('Testing with URL:', testUrl);
      
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        toast.success('Successfully connected to Google Drive!');
        // Only try folder listing if basic test works
        await listFolderContents(accessToken, folderId);
      } else {
        toast.error(`Drive error: ${data.error?.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Google Drive test failed:', error);
      toast.error('Failed to access Google Drive');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to list folder contents
  async function listFolderContents(accessToken: string, folderId: string) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&pageSize=5`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();
    if (response.ok) {
      console.log('Found files:', data.files);
      toast.success(`Found ${data.files?.length || 0} files in folder`);
    } else {
      console.error('Folder listing error:', data);
      toast.error('Failed to list folder contents');
    }
  }

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
      <button
        onClick={handleTestExtraction}
        disabled={loading}
        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Extract'}
      </button>
      <button
        onClick={handleTestEnvironment}
        disabled={loading}
        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Env'}
      </button>
      <button
        onClick={handleTestGoogleDrive}
        disabled={loading}
        className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Drive'}
      </button>
    </div>
  );
} 