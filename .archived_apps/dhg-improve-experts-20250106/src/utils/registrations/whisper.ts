import { functionRegistry } from '../function-registry';

functionRegistry.register('processAudioWithWhisper', {
  description: 'Processes audio files using OpenAI Whisper',
  status: 'experimental',
  location: 'src/utils/whisper-processing.ts',
  category: 'AUDIO_PROCESSING',
  dependencies: ['openai'],
  usedIn: ['document-processing'],
  targetPackage: 'audio-processing'
}); 