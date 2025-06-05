#\!/usr/bin/env ts-node

import { SupabaseClientService } from '../packages/shared/services/supabase-client';

async function main() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get 5 most recent expert documents
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select('id, source_id, document_type_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error fetching expert documents:', error);
      process.exit(1);
    }
    
    console.log('Recent Expert Documents:');
    console.log('-----------------------');
    data.forEach((doc, i) => {
      console.log(`[${i+1}] ID: ${doc.id}`);
      console.log(`    Source ID: ${doc.source_id}`);
      console.log(`    Document Type ID: ${doc.document_type_id}`);
      console.log(`    Created At: ${doc.created_at}`);
      console.log('-----------------------');
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main();
