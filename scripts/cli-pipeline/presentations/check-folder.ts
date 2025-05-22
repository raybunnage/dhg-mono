#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  try {
    console.log('Checking folder existence in database...');
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Try a direct query for a folder
    const folderId = 'ed473ea7-bdad-4c2b-a432-934eaae11730'; // 2020-06-17-Wager-Networks-Intro
    
    const { data, error } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', folderId);
    
    if (error) {
      console.error('Error querying database:', error);
      process.exit(1);
    }
    
    console.log(`Query results for folder ${folderId}:`, data);
    
    // Check if this folder has a presentation
    const { data: presentations, error: presentationError } = await supabase
      .from('presentations')
      .select('*')
      .eq('high_level_folder_source_id', folderId);
    
    if (presentationError) {
      console.error('Error querying presentations:', presentationError);
    } else {
      console.log(`Presentations for folder ${folderId}:`, presentations);
    }
    
    // Try another folder from the list
    const folderId2 = 'ffcff225-44a0-40b3-b57c-b83d48fad196'; // 2020-07-15-Wager-Imaging-ANS-part2
    
    const { data: data2, error: error2 } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', folderId2);
    
    if (error2) {
      console.error('Error querying database for second folder:', error2);
    } else {
      console.log(`Query results for folder ${folderId2}:`, data2);
    }
    
    console.log('Check completed');
  } catch (error) {
    console.error('Execution error:', error);
    process.exit(1);
  }
}

main();