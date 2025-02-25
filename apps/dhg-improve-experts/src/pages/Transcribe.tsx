import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../supabase/types';
import { getVideoSummary, testOpenAIConnection } from '@/utils/whisper-processing';
import { toast } from 'react-hot-toast';
import { AudioPlayer } from '@/components/AudioPlayer';

type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];

interface MP4FileWithAudio extends SourceGoogle {
  id: string;
  name: string;
  parent_path: string | null;
  web_view_link: string | null;
  updated_at: string;
  has_audio_file: boolean;
  audio_file?: SourceGoogle | null;
  summary?: string;
  processing?: boolean;
}

export function Transcribe() {
  const [mp4Files, setMP4Files] = useState<MP4FileWithAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingM4A, setPendingM4A] = useState<SourceGoogle | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    loadMP4Files();
  }, []);

  const loadMP4Files = async () => {
    try {
      setLoading(true);
      
      // First get all MP4 files
      const { data: mp4Data, error: mp4Error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('mime_type', 'video/mp4')
        .eq('deleted', false)
        .order('name');

      if (mp4Error) throw mp4Error;
      if (!mp4Data) return;

      console.log('Found MP4 files:', mp4Data.map(f => ({
        name: f.name,
        path: f.parent_path,
        mime: f.mime_type
      })));

      // Get all audio files in one query
      const { data: allAudioData, error: audioError } = await supabase
        .from('sources_google')
        .select('*')
        .in('mime_type', ['audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/mpeg'])
        .eq('deleted', false);

      if (audioError) throw audioError;

      console.log('Found Audio files:', allAudioData?.map(f => ({
        name: f.name,
        path: f.parent_path,
        mime: f.mime_type
      })));

      // Map MP4 files with their audio files
      const filesWithAudioInfo = mp4Data.map((mp4File) => {
        // Find matching audio file by checking name similarity and folder
        const audioFile = allAudioData?.find(audio => {
          // Get base names without extensions and remove "video"/"audio" labels
          const mp4BaseName = mp4File.name
            .toLowerCase()
            .replace('.mp4', '')
            .replace(' video', '');
            
          const audioBaseName = audio.name
            .toLowerCase()
            .replace('.m4a', '')
            .replace(' audio', '');
          
          // Check if they're in the same folder structure
          const inSameFolder = mp4File.parent_path?.includes(audio.parent_path || '') || 
                             audio.parent_path?.includes(mp4File.parent_path || '');
          
          const nameMatch = mp4BaseName === audioBaseName;
          
          console.log('Comparing:', {
            mp4: {
              original: mp4File.name,
              baseName: mp4BaseName,
              path: mp4File.parent_path
            },
            audio: {
              original: audio.name,
              baseName: audioBaseName,
              path: audio.parent_path
            },
            inSameFolder,
            nameMatch
          });

          return inSameFolder && nameMatch;
        });

        return {
          ...mp4File,
          has_audio_file: !!audioFile,
          audio_file: audioFile || null
        };
      });

      setMP4Files(filesWithAudioInfo);
    } catch (err) {
      console.error('Error loading MP4 files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load MP4 files');
    } finally {
      setLoading(false);
    }
  };

  const handleGetSummary = async (fileId: string) => {
    try {
      // Update UI to show processing
      setMP4Files(prev => prev.map(f => 
        f.id === fileId ? {...f, processing: true} : f
      ));

      const result = await getVideoSummary(fileId);
      
      // Update file with summary
      setMP4Files(prev => prev.map(f => 
        f.id === fileId ? {
          ...f, 
          processing: false,
          summary: result.summary
        } : f
      ));
    } catch (error) {
      console.error('Error getting summary:', error);
      toast.error('Failed to get summary');
    }
  };

  async function handleExtractAudio() {
    setExtracting(true);
    setProgress('Starting extraction...');
    try {
      // Step 1: Find an M4A file (keeping our working code)
      const { data: sourceFile, error: queryError } = await supabase
        .from('sources_google')
        .select(`
          id, 
          name,
          mime_type,
          drive_id,
          content_extracted,
          extracted_content
        `)  // Only select columns that exist
        .eq('mime_type', 'audio/m4a')
        .is('content_extracted', false)  // Use the correct column
        .limit(1)
        .single();

      if (queryError) throw queryError;
      if (!sourceFile) {
        toast.error('No pending M4A files found');
        return;
      }

      setCurrentFile(sourceFile.name);
      setProgress(`Found file: ${sourceFile.name}`);

      // Step 2: Try to create audio blob from raw content
      try {
        // First check if we have content and it's in the expected format
        if (!sourceFile.extracted_content || typeof sourceFile.extracted_content !== 'object') {
          throw new Error('No valid audio content found');
        }
        
        // Check if extracted_content is an object with data property
        const content = sourceFile.extracted_content as { data?: string };
        if (!content || !content.data) {
          throw new Error('No audio data found in content');
        }
        
        const base64Content = content.data;
        if (!base64Content || typeof base64Content !== 'string') {
          throw new Error('Invalid audio content format');
        }
        
        // Convert base64 to array buffer
        const binaryContent = atob(base64Content);
        const bytes = new Uint8Array(binaryContent.length);
        for (let i = 0; i < binaryContent.length; i++) {
          bytes[i] = binaryContent.charCodeAt(i);
        }
        
        const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setProgress('Created audio URL - testing playback');
        toast.success('Audio ready for playback');
      } catch (blobError) {
        console.error('Error creating audio blob:', blobError);
        toast.error('Failed to create audio from content');
        setProgress('Error processing audio content');
        return;
      }

    } catch (err) {
      console.error('Error finding M4A file:', err);
      toast.error('Failed to find M4A file');
      setProgress('Error finding file');
    } finally {
      setExtracting(false);
    }
  }

  async function findPendingM4A() {
    try {
      // Find specific M4A file by ID
      const { data: sourceFile, error: queryError } = await supabase
        .from('sources_google')
        .select('*')
        .eq('id', '08c67178-1487-4f5b-920b-c60efa3ea938')
        .limit(1)
        .single();

      if (queryError) throw queryError;
      if (!sourceFile) {
        toast.error('Could not find file with specified ID');
        return;
      }

      setPendingM4A(sourceFile);
      console.log('Found file:', sourceFile);  // Log all file details
      toast.success(`Found file: ${sourceFile.name}`);

    } catch (err) {
      console.error('Error finding file:', err);
      toast.error('Failed to find file');
    }
  }

  if (loading) {
    return <div className="container mx-auto p-4">Loading MP4 files...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MP4 Transcription</h1>
        <button
          onClick={findPendingM4A}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Find Pending M4A
        </button>
      </div>
      
      {mp4Files.length === 0 ? (
        <div className="text-gray-600">No MP4 files found</div>
      ) : (
        <div className="grid gap-4">
          {mp4Files.map((file) => (
            <div key={file.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{file.name}</h2>
                <div className={`px-2 py-1 rounded text-sm ${
                  file.has_audio_file 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {file.has_audio_file ? 'Audio Extracted' : 'Needs Audio Extraction'}
                </div>
              </div>
              
              <div className="mt-2 text-gray-600">
                Path: {file.parent_path || 'Root'}
              </div>
              
              {file.web_view_link && (
                <div className="mt-2">
                  <a 
                    href={file.web_view_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View in Google Drive
                  </a>
                </div>
              )}

              {file.has_audio_file && file.audio_file && (
                <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                  <div className="font-medium text-gray-700">Audio File:</div>
                  <div className="text-gray-600">{file.audio_file.name}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    ID: {file.audio_file.id}<br/>
                    Drive ID: {file.audio_file.drive_id}
                  </div>
                  {file.audio_file.web_view_link && (
                    <a 
                      href={file.audio_file.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Audio in Drive
                    </a>
                  )}
                </div>
              )}

              <div className="mt-2">
                {!file.summary && (
                  <button
                    onClick={() => handleGetSummary(file.id)}
                    disabled={file.processing}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    {file.processing ? 'Getting Summary...' : 'Get Quick Summary'}
                  </button>
                )}
                
                {file.summary && (
                  <div className="bg-gray-50 p-3 rounded mt-2">
                    <h3 className="font-medium text-gray-700">Summary:</h3>
                    <p className="text-gray-600 text-sm mt-1">{file.summary}</p>
                  </div>
                )}
              </div>

              <div className="mt-2 text-sm text-gray-500">
                Last updated: {new Date(file.updated_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-8">
        <button
          onClick={handleExtractAudio}
          disabled={extracting}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {extracting ? 'Extracting...' : 'Extract Next Audio File'}
        </button>

        {progress && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <p className="font-semibold">Progress:</p>
            <p>{progress}</p>
            {currentFile && <p>Current file: {currentFile}</p>}
          </div>
        )}

        {audioUrl && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Test Playback</h2>
            <AudioPlayer url={audioUrl} />
          </div>
        )}
      </div>

      {pendingM4A && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-semibold">Found M4A File:</h2>
          <p>Name: {pendingM4A.name}</p>
          <p>Path: {pendingM4A.parent_path || 'Root'}</p>
        </div>
      )}
    </div>
  );
} 