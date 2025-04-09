#!/usr/bin/env node

/**
 * This script checks the sources_google2 table
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
// Service role key from .env.development
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

async function main() {
  try {
    console.log('Checking sources_google2 table...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check sources_google2
    const { data: sg2Data, error: sg2Error } = await supabase
      .from('sources_google2')
      .select('*')
      .limit(1);
    
    if (sg2Error) {
      console.error('Error accessing sources_google2:', sg2Error.message);
      return;
    }
    
    console.log('sources_google2 accessible:', sg2Data !== null);
    
    if (sg2Data && sg2Data.length > 0) {
      console.log('sources_google2 has data:', sg2Data.length > 0);
      
      // Check sample record
      const record = sg2Data[0];
      console.log('\nSample record from sources_google2:');
      console.log('Fields:', Object.keys(record).join(', '));
      
      // Count records
      const { count: totalCount, error: countError } = await supabase
        .from('sources_google2')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error counting sources_google2 records:', countError.message);
      } else {
        console.log(`\nTotal records in sources_google2: ${totalCount}`);
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
      
      console.log('\nRoot folder counts in sources_google2:');
      for (const rootType of rootQueries) {
        const { count, error } = await supabase
          .from('sources_google2')
          .select('*', { count: 'exact', head: true })
          .eq('root_drive_id', rootType.id);
        
        if (error) {
          console.error(`Error counting ${rootType.name} records:`, error.message);
        } else {
          console.log(`- ${rootType.name}: ${count} records`);
        }
      }
    } else {
      console.log('No records found in sources_google2');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();