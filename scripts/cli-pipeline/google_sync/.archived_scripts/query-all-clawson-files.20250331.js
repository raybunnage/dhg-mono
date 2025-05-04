/**
 * Query All Clawson Files
 * 
 * This script fetches all files related to the DR Clawson papers folder
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

async function queryAllFiles() {
  try {
    // Query all files related to the folder
    const { data, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`parent_folder_id.eq.${FOLDER_ID},drive_id.eq.${FOLDER_ID}`);
    
    if (error) {
      console.error('Error querying files:', error);
      return;
    }
    
    console.log(`Found ${data.length} files in the database`);
    
    // Print all files with their paths
    if (data.length > 0) {
      console.log('\nFiles:');
      data.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.mime_type}) - Path: ${file.path}`);
      });
    }
    
    // Format data into a hierarchy
    const fileHierarchy = {};
    data.forEach(file => {
      const path = file.path || '/unknown';
      const parts = path.split('/').filter(Boolean);
      
      let current = fileHierarchy;
      parts.forEach((part, i) => {
        if (!current[part]) {
          current[part] = {
            _file: i === parts.length - 1 ? file : null,
            _children: {}
          };
        }
        current = current[part]._children;
      });
    });
    
    console.log('\nFolder Hierarchy:');
    printHierarchy(fileHierarchy, 0);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

function printHierarchy(obj, level = 0) {
  const indent = '  '.repeat(level);
  
  Object.keys(obj).forEach(key => {
    const item = obj[key];
    const file = item._file;
    
    if (file) {
      console.log(`${indent}- ${file.name} (${file.mime_type})`);
    } else {
      console.log(`${indent}+ ${key}/`);
    }
    
    if (Object.keys(item._children).length > 0) {
      printHierarchy(item._children, level + 1);
    }
  });
}

queryAllFiles()
  .then(() => console.log('\nQuery complete'))
  .catch(err => console.error('Script error:', err))
  .finally(() => setTimeout(() => process.exit(0), 2000)); // Exit after 2 seconds