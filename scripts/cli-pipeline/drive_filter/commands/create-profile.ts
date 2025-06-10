#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { FilterService } from '../../../../packages/shared/services/filter-service';

const command = new Command('create-profile');

// Define options interface
interface CommandOptions {
  name: string;
  description?: string;
  active?: boolean;
  mimeTypes?: string[];
  documentTypes?: string[];
  experts?: string[];
  folders?: string[];
}

command
  .description('Create a new filter profile')
  .option('-n, --name <name>', 'Profile name (required)')
  .option('-d, --description <description>', 'Profile description')
  .option('-a, --active', 'Set this profile as active (default: false)')
  .option('--mime-types <types...>', 'Mime types to include (comma-separated)')
  .option('--document-types <types...>', 'Document type IDs to include (comma-separated)')
  .option('--experts <experts...>', 'Expert IDs to include (comma-separated)')
  .option('--folders <folders...>', 'Folder IDs to include (comma-separated)')
  .action(async (options: CommandOptions) => {
    try {
      // Check if name is provided
      if (!options.name) {
        console.error('Error: Profile name is required (-n, --name)');
        process.exit(1);
      }

      // Initialize services
      const supabase = SupabaseClientService.getInstance().getClient();
      const filterService = new FilterService(supabase);
      
      // Create the profile using FilterService
      const profile = await filterService.createProfile({
        name: options.name,
        description: options.description || null,
        is_active: options.active || false
      });
      
      if (!profile) {
        console.error('❌ Failed to create filter profile');
        process.exit(1);
      }
      
      console.log(`✅ Filter profile "${options.name}" created successfully with ID: ${profile.id}`);
      
      // If set as active, confirm it
      if (options.active) {
        console.log('👉 Profile set as active');
      }
      
      // Add folders/drives if specified
      if (options.folders && options.folders.length > 0) {
        const success = await filterService.addDrivesToProfile(profile.id, options.folders);
        if (success) {
          console.log(`✅ Added ${options.folders.length} folder(s) to profile`);
        } else {
          console.error('⚠️  Warning: Failed to add some folders to profile');
        }
      }
      
      // Note: mime-types, document-types, and experts filtering are handled by filter criteria
      // in the FilterService when applying filters, not stored in the profile itself
      if (options.mimeTypes || options.documentTypes || options.experts) {
        console.log('\n📝 Note: Additional filter criteria (mime-types, document-types, experts) will be applied when using this profile.');
      }
    } catch (error) {
      console.error('Error creating filter profile:', error);
      process.exit(1);
    }
  });


// If running this file directly, parse args
if (require.main === module) {
  command.parse(process.argv);
}

export default command;