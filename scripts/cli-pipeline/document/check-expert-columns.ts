/**
 * Check expert and expert_documents tables columns directly
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const expertId = '090d6ec2-07c7-42cf-81b3-33648a5ff297';
  
  console.log(`Checking database structure for expert ${expertId}`);
  
  // First, check if the expert_documents table exists
  try {
    const { data: expert, error } = await supabase
      .from('expert_profiles')
      .select('*')
      .eq('id', expertId)
      .single();
      
    if (error) {
      console.error('Error fetching expert:', error.message);
    } else {
      console.log('Expert found:', {
        id: expert.id,
        name: expert.expert_name,
        hasMetadata: !!expert.metadata
      });
      
      // Check metadata formats
      if (expert.metadata) {
        if (typeof expert.metadata === 'object') {
          console.log('Metadata keys:', Object.keys(expert.metadata));
        }
      }
    }
    
    // Try a direct approach to get data from expert_documents with a raw SQL query
    console.log('\nAttempting direct SQL query to examine expert_documents structure');
    const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', {
      sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'google_expert_documents'"
    });
    
    if (sqlError) {
      console.error('SQL error:', sqlError.message);
    } else {
      console.log('Expert_documents columns:');
      console.table(sqlResult);
      
      // Now try to get documents for this expert with the correct column name
      if (sqlResult && sqlResult.length > 0) {
        // Find column names that might refer to an expert
        const expertColumns = sqlResult
          .filter(col => col.column_name.toLowerCase().includes('expert'))
          .map(col => col.column_name);
          
        console.log('Potential expert columns:', expertColumns);
        
        // Try each potential column
        for (const column of expertColumns) {
          console.log(`\nQuerying with column: ${column}`);
          
          const { data: docs, error: docsError } = await supabase.rpc('exec_sql', {
            sql_query: `SELECT id, title FROM expert_documents WHERE ${column} = '${expertId}' LIMIT 5`
          });
          
          if (docsError) {
            console.error(`Error with ${column}:`, docsError.message);
          } else {
            console.log(`Results for ${column}:`, docs);
            if (docs && docs.length > 0) {
              console.log(`Found ${docs.length} documents using ${column}`);
              console.table(docs);
            } else {
              console.log(`No documents found using ${column}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in script:', err);
  }
}

main().catch(console.error);