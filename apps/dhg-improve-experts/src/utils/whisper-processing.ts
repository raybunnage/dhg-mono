import { createParser } from 'eventsource-parser';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../file_types/supabase/types';
import OpenAI from 'openai';

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

export async function getVideoSummary(fileId: string): Promise<WhisperSummaryResult> {
  try {
    // Test OpenAI connection first
    const isConnected = await testOpenAIConnection();
    if (!isConnected) {
      throw new Error('Could not connect to OpenAI');
    }

    // Get video details from Supabase
    const { data: file, error } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) throw error;
    if (!file) throw new Error('File not found');

    // For testing, return mock data
    // TODO: Implement actual Whisper API call
    return {
      summary: `Test summary for ${file.name}`,
      duration: 0
    };
  } catch (error) {
    console.error('Error in getVideoSummary:', error);
    return {
      summary: '',
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 