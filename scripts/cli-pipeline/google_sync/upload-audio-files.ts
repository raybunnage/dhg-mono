#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Database } from '../../../supabase/types';

type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];

interface BatchConfig {
  batchId: string;
  createdAt: string;
  totalFiles: number;
  localGoogleDrivePath?: string;
  outputDirectory: string;
  commands: ProcessingCommand[];
}

interface ProcessingCommand {
  index: number;
  mp4DriveId: string;
  mp4Name: string;
  m4aName: string;
  folderDriveId: string;
  folderName: string;
  inputPath?: string;
  outputPath?: string;
  ffmpegCommand?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export async function uploadAudioFiles(options: {
  batchId?: string;
  batchDir?: string;
  dryRun?: boolean;
} = {}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Uploading audio files to Google Drive...\n');
  
  try {
    // Find batch directory
    let batchDir: string;
    if (options.batchDir) {
      batchDir = options.batchDir;
    } else if (options.batchId) {
      // Default location based on batch ID
      batchDir = path.join(
        process.env.HOME || '~',
        'Documents',
        'dhg-audio-processing',
        options.batchId
      );
    } else {
      throw new Error('Either --batch-id or --batch-dir must be specified');
    }
    
    // Load batch configuration
    const configPath = path.join(batchDir, 'batch-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const batchConfig: BatchConfig = JSON.parse(configData);
    
    console.log(`Loaded batch: ${batchConfig.batchId}`);
    console.log(`Total files in batch: ${batchConfig.totalFiles}`);
    
    // Initialize Google Drive API
    let drive: any;
    try {
      const auth = await getGoogleAuth();
      drive = google.drive({ version: 'v3', auth });
    } catch (error) {
      console.error('Failed to initialize Google Drive API:', error);
      console.log('\n⚠️  Google Drive API not available');
      console.log('In dry-run mode, we\'ll simulate the upload process');
      
      if (!options.dryRun) {
        throw new Error('Google Drive API required for actual uploads. Use --dry-run to simulate.');
      }
    }
    
    // Process each command
    let uploaded = 0;
    let failed = 0;
    
    for (const command of batchConfig.commands) {
      console.log(`\n[${command.index}/${batchConfig.totalFiles}] Processing ${command.m4aName}`);
      
      // Check if M4A file exists locally
      const m4aPath = command.outputPath || path.join(batchConfig.outputDirectory, command.m4aName);
      
      try {
        const stats = await fs.stat(m4aPath);
        console.log(`  ✓ Found local file: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        
        if (options.dryRun) {
          console.log('  🔸 [DRY RUN] Would upload to folder:', command.folderName);
          console.log('  🔸 [DRY RUN] Would create database entry');
          uploaded++;
          continue;
        }
        
        // Upload to Google Drive
        console.log('  📤 Uploading to Google Drive...');
        const fileMetadata = {
          name: command.m4aName,
          parents: [command.folderDriveId]
        };
        
        const media = {
          mimeType: 'audio/x-m4a',
          body: require('fs').createReadStream(m4aPath)
        };
        
        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, size, webViewLink, mimeType'
        });
        
        console.log('  ✓ Uploaded successfully');
        console.log('  Drive ID:', response.data.id);
        
        // Create database entry
        console.log('  📝 Creating database entry...');
        const { error: dbError } = await supabase
          .from('google_sources')
          .insert({
            drive_id: response.data.id,
            name: response.data.name,
            mime_type: 'audio/x-m4a',
            parent_folder_id: command.folderDriveId,
            size: stats.size,
            web_view_link: response.data.webViewLink,
            path_depth: 0, // Same level as the MP4
            main_video_id: command.mp4DriveId, // Link to the source MP4
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (dbError) {
          console.error('  ⚠️  Database error:', dbError.message);
          failed++;
        } else {
          console.log('  ✓ Database entry created');
          uploaded++;
        }
        
      } catch (error: any) {
        console.error(`  ✗ Failed:`, error.message);
        failed++;
      }
    }
    
    // Summary
    console.log('\n=== Upload Summary ===');
    console.log(`Total files processed: ${batchConfig.totalFiles}`);
    console.log(`Successfully uploaded: ${uploaded}`);
    console.log(`Failed: ${failed}`);
    
    if (options.dryRun) {
      console.log('\n🔸 This was a DRY RUN - no files were actually uploaded');
    }
    
    // Update batch status
    const statusPath = path.join(batchDir, 'upload-status.json');
    await fs.writeFile(statusPath, JSON.stringify({
      completedAt: new Date().toISOString(),
      uploaded,
      failed,
      dryRun: options.dryRun || false
    }, null, 2));
    
    console.log(`\nUpload status saved to: ${statusPath}`);
    
  } catch (error) {
    console.error('Error uploading files:', error);
    throw error;
  }
}

async function getGoogleAuth() {
  // Try to load service account credentials
  const serviceAccountPath = path.join(process.cwd(), '.service-account.json');
  
  try {
    const credentials = JSON.parse(await fs.readFile(serviceAccountPath, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    return auth;
  } catch (error) {
    throw new Error('Failed to load Google service account credentials from .service-account.json');
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const batchId = args.find(arg => arg.startsWith('--batch-id='))?.split('=')[1];
  const batchDir = args.find(arg => arg.startsWith('--batch-dir='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  
  uploadAudioFiles({
    batchId,
    batchDir,
    dryRun
  })
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}