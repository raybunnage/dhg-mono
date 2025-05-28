/**
 * Debug script to check expert profiles
 * 
 * This script will check if experts have processed content in their documents.
 */
import { supabase } from './integrations/supabase/client';

async function testExpertProcessedContent() {
  console.log('Testing expert processed content...');
  
  // Get a list of experts
  const { data: experts, error: expertsError } = await supabase
    .from('expert_profiles')
    .select('id, expert_name, metadata')
    .limit(5);
  
  if (expertsError) {
    console.error('Error fetching experts:', expertsError);
    return;
  }
  
  console.log('Experts with metadata:');
  for (const expert of experts) {
    console.log(`- ${expert.expert_name} (${expert.id}): Has metadata: ${!!expert.metadata}`);
    
    // Check if this expert has processed documents
    const { data: docs, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, title, processing_status, processed_content')
      .eq('expert_id', expert.id)
      .eq('processing_status', 'completed')
      .limit(1);
    
    if (docsError) {
      console.error(`Error fetching documents for ${expert.expert_name}:`, docsError);
      continue;
    }
    
    if (docs && docs.length > 0) {
      console.log(`  - Has processed document: ${docs[0].title} (${docs[0].id})`);
      console.log(`  - Processed content type: ${typeof docs[0].processed_content}`);
      console.log(`  - Has processed_content: ${!!docs[0].processed_content}`);
      
      if (docs[0].processed_content) {
        // Check if it's a string that needs parsing or already an object
        if (typeof docs[0].processed_content === 'string') {
          try {
            const parsed = JSON.parse(docs[0].processed_content);
            console.log(`  - Parsed content has keys: ${Object.keys(parsed).join(', ')}`);
          } catch (e) {
            console.error(`  - Error parsing content: ${e.message}`);
            console.log(`  - Content preview: ${docs[0].processed_content.substring(0, 100)}...`);
          }
        } else {
          console.log(`  - Content has keys: ${Object.keys(docs[0].processed_content).join(', ')}`);
        }
      }
    } else {
      console.log(`  - No processed documents`);
    }
  }
}

// Run the function
testExpertProcessedContent().catch(console.error);