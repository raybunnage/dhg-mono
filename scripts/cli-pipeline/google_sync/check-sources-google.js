#!/usr/bin/env node

/**
 * This script checks the sources_google table
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

async function main() {
  try {
    console.log('Checking sources_google table...');
    
    // Get Supabase client using the singleton service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check sources_google
    const { data: sg2Data, error: sg2Error } = await supabase
      .from('sources_google')
      .select('*')
      .limit(1);
    
    if (sg2Error) {
      console.error('Error accessing sources_google:', sg2Error.message);
      return;
    }
    
    console.log('sources_google accessible:', sg2Data !== null);
    
    if (sg2Data && sg2Data.length > 0) {
      console.log('sources_google has data:', sg2Data.length > 0);
      
      // Check sample record
      const record = sg2Data[0];
      console.log('\nSample record from sources_google:');
      console.log('Fields:', Object.keys(record).join(', '));
      
      // Count records
      const { count: totalCount, error: countError } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error counting sources_google records:', countError.message);
      } else {
        console.log(`\nTotal records in sources_google: ${totalCount}`);
      }
      
      // Check for our target root folders
      const rootQueries = [
        {
          name: 'Dynamic Healing Discussion Group',
          id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
        },
        {
          name: 'Polyvagal Steering Group',
          id: '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc'
        }
      ];
      
      console.log('\nRoot folder counts in sources_google:');
      for (const rootType of rootQueries) {
        const { count, error } = await supabase
          .from('sources_google')
          .select('*', { count: 'exact', head: true })
          .eq('root_drive_id', rootType.id);
        
        if (error) {
          console.error(`Error counting ${rootType.name} records:`, error.message);
        } else {
          console.log(`- ${rootType.name}: ${count} records`);
        }
      }
    } else {
      console.log('No records found in sources_google');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();