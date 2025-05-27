import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function updateSubjectDescriptions() {
  try {
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Read and parse the CSV file
    const csvFilePath = path.resolve(__dirname, '../../../file_types/csv/id_description_concise.csv');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`Found ${records.length} descriptions to import`);
    
    // Update each record
    let successCount = 0;
    
    for (const record of records) {
      const { id, description } = record;
      
      console.log(`Updating subject ID: ${id} with description`);
      
      // Update the record
      const { error } = await supabase
        .from('subject_classifications')
        .update({ description })
        .eq('id', id);
      
      if (error) {
        console.error(`Error updating subject ${id}:`, error);
      } else {
        successCount++;
      }
    }
    
    console.log(`Successfully updated ${successCount} of ${records.length} subjects`);
    
  } catch (error) {
    console.error('Error during import:', error);
  }
}

// Run the function
updateSubjectDescriptions().catch(console.error);