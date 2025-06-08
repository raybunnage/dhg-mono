#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function fixSyncStatisticsConstraint() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Fixing google_sync_statistics table and constraints...');
  
  try {
    // Create the table if it doesn't exist
    console.log('Creating table if not exists...');
    const { error: createError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS google_sync_statistics (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          folder_id TEXT NOT NULL,
          folder_name TEXT,
          root_drive_id TEXT,
          google_drive_count INTEGER DEFAULT 0,
          google_drive_documents INTEGER DEFAULT 0,
          google_drive_folders INTEGER DEFAULT 0,
          local_files INTEGER DEFAULT 0,
          local_only_files INTEGER DEFAULT 0,
          matching_files INTEGER DEFAULT 0,
          mp4_files INTEGER DEFAULT 0,
          mp4_total_size BIGINT DEFAULT 0,
          new_files INTEGER DEFAULT 0,
          total_google_drive_items INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (createError) {
      console.error('Error creating table:', createError);
      // Continue anyway, table might already exist
    } else {
      console.log('Table created or already exists');
    }
    
    // Remove any duplicates first
    console.log('Removing any duplicate entries...');
    const { error: dedupeError } = await supabase.rpc('execute_sql', {
      sql_query: `
        DELETE FROM google_sync_statistics a
        USING google_sync_statistics b
        WHERE a.id < b.id
        AND a.folder_id = b.folder_id
        AND (
          (a.root_drive_id IS NULL AND b.root_drive_id IS NULL) OR
          (a.root_drive_id = b.root_drive_id)
        );
      `
    });
    
    if (dedupeError) {
      console.error('Error removing duplicates:', dedupeError);
    } else {
      console.log('Duplicates removed (if any)');
    }
    
    // Drop existing constraint if it exists
    console.log('Dropping existing constraint if exists...');
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE google_sync_statistics 
        DROP CONSTRAINT IF EXISTS google_sync_statistics_folder_root_unique;
      `
    });
    
    if (dropError) {
      console.error('Error dropping constraint:', dropError);
    }
    
    // Add the unique constraint
    console.log('Adding unique constraint on (folder_id, root_drive_id)...');
    const { error: addConstraintError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE google_sync_statistics 
        ADD CONSTRAINT google_sync_statistics_folder_root_unique 
        UNIQUE (folder_id, root_drive_id);
      `
    });
    
    if (addConstraintError) {
      console.error('Error adding constraint:', addConstraintError);
      return;
    }
    
    console.log('Unique constraint added successfully');
    
    // Add updated_at trigger
    console.log('Creating updated_at trigger...');
    const { error: triggerError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        DROP TRIGGER IF EXISTS update_google_sync_statistics_updated_at ON google_sync_statistics;
        
        CREATE TRIGGER update_google_sync_statistics_updated_at 
        BEFORE UPDATE ON google_sync_statistics 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `
    });
    
    if (triggerError) {
      console.error('Error creating trigger:', triggerError);
    } else {
      console.log('Updated_at trigger created successfully');
    }
    
    console.log('\n✅ Constraint fix completed successfully!');
    console.log('You can now run: ./google-sync-cli.sh populate-statistics --verbose');
    
  } catch (error) {
    console.error('Error fixing constraints:', error);
  }
}

// Run the fix
fixSyncStatisticsConstraint();