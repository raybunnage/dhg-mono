#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Database } from '../../../supabase/types';
import { promises as fs } from 'fs';
import * as path from 'path';

type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];

interface AudioGapResult {
  folder_drive_id: string;
  folder_name: string;
  mp4_file: {
    drive_id: string;
    name: string;
    size: number;
    web_view_link: string | null;
  };
  expected_m4a_name: string;
  local_path?: string;
}

export async function analyzeAudioGaps(options: { outputFile?: string; limit?: number } = {}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Analyzing folders for missing M4A audio files...');
  
  try {
    // First, get all MP4 files at path_depth = 0 with main_video_id
    const { data: mp4Files, error: mp4Error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('mime_type', 'video/mp4')
      .eq('path_depth', 0)
      .not('main_video_id', 'is', null)
      .order('name');
    
    if (mp4Error) {
      throw new Error(`Failed to fetch MP4 files: ${mp4Error.message}`);
    }
    
    if (!mp4Files || mp4Files.length === 0) {
      console.log('No MP4 files found at path_depth = 0 with main_video_id');
      return;
    }
    
    console.log(`Found ${mp4Files.length} MP4 files to check`);
    
    const gaps: AudioGapResult[] = [];
    
    // Check each MP4 file for corresponding M4A
    for (const mp4 of mp4Files) {
      if (!mp4.parent_folder_id) continue;
      
      // Expected M4A filename
      const expectedM4aName = mp4.name.replace('.mp4', '.m4a').replace('.MP4', '.m4a');
      
      // Check if M4A already exists in the same folder
      const { data: existingM4a, error: m4aError } = await supabase
        .from('google_sources')
        .select('*')
        .eq('parent_folder_id', mp4.parent_folder_id)
        .eq('name', expectedM4aName)
        .single();
      
      if (m4aError && m4aError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error(`Error checking for M4A: ${m4aError.message}`);
        continue;
      }
      
      // If no M4A exists, add to gaps
      if (!existingM4a) {
        // Get folder information
        const { data: folder, error: folderError } = await supabase
          .from('google_sources')
          .select('name')
          .eq('drive_id', mp4.parent_folder_id)
          .single();
        
        gaps.push({
          folder_drive_id: mp4.parent_folder_id,
          folder_name: folder?.name || 'Unknown Folder',
          mp4_file: {
            drive_id: mp4.drive_id,
            name: mp4.name,
            size: mp4.size || 0,
            web_view_link: mp4.web_view_link
          },
          expected_m4a_name: expectedM4aName
        });
      }
    }
    
    // Apply limit if specified
    const limitedGaps = options.limit ? gaps.slice(0, options.limit) : gaps;
    
    // Generate report
    console.log(`\n=== Audio Gap Analysis Report ===`);
    console.log(`Total MP4 files checked: ${mp4Files.length}`);
    console.log(`MP4 files missing M4A: ${gaps.length}`);
    if (options.limit && gaps.length > options.limit) {
      console.log(`Showing first ${options.limit} results`);
    }
    
    // Display results
    console.log('\nFolders needing M4A files:');
    console.log('─'.repeat(80));
    
    limitedGaps.forEach((gap, index) => {
      console.log(`\n${index + 1}. ${gap.folder_name}`);
      console.log(`   Folder ID: ${gap.folder_drive_id}`);
      console.log(`   MP4 File: ${gap.mp4_file.name}`);
      console.log(`   MP4 Size: ${(gap.mp4_file.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   Expected M4A: ${gap.expected_m4a_name}`);
      if (gap.mp4_file.web_view_link) {
        console.log(`   View MP4: ${gap.mp4_file.web_view_link}`);
      }
    });
    
    // Save to file if requested
    if (options.outputFile) {
      const outputPath = path.resolve(options.outputFile);
      const outputData = {
        analysis_date: new Date().toISOString(),
        total_mp4_files: mp4Files.length,
        total_gaps: gaps.length,
        gaps: limitedGaps
      };
      
      await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
      console.log(`\nAnalysis saved to: ${outputPath}`);
    }
    
    return limitedGaps;
    
  } catch (error) {
    console.error('Error analyzing audio gaps:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
  
  analyzeAudioGaps({
    outputFile,
    limit: limit ? parseInt(limit, 10) : undefined
  })
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}