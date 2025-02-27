import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../supabase/types';
import { getVideoSummary, testOpenAIConnection } from '@/utils/whisper-processing';
import { fetchDriveFileContent, fetchDriveFileMetadata } from '@/utils/google-drive';
import { toast } from 'react-hot-toast';
import { AudioPlayer } from '@/components/AudioPlayer';
import { processAudioFile } from '@/utils/audio-pipeline';
import { processBatch } from '@/utils/batch-processor';
import { v4 as uuidv4 } from 'uuid';

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
  const [extractionComplete, setExtractionComplete] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    file: string;
    status: string;
    processed: number;
    total: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
          
          return inSameFolder && nameMatch;
        });

        return {
          ...mp4File,
          has_audio_file: !!audioFile,
          audio_file: audioFile || null
        };
      });

      // Filter to only show MP4 files that have an associated audio file
      const filesWithAudio = filesWithAudioInfo.filter(file => file.has_audio_file);
      setMP4Files(filesWithAudio);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading MP4 files:', error);
      setError('Failed to load MP4 files');
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

  async function handleExtractAudio(fileToExtract?: SourceGoogle) {
    setExtracting(true);
    setProgress('Starting extraction...');
    console.log('🚀 Starting audio extraction process');
    try {
      // Use the passed file or fall back to pendingM4A
      const targetFile = fileToExtract || pendingM4A;
      
      if (!targetFile) {
        console.log('❌ No pending M4A file found');
        toast.error('Please find an M4A file first');
        return;
      }

      // Update state for UI display
      if (fileToExtract && fileToExtract !== pendingM4A) {
        setPendingM4A(fileToExtract);
      }
      
      // First get metadata to know what to expect
      try {
        const metadata = await fetchDriveFileMetadata(targetFile.drive_id);
        console.log('📊 Original file metadata:', {
          name: metadata.name,
          mimeType: metadata.mimeType,
          size: metadata.size + ' bytes',
          formattedSize: (metadata.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
        
        if (metadata.size < 10000) {
          console.warn('⚠️ WARNING: File size is suspiciously small for audio!');
        }
      } catch (metadataError) {
        console.error('❌ Failed to get file metadata:', metadataError);
      }
      
      console.log('📂 Processing file:', {
        id: targetFile.id,
        name: targetFile.name,
        driveId: targetFile.drive_id,
        mimeType: targetFile.mime_type
      });
      setCurrentFile(targetFile.name);
      setProgress(`Processing file: ${targetFile.name}`);

      // Step 1: Get the file content from Google Drive
      setProgress('Fetching file from Google Drive...');
      console.log('🔄 Fetching file content from Google Drive...');
      let audioData: ArrayBuffer;
      
      try {
        audioData = await fetchDriveFileContent(targetFile.drive_id);
        console.log('✅ Successfully fetched file content:', {
          byteLength: audioData.byteLength,
          sizeInMB: (audioData.byteLength / (1024 * 1024)).toFixed(2) + ' MB'
        });
        setProgress(`Fetched ${audioData.byteLength} bytes from Google Drive`);
      } catch (fetchError) {
        console.error('❌ Error fetching from Google Drive:', fetchError);
        toast.error('Failed to fetch file from Google Drive');
        throw fetchError;
      }
      
      // Validate that we actually received audio data, not HTML error
      const dataView = new Uint8Array(audioData.slice(0, 20));
      let textVersion = '';
      for (let i = 0; i < dataView.length; i++) {
        textVersion += String.fromCharCode(dataView[i]);
      }
      
      if (textVersion.includes('<!DOCTYPE') || textVersion.includes('<html')) {
        console.error('❌ Received HTML instead of audio data:', textVersion);
        toast.error('Received HTML instead of audio data. Check authentication.');
        throw new Error('Received HTML instead of audio data');
      }
      
      // Additional validation for file size
      if (audioData.byteLength < 10000) {
        console.warn('⚠️ Suspiciously small file size for audio:', audioData.byteLength);
        toast.warning('File size is very small for audio. Check if valid.');
      }
      
      console.log('✅ Received valid binary data');
      
      // Step 2: Convert to base64 for storage in JSONB field
      setProgress('Processing audio data for storage...');
      console.log('🔄 Converting to base64 format...');
      // Convert ArrayBuffer to base64 string
      const base64Data = btoa(
        new Uint8Array(audioData)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      console.log('✅ Converted to base64 format:', {
        originalSize: audioData.byteLength,
        base64Length: base64Data.length,
        ratio: (base64Data.length / audioData.byteLength).toFixed(2) + 'x'
      });

      // Step 3: Update the Supabase record with better error handling
      console.log('🔄 Preparing to update Supabase record...');
      
      // Prepare the payload
      const updatePayload = {
        content_extracted: true,
        extracted_content: { 
          data: base64Data,
          size: audioData.byteLength,
          mime_type: 'audio/m4a',
          extracted_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString(),
      };
      
      console.log('📦 Update payload prepared:', {
        id: targetFile.id,
        contentSize: base64Data.length,
        originalSize: audioData.byteLength
      });
      
      // Use try-catch to handle CORS and other errors
      try {
        console.log('🔄 Sending update to Supabase...');
        const { error: updateError } = await supabase
          .from('sources_google')
          .update(updatePayload)
          .eq('id', targetFile.id);
        
        if (updateError) {
          console.error('❌ Error updating Supabase record:', updateError);
          throw updateError;
        }
        
        console.log('✅ Supabase record updated successfully');
        setProgress('Supabase record updated successfully');
      } catch (updateError) {
        console.error('❌ Failed to update Supabase:', updateError);
        
        // Despite the error, continue with extraction so user can at least play the audio
        toast.error('Failed to save to database, but continuing with extraction');
        setProgress('Database update failed, but continuing extraction');
      }
      
      // Verify the update by fetching the record again
      try {
        console.log('🔍 Verifying Supabase update...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('sources_google')
          .select('extracted_content')
          .eq('id', targetFile.id)
          .single();
          
        if (verifyError) {
          console.error('❌ Error verifying update:', verifyError);
        } else if (verifyData?.extracted_content) {
          const storedContent = verifyData.extracted_content as any;
          console.log('✅ Verification successful:', {
            hasData: !!storedContent.data,
            storedSize: storedContent.size,
            expectedSize: audioData.byteLength,
            match: storedContent.size === audioData.byteLength ? '✅ Match' : '❌ Different'
          });
        } else {
          console.error('❌ No extracted_content found after update');
        }
      } catch (verifyError) {
        console.error('❌ Verification failed:', verifyError);
      }

      // Step 3: Create audio blob for playback
      try {
        console.log('🔄 Creating audio blob for playback...');
        const audioBlob = new Blob([audioData], { type: 'audio/m4a' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        console.log('✅ Created audio URL for playback:', { url });
        setProgress('Created audio URL - testing playback');
        toast.success('Audio extracted and ready for playback');
        setExtractionComplete(true);

        // Try to get audio metadata if possible
        const tempAudio = new Audio();
        tempAudio.src = url;
        
        tempAudio.addEventListener('loadedmetadata', () => {
          console.log('🎵 Audio metadata:', {
            duration: tempAudio.duration,
            // These are non-standard properties, so TypeScript complains
            // But we'll keep them for debugging with Firefox
            channels: (tempAudio as any).mozChannels || '(unknown)',
            sampleRate: (tempAudio as any).mozSampleRate || '(unknown)'
          });
        });
        
        tempAudio.addEventListener('error', (e) => {
          console.error('❌ Audio metadata error:', tempAudio.error);
        });
      } catch (blobError) {
        console.error('❌ Error creating audio blob:', blobError);
        console.error('Error creating audio blob:', blobError);
        toast.error('Failed to create audio from content');
        setProgress('Error processing audio content');
        return;
      }

      console.log('🎉 Audio extraction complete!');

    } catch (err) {
      console.error('❌ Error during extraction process:', err);
      console.error('Error extracting audio:', err);
      toast.error('Failed to extract audio');
      setProgress('Error extracting audio');
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
      // Check if web_view_link is available for Google Drive access
      if (sourceFile.web_view_link) {
        console.log('Google Drive link:', sourceFile.web_view_link);
        console.log('Drive ID:', sourceFile.drive_id);
      }
      toast.success(`Found file: ${sourceFile.name}`);

    } catch (err) {
      console.error('Error finding file:', err);
      toast.error('Failed to find file');
    }
  }

  // New function to test playback of stored audio
  async function testStoredAudioPlayback() {
    if (!pendingM4A) {
      toast.error('No M4A file selected');
      return;
    }

    setProgress('Testing stored audio playback...');
    console.log('🔄 Testing playback of stored audio from Supabase...');

    try {
      // First get the original file metadata from Google Drive for comparison
      const driveId = pendingM4A.drive_id;
      console.log('🔍 Getting original file metadata for comparison...');
      const metadata = await fetchDriveFileMetadata(driveId);
      console.log('📊 Original file on Google Drive:', {
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size + ' bytes',
        formattedSize: (metadata.size / 1024).toFixed(2) + ' KB'
      });
      
      if (metadata.size < 10000) {
        console.warn('⚠️ WARNING: Original file size is suspiciously small for audio!');
      }
    } catch (metadataError) {
      console.error('❌ Failed to get original file metadata:', metadataError);
    }

    try {
      // Fetch the stored record to get the extracted content
      const { data: sourceFile, error: fetchError } = await supabase
        .from('sources_google')
        .select('extracted_content')
        .eq('id', pendingM4A.id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching audio record:', fetchError);
        toast.error('Failed to fetch audio data');
        return;
      }

      if (!sourceFile?.extracted_content) {
        console.error('❌ No extracted content found in record');
        toast.error('No audio content found in record');
        return;
      }

      // More detailed logging of what we got
      console.log('🔍 Detailed extracted_content inspection:', {
        type: typeof sourceFile.extracted_content,
        isJSON: sourceFile.extracted_content instanceof Object,
        keys: Object.keys(sourceFile.extracted_content),
        contentValue: sourceFile.extracted_content
      });

      // Display all stored metadata from Supabase
      const extractedMetadata = sourceFile.extracted_content as {
        data?: string;
        size?: number;
        mime_type?: string;
        extracted_at?: string;
      };
      
      console.log('📊 Storage metadata in Supabase:', {
        storedSize: extractedMetadata.size + ' bytes',
        storedMimeType: extractedMetadata.mime_type,
        extractedAt: extractedMetadata.extracted_at,
        base64Length: extractedMetadata.data?.length
      });
      
      // Compare with original if we have both
      if (extractedMetadata.size) {
        try {
          const metadata = await fetchDriveFileMetadata(pendingM4A.drive_id);
          console.log('📏 Size comparison:', {
            originalSize: metadata.size + ' bytes',
            storedSize: extractedMetadata.size + ' bytes',
            difference: (metadata.size - extractedMetadata.size) + ' bytes',
            match: metadata.size === extractedMetadata.size ? '✅ Match' : '❌ Different'
          });
        } catch (err) {
          console.error('Error comparing sizes:', err);
        }
      }

      console.log('✅ Retrieved audio data from Supabase:', {
        recordId: pendingM4A.id,
        hasData: !!sourceFile.extracted_content,
        contentType: typeof sourceFile.extracted_content
      });

      // Extract and convert the base64 data
      const content = sourceFile.extracted_content as { data?: string };
      if (!content || !content.data) {
        console.error('❌ Invalid data format in extracted_content');
        toast.error('Invalid audio data format');
        return;
      }

      // Validate base64 data
      console.log('🔍 Base64 data validation:', {
        length: content.data.length,
        sample: content.data.substring(0, 30) + '...',
        looksLikeBase64: /^[A-Za-z0-9+/=]+$/.test(content.data),
        mimeType: content.mime_type || 'audio/m4a'
      });

      // Convert base64 to binary
      console.log('🔄 Converting base64 to binary...');
      const base64Content = content.data;
      const binaryContent = atob(base64Content);
      const bytes = new Uint8Array(binaryContent.length);
      for (let i = 0; i < binaryContent.length; i++) {
        bytes[i] = binaryContent.charCodeAt(i);
      }

      console.log('✅ Converted to binary data:', {
        base64Length: base64Content.length,
        binaryLength: bytes.length
      });

      // Calculate simple checksum for validation
      let originalChecksum = 0;
      let extractedChecksum = 0;
      for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
        extractedChecksum += bytes[i];
      }
      console.log('🔐 Extracted file checksum (first 1000 bytes):', extractedChecksum);
      
      // Now download original for comparison
      try {
        const originalData = await fetchDriveFileContent(pendingM4A.drive_id);
        const originalBytes = new Uint8Array(originalData);
        for (let i = 0; i < Math.min(originalBytes.length, 1000); i++) {
          originalChecksum += originalBytes[i];
        }
        console.log('🔐 Original file checksum (first 1000 bytes):', originalChecksum);
        console.log('📊 Checksums match?', originalChecksum === extractedChecksum ? '✅ YES' : '❌ NO');
      } catch (err) {
        console.error('Error comparing checksums:', err);
      }

      // Create blob and URL
      // Try multiple MIME types
      const mimeType = content.mime_type || 'audio/m4a';
      console.log('🔄 Creating blob with MIME type:', mimeType);
      const audioBlob = new Blob([bytes], { type: mimeType });
      
      console.log('🔍 Blob details:', {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Log the URL and add diagnostic button
      console.log('✅ Created audio URL for playback from stored data:', url);
      setProgress('Playing back stored audio data');
      
      // Add a direct download link for diagnostic purposes
      const downloadElement = document.createElement('a');
      downloadElement.href = url;
      downloadElement.download = `${pendingM4A.name || 'audio-debug'}.m4a`;
      downloadElement.textContent = 'Download for debugging';
      downloadElement.style.display = 'none';
      document.body.appendChild(downloadElement);
      console.log('💾 Debug download link created, click to download:', downloadElement);
      
      toast.success('Playing audio from stored data');
      
      // Force browser to create a new audio element
      setAudioUrl(null);
      setTimeout(() => {
        setAudioUrl(url);
      }, 50);

    } catch (err) {
      console.error('❌ Error testing stored audio:', err);
      toast.error('Failed to test stored audio');
      setProgress('Error testing stored audio');
    }
  }

  async function handleDirectProcess(file: SourceGoogle) {
    setExtracting(true);
    setProgress('Starting direct processing pipeline...');
    
    try {
      await processAudioFile(file, (msg) => {
        setProgress(msg);
      });
      
      toast.success('Processing complete!');
      
      // Refresh data
      await loadMP4Files();
    } catch (error) {
      console.error('Processing failed:', error);
      toast.error('Processing failed: ' + error.message);
    } finally {
      setExtracting(false);
    }
  }

  async function handleBatchProcess() {
    if (selectedForBatch.length === 0) {
      toast.error('Select files for batch processing first');
      return;
    }
    
    setExtracting(true);
    setBatchProgress(null);
    
    try {
      await processBatch(
        selectedForBatch, 
        1, // Adjust concurrency based on your system
        (file, status, processed, total) => {
          setBatchProgress({ file, status, processed, total });
        }
      );
      
      toast.success('Batch processing complete!');
      setSelectedForBatch([]);
      
      // Refresh data
      await loadMP4Files();
    } catch (error) {
      console.error('Batch processing failed:', error);
      toast.error('Batch processing failed');
    } finally {
      setExtracting(false);
      setBatchProgress(null);
    }
  }

  const insertFileToSupabase = async (fileData: {
    name: string;
    drive_id: string;
    mime_type: string;
    parent_folder_id?: string | null;
    path?: string | null;
  }) => {
    try {
      // Use destructuring to ensure we have all required fields
      const { name, drive_id, mime_type } = fileData;
      
      // Ensure required fields are present
      if (!name || !drive_id || !mime_type) {
        console.error("Missing required fields for sources_google insert");
        return { error: "Missing required fields" };
      }
      
      // Prepare insert data with only the fields we want to set
      const insertData = {
        name,
        drive_id,
        mime_type,
        // Explicitly set parent_folder_id to null to avoid the constraint violation
        parent_folder_id: null,
        // Set some defaults that might be useful
        is_root: false,
        sync_status: 'synced',
        content_extracted: false,
        deleted: false,
      };
      
      const { data, error } = await supabase
        .from('sources_google')
        .insert(insertData)
        .select()
        .single();
        
      if (error) throw error;
      console.log("File successfully inserted:", data);
      return { data };
    } catch (error) {
      console.error("Error inserting file to Supabase:", error);
      return { error };
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // For a single file, we can still use the simple approach
      const fileMetadata = {
        name: file.name,
        drive_id: uuidv4(),
        mime_type: file.type,
        parent_folder_id: null, // No parent for manually uploaded files
      };
      
      const { data, error } = await insertFileToSupabase(fileMetadata);
      
      if (error) {
        toast.error("Failed to upload file");
        console.error(error);
        return;
      }
      
      toast.success("File uploaded successfully!");
      await loadMP4Files();
      
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading MP4 files...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">MP4 Audio Extraction</h1>
        <div>
          <button
            onClick={findPendingM4A}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
          >
            Find Pending M4A
          </button>
          <button
            onClick={async () => {
              // Find Staats audio file
              const { data: sourceFile, error: queryError } = await supabase
                .from('sources_google')
                .select('*')
                .eq('id', '08c67178-1487-4f5b-920b-c60efa3ea938')
                .limit(1)
                .single();
              
              if (queryError) {
                console.error('Error finding file:', queryError);
                toast.error('Failed to find audio file');
                return;
              }
              
              if (sourceFile) {
                toast.success(`Selected: ${sourceFile.name}`);
                // Pass file directly to extraction function
                handleExtractAudio(sourceFile);
              } else {
                toast.error('Audio file not found');
              }
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Extract Audio File
          </button>
        </div>
      </div>
      
      {mp4Files.length === 0 ? (
        <div className="text-gray-600">No MP4 files with associated audio found</div>
      ) : (
        <div className="grid gap-4">
          {mp4Files.map((file) => (
            <div key={file.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{file.name}</h2>
                <input 
                  type="checkbox"
                  checked={selectedForBatch.includes(file.audio_file?.id || '')}
                  onChange={(e) => {
                    if (!file.audio_file) return;
                    
                    if (e.target.checked) {
                      setSelectedForBatch([...selectedForBatch, file.audio_file.id]);
                    } else {
                      setSelectedForBatch(selectedForBatch.filter(id => id !== file.audio_file?.id));
                    }
                  }}
                  className="h-5 w-5 text-blue-600"
                />
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

              {file.audio_file && (
                <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                  <div className="font-medium text-gray-700">Audio File:</div>
                  <div className="text-gray-600">{file.audio_file.name}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    ID: {file.audio_file.id}<br/>
                    Drive ID: {file.audio_file.drive_id}
                  </div>
                  <button
                    onClick={() => setPendingM4A(file.audio_file)}
                    className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Select Audio for Processing
                  </button>
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
          onClick={() => handleExtractAudio()}
          disabled={extracting}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {extracting ? 'Extracting...' : 'Extract Next Audio File'}
        </button>

        {extractionComplete && (
          <button
            onClick={testStoredAudioPlayback}
            className="ml-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Test Stored Audio Playback
          </button>
        )}

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
            <div className="flex space-x-2 mt-2">
              <a 
                href={audioUrl} 
                download="audio-debug.m4a" 
                className="inline-block bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                Download Audio File for Testing
              </a>
              <button
                onClick={() => {
                  // Force browser to download
                  const link = document.createElement('a');
                  link.href = audioUrl;
                  link.download = `${pendingM4A?.name || 'extracted-audio'}.m4a`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="inline-block bg-green-500 hover:bg-green-700 text-white px-3 py-1 rounded"
              >
                Force Download
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              If playback doesn't work, download and try playing in your media player.
            </p>
          </div>
        )}
      </div>

      {pendingM4A && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-semibold">Found M4A File:</h2>
          <p>Name: {pendingM4A.name}</p>
          <p>Path: {pendingM4A.parent_path || 'Root'}</p>
          <div className="mt-3">
            <button
              onClick={testStoredAudioPlayback}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Play Audio from Supabase
            </button>
            <button
              onClick={async () => {
                try {
                  setProgress('Fetching directly from Google Drive...');
                  // Get file directly from Google Drive
                  const audioData = await fetchDriveFileContent(pendingM4A.drive_id);
                  console.log('✅ Direct download successful:', {
                    byteLength: audioData.byteLength,
                    sizeInMB: (audioData.byteLength / (1024 * 1024)).toFixed(2) + ' MB'
                  });
                  
                  // Create blob and URL
                  const audioBlob = new Blob([audioData], { type: 'audio/m4a' });
                  const url = URL.createObjectURL(audioBlob);
                  setAudioUrl(url);
                  setProgress('Playing audio directly from Google Drive');
                  toast.success('Direct download successful');
                } catch (error) {
                  console.error('❌ Direct download failed:', error);
                  toast.error('Failed to download directly');
                }
              }}
              className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded ml-2"
            >
              Direct Download Test
            </button>
            <p className="text-sm text-gray-500 mt-2">
              This will fetch the stored audio data from Supabase and play it,
              confirming it was correctly saved.
            </p>
          </div>
          <div className="mt-4 bg-yellow-50 p-3 rounded">
            <h3 className="font-medium text-yellow-800">Troubleshooting Steps:</h3>
            <ol className="list-decimal ml-5 text-sm mt-2 text-yellow-800">
              <li>Try "Direct Download Test" first to verify the file exists in Google Drive</li>
              <li>If direct download works but Supabase doesn't, try "Extract Audio File" again</li>
              <li>Check console logs for detailed error information</li>
            </ol>
          </div>
        </div>
      )}

      <button
        onClick={() => handleDirectProcess(pendingM4A)}
        disabled={extracting || !pendingM4A}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded ml-2"
      >
        Process Directly
      </button>

      {selectedForBatch.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <h3 className="font-medium">Batch Processing</h3>
          <p>{selectedForBatch.length} files selected</p>
          <button
            onClick={handleBatchProcess}
            disabled={extracting}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Process {selectedForBatch.length} Files
          </button>
          
          <button
            onClick={() => setSelectedForBatch([])}
            className="mt-2 ml-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Clear Selection
          </button>
        </div>
      )}

      {batchProgress && (
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <h3 className="font-medium">Batch Progress</h3>
          <p>Processing: {batchProgress.file}</p>
          <p>Status: {batchProgress.status}</p>
          <p>Progress: {batchProgress.processed} of {batchProgress.total}</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="mb-8 p-4 bg-white shadow rounded">
        <h2 className="text-lg font-semibold mb-4">Upload New File</h2>
        
        <div className="flex items-center">
          <label className="relative cursor-pointer bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
            <span>Select File</span>
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={isUploading}
              accept="video/mp4,audio/mp4,audio/m4a"
            />
          </label>
          
          {isUploading && (
            <div className="ml-4 flex items-center">
              <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-600">Uploading...</span>
            </div>
          )}
        </div>
        
        <p className="mt-2 text-sm text-gray-500">
          Upload MP4 video or audio files to process them.
        </p>
      </div>
    </div>
  );
} 