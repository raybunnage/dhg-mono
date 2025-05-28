import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../packages/shared/services/supabase-client';
import { Logger } from '../packages/shared/utils/logger';

async function linkTranscriptsToPresentation() {
  const supabaseClient = SupabaseClientService.getInstance().getClient();
  
  // Get list of transcript files
  const transcriptsDir = path.join(process.cwd(), 'file_types/transcripts');
  const files = fs.readdirSync(transcriptsDir).filter(f => f.endsWith('_transcript.txt'));
  
  console.log(`Found ${files.length} transcript files`);
  
  // Get list of presentations with missing content from missing_content.md
  const { data: presentations } = await supabaseClient
    .from('media_presentations')
    .select('id, title, main_video_id')
    .in('id', [
      '9927be5c-2606-4b8b-9061-911d013473bd',  // Gervitz.3.24.21
      '030bbcc0-01a8-440d-b962-301bf1c83759',  // S.Othmer.12.09.20.Neuroregulation
      'f497c52d-b046-4c44-a982-27f06eca47f3',  // Carter.8.26.20
      'ded77cb9-8380-4c29-82dc-c39e30a9e15c',  // Kovacic.Porges.106.21 
      '13f437dc-cc38-46a7-86f1-530bd741b389',  // Matt and Alona.10.21.20
      '761b2ba0-9311-4d09-932d-c3fb452bf9b2',  // From Flight to Faint.11.18.20
      '791d3b98-f2db-417c-9b70-44c395ae5a97',  // Matt Lederman
      'bec465a2-99de-4bc4-9d69-59cb3b8de5cf',  // video1202452101
      'ee8ad893-7a8b-4e3e-aeb9-4977e7786ca8'   // Wilkinson.9.15.24
    ]);
  
  if (!presentations || presentations.length === 0) {
    console.log('No presentations found to fix');
    return;
  }
  
  console.log(`Found ${presentations.length} presentations to fix`);
  
  for (const presentation of presentations) {
    const title = presentation.title;
    console.log(`Processing presentation: ${title} (${presentation.id})`);
    
    // Find matching transcript file
    const matchingFiles = files.filter(f => {
      const simplifiedFile = f.toLowerCase().replace(/[.']/g, '');
      const simplifiedTitle = title.toLowerCase().replace(/[.']/g, '');
      return simplifiedFile.includes(simplifiedTitle);
    });
    
    if (matchingFiles.length > 0) {
      console.log(`Found matching transcript file: ${matchingFiles[0]}`);
      
      // Read the transcript content
      const transcriptPath = path.join(transcriptsDir, matchingFiles[0]);
      const content = fs.readFileSync(transcriptPath, 'utf8');
      
      console.log(`Read ${content.length} characters from transcript`);
      
      // Get the document type ID for Video Summary Transcript
      const { data: docType } = await supabaseClient
        .from('document_types')
        .select('id')
        .eq('document_type', 'Video Summary Transcript')
        .single();
        
      if (!docType) {
        console.log('Document type not found for Video Summary Transcript');
        continue;
      }
      
      // Check if an expert_document already exists for this source
      const { data: source } = await supabaseClient
        .from('google_sources')
        .select('id')
        .eq('id', presentation.main_video_id)
        .single();
        
      if (!source) {
        console.log(`Source not found for presentation ${presentation.id}`);
        continue;
      }
      
      const { data: existingDoc } = await supabaseClient
        .from('google_expert_documents')
        .select('id')
        .eq('source_id', source.id)
        .eq('document_type_id', docType.id)
        .maybeSingle();
        
      let expertDocId;
      
      if (existingDoc) {
        console.log(`Found existing expert_document: ${existingDoc.id}`);
        expertDocId = existingDoc.id;
        
        // Update the content
        await supabaseClient
          .from('google_expert_documents')
          .update({
            raw_content: content,
            // Don't set status
            updated_at: new Date().toISOString()
          })
          .eq('id', expertDocId);
          
        console.log(`Updated expert_document ${expertDocId} with transcript content`);
      } else {
        // Create a new expert_document with the transcript content
        const { data: newDoc, error } = await supabaseClient
          .from('google_expert_documents')
          .insert({
            source_id: source.id,
            document_type_id: docType.id,
            raw_content: content,
            // Try without setting a status field at all
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (error) {
          console.log(`Error creating expert_document: ${error.message}`);
          continue;
        }
        
        expertDocId = newDoc.id;
        console.log(`Created new expert_document: ${expertDocId}`);
      }
      
      // Check if presentation_asset exists
      const { data: existingAsset } = await supabaseClient
        .from('media_presentation_assets')
        .select('id')
        .eq('presentation_id', presentation.id)
        .eq('asset_type', 'transcript')
        .maybeSingle();
        
      if (existingAsset) {
        console.log(`Found existing presentation_asset: ${existingAsset.id}`);
        
        // Update it to point to our expert_document
        await supabaseClient
          .from('media_presentation_assets')
          .update({
            expert_document_id: expertDocId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAsset.id);
          
        console.log(`Updated presentation_asset ${existingAsset.id} to point to expert_document ${expertDocId}`);
      } else {
        // Create a new presentation_asset
        const { data: newAsset, error } = await supabaseClient
          .from('media_presentation_assets')
          .insert({
            presentation_id: presentation.id,
            asset_type: 'transcript',
            expert_document_id: expertDocId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (error) {
          console.log(`Error creating presentation_asset: ${error.message}`);
          continue;
        }
        
        console.log(`Created new presentation_asset: ${newAsset.id}`);
      }
      
      console.log(`Successfully linked transcript to presentation ${presentation.id}`);
    } else {
      console.log(`No matching transcript file found for presentation ${title}`);
    }
  }
}

linkTranscriptsToPresentation().then(() => {
  console.log('Done!');
}).catch(err => {
  console.error('Error:', err);
});