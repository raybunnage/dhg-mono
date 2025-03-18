import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

async function checkDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  console.log('URL:', supabaseUrl);
  console.log('Key length:', supabaseKey.length);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get column information through a direct RPC call
    console.log('\nAttempting to check documentation_files table...');
    const { data: docFiles, error } = await supabase
      .from('documentation_files')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Error fetching documentation_files:', error);
    } else if (docFiles && docFiles.length > 0) {
      console.log('Sample record structure:');
      const record = docFiles[0];
      
      // Print the structure of the record
      for (const [key, value] of Object.entries(record)) {
        const type = typeof value;
        const hasValue = value !== null && value !== undefined;
        console.log(`- ${key}: ${type}${hasValue ? ' (has value)' : ' (empty)'}`);
      }
    }
    
    // Check document_types
    console.log('\nChecking document_types...');
    const { data: docTypesData, error: docTypesError } = await supabase
      .from('document_types')
      .select('*')
      .limit(5);
      
    if (docTypesError) {
      console.error('Error fetching document types:', docTypesError);
    } else if (docTypesData && docTypesData.length > 0) {
      console.log('Sample document types record structure:');
      const docTypeRecord = docTypesData[0];
      
      // Print the structure
      for (const [key, value] of Object.entries(docTypeRecord)) {
        const type = typeof value;
        console.log(`- ${key}: ${type}`);
      }
      
      // List the IDs
      console.log('\nDocument type IDs:');
      docTypesData.forEach(dt => {
        console.log(`- ${dt.id}`);
      });
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkDatabase().catch(console.error);