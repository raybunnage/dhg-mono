/**
 * Debug script to check expert profile data
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const expertId = '090d6ec2-07c7-42cf-81b3-33648a5ff297';
    
    console.log(`Checking expert with ID: ${expertId}`);
    
    // First check what tables exist by listing some known ones
    console.log("Checking for known tables...");
    
    const tablesCheck = [
      'experts',
      'expert_documents',
      'documents',
      'sources_google'
    ];
    
    for (const tableName of tablesCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          console.log(`Table ${tableName}: ERROR - ${error.message}`);
        } else {
          console.log(`Table ${tableName}: EXISTS`);
        }
      } catch (e) {
        console.error(`Error checking table ${tableName}:`, e);
      }
    }
    
    // First check the experts table
    const { data: expert, error: expertError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name, metadata')
      .eq('id', expertId)
      .single();
      
    if (expertError) {
      console.error('Error fetching expert:', expertError.message);
      return;
    }
    
    console.log('Expert data:', {
      id: expert.id,
      expert_name: expert.expert_name,
      full_name: expert.full_name
    });
    
    console.log('Metadata type:', typeof expert.metadata);
    
    if (expert.metadata) {
      console.log('Metadata is present');
      if (typeof expert.metadata === 'object') {
        console.log('Metadata keys:', Object.keys(expert.metadata));
        
        // Check if metadata has expected fields for enhanced profile
        const hasName = expert.metadata.name !== undefined;
        const hasBio = expert.metadata.bio !== undefined;
        const hasExpertise = expert.metadata.expertise !== undefined;
        
        console.log('Enhanced profile fields in metadata:', {
          name: hasName,
          bio: hasBio,
          expertise: hasExpertise
        });
        
        // Check if metadata has the exact structure expected by EnhancedExpertProfile
        console.log('Is metadata in expected format:', hasName || hasBio || hasExpertise);
      }
    }
    
    // Get the table schema first to check what fields are available
    console.log("Checking expert_documents table schema...");
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'expert_documents');
    
    if (tableError) {
      console.error('Error fetching table schema:', tableError.message);
    } else {
      console.log('Expert_documents columns:', tables.map(t => t.column_name));
    }
    
    // Try expert_documents with expert_id
    console.log('Trying to query expert_documents with expert_id field...');
    const { data: docs, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, title, processing_status, processed_content')
      .eq('expert_id', expertId)
      .limit(5);
      
    if (docsError) {
      console.error('Error fetching documents with expert_id:', docsError.message);
      
      // If that fails, try with other potential field names
      console.log('Trying alternate field names...');
      const alternateFields = ['expertId', 'expert', 'expert_ref'];
      
      for (const field of alternateFields) {
        console.log(`Trying field: ${field}`);
        const { data: altDocs, error: altError } = await supabase
          .from('expert_documents')
          .select('id, title, processing_status, processed_content')
          .eq(field, expertId)
          .limit(5);
          
        if (!altError) {
          console.log(`Found documents using ${field} field: ${altDocs.length}`);
          return;
        } else {
          console.error(`Error with ${field}:`, altError.message);
        }
      }
      
      return;
    }
    
    console.log(`Found ${docs.length} documents`);
    
    // For each document, examine its processed_content
    for (const doc of docs) {
      console.log('Document:', {
        id: doc.id,
        title: doc.title,
        status: doc.processing_status,
        hasProcessedContent: doc.processed_content !== null
      });
      
      if (doc.processed_content) {
        const contentType = typeof doc.processed_content;
        console.log('Processed content type:', contentType);
        
        // If it's an object, check its keys
        if (contentType === 'object') {
          console.log('Content keys:', Object.keys(doc.processed_content));
          
          // Check for enhanced profile fields
          const content = doc.processed_content;
          const hasNameField = content.name !== undefined;
          const hasBioField = content.bio !== undefined;
          const hasExpertiseField = content.expertise !== undefined;
          
          console.log('Enhanced profile fields in document:', {
            name: hasNameField,
            bio: hasBioField,
            expertise: hasExpertiseField
          });
        } 
        // If it's a string, try parsing it as JSON
        else if (contentType === 'string') {
          console.log('String content length:', doc.processed_content.length);
          
          try {
            const parsed = JSON.parse(doc.processed_content);
            console.log('Successfully parsed content as JSON');
            console.log('Parsed content keys:', Object.keys(parsed));
            
            // Check for enhanced profile fields
            const hasNameField = parsed.name !== undefined;
            const hasBioField = parsed.bio !== undefined;
            const hasExpertiseField = parsed.expertise !== undefined;
            
            console.log('Enhanced profile fields in parsed content:', {
              name: hasNameField,
              bio: hasBioField,
              expertise: hasExpertiseField
            });
          } catch (e) {
            console.error('Error parsing content as JSON:', e.message);
            console.log('Content preview:', doc.processed_content.substring(0, 100));
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in script:', err);
  }
}

main().catch(console.error);