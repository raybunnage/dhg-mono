import { createParser } from 'eventsource-parser';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../file_types/supabase/types';

type VideoSummary = Database['public']['Tables']['video_summaries']['Row'];
type ProcessingCost = Database['public']['Tables']['processing_costs']['Row'];

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