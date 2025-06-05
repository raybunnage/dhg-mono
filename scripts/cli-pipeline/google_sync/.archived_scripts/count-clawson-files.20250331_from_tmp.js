/**
 * Count Clawson Files
 * 
 * This script counts files in the DR Clawson papers folder
 * 
 * Usage:
 *   node tmp/count-clawson-files.js [--show-deleted]
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from multiple files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.development', '.env.local'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Process command-line arguments
const args = process.argv.slice(2);
const showDeleted = args.includes('--show-deleted');
const showAll = args.includes('--all');

// Dr. Clawson folder ID
const CLAWSON_FOLDER_ID = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';

// Ensure Supabase credentials are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function countRecords() {
  try {
    // Build query for all records
    let query = supabase
      .from('google_sources')
      .select('id, drive_id, name, mime_type, path, deleted, created_at, updated_at')
      .or(`parent_folder_id.eq.${CLAWSON_FOLDER_ID},drive_id.eq.${CLAWSON_FOLDER_ID}`);
    
    // If not showing all records, apply filters
    if (!showAll) {
      if (showDeleted) {
        // Show only deleted records
        query = query.eq('deleted', true);
      } else {
        // Show only active records
        query = query.eq('deleted', false);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching records:', error);
      return;
    }
    
    // Filter for stats
    const activeRecords = data.filter(record => !record.deleted);
    const deletedRecords = data.filter(record => record.deleted);
    
    console.log(`Total records for DR Clawson papers folder: ${data.length}`);
    console.log(`Active records: ${activeRecords.length}`);
    console.log(`Deleted records: ${deletedRecords.length}`);
    
    // Count files by mime type (for the currently visible records)
    const mimeTypeCounts = {};
    data.forEach(file => {
      const type = file.mime_type || 'unknown';
      mimeTypeCounts[type] = (mimeTypeCounts[type] || 0) + 1;
    });
    
    console.log('\nFiles by type:');
    Object.entries(mimeTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });
    
    // Get the root folder itself
    const { data: folder, error: folderError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('drive_id', CLAWSON_FOLDER_ID)
      .single();
    
    if (folderError) {
      console.error('Error getting folder:', folderError);
      return;
    }
    
    console.log('\nFolder details:');
    console.log(`- Name: ${folder.name}`);
    console.log(`- Path: ${folder.path || '/'}`);
    console.log(`- Drive ID: ${folder.drive_id}`);
    console.log(`- Created: ${new Date(folder.created_at).toLocaleString()}`);
    console.log(`- Updated: ${new Date(folder.updated_at).toLocaleString()}`);
    console.log(`- Deleted: ${folder.deleted ? 'Yes' : 'No'}`);
    
    // Show sample of current records
    if (data.length > 0 && data.length <= 10) {
      console.log('\nAll records:');
      data.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.mime_type || 'unknown'})`);
        console.log(`   Path: ${file.path || '/'}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Drive ID: ${file.drive_id}`);
        console.log(`   Deleted: ${file.deleted ? 'Yes' : 'No'}`);
        console.log(`   Updated: ${new Date(file.updated_at).toLocaleString()}`);
      });
    } else if (data.length > 10) {
      console.log('\nSample records (first 5):');
      data.slice(0, 5).forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.mime_type || 'unknown'})`);
        console.log(`   Path: ${file.path || '/'}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Drive ID: ${file.drive_id}`);
        console.log(`   Deleted: ${file.deleted ? 'Yes' : 'No'}`);
        console.log(`   Updated: ${new Date(file.updated_at).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

countRecords()
  .then(() => console.log('\nQuery complete'))
  .catch(err => console.error('Script error:', err));