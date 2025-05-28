# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Diagnose Presentations
 * 
 * This script analyzes presentations and their relationships to MP4 files
 * to help diagnose issues with the sync process.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Set log level
Logger.setLevel(LogLevel.INFO);

/**
 * Main diagnostic function
 */
async function diagnosePresentations(): Promise<void> {
  console.log('\n=== Diagnosing Presentations ===\n');

  try {
    // Initialize Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 1. Count total presentations
    const { data: allPresentations, error: presentationError } = await supabase
      .from('presentations')
      .select('id', { count: 'exact' });
    
    if (presentationError) {
      Logger.error(`Error fetching presentations: ${presentationError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Total presentations: ${allPresentations?.length || 0}`);
    
    // 2. Count presentations with NULL main_video_id
    const { data: nullVideoPresentations, error: nullError } = await supabase
      .from('presentations')
      .select('id', { count: 'exact' })
      .is('main_video_id', null);
    
    if (nullError) {
      Logger.error(`Error fetching null video presentations: ${nullError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Presentations with NULL main_video_id: ${nullVideoPresentations?.length || 0}`);
    
    // 3. Get a sample of presentations with NULL main_video_id
    const { data: sampleNullPresentations, error: sampleError } = await supabase
      .from('presentations')
      .select('id, title, filename')
      .is('main_video_id', null)
      .limit(5);
    
    if (sampleError) {
      Logger.error(`Error fetching sample null presentations: ${sampleError.message}`);
    } else if (sampleNullPresentations && sampleNullPresentations.length > 0) {
      Logger.info('\nSample presentations with NULL main_video_id:');
      sampleNullPresentations.forEach(p => {
        Logger.info(`- ${p.title || p.filename} (${p.id})`);
      });
      
      // 4. Check if these presentations have assets
      const presentationIds = sampleNullPresentations.map(p => p.id);
      
      const { data: presentationAssets, error: assetError } = await supabase
        .from('presentation_assets')
        .select('presentation_id, asset_type, source_id, expert_document_id')
        .in('presentation_id', presentationIds);
      
      if (assetError) {
        Logger.error(`Error fetching presentation assets: ${assetError.message}`);
      } else {
        // Group assets by presentation_id
        const assetsByPresentation: Record<string, any[]> = {};
        if (presentationAssets) {
          presentationAssets.forEach((asset: any) => {
            if (!assetsByPresentation[asset.presentation_id]) {
              assetsByPresentation[asset.presentation_id] = [];
            }
            assetsByPresentation[asset.presentation_id].push(asset);
          });
        }
        
        Logger.info('\nAssets for sample presentations:');
        sampleNullPresentations.forEach(p => {
          const assets = assetsByPresentation[p.id] || [];
          Logger.info(`- ${p.title || p.filename}: ${assets.length} assets`);
          assets.forEach((asset: any) => {
            const sourceInfo = asset.source_id ? `source_id: ${asset.source_id}` : 'no source_id';
            const expertDocInfo = asset.expert_document_id ? `expert_doc: ${asset.expert_document_id}` : 'no expert_doc';
            Logger.info(`  * ${asset.asset_type} (${sourceInfo}, ${expertDocInfo})`);
          });
        });
      }
    }
    
    // 5. Count presentations with video assets but no main_video_id
    const { data: fixablePresentations, error: fixableError } = await supabase
      .from('presentations')
      .select(`
        id, 
        presentation_assets!inner(
          id,
          source_id,
          sources_google:source_id(
            mime_type
          )
        )
      `)
      .is('main_video_id', null)
      .eq('presentation_assets.sources_google.mime_type', 'video/mp4');
    
    if (fixableError) {
      Logger.error(`Error fetching fixable presentations: ${fixableError.message}`);
    } else {
      Logger.info(`\nPresentations with NULL main_video_id but have video assets: ${fixablePresentations?.length || 0}`);
    }
    
    // 6. Count total MP4 files
    const { data: mp4Files, error: mp4Error } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('deleted', false)
      .eq('mime_type', 'video/mp4');
    
    if (mp4Error) {
      Logger.error(`Error fetching MP4 files: ${mp4Error.message}`);
    } else {
      Logger.info(`\nTotal MP4 files: ${mp4Files?.length || 0}`);
    }
    
    // 7. Count MP4 files in Dynamic Healing Discussion Group
    const folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Dynamic Healing Discussion Group
    
    // Get folder info
    const { data: folderInfo, error: folderError } = await supabase
      .from('google_sources')
      .select('name, path')
      .eq('drive_id', folderId)
      .single();
    
    if (folderError) {
      Logger.error(`Error fetching folder info: ${folderError.message}`);
    } else if (folderInfo) {
      // Count MP4 files with parent paths containing the folder name
      const { data: folderMp4Files, error: folderMp4Error } = await supabase
        .from('google_sources')
        .select('id, name, parent_path', { count: 'exact' })
        .eq('deleted', false)
        .eq('mime_type', 'video/mp4')
        .or(`parent_path.ilike.%${folderInfo.name}%,parent_folder_id.eq.${folderId}`);
      
      if (folderMp4Error) {
        Logger.error(`Error fetching folder MP4 files: ${folderMp4Error.message}`);
      } else {
        Logger.info(`MP4 files in "${folderInfo.name}": ${folderMp4Files?.length || 0}`);
      }
    }
    
    // 8. Count presentations with main_video_id
    const { data: withVideoPresentations, error: withVideoError } = await supabase
      .from('presentations')
      .select('id', { count: 'exact' })
      .not('main_video_id', 'is', null);
    
    if (withVideoError) {
      Logger.error(`Error fetching presentations with video: ${withVideoError.message}`);
    } else {
      Logger.info(`\nPresentations with main_video_id: ${withVideoPresentations?.length || 0}`);
    }
    
    console.log('\n=== Diagnosis Complete ===\n');
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
diagnosePresentations().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});