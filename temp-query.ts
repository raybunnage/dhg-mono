#\!/usr/bin/env ts-node
import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function main() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data, error } = await supabase
    .from('expert_documents')
    .select('id, source_id, document_type_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  console.log('Expert document IDs:');
  data.forEach(record => {
    console.log();
  });
}

main().catch(console.error);
