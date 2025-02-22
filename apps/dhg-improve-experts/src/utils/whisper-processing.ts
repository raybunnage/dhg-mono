import { createParser } from 'eventsource-parser';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../file_types/supabase/types';
import OpenAI from 'openai';
import { proxyGoogleDrive } from '@/api/proxy';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type VideoSummary = Database['public']['Tables']['video_summaries']['Row'];
type ProcessingCost = Database['public']['Tables']['processing_costs']['Row'];

// Add this before the OpenAI initialization
if (import.meta.env.DEV) {
  console.warn(
    'Warning: Using OpenAI client in browser environment.',
    'Make sure this is only used in development.'
  );
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: import.meta.env.DEV || import.meta.env.MODE === 'development'
});

// Add more detailed environment checks
function checkEnvironment() {
  const issues = [];
  
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    issues.push('OpenAI API key not found');
  }
  
  if (import.meta.env.VITE_OPENAI_API_KEY?.startsWith('sk-')) {
    console.log('OpenAI API key format looks valid');
  } else {
    issues.push('OpenAI API key format looks invalid');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

// Export the test function
export async function testOpenAIConnection() {
  try {
    // Check environment first
    const envCheck = checkEnvironment();
    if (!envCheck.isValid) {
      console.error('Environment issues:', envCheck.issues);
      return false;
    }

    // Test API connection
    const models = await openai.models.list();
    
    // Log available models for debugging
    console.log('Available OpenAI models:', 
      models.data.map(m => m.id).join(', ')
    );
    
    // Verify Whisper model is available
    const hasWhisper = models.data.some(m => m.id.includes('whisper'));
    if (!hasWhisper) {
      console.warn('Whisper model not found in available models');
    }

    return true;
  } catch (error) {
    console.error('OpenAI connection test failed:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      key: import.meta.env.VITE_OPENAI_API_KEY ? 'Key exists' : 'No key found'
    });
    return false;
  }
}

async function processVideo(fileId: string): Promise<VideoSummary> {
  try {
    // 1. Get video from Google Drive
    const { data: file } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', fileId)
      .single();

    // 2. Extract audio (using ffmpeg.wasm)
    const audioBuffer = await extractAudio(file.web_view_link);

    // 3. Send to Whisper API with summarize parameter
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: new FormData([
        ['file', audioBuffer],
        ['model', 'whisper-1'],
        ['response_format', 'text'],
        ['prompt', 'Provide a concise summary of the main points discussed'],
      ])
    });

    const summary = await response.text();

    // 4. Save summary
    await supabase
      .from('video_summaries')
      .upsert({
        source_id: fileId,
        status: 'completed',
        summary,
        updated_at: new Date().toISOString()
      });

    // Add cost tracking
    const trackUsage = async (durationMinutes: number): Promise<ProcessingCost> => {
      const cost = durationMinutes * 0.006;
      await supabase
        .from('processing_costs')
        .insert({
          service: 'whisper',
          duration_minutes: durationMinutes,
          cost_usd: cost,
          processed_at: new Date().toISOString()
        });
      return {
        id: '',
        service: 'whisper',
        duration_minutes: durationMinutes,
        cost_usd: cost,
        processed_at: new Date().toISOString()
      };
    };

    return {
      id: '',
      source_id: fileId,
      status: 'completed',
      summary,
      error: null,
      created_at: '',
      updated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error processing video:', error);
    await supabase
      .from('video_summaries')
      .upsert({
        source_id: fileId,
        status: 'error',
        error: error.message,
        updated_at: new Date().toISOString()
      });
    throw error;
  }
}

async function trackUsage(durationMinutes: number): Promise<ProcessingCost> {
  const cost = durationMinutes * 0.006;
  await supabase
    .from('processing_costs')
    .insert({
      service: 'whisper',
      duration_minutes: durationMinutes,
      cost_usd: cost,
      processed_at: new Date().toISOString()
    });
  return {
    id: '',
    service: 'whisper',
    duration_minutes: durationMinutes,
    cost_usd: cost,
    processed_at: new Date().toISOString()
  };
}

interface WhisperSummaryResult {
  summary: string;
  duration: number;
  error?: string;
}

async function extractAudioFromVideo(videoData: Blob): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  // Write video file to FFmpeg's virtual filesystem
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoData));
  
  // Extract audio
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vn', // No video
    '-acodec', 'libmp3lame',
    '-ac', '2', // Stereo
    '-ab', '160k', // Bitrate
    '-ar', '44100', // Sample rate
    'output.mp3'
  ]);

  // Read the audio file
  const data = await ffmpeg.readFile('output.mp3');
  return new Blob([data], { type: 'audio/mpeg' });
}

export async function getVideoSummary(fileId: string): Promise<WhisperSummaryResult> {
  try {
    console.log('Starting getVideoSummary for fileId:', fileId);

    // Get video details from Supabase
    const { data: file, error } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) throw error;
    if (!file) throw new Error('File not found');

    // Log what we found
    console.log('Found video file:', {
      name: file.name,
      type: file.mime_type,
      size: file.metadata?.size,
      parent_path: file.parent_path,
      drive_id: file.drive_id
    });

    // Get the access token
    const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Google Drive access token not found');
    }

    try {
      // First try to find an m4a file in the same folder
      const { data: audioFiles } = await supabase
        .from('sources_google')
        .select('*')
        .eq('parent_path', file.parent_path)
        .in('mime_type', ['audio/m4a', 'audio/x-m4a'])
        .eq('deleted', false);

      console.log('Found audio files in same folder:', 
        audioFiles?.map(f => ({
          name: f.name,
          type: f.mime_type,
          path: f.parent_path
        }))
      );

      let audioData: Blob;
      
      // If we found an m4a file with matching name pattern, use it
      const matchingAudio = audioFiles?.find(af => {
        // Remove extensions and audio/video labels
        const audioBaseName = af.name
          .toLowerCase()
          .replace('.m4a', '')
          .replace(' audio', '');
        
        const videoBaseName = file.name
          .toLowerCase()
          .replace('.mp4', '')
          .replace(' video', '');

        const matches = audioBaseName === videoBaseName;
        
        console.log('Comparing:', {
          audio: {
            original: af.name,
            baseName: audioBaseName,
            path: af.parent_path
          },
          video: {
            original: file.name,
            baseName: videoBaseName,
            path: file.parent_path
          },
          matches
        });

        return matches;
      });

      if (matchingAudio) {
        console.log('Found matching audio:', {
          name: matchingAudio.name,
          id: matchingAudio.id,
          drive_id: matchingAudio.drive_id
        });

        audioData = await proxyGoogleDrive(matchingAudio.drive_id, accessToken);
        console.log('Successfully got audio data:', {
          size: formatBytes(audioData.size),
          type: audioData.type
        });

        // For now, just return success message
        return {
          summary: `Successfully fetched audio: ${matchingAudio.name} (${formatBytes(audioData.size)})`,
          duration: 0
        };
      } else {
        console.log('No matching audio file found');
        return {
          summary: 'No matching audio file found',
          duration: 0,
          error: 'Need to extract audio first'
        };
      }

    } catch (driveError) {
      console.error('Drive fetch failed:', driveError);
      throw driveError;
    }

  } catch (error) {
    console.error('Error in getVideoSummary:', error);
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