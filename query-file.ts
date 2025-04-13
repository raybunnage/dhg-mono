import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function main() {
  const driveId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`Querying for file with drive_id: ${driveId}`);
  
  const { data, error } = await supabase
    .from('sources_google2')
    .select('*')
    .eq('drive_id', driveId);
    
  if (error) {
    console.error('Error querying database:', error);
    return;
  }
  
  console.log('Results:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
