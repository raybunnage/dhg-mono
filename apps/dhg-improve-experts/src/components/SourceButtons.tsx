import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { processUnextractedDocuments, testSingleDocument } from '@/utils/document-processing';
import { listDriveFiles, listAllDriveFiles } from '@/utils/google-drive';
import { FileTree } from './FileTree';

function sanitizeFileName(name: string): string {
  // Remove or replace problematic characters
  return name
    .replace(/"/g, '') // Remove double quotes
    .replace(/\\/g, '/') // Replace backslashes with forward slashes
    .trim(); // Remove leading/trailing whitespace
}

function sanitizePath(path: string | null): string | null {
  if (!path) return null;
  // Remove leading/trailing slashes and normalize internal ones
  return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

export function SourceButtons() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [files, setFiles] = useState<any[]>([]);

  // Add this effect to load files on mount
  useEffect(() => {
    const loadFiles = async () => {
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('deleted', false)
        .order('name');
      
      if (error) {
        console.error('Error loading files:', error);
        return;
      }
      
      setFiles(data);
    };

    loadFiles();
  }, []);

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
      
      // First get list of existing files to prevent duplicates
      const { data: existingFiles, error: existingError } = await supabase
        .from('sources_google')
        .select('drive_id')
        .eq('deleted', false);

      if (existingError) throw existingError;

      // Create Set of existing drive_ids for faster lookup
      const existingDriveIds = new Set(existingFiles?.map(f => f.drive_id) || []);
      console.log(`Found ${existingDriveIds.size} existing files`);

      // Get ALL files recursively
      const files = await listAllDriveFiles(import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID);
      console.log(`Found ${files.length} total files in Drive`);

      // Track changes that would be made
      const changes = {
        toAdd: [] as any[],
        toSkip: [] as any[],
        toDelete: [] as any[],
      };

      if (!dryRun) {
        // First mark files as deleted if they're no longer in Drive
        const { error: updateError } = await supabase
          .from('sources_google')
          .update({ 
            deleted: true,
            updated_at: new Date().toISOString() 
          })
          .not('drive_id', 'in', existingDriveIds)
          .eq('deleted', false);

        if (updateError) {
          console.error('Error marking deleted files:', updateError);
        }

        // Restore files if they reappear in Drive
        const { error: restoreError } = await supabase
          .from('sources_google')
          .update({ 
            deleted: false,
            updated_at: new Date().toISOString() 
          })
          .in('drive_id', existingDriveIds)
          .eq('deleted', true);

        if (restoreError) {
          console.error('Error restoring files:', restoreError);
        }
      }

      // Process each file with progress
      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length });
        
        try {
          // Skip if file already exists
          if (existingDriveIds.has(file.id)) {
            changes.toSkip.push(file.name);
            continue;
          }

          changes.toAdd.push(file.name);
          
          if (!dryRun) {
            const sanitizedName = sanitizeFileName(file.name);
            const sanitizedPath = sanitizePath(file.path);
            const sanitizedParentPath = sanitizePath(file.parentPath);

            console.log('Inserting new file:', {
              name: sanitizedName,
              path: sanitizedPath,
              parentPath: sanitizedParentPath
            });

            const { error: insertError } = await supabase
              .from('sources_google')
              .insert([{
                drive_id: file.id,
                name: sanitizedName,
                mime_type: file.mimeType,
                web_view_link: file.webViewLink,
                path: sanitizedPath,
                parent_path: sanitizedParentPath,
                content_extracted: false,
                deleted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);

            if (insertError) {
              console.error('Insert error:', insertError);
              throw insertError;
            } else {
              console.log(`Added new file: ${sanitizedName}`);
              toast.success(`Added: ${sanitizedName}`, { duration: 2000 });
            }
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
        }
      }

      // Cleanup check
      console.log('Checking for orphaned records...');

      if (existingDriveIds.size > 0) {
        const { data: orphanedRecords, error: queryError } = await supabase
          .from('sources_google')
          .select('id, name, drive_id')
          .not('drive_id', 'in', existingDriveIds)
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

      // Summary
      console.log('Sync Summary:', {
        totalInDrive: files.length,
        existing: existingDriveIds.size,
        added: changes.toAdd.length,
        skipped: changes.toSkip.length
      });

      toast.success(`Sync completed. Added ${changes.toAdd.length} new files.`);

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

  const handleDeleteAllRecords = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL records from sources_google. Are you sure?')) {
      return;
    }

    setLoading(true);
    try {
      // Get all sources_google records
      const { data: sources, error: fetchError } = await supabase
        .from('sources_google')
        .select('id');

      if (fetchError) throw fetchError;
      if (!sources?.length) {
        toast.success('No records to delete');
        return;
      }

      console.log(`Found ${sources.length} records to delete`);

      // Delete in batches of 100
      const BATCH_SIZE = 100;
      const sourceIds = sources.map(s => s.id);
      const batches = [];

      for (let i = 0; i < sourceIds.length; i += BATCH_SIZE) {
        batches.push(sourceIds.slice(i, i + BATCH_SIZE));
      }

      let deletedCount = 0;
      for (const batch of batches) {
        const { error: deleteError } = await supabase
          .from('sources_google')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error('Batch delete error:', deleteError);
          throw deleteError;
        }
        
        deletedCount += batch.length;
        console.log(`Deleted batch of ${batch.length} records. Total: ${deletedCount}`);
      }

      toast.success(`Successfully deleted ${deletedCount} records`);

    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete records');
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
          onClick={() => {/* TODO: Implement search */}}
          disabled={loading || !searchTerm}
          className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <FileTree files={files} />
    </div>
  );
} 