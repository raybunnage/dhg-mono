#!/usr/bin/env ts-node
import { Command } from 'commander';
import { PresentationService } from './services/presentation-service';

interface CommandOptions {
  folderId?: string;
  dryRun?: boolean;
}

const command = new Command('create-one-presentation')
  .description('Create a presentation for a specific folder')
  .option('-f, --folder-id <string>', 'ID of the folder to create presentation for (required)')
  .option('--dry-run', 'Show what would be created without making changes')
  .action(async (options: CommandOptions) => {
    try {
      console.log('Creating presentation for a specific folder...');
      
      const presentationService = PresentationService.getInstance();
      
      if (!options.folderId) {
        console.error('Error: Folder ID is required');
        process.exit(1);
      }
      
      // Get the specific folder
      const { data: folder, error } = await presentationService.supabaseClient
        .from('sources_google')
        .select('id, name, drive_id, path, main_video_id')
        .eq('id', options.folderId)
        .single();
      
      if (error || !folder) {
        console.error('Error finding folder:', error || 'Not found');
        process.exit(1);
      }
      
      console.log('Found folder:', folder.name);
      
      if (!folder.main_video_id) {
        console.error('Error: Folder does not have a main_video_id');
        process.exit(1);
      }
      
      // Create a presentation for this folder
      const result = await presentationService.createMissingPresentations([folder], {
        dryRun: options.dryRun,
        createAssets: true,
        verbose: true
      });
      
      console.log('Creation result:', JSON.stringify(result, null, 2));
      
      if (result.created.length > 0) {
        console.log('Successfully created presentation:', result.created[0].presentation.id);
        
        // Verify creation by querying the database
        const { data: verifyPresentation, error: verifyError } = await presentationService.supabaseClient
          .from('media_presentations')
          .select('id, title, high_level_folder_source_id, video_source_id')
          .eq('id', result.created[0].presentation.id)
          .single();
        
        if (verifyError) {
          console.error('Error verifying presentation:', verifyError);
        } else {
          console.log('Verified presentation:', verifyPresentation);
        }
        
        // Check for assets - Note: Fix column names to match schema
        const { data: assets, error: assetsError } = await presentationService.supabaseClient
          .from('media_presentation_assets')
          .select('id, asset_type, asset_role, asset_source_id')
          .eq('presentation_id', result.created[0].presentation.id);
        
        if (assetsError) {
          console.error('Error fetching assets:', assetsError);
        } else {
          console.log('Presentation assets:', assets);
        }
      }
      
      console.log('Command completed successfully');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;