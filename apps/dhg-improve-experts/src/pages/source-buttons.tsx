import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { ExtractContentButton } from '@/components/ExtractContentButton';
import { syncGoogleDriveFiles } from '@/utils/google-drive-sync';
import { syncFileMetadata } from '@/utils/metadata-sync';
import mammoth from 'mammoth';

export default function SourceButtonsPage() {
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [extractedContent, setExtractedContent] = useState<{
    name: string;
    content: string;
  } | null>(null);

  // Test Environment
  const handleTestEnvironment = async () => {
    setLoading(true);
    try {
      // Test Google token
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      console.log('Access token starts with:', accessToken.substring(0, 10) + '...');
      
      const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
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

  // Sync Metadata
  const handleMetadataSync = async () => {
    setLoading(true);
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      if (!accessToken) {
        toast.error('Missing access token');
        return;
      }
      
      const result = await syncFileMetadata(accessToken);
      if (result.success) {
        toast.success('Metadata sync completed successfully');
      }
    } catch (error) {
      console.error('Metadata sync failed:', error);
      toast.error('Failed to sync metadata');
    } finally {
      setLoading(false);
    }
  };

  // Sync Sources
  const handleGoogleDriveSync = async () => {
    setLoading(true);
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

      if (!accessToken || !folderId) {
        toast.error('Missing access token or folder ID');
        return;
      }

      const result = await syncGoogleDriveFiles(accessToken, folderId);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync with Google Drive');
    } finally {
      setLoading(false);
    }
  };

  // Test Extract
  const handleTestExtract = async () => {
    setLoading(true);
    try {
      // Get first unprocessed docx file
      const { data: doc } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, mime_type')
        .eq('content_extracted', false)
        .eq('mime_type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .limit(1)
        .single();

      if (!doc) {
        toast.error('No unprocessed DOCX files found');
        return;
      }

      console.log('Testing extraction for:', {
        name: doc.name,
        driveId: doc.drive_id,
        mimeType: doc.mime_type
      });

      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      const url = `https://www.googleapis.com/drive/v3/files/${doc.drive_id}?alt=media`;

      const downloadResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(`Could not download Office document: ${downloadResponse.status}`);
      }

      const buffer = await downloadResponse.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });

      if (!result.value) {
        throw new Error('No content extracted from document');
      }

      // Store the extracted content
      setExtractedContent({
        name: doc.name,
        content: result.value
      });

      console.log('Extraction successful:', {
        name: doc.name,
        contentLength: result.value.length,
        preview: result.value.substring(0, 200)
      });

      toast.success(`Successfully extracted content from ${doc.name}`);

    } catch (error) {
      console.error('Test extraction failed:', error);
      toast.error('Failed to extract content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl mb-4">Expert Profiles</h1>

      <button className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
        Sync Sources
      </button>

      <div className="bg-white rounded-lg p-6 shadow">
        <div className="space-y-4">
          {/* Dry Run Mode Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            <span className="text-sm font-medium">
              Dry Run Mode (Preview Changes)
            </span>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={handleGoogleDriveSync}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Sync Sources
            </button>
            <button className="bg-green-500 text-white px-4 py-2 rounded">
              <ExtractContentButton />
            </button>
            <button 
              onClick={handleTestExtract}
              disabled={loading}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Test Extract
            </button>
            <button 
              onClick={handleTestEnvironment}
              disabled={loading}
              className="bg-purple-500 text-white px-4 py-2 rounded"
            >
              Test Env
            </button>
            <button className="bg-orange-500 text-white px-4 py-2 rounded">
              Test Drive
            </button>
            <button 
              onClick={handleMetadataSync}
              disabled={loading}
              className="bg-purple-500 text-white px-4 py-2 rounded"
            >
              Sync Metadata
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="px-4 py-2 border rounded flex-1"
            />
            <button className="bg-indigo-500 text-white px-4 py-2 rounded">
              Search
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button className="bg-blue-500 text-white px-4 py-2 rounded">
              Folder View
            </button>
            <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded">
              Raw View
            </button>
          </div>
        </div>
      </div>

      {extractedContent && (
        <div className="mt-8 p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            Extracted Content from: {extractedContent.name}
          </h3>
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: extractedContent.content }}
          />
        </div>
      )}
    </div>
  );
} 