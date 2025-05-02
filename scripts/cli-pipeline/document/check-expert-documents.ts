/**
 * Check expert_documents table structure
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check expert_documents table structure directly with raw SQL
    const { data, error } = await supabase.rpc('get_table_structure', {
      table_name: 'expert_documents'
    });
    
    if (error) {
      console.error('Error fetching table structure:', error.message);
      
      // Try alternative approach with a direct query to pg_catalog
      console.log('Trying alternative approach...');
      
      const { data: columns, error: columnsError } = await supabase.rpc('list_columns', {
        table_name: 'expert_documents'
      });
      
      if (columnsError) {
        console.error('Error fetching columns:', columnsError.message);
        return;
      }
      
      console.log('Columns in expert_documents:');
      console.table(columns);
      return;
    }
    
    console.log('Expert_documents table structure:');
    console.table(data);
    
    // Check for documents related to our expert
    const expertId = '090d6ec2-07c7-42cf-81b3-33648a5ff297';
    console.log(`\nChecking for documents with expert_id = ${expertId}`);
    
    // Try to query based on the column name we discovered
    try {
      for (const column of ['expert_id', 'expertId', 'expert']) {
        console.log(`\nTrying column: ${column}`);
        
        const { data: docs, error: docsError } = await supabase
          .from('expert_documents')
          .select('id, title, created_at')
          .eq(column, expertId)
          .limit(5);
          
        if (docsError) {
          console.error(`Error with ${column}:`, docsError.message);
        } else {
          console.log(`Found ${docs.length} documents with ${column}`);
          if (docs.length > 0) {
            console.table(docs);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error querying documents:', e);
    }
  } catch (err) {
    console.error('Error in script:', err);
  }
}

main().catch(console.error);