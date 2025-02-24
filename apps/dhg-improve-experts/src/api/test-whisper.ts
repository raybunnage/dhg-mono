import { openai } from '@/lib/openai';

export async function testWhisper(req: Request) {
  try {
    // Test Whisper-specific configuration
    const whisperModel = import.meta.env.VITE_WHISPER_MODEL;
    const whisperKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!whisperModel || !whisperKey) {
      throw new Error('Missing Whisper configuration');
    }

    // Just verify the model exists
    const models = await openai.models.list();
    const hasWhisperModel = models.data.some(m => m.id === whisperModel);

    if (!hasWhisperModel) {
      throw new Error(`Whisper model ${whisperModel} not found`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Whisper configuration verified'
    }));

  } catch (error) {
    console.error('Whisper test failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
} 