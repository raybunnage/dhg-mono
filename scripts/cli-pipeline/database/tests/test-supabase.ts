// Simple test for Supabase output
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';

async function main() {
  console.log("Starting Supabase test script");
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get a few document types as a simple test
    const { data, error } = await supabase
      .from('document_types')
      .select('id, document_type')
      .limit(5);
      
    if (error) {
      console.error("Error fetching document types:", error.message);
      return;
    }
    
    console.log("Retrieved document types:");
    console.log("=======================");
    data.forEach((item, index) => {
      console.log(`${index + 1}. ${item.document_type} (ID: ${item.id})`);
    });
    console.log("=======================");
    
  } catch (error) {
    console.error("Exception occurred:", error);
  }
}

main();