#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

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

      // Verify Supabase connection before proceeding
      const supabase = SupabaseClientService.getInstance().getClient();
      const { error } = await supabase
        .from('user_filter_profiles')
        .select('id')
        .limit(1);
        
      if (error) {
        console.error(`Supabase error checking filter table: ${error.message}`);
        process.exit(1);
      }
      
      // Build filter criteria
      let filterCriteria = {};
      
      if (options.mimeTypes) {
        filterCriteria = { mime_types: options.mimeTypes };
      }
      
      if (options.documentTypes) {
        filterCriteria = { ...filterCriteria, document_types: options.documentTypes };
      }
      
      if (options.experts) {
        filterCriteria = { ...filterCriteria, experts: options.experts };
      }
      
      if (options.folders) {
        filterCriteria = { ...filterCriteria, folders: options.folders };
      }

      // Create the profile directly since filterService.createProfile is having issues
      const { data, error: insertError } = await supabase
        .from('user_filter_profiles')
        .insert({
          name: options.name,
          description: options.description,
          is_active: options.active || false
        })
        .select();
        
      if (insertError) {
        console.error(`Error creating profile: ${insertError.message}`);
        process.exit(1);
      }
      
      if (data && data[0]) {
        console.log(`✅ Filter profile "${options.name}" created successfully with ID: ${data[0].id}`);
        
        // If set as active, confirm it
        if (options.active) {
          console.log('👉 Profile set as active');
        }
      } else {
        console.error('❌ Failed to create filter profile (no data returned)');
        process.exit(1);
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