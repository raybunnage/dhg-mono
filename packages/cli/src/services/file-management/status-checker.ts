import { SupabaseClient } from '../supabase-client';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentationFile {
  id: string;
  file_path?: string;
  [key: string]: any;
}

export async function updateDeletionStatus(
  supabase: SupabaseClient,
  records: Array<DocumentationFile>,
  rootDir: string = process.cwd()
): Promise<{
  existingCount: number;
  missingCount: number;
  successCount: number;
  failureCount: number;
}> {
  let existingCount = 0;
  let missingCount = 0;
  let successCount = 0;
  let failureCount = 0;
  
  const batchSize = 10;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const updatePromises = batch.map(async (record) => {
      try {
        if (!record.file_path) {
          console.log(`Record ${record.id}: No file path to check`);
          return false;
        }
        
        const absolutePath = path.join(rootDir, record.file_path);
        const exists = fs.existsSync(absolutePath);
        
        if (exists) {
          existingCount++;
          successCount++;
          console.log(`✅ Record ${record.id}: File exists`);
          return true;
        } else {
          // Since we don't use is_deleted anymore, hard delete the record
          const { error } = await supabase
            .from('documentation_files')
            .delete()
            .eq('id', record.id);
            
          if (error) {
            failureCount++;
            return false;
          }
          
          missingCount++;
          successCount++;
          console.log(`❌ Record ${record.id}: File missing, record deleted from database`);
          return true;
        }
      } catch (error) {
        console.error(`Exception checking record ${record.id}:`, error instanceof Error ? error.message : 'Unknown error');
        failureCount++;
        return false;
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`Processed ${Math.min(i + batchSize, records.length)} of ${records.length} records...`);
  }
  
  return { existingCount, missingCount, successCount, failureCount };
}