#!/usr/bin/env node

/**
 * This script checks the current status of the sources_google migration
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

async function main() {
  try {
    console.log('Checking migration status...');
    
    // Get Supabase client from singleton service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check if tables exist
    console.log('Checking tables...');
    
    // Check sources_google
    const { data: sgData, error: sgError } = await supabase
      .from('sources_google')
      .select('id')
      .limit(1);
    
    if (sgError) {
      console.error('Error accessing sources_google:', sgError.message);
    } else {
      console.log('sources_google accessible:', sgData !== null);
      
      if (sgData && sgData.length > 0) {
        console.log('sources_google has data:', sgData.length > 0);
        
        // Check schema
        const { data: sgSample, error: sgSampleError } = await supabase
          .from('sources_google')
          .select('*')
          .limit(1);
        
        if (sgSampleError) {
          console.error('Error getting sources_google sample:', sgSampleError.message);
        } else if (sgSample && sgSample.length > 0) {
          const record = sgSample[0];
          console.log('\nSources_google schema:');
          
          // Check for key fields
          const newFields = ['parent_folder_id', 'is_deleted', 'path_array', 'path_depth', 'main_video_id'];
          const oldFields = ['parent_id', 'deleted'];
          
          // Check new schema fields
          let hasNewSchema = true;
          for (const field of newFields) {
            const hasField = field in record;
            console.log(`- ${field}: ${hasField}`);
            if (!hasField) {
              hasNewSchema = false;
            }
          }
          
          // Check old schema fields
          let hasOldSchema = false;
          for (const field of oldFields) {
            const hasField = field in record;
            console.log(`- ${field}: ${hasField}`);
            if (hasField) {
              hasOldSchema = true;
            }
          }
          
          // Migration assessment
          console.log('\nMigration assessment:');
          if (hasNewSchema && !hasOldSchema) {
            console.log('✅ Migration COMPLETE - using new schema only');
          } else if (!hasNewSchema && hasOldSchema) {
            console.log('❌ Migration NOT STARTED - using old schema only');
          } else if (hasNewSchema && hasOldSchema) {
            console.log('⚠️ Migration IN PROGRESS - has both schemas');
          } else {
            console.log('❓ Migration status UNKNOWN - schema doesn\'t match expected patterns');
          }
        }
      }
    }
    
    // Check sources_google
    const { data: sg2Data, error: sg2Error } = await supabase
      .from('sources_google')
      .select('id')
      .limit(1);
    
    if (sg2Error) {
      console.log('sources_google not accessible (expected if migration completed)');
    } else {
      console.log('\nsources_google accessible:', sg2Data !== null);
      
      if (sg2Data && sg2Data.length > 0) {
        console.log('sources_google has data:', sg2Data.length > 0);
      }
    }
    
    // Check counts for the specific drive folders
    console.log('\nChecking root folder counts:');
    
    // Dynamic Healing Group
    const { count: dhgCount, error: dhgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV');
    
    if (dhgError) {
      console.error('Error counting DHG records:', dhgError.message);
    } else {
      console.log(`- Dynamic Healing Discussion Group: ${dhgCount} records`);
    }
    
    // Polyvagal Steering Group
    const { count: pvsgCount, error: pvsgError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .eq('root_drive_id', '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc');
    
    if (pvsgError) {
      console.error('Error counting PVSG records:', pvsgError.message);
    } else {
      console.log(`- Polyvagal Steering Group: ${pvsgCount} records`);
    }
    
    // Total records
    const { count: totalCount, error: totalError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.error('Error counting total records:', totalError.message);
    } else {
      console.log(`- Total records: ${totalCount}`);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main();