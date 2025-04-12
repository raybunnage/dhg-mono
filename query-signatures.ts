import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function main() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Query for records with file_signature
  const { data: withSignature, error: error1 } = await supabase
    .from('sources_google2')
    .select('id, name, file_signature, modified_at')
    .not('file_signature', 'is', null)
    .limit(10);
    
  console.log('Records WITH file_signature:');
  console.log(JSON.stringify(withSignature, null, 2));
  
  // Query for records without file_signature
  const { data: withoutSignature, error: error2 } = await supabase
    .from('sources_google2')
    .select('id, name, modified_at')
    .is('file_signature', null)
    .limit(10);
    
  console.log('\nRecords WITHOUT file_signature:');
  console.log(JSON.stringify(withoutSignature, null, 2));
  
  // Count total records with and without file_signature
  const { count: countWith, error: error3 } = await supabase
    .from('sources_google2')
    .select('id', { count: 'exact', head: true })
    .not('file_signature', 'is', null);
    
  const { count: countWithout, error: error4 } = await supabase
    .from('sources_google2')
    .select('id', { count: 'exact', head: true })
    .is('file_signature', null);
    
  console.log('\nSummary:');
  console.log(`Records WITH file_signature: ${countWith}`);
  console.log(`Records WITHOUT file_signature: ${countWithout}`);
}

main().catch(console.error);
