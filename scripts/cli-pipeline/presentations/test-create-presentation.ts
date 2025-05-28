#!/usr/bin/env ts-node
import { PresentationService } from './services/presentation-service';

async function main() {
  try {
    console.log('Testing direct presentation creation...');
    
    const presentationService = PresentationService.getInstance();
    
    // Get a specific folder that needs a presentation
    const { data: folder, error } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, drive_id, path, main_video_id')
      .eq('id', 'ed473ea7-bdad-4c2b-a432-934eaae11730')  // 2020-06-17-Wager-Networks-Intro
      .single();
    
    if (error || !folder) {
      console.error('Error finding folder:', error);
      process.exit(1);
    }
    
    console.log('Found folder:', folder.name);
    
    // Fix the presentation data to match the current schema
    // The presentations table doesn't have expert_id field, but has expert_document_id instead
    const result = await presentationService.createMissingPresentations([folder], {
      dryRun: false,
      createAssets: true,
      verbose: true
    });
    
    console.log('Creation result:', JSON.stringify(result, null, 2));
    
    if (result.created.length > 0) {
      console.log('Successfully created presentation:', result.created[0].presentation.id);
      
      // Verify creation by querying the database
      const { data: verifyPresentation } = await presentationService.supabaseClient
        .from('media_presentations')
        .select('id, title, expert_id, high_level_folder_source_id')
        .eq('id', result.created[0].presentation.id)
        .single();
      
      console.log('Verified presentation:', verifyPresentation);
      
      // Check for assets
      const { data: assets } = await presentationService.supabaseClient
        .from('media_presentation_assets')
        .select('id, asset_type, asset_role, source_id')
        .eq('presentation_id', result.created[0].presentation.id);
      
      console.log('Presentation assets:', assets);
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

main();