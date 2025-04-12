// Simple script to check for duplicate files in sources_google2
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get URL and key from env or set default for localhost
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '***REMOVED***';

async function main() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query all records from sources_google2
    const { data, error } = await supabase
      .from('sources_google2')
      .select('id, drive_id, name, path, created_at, updated_at')
      .order('name');
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    // Find duplicates by name
    const nameCount = {};
    data.forEach(record => {
      if (!nameCount[record.name]) {
        nameCount[record.name] = [];
      }
      nameCount[record.name].push(record);
    });
    
    // Filter for names with more than one entry
    const duplicates = Object.entries(nameCount)
      .filter(([name, records]) => records.length > 1)
      .map(([name, records]) => ({
        name,
        count: records.length,
        records
      }))
      .sort((a, b) => b.count - a.count);
    
    console.log('Files with duplicate names:');
    console.log(JSON.stringify(duplicates.slice(0, 10), null, 2));
    console.log(`Total files with duplicate names: ${duplicates.length}`);
    
    // Check for drive_id duplicates
    const driveIdCount = {};
    data.forEach(record => {
      if (!driveIdCount[record.drive_id]) {
        driveIdCount[record.drive_id] = [];
      }
      driveIdCount[record.drive_id].push(record);
    });
    
    // Filter for drive_ids with more than one entry
    const driveIdDuplicates = Object.entries(driveIdCount)
      .filter(([driveId, records]) => records.length > 1)
      .map(([driveId, records]) => ({
        drive_id: driveId,
        count: records.length,
        records
      }))
      .sort((a, b) => b.count - a.count);
    
    console.log('\nFiles with duplicate drive_ids:');
    console.log(JSON.stringify(driveIdDuplicates.slice(0, 10), null, 2));
    console.log(`Total files with duplicate drive_ids: ${driveIdDuplicates.length}`);
    
    // Check total count
    console.log('\nTotal records in sources_google2:', data.length);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main();