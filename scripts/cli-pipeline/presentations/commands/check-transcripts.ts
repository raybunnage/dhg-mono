import { SupabaseClientService } from '../packages/shared/services/supabase-client';

async function checkRawContent() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get document type for transcripts
    const { data: docType } = await supabase
      .from('document_types')
      .select('id')
      .eq('document_type', 'Video Summary Transcript')
      .single();
      
    if (!docType) {
      console.log('Document type not found');
      return;
    }
    
    console.log('Document type ID:', docType.id);
    
    // Get presentations from missing list
    const { data: presentations } = await supabase
      .from('media_presentations')
      .select('id, title, main_video_id')
      .in('id', [
        '9927be5c-2606-4b8b-9061-911d013473bd',  // Gervitz.3.24.21
        'f497c52d-b046-4c44-a982-27f06eca47f3',  // Carter.8.26.20
        'ded77cb9-8380-4c29-82dc-c39e30a9e15c',  // Kovacic.Porges.106.21
      ]);
      
    console.log(`Found ${presentations?.length || 0} presentations`);
    
    if (!presentations || presentations.length === 0) {
      console.log('No presentations found');
      return;
    }
    
    for (const presentation of presentations) {
      console.log(`\nPresentation: ${presentation.title} (${presentation.id})`);
      console.log(`Main video ID: ${presentation.main_video_id}`);
      
      // Check for expert_documents with this source ID
      const { data: expertDocs } = await supabase
        .from('expert_documents')
        .select('id, document_type_id, status, created_at, updated_at')
        .eq('source_id', presentation.main_video_id);
      
      if (!expertDocs || expertDocs.length === 0) {
        console.log('No expert_documents found for this source');
      } else {
        console.log(`Found ${expertDocs.length} expert_documents`);
        
        for (const doc of expertDocs) {
          console.log(`Doc ID: ${doc.id}, Type: ${doc.document_type_id}, Status: ${doc.status}`);
          
          // Check if this doc has raw_content
          const { data, error } = await supabase
            .from('expert_documents')
            .select('raw_content')
            .eq('id', doc.id)
            .single();
          
          if (error) {
            console.log(`Error checking raw_content: ${error.message}`);
          } else if (data && data.raw_content) {
            const contentLength = data.raw_content.length;
            const preview = data.raw_content.substring(0, 100).replace(/\n/g, ' ') + '...';
            console.log(`Has raw_content (${contentLength} chars): ${preview}`);
          } else {
            console.log('No raw_content found');
          }
        }
      }
      
      // Check presentation_assets
      const { data: assets } = await supabase
        .from('media_presentation_assets')
        .select('id, asset_type, expert_document_id')
        .eq('presentation_id', presentation.id);
      
      if (!assets || assets.length === 0) {
        console.log('No presentation_assets found');
      } else {
        console.log(`Found ${assets.length} presentation_assets`);
        for (const asset of assets) {
          console.log(`Asset ID: ${asset.id}, Type: ${asset.asset_type}, Links to doc: ${asset.expert_document_id || 'None'}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRawContent().catch(console.error);