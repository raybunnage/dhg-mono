const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.development' });

async function main() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (\!supabaseUrl || \!supabaseKey) {
      console.error('Missing Supabase credentials');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Fetching expert documents...');
    
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select('id, source_id, document_type_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }
    
    console.log('Expert document IDs:');
    
    data.forEach((record, index) => {
      console.log(`[${index + 1}] ID: ${record.id}`);
      console.log(`    Source ID: ${record.source_id}`);
      console.log(`    Document Type ID: ${record.document_type_id || 'None'}`);
      console.log(`    Created At: ${record.created_at}`);
      console.log('-----------------------------------');
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main();
