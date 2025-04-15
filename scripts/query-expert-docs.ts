#\!/usr/bin/env ts-node
import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function main() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('Fetching expert documents...');
    
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_type_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    if (\!data || data.length === 0) {
      console.log('No expert documents found');
      return;
    }
    
    console.log('\nRecent Expert Documents:');
    console.log('-----------------------');
    
    data.forEach((doc, index) => {
      console.log(`[${index + 1}] ID: ${doc.id}`);
      console.log(`    Source ID: ${doc.source_id}`);
      console.log(`    Document Type ID: ${doc.document_type_id || 'None'}`);
      console.log(`    Created At: ${doc.created_at}`);
      console.log('-----------------------');
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main();
