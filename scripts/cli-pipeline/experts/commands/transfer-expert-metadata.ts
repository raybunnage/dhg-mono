/**
 * Transfer Expert Metadata Command
 *
 * This command searches for each expert's most recent document with a specific document type ID
 * and transfers JSON content from the expert_documents processed_content field to the experts metadata field.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface TransferExpertMetadataOptions {
  dryRun?: boolean;
  verbose?: boolean;
  documentTypeId?: string;
  expertLimit?: number;
}

interface SourceGoogleData {
  id: string;
  name: string;
  mime_type: string;
  modified_at: string;
  document_type_id: string;
}

interface SourcesGoogleExpertRecord {
  source_id: string;
  sources_google: SourceGoogleData;
}

export async function transferExpertMetadata({
  dryRun = false,
  verbose = false,
  documentTypeId = '554ed67c-35d1-4218-abba-8d1b0ff7156d', // Presentation Announcement type
  expertLimit = 0
}: TransferExpertMetadataOptions = {}): Promise<void> {
  try {
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();

    console.log('\n🔍 Transferring processed_content from expert_documents to experts.metadata\n');
    
    // Step 1: Get all experts
    const { data: experts, error: expertsError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name, metadata')
      .order('expert_name', { ascending: true })
      .limit(expertLimit > 0 ? expertLimit : 1000);

    if (expertsError) {
      console.error('Error fetching experts:', expertsError);
      return;
    }

    console.log(`Found ${experts.length} experts to process`);

    // Track statistics
    let successCount = 0;
    let skippedCount = 0;
    let noContentCount = 0;
    let noSourcesCount = 0;
    
    // Process each expert
    for (const expert of experts) {
      if (verbose) {
        console.log(`\nProcessing expert: ${expert.expert_name} (${expert.id})`);
      }

      // Step 2: Find the latest sources_google associated with this expert via sources_google_experts
      // First get all sources
      const { data: expertSources, error: sourcesError } = await supabase
        .from('sources_google_experts')
        .select(`
          source_id,
          sources_google!inner(
            id,
            name,
            mime_type,
            modified_at,
            document_type_id
          )
        `)
        .eq('expert_id', expert.id)
        .eq('sources_google.document_type_id', documentTypeId);
      
      // Sort the results to find the latest source
      let latestSources: any[] = [];
      if (expertSources && expertSources.length > 0) {
        // Sort by modified_at in descending order
        const sortedSources = [...expertSources].sort((a: any, b: any) => {
          const dateA = new Date(a.sources_google.modified_at || 0);
          const dateB = new Date(b.sources_google.modified_at || 0);
          return dateB.getTime() - dateA.getTime();
        });
        latestSources = [sortedSources[0]];
      }

      if (sourcesError) {
        console.error(`Error fetching sources for expert ${expert.expert_name}:`, sourcesError);
        continue;
      }

      if (!latestSources || latestSources.length === 0) {
        if (verbose) {
          console.log(`No matching sources found for expert ${expert.expert_name}`);
        }
        noSourcesCount++;
        continue;
      }

      // Type casting to handle the nested structure from Supabase
      const latestSource: SourceGoogleData = latestSources[0].sources_google as unknown as SourceGoogleData;
      
      if (verbose) {
        console.log(`Latest matching source: ${latestSource.name} (modified: ${latestSource.modified_at})`);
      }

      // Step 3: Get the expert_document associated with this source
      const { data: documents, error: documentsError } = await supabase
        .from('expert_documents')
        .select('id, processed_content, title')
        .eq('source_id', latestSource.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (documentsError) {
        console.error(`Error fetching expert_documents for source ${latestSource.id}:`, documentsError);
        continue;
      }

      if (!documents || documents.length === 0) {
        if (verbose) {
          console.log(`No expert_documents found for source ${latestSource.id}`);
        }
        continue;
      }

      const document = documents[0];
      
      // Check if processed_content exists and is valid JSON
      if (!document.processed_content) {
        if (verbose) {
          console.log(`No processed_content found for document ${document.id}`);
        }
        noContentCount++;
        continue;
      }

      // Verify the processed_content is valid JSON
      try {
        // It's already a JSON object, so we just make sure it's valid
        const parsedContent = document.processed_content;
        
        if (verbose) {
          console.log(`Found processed_content for document ${document.title || document.id}`);
          console.log('Content:', JSON.stringify(parsedContent, null, 2).substring(0, 100) + '...');
        }

        // Update the expert's metadata field
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('experts')
            .update({ metadata: parsedContent })
            .eq('id', expert.id);

          if (updateError) {
            console.error(`Error updating metadata for expert ${expert.expert_name}:`, updateError);
            continue;
          }

          console.log(`✅ Updated metadata for ${expert.expert_name}`);
          successCount++;
        } else {
          console.log(`🔍 [DRY RUN] Would update metadata for ${expert.expert_name}`);
          successCount++;
        }
      } catch (e) {
        console.error(`Error parsing processed_content for document ${document.id}:`, e);
        skippedCount++;
      }
    }

    // Print summary
    console.log('\n📊 Transfer Summary:');
    console.log(`Total experts processed: ${experts.length}`);
    console.log(`Successful transfers: ${successCount}`);
    console.log(`Experts with no matching sources: ${noSourcesCount}`);
    console.log(`Documents with no content: ${noContentCount}`);
    console.log(`Skipped (invalid content): ${skippedCount}`);
    
    if (dryRun) {
      console.log('\n⚠️ This was a DRY RUN - no changes were made to the database');
    }
    
  } catch (error) {
    console.error('Error in transferExpertMetadata:', error);
  }
}