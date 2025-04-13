/**
 * Fix Clawson Paper File Paths
 * 
 * This script fixes file paths in the database that were not properly set during sync
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const FOLDER_ID = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';
const FOLDER_DB_ID = '7877d780-6ae3-4b59-a21d-c5a202b2dd8e';
const ROOT_PATH = '/DR Clawson papers';

async function fixPaths() {
  try {
    // Get all records related to the folder
    const { data: records, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`parent_folder_id.eq.${FOLDER_ID},drive_id.eq.${FOLDER_ID}`);
    
    if (error) {
      console.error('Error getting records:', error);
      return;
    }
    
    console.log(`Found ${records.length} records to process`);
    
    // Process each record
    for (const record of records) {
      // Skip the root folder itself
      if (record.id === FOLDER_DB_ID) {
        console.log(`Skipping root folder record: ${record.name}`);
        continue;
      }
      
      // Update path for direct children
      if (record.parent_folder_id === FOLDER_ID) {
        const newPath = `${ROOT_PATH}/${record.name}`;
        console.log(`Updating path for ${record.name} from "${record.path}" to "${newPath}"`);
        
        const { error: updateError } = await supabase
          .from('sources_google')
          .update({
            path: newPath,
            parent_path: ROOT_PATH,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
        
        if (updateError) {
          console.error(`Error updating ${record.name}:`, updateError);
        }
      }
    }
    
    console.log('Path updates complete');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixPaths()
  .then(() => console.log('\nFix complete'))
  .catch(err => console.error('Script error:', err))
  .finally(() => setTimeout(() => process.exit(0), 2000)); // Exit after 2 seconds