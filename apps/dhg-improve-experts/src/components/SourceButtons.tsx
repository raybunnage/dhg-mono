import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import toast from 'react-hot-toast';
import { processUnextractedDocuments, testSingleDocument } from '@/utils/document-processing';
import { listDriveFiles, listAllDriveFiles } from '@/utils/google-drive';

export function SourceButtons() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleDryRunChange = (checked: boolean) => {
    if (!checked) {
      if (window.confirm('⚠️ Turning off Dry Run Mode will allow actual changes to the database. Continue?')) {
        setDryRun(false);
      }
    } else {
      setDryRun(true);
    }
  };

  const handleSyncSources = async () => {
    setLoading(true);
    setProgress({ current: 0, total: 0 });
    
    try {
      console.log(`Starting sync in ${dryRun ? 'DRY RUN' : 'LIVE'} mode`);
      
      // Get ALL files recursively
      const files = await listAllDriveFiles(import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID);
      const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      const documents = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
      
      setProgress({ current: 0, total: files.length });

      // Build folder tree visualization
      const folderTree = folders.reduce((acc, folder) => {
        acc[folder.path || folder.name] = documents
          .filter(doc => doc.parentId === folder.id)
          .map(doc => doc.name);
        return acc;
      }, {} as Record<string, string[]>);

      console.log('Drive contents summary:');
      console.log(`- Total items: ${files.length}`);
      console.log(`- Folders: ${folders.length}`);
      console.log(`- Documents: ${documents.length}`);
      console.log('\nFolder structure:');
      Object.entries(folderTree).forEach(([folder, files]) => {
        console.log(`\n${folder}:`);
        files.forEach(file => console.log(`  - ${file}`));
      });

      // Track changes that would be made
      const changes = {
        toAdd: [] as any[],
        toSkip: [] as any[],
        toDelete: [] as any[],
      };

      // Process each file with progress
      for (const [index, file] of files.entries()) {
        setProgress(prev => ({ ...prev, current: index + 1 }));
        
        try {
          // Modified query to check for existing record
          const { data: existing, error: queryError } = await supabase
            .from('sources_google')
            .select('id')
            .eq('drive_id', file.id)
            .maybeSingle(); // Use maybeSingle instead of single

          if (queryError) {
            console.error(`Error checking file ${file.name}:`, queryError);
            continue;
          }

          if (existing) {
            changes.toSkip.push(file.name);
            console.log(`Would skip duplicate: ${file.name} (${file.id})`);
            continue;
          }

          changes.toAdd.push(file.name);
          
          if (!dryRun) {
            // Only insert if not in dry-run mode
            const { error: insertError } = await supabase
              .from('sources_google')
              .insert({
                drive_id: file.id,
                name: file.name,
                mime_type: file.mimeType,
                web_view_link: file.webViewLink,
                content_extracted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) {
              console.error(`Error inserting file ${file.name}:`, insertError);
            } else {
              console.log(`Added new file: ${file.name}`);
              toast.success(`Added: ${file.name}`, { duration: 2000 });
            }
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          toast.error(`Failed to process: ${file.name}`);
        }
      }

      // Cleanup check
      const validDriveIds = files.map(f => f.id);
      console.log('Checking for orphaned records...');

      if (validDriveIds.length > 0) {
        const { data: orphanedRecords, error: queryError } = await supabase
          .from('sources_google')
          .select('id, name, drive_id')
          .not('drive_id', 'in', validDriveIds)
          .eq('content_extracted', false)
          .not('id', 'in', 
            supabase
              .from('expert_documents')
              .select('source_id')
          );

        if (queryError) {
          console.error('Error finding orphaned records:', queryError);
        } else if (orphanedRecords?.length) {
          changes.toDelete = orphanedRecords.map(r => r.name);
          console.log('Would delete:', changes.toDelete);
        }
      }

      // Enhanced summary message
      const summary = [
        `${dryRun ? '[DRY RUN] Would make' : 'Made'} these changes:`,
        `Total items in Drive: ${files.length} (${folders.length} folders, ${documents.length} documents)`,
        `- Add: ${changes.toAdd.length} files`,
        `- Skip: ${changes.toSkip.length} files`,
        `- Delete: ${changes.toDelete.length} files`,
      ].join('\n');

      console.log(summary);
      toast.success(summary);

    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync sources');
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
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

  const handleSearch = async () => {
    setLoading(true);
    try {
      console.log('Searching for:', searchTerm);
      
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Search results:', data);
      setSearchResults(data || []);
      
      if (data?.length === 0) {
        toast.error('No files found');
      } else {
        toast.success(`Found ${data.length} files`);
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllRecords = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL records from sources_google and related expert_documents. Are you sure?')) {
      return;
    }

    setLoading(true);
    try {
      console.log('Starting deletion process...');

      // First get all sources_google IDs
      const { data: sources } = await supabase
        .from('sources_google')
        .select('id');

      if (!sources?.length) {
        console.log('No records to delete');
        return;
      }

      const sourceIds = sources.map(s => s.id);
      console.log(`Found ${sourceIds.length} records to delete`);

      // Delete expert_documents first
      const { error: expertDocsError } = await supabase
        .from('expert_documents')
        .delete()
        .in('source_id', sourceIds);

      if (expertDocsError) {
        throw new Error(`Failed to delete expert_documents: ${expertDocsError.message}`);
      }
      console.log('Deleted related expert_documents');

      // Now delete sources_google records
      const { error: sourcesError } = await supabase
        .from('sources_google')
        .delete()
        .in('id', sourceIds);

      if (sourcesError) {
        throw new Error(`Failed to delete sources_google: ${sourcesError.message}`);
      }

      console.log('Successfully deleted all records');
      toast.success(`Deleted ${sourceIds.length} records`);

    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => handleDryRunChange(e.target.checked)}
            className="form-checkbox h-4 w-4 text-blue-600"
          />
          <span className="text-sm font-medium">
            Dry Run Mode {dryRun ? '(Preview Changes)' : '(Make Changes)'}
          </span>
        </label>
        {!dryRun && (
          <span className="text-red-500 text-sm">
            ⚠️ Live Mode - Changes will be saved
          </span>
        )}
      </div>
      
      {loading && progress.total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
          <div className="text-sm text-gray-600 mt-1">
            Processing {progress.current} of {progress.total} files
          </div>
        </div>
      )}

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
        <button
          onClick={handleDeleteAllRecords}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Delete All Records'}
        </button>
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search files..."
          className="px-4 py-2 border rounded"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !searchTerm}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold mb-2">Search Results:</h3>
          <ul className="space-y-2">
            {searchResults.map((file) => (
              <li key={file.id} className="p-2 bg-gray-50 rounded">
                <div className="font-medium">{file.name}</div>
                <div className="text-sm text-gray-600">
                  Type: {file.mime_type}
                  {file.content_extracted && ' ✓ Extracted'}
                </div>
                {file.web_view_link && (
                  <a 
                    href={file.web_view_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    View in Drive
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 