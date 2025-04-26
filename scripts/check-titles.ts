import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function checkTitles() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, title, source_id')
      .in('id', ['75444efc-6e4c-48ec-ad16-e6cebe9921f9', '1eae97b4-7804-43a2-a265-e887f619855c']);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Updated documents:');
    for (const doc of data) {
      console.log(`- Document ID: ${doc.id}`);
      console.log(`  Title: ${doc.title}`);
      console.log('');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkTitles();