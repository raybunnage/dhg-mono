// Temporarily disabled Node.js specific code
// import fs from 'fs';
// import path from 'path';
import { fetchDriveFileContent, fetchDriveFileMetadata } from './google-drive';
import { supabase } from '@/integrations/supabase/client';

// Disabled for browser compatibility
// const TEMP_DIR = path.join(process.cwd(), 'temp-audio');
// if (!fs.existsSync(TEMP_DIR)) {
//   fs.mkdirSync(TEMP_DIR, { recursive: true });
// }

// Browser-safe path joining utility (unused for now)
const joinPaths = (...paths) => {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
};

/**
 * TEMPORARILY DISABLED - Will be reimplemented for server compatibility
 */
export async function downloadAudioToLocal(driveId: string, fileName: string) {
  console.log('📥 [DISABLED] Would download file:', fileName);
  
  // Return mock data for now
  return {
    path: `temp-audio/${driveId}_${fileName}`,
    size: 1024 * 1024 // 1MB placeholder
  };
}

/**
 * TEMPORARILY DISABLED - Will be reimplemented for server compatibility
 */
export async function processAudioFile(sourceFile: {
  id: string;
  drive_id: string;
  name: string;
}, updateProgress: (msg: string) => void) {
  console.log('⚠️ Audio processing temporarily disabled');
  updateProgress('Audio processing temporarily disabled');
  
  // Return mock data to prevent UI errors
  return {
    text: "Audio processing is temporarily disabled",
    segments: [],
    summary: "This feature will be available soon"
  };
}

// Placeholder for your Whisper integration
async function processWithWhisper(filePath: string) {
  console.log('🔊 [DISABLED] Would process with Whisper:', filePath);
  
  // Return mock data
  return {
    text: "Audio processing is temporarily disabled",
    segments: [],
    summary: "This feature will be available soon"
  };
}

// Store just the results, not the audio
async function storeTranscriptionResults(fileId: string, transcription: any) {
  console.log('💾 [DISABLED] Would store results for:', fileId);
  // No database updates for now
  return { success: true };
} 