import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function main() {
  try {
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Query for possible duplicate files
    const { data, error } = await supabase
      .from('sources_google2')
      .select('name, count(*)')
      .group('name')
      .having('count(*)', 'gt', 1)
      .order('count(*)', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Files with multiple entries:');
    console.log(JSON.stringify(data, null, 2));
    
    // For specific file
    console.log('\nChecking "Stockdale_Seigel" files:');
    const { data: stockdaleData, error: stockdaleError } = await supabase
      .from('sources_google2')
      .select('id, drive_id, name, path, path_array, created_at, updated_at, modified_at')
      .ilike('name', '%Stockdale%Seigel%');
      
    if (stockdaleError) {
      console.error('Error:', stockdaleError);
      return;
    }
    
    console.log(JSON.stringify(stockdaleData, null, 2));
    
    // Check total count
    const { data: countData, error: countError } = await supabase
      .from('sources_google2')
      .select('count(*)', { count: 'exact' });
      
    if (countError) {
      console.error('Error:', countError);
      return;
    }
    
    console.log('\nTotal records in sources_google2:', countData[0].count);
    
    // Check recent additions
    const { data: recentData, error: recentError } = await supabase
      .from('sources_google2')
      .select('id, drive_id, name, created_at, updated_at, modified_at')
      .order('updated_at', { ascending: false })
      .limit(5);
      
    if (recentError) {
      console.error('Error:', recentError);
      return;
    }
    
    console.log('\nMost recently updated records:');
    console.log(JSON.stringify(recentData, null, 2));
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

main();
