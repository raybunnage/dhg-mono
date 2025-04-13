import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../supabase/types';
import OpenAI from 'openai';
import { proxyGoogleDrive } from '@/api/proxy';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB in bytes

// Add a test function for FFmpeg
async function testFFmpeg() {
  try {
    console.log('🔍 Testing FFmpeg setup...');
    
    const ffmpeg = new FFmpeg();
    console.log('✅ FFmpeg instance created');

    await ffmpeg.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
      workerURL: '/ffmpeg-worker.js'
    });
    console.log('✅ FFmpeg loaded');

    // Test with a simple command
    const result = await ffmpeg.exec(['-version']);
    console.log('FFmpeg version:', new TextDecoder().decode(new Uint8Array(result)));

    return true;
  } catch (error) {
    console.error('❌ FFmpeg test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    return false;
  }
}

// Update the test function to check both OpenAI and FFmpeg
export async function testOpenAIConnection() {
  try {
    // Test FFmpeg first
    const ffmpegWorking = await testFFmpeg();
    console.log('FFmpeg status:', ffmpegWorking ? '✅ Working' : '❌ Not working');

    // Then test OpenAI
    const models = await openai.models.list();
    console.log('Available OpenAI models:', 
      models.data.map(m => m.id).join(', ')
    );

    return ffmpegWorking;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

interface WhisperSummaryResult {
  summary: string;
  duration: number;
  error?: string;
}

// Simple chunking strategy
async function splitIntoChunks(audioData: ArrayBuffer): Promise<File[]> {
  console.log('🔄 Starting chunk splitting process...', {
    totalSize: formatBytes(audioData.byteLength),
    maxChunkSize: formatBytes(MAX_WHISPER_SIZE)
  });

  const chunks: File[] = [];
  const totalLength = audioData.byteLength;
  let offset = 0;
  let chunkIndex = 0;

  // Use a smaller max size to ensure we're well under the limit
  const SAFE_CHUNK_SIZE = MAX_WHISPER_SIZE - 2000000; // 2MB safety margin

  try {
    while (offset < totalLength) {
      console.log(`📊 Processing chunk ${chunkIndex}:`, {
        progress: `${formatBytes(offset)} of ${formatBytes(totalLength)}`,
        percentComplete: ((offset / totalLength) * 100).toFixed(1) + '%'
      });

      const chunkSize = Math.min(SAFE_CHUNK_SIZE, totalLength - offset);
      const chunk = audioData.slice(offset, offset + chunkSize);
      
      const chunkFile = new File(
        [chunk], 
        `chunk_${chunkIndex}.m4a`,
        { 
          type: 'audio/m4a',
          lastModified: Date.now()
        }
      );

      // Verify chunk size
      console.log(`🔍 Verifying chunk ${chunkIndex}:`, {
        requestedSize: formatBytes(chunkSize),
        actualSize: formatBytes(chunkFile.size),
        maxAllowed: formatBytes(MAX_WHISPER_SIZE),
        isWithinLimit: chunkFile.size <= MAX_WHISPER_SIZE
      });

      if (chunkFile.size > MAX_WHISPER_SIZE) {
        throw new Error(`Chunk ${chunkIndex} exceeds size limit: ${formatBytes(chunkFile.size)}`);
      }

      chunks.push(chunkFile);
      console.log(`✅ Added chunk ${chunkIndex}`);
      
      offset += chunkSize;
      chunkIndex++;
    }

    console.log('🎉 Chunking complete:', {
      totalChunks: chunks.length,
      totalSize: formatBytes(chunks.reduce((acc, c) => acc + c.size, 0)),
      individualSizes: chunks.map((c, i) => `Chunk ${i}: ${formatBytes(c.size)}`)
    });

    return chunks;
  } catch (error) {
    console.error('❌ Error during chunk creation:', error);
    throw error;
  }
}

async function convertToMp3(audioData: Blob): Promise<Blob> {
  console.log('🔄 Converting audio to MP3 format...');
  try {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    console.log('✅ FFmpeg loaded');

    // Write input file
    await ffmpeg.writeFile('input.m4a', await fetchFile(audioData));
    console.log('✅ Input file written');

    // Convert to MP3
    await ffmpeg.exec([
      '-i', 'input.m4a',
      '-acodec', 'libmp3lame',
      '-ac', '2',  // stereo
      '-ar', '44100',  // sample rate
      'output.mp3'
    ]);
    console.log('✅ Conversion complete');

    // Read the output file
    const data = await ffmpeg.readFile('output.mp3');
    const mp3Blob = new Blob([data], { type: 'audio/mpeg' });
    console.log('✅ MP3 file created:', formatBytes(mp3Blob.size));

    return mp3Blob;
  } catch (error) {
    console.error('❌ Error converting to MP3:', error);
    throw error;
  }
}

async function processChunk(chunk: File, index: number): Promise<string> {
  try {
    console.log(`🎯 Processing chunk ${index}:`, {
      name: chunk.name,
      size: formatBytes(chunk.size),
      type: chunk.type
    });

    // Convert chunk to MP3
    const mp3Data = await convertToMp3(chunk);
    
    // Create MP3 file
    const mp3File = new File(
      [mp3Data],
      `chunk_${index}.mp3`,
      { type: 'audio/mpeg' }
    );

    console.log(`📦 Converted chunk ${index}:`, {
      originalSize: formatBytes(chunk.size),
      mp3Size: formatBytes(mp3File.size)
    });

    // Create FormData with MP3
    const formData = new FormData();
    formData.append('file', mp3File);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    // Make the request
    console.log(`🚀 Sending MP3 chunk ${index} to Whisper...`);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
      },
      body: formData
    });

    // Log response details
    console.log(`📥 Got response for chunk ${index}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error for chunk ${index}:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Chunk ${index} failed: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    console.log(`✅ Successfully processed chunk ${index}:`, {
      textLength: text.length,
      preview: text.slice(0, 100) + '...'
    });

    return text;
  } catch (error) {
    console.error(`❌ Error processing chunk ${index}:`, error);
    throw error;
  }
}

export async function getVideoSummary(fileId: string): Promise<WhisperSummaryResult> {
  try {
    console.log('🎬 Starting video summary for fileId:', fileId);

    // Get matching audio file info
    const { data: file } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', fileId)
      .single();

    if (!file) throw new Error('File not found');
    console.log('📄 Found file:', {
      name: file.name,
      type: file.mime_type,
      driveId: file.drive_id
    });

    // Get the audio data
    console.log('🔄 Fetching audio data from Drive...');
    const audioData = await proxyGoogleDrive(
      file.drive_id, 
      import.meta.env.VITE_GOOGLE_ACCESS_TOKEN
    );
    console.log('✅ Got audio data:', {
      type: typeof audioData,
      isArrayBuffer: audioData instanceof ArrayBuffer,
      size: formatBytes(audioData.byteLength || 0)
    });

    // Split into chunks
    console.log('✂️ Starting to split audio into chunks...');
    try {
      const chunks = await splitIntoChunks(audioData);
      console.log(`📦 Successfully split into ${chunks.length} chunks`);

      // Process chunks sequentially to maintain order
      console.log('🎯 Starting to process chunks...');
      const results: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`⏳ Processing chunk ${i + 1} of ${chunks.length}`);
        try {
          const result = await processChunk(chunks[i], i);
          results.push(result);
          console.log(`✅ Completed chunk ${i + 1} of ${chunks.length}`);
        } catch (chunkError) {
          console.error(`❌ Error processing chunk ${i + 1}:`, chunkError);
          throw chunkError;
        }
      }

      console.log('🎉 All chunks processed successfully');
      return {
        summary: results.join(' '),
        duration: 0
      };
    } catch (splitError) {
      console.error('❌ Error splitting audio:', splitError);
      throw splitError;
    }

  } catch (error) {
    console.error('❌ Error in getVideoSummary:', error);
    return {
      summary: '',
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to format bytes
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 