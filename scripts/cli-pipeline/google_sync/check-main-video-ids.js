#!/usr/bin/env node

/**
 * Check Main Video ID Stats in sources_google2
 * 
 * This script checks how many files have main_video_id set
 * and provides statistics on main video usage.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

// Target root folder ID
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

async function main() {
  try {
    console.log('Checking main_video_id stats in sources_google2...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('sources_google2')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.error('Error getting total count:', totalError.message);
      return;
    }
    
    // Get count with main_video_id set
    const { count: withMainVideo, error: mainVideoError } = await supabase
      .from('sources_google2')
      .select('*', { count: 'exact', head: true })
      .not('main_video_id', 'is', null);
    
    if (mainVideoError) {
      console.error('Error getting main_video_id count:', mainVideoError.message);
      return;
    }
    
    console.log(`Total records: ${totalCount}`);
    console.log(`Records with main_video_id set: ${withMainVideo} (${Math.round(withMainVideo/totalCount*100)}%)`);
    console.log(`Records without main_video_id: ${totalCount - withMainVideo}`);
    
    // Get type breakdown for files with main_video_id
    console.log('\nFile types with main_video_id set:');
    const { data: mimeTypeData, error: mimeError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT mime_type, COUNT(*) as count
        FROM sources_google2
        WHERE main_video_id IS NOT NULL
        GROUP BY mime_type
        ORDER BY count DESC
        LIMIT 10
      `
    });
    
    if (mimeError) {
      console.error('Error getting mime type breakdown:', mimeError.message);
    } else if (mimeTypeData) {
      mimeTypeData.forEach(row => {
        console.log(`- ${row.mime_type || 'NULL'}: ${row.count} files`);
      });
    }
    
    // Get type breakdown for files without main_video_id
    console.log('\nFile types without main_video_id:');
    const { data: missingMimeData, error: missingMimeError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT mime_type, COUNT(*) as count
        FROM sources_google2
        WHERE main_video_id IS NULL
        GROUP BY mime_type
        ORDER BY count DESC
        LIMIT 10
      `
    });
    
    if (missingMimeError) {
      console.error('Error getting missing mime type breakdown:', missingMimeError.message);
    } else if (missingMimeData) {
      missingMimeData.forEach(row => {
        console.log(`- ${row.mime_type || 'NULL'}: ${row.count} files`);
      });
    }
    
    // Test the associations
    console.log('\nChecking some file associations:');
    const { data: testFiles, error: testError } = await supabase
      .from('sources_google2')
      .select('id, name, mime_type, main_video_id')
      .not('main_video_id', 'is', null)
      .limit(5);
    
    if (testError) {
      console.error('Error getting test files:', testError.message);
    } else if (testFiles) {
      for (const file of testFiles) {
        const { data: videoData, error: videoError } = await supabase
          .from('sources_google2')
          .select('name, mime_type')
          .eq('id', file.main_video_id)
          .single();
        
        if (videoError) {
          console.log(`- ${file.name}: Error retrieving main video: ${videoError.message}`);
        } else if (videoData) {
          console.log(`- ${file.name} (${file.mime_type}) → ${videoData.name} (${videoData.mime_type})`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking main_video_id stats:', error);
    process.exit(1);
  }
}

main();