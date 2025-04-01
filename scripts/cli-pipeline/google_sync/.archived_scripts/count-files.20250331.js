/**
 * Count files in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple count of all files
async function countAllFiles() {
  try {
    // Count the total records
    const { data, error } = await supabase
      .from('sources_google')
      .select('id');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`Total records in sources_google: ${data.length}`);
    
    // Check our folder specifically
    const folderId = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';
    const { data: folderData, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id')
      .eq('drive_id', folderId);
    
    if (folderError) {
      console.error('Error checking folder:', folderError);
      return;
    }
    
    console.log(`Found ${folderData.length} records with drive_id = ${folderId}`);
    
    // Check files with this parent folder
    const { data: childData, error: childError } = await supabase
      .from('sources_google')
      .select('id, name, parent_folder_id')
      .eq('parent_folder_id', folderId);
    
    if (childError) {
      console.error('Error checking children:', childError);
      return;
    }
    
    console.log(`Found ${childData.length} records with parent_folder_id = ${folderId}`);
    
    if (childData.length > 0) {
      console.log('First 5 children:');
      childData.slice(0, 5).forEach((record, i) => {
        console.log(`${i+1}. ${record.name}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

countAllFiles()
  .finally(() => setTimeout(() => process.exit(0), 2000));