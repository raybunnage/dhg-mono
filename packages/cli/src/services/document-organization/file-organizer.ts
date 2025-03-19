import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotEnv } from 'dotenv';

// Document type mapping for file organization
export const DEFAULT_DOCUMENT_TYPE_MAPPING = {
  'Code Documentation Markdown': 'code-documentation',
  'Deployment Environment Guide': 'deployment-environment',
  'External Library Documentation': 'external-library',
  'Git Repository Journal': 'git-repository',
  'README': 'readmes',
  'Script Report': 'script-reports',
  'Solution Guide': 'solution-guides',
  'Technical Specification': 'technical-specs',
  'Cli Pipeline Markdown': 'cli-pipeline'
};

/**
 * Initialize Supabase connection
 */
export async function initSupabaseConnection(): Promise<SupabaseClient> {
  console.log('Initializing database connection...');
  
  // Load environment variables if not already loaded
  loadDotEnv();
  
  // Setup function to get database connection
  const supabaseUrl = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials!');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * List all available document types in the database
 */
export async function listAllDocumentTypes(
  supabase: SupabaseClient
): Promise<{ id: string; docType: string; category: string; count: number }[]> {
  console.log('\n=== LISTING ALL DOCUMENT TYPES ===');
  
  try {
    // Get the first record to determine column names
    const { data: firstDocType, error: firstError } = await supabase
      .from('document_types')
      .select('*')
      .limit(1);
      
    if (firstError) {
      throw new Error(`Error checking document types: ${firstError.message}`);
    }
    
    if (!firstDocType || firstDocType.length === 0) {
      throw new Error('No document types found in the database.');
    }
    
    // Use the document_type column for the type name, which is the correct column in this database
    const nameColumn = 'document_type';
    
    if (!Object.keys(firstDocType[0]).includes(nameColumn)) {
      throw new Error('Could not find document_type column in document_types table.');
    }
    
    // Get all document types
    const { data: allTypes, error: allError } = await supabase
      .from('document_types')
      .select('*')
      .order(nameColumn);
      
    if (allError) {
      throw new Error(`Error fetching all document types: ${allError.message}`);
    }
    
    if (!allTypes || allTypes.length === 0) {
      return [];
    }
    
    // Convert to standardized format
    return allTypes.map(type => ({
      id: type.id,
      docType: type[nameColumn],
      category: type.category || 'N/A',
      count: type.current_num_of_type || 0
    }));
    
  } catch (error) {
    console.error('Error listing document types:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Move a single file based on document type
 */
export async function findAndMoveDocumentByType(
  supabase: SupabaseClient,
  documentType: string,
  targetFolder: string
): Promise<{ success: boolean; message: string }> {
  console.log(`\n=== FINDING A FILE WITH DOCUMENT TYPE: ${documentType} ===`);
  
  try {
    // Get the first record to determine column names
    const { data: firstDocType, error: firstError } = await supabase
      .from('document_types')
      .select('*')
      .limit(1);
      
    if (firstError) {
      return { success: false, message: `Error checking document types: ${firstError.message}` };
    }
    
    if (!firstDocType || firstDocType.length === 0) {
      return { success: false, message: 'No document types found in the database.' };
    }
    
    // Use the document_type column for the type name, which is the correct column in this database
    const nameColumn = 'document_type';
    
    if (!Object.keys(firstDocType[0]).includes(nameColumn)) {
      return { success: false, message: 'Could not find document_type column in document_types table.' };
    }
    
    // Find document_type_id for the document type
    console.log(`Looking up document_type_id for "${documentType}" using column "${nameColumn}"...`);
    const { data: docTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('*')
      .eq(nameColumn, documentType);
      
    if (docTypeError) {
      return { success: false, message: `Error looking up document type: ${docTypeError.message}` };
    }
    
    if (!docTypes || docTypes.length === 0) {
      return { success: false, message: `Document type "${documentType}" not found in the database.` };
    }
    
    const docTypeId = docTypes[0].id;
    console.log(`Found document_type_id: ${docTypeId}`);
    
    // Find a file with this document type and is_deleted = false
    console.log(`Finding an active file with document type "${documentType}"...`);
    const { data: files, error: fileError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, document_type_id')
      .eq('document_type_id', docTypeId)
      .eq('is_deleted', false)
      .limit(1);
      
    if (fileError) {
      return { success: false, message: `Error finding file: ${fileError.message}` };
    }
    
    if (!files || files.length === 0) {
      return { success: false, message: `No active files found with document type "${documentType}".` };
    }
    
    const file = files[0];
    console.log(`Found file: ${file.title} (${file.file_path})`);
    
    // Check if the file exists
    const rootDir = process.cwd();
    const sourcePath = path.join(rootDir, file.file_path);
    
    if (!fs.existsSync(sourcePath)) {
      return { success: false, message: `File not found on disk: ${sourcePath}` };
    }
    
    // Ensure target directory exists
    const targetDir = path.join(rootDir, 'docs', targetFolder);
    if (!fs.existsSync(targetDir)) {
      console.log(`Creating target directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Get the filename from the path
    const fileName = path.basename(file.file_path);
    
    // Determine target path
    const targetPath = path.join(targetDir, fileName);
    
    // If target file already exists, return success=false
    if (fs.existsSync(targetPath)) {
      return { 
        success: false, 
        message: `Target file already exists: ${targetPath}. Skipping.` 
      };
    }
    
    // Move the file
    console.log(`Moving file from: ${sourcePath}`);
    console.log(`To: ${targetPath}`);
    
    try {
      // Copy the file first
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`File copied successfully.`);
      
      // Update the file_path in the database
      const newFilePath = `docs/${targetFolder}/${fileName}`;
      console.log(`Updating file_path in database to: ${newFilePath}`);
      
      const { error: updateError } = await supabase
        .from('documentation_files')
        .update({ file_path: newFilePath })
        .eq('id', file.id);
        
      if (updateError) {
        return { success: false, message: `Error updating file path in database: ${updateError.message}` };
      }
      
      console.log(`Database updated successfully.`);
      
      // Delete the original file
      fs.unlinkSync(sourcePath);
      console.log(`Original file deleted.`);
      
      return { 
        success: true, 
        message: `File successfully moved from ${file.file_path} to docs/${targetFolder}/${fileName}` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Error moving file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Move all files based on document type mapping
 */
export async function moveAllFilesByDocumentType(
  supabase: SupabaseClient,
  documentTypeMapping: Record<string, string>
): Promise<{
  success: boolean;
  stats: {
    docType: string;
    moved: number;
    skipped: number;
    errors: number;
  }[];
}> {
  console.log('\n=== MOVING ALL FILES BASED ON DOCUMENT TYPE MAPPING ===');
  
  const result = {
    success: true,
    stats: [] as {
      docType: string;
      moved: number;
      skipped: number;
      errors: number;
    }[]
  };
  
  try {
    // Get all document types
    const { data: docTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('*');
      
    if (docTypeError) {
      throw new Error(`Error fetching document types: ${docTypeError.message}`);
    }
    
    if (!docTypes || docTypes.length === 0) {
      throw new Error('No document types found in database.');
    }
    
    // Use the document_type column for the type name, which is the correct column in this database
    const nameColumn = 'document_type';
    
    if (!Object.keys(docTypes[0]).includes(nameColumn)) {
      throw new Error('Could not find document_type column in document_types table.');
    }
    
    // Process each document type in our mapping
    for (const [documentType, targetFolder] of Object.entries(documentTypeMapping)) {
      console.log(`\nProcessing document type: "${documentType}" -> ${targetFolder}`);
      
      // Find the document type ID
      const matchingDocType = docTypes.find(dt => dt[nameColumn] === documentType);
      
      const docTypeStat = {
        docType: documentType,
        moved: 0,
        skipped: 0,
        errors: 0
      };
      
      if (!matchingDocType) {
        console.log(`Document type "${documentType}" not found in the database. Skipping.`);
        docTypeStat.errors = 1;
        result.stats.push(docTypeStat);
        continue;
      }
      
      const docTypeId = matchingDocType.id;
      console.log(`Found document_type_id: ${docTypeId}`);
      
      // Find all active files with this document type
      const { data: files, error: fileError } = await supabase
        .from('documentation_files')
        .select('id, file_path, title, document_type_id')
        .eq('document_type_id', docTypeId)
        .eq('is_deleted', false);
        
      if (fileError) {
        console.error(`Error finding files: ${fileError.message}`);
        docTypeStat.errors = 1;
        result.stats.push(docTypeStat);
        continue;
      }
      
      if (!files || files.length === 0) {
        console.log(`No active files found with document type "${documentType}". Skipping.`);
        result.stats.push(docTypeStat);
        continue;
      }
      
      console.log(`Found ${files.length} files with document type "${documentType}"`);
      
      // Create target directory
      const rootDir = process.cwd();
      const targetDir = path.join(rootDir, 'docs', targetFolder);
      
      if (!fs.existsSync(targetDir)) {
        console.log(`Creating target directory: ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Process each file
      for (const file of files) {
        try {
          // Check if file already has the correct path
          if (file.file_path.startsWith(`docs/${targetFolder}/`)) {
            console.log(`File "${file.title}" already in correct location. Skipping.`);
            docTypeStat.skipped++;
            continue;
          }
          
          // Check if the file exists
          const sourcePath = path.join(rootDir, file.file_path);
          
          if (!fs.existsSync(sourcePath)) {
            console.log(`File not found on disk: ${sourcePath}. Skipping.`);
            docTypeStat.skipped++;
            continue;
          }
          
          // Get the filename from the path
          const fileName = path.basename(file.file_path);
          
          // Determine target path
          const targetPath = path.join(targetDir, fileName);
          
          // Skip if target file already exists
          if (fs.existsSync(targetPath)) {
            console.log(`Target file already exists: ${targetPath}. Skipping.`);
            docTypeStat.skipped++;
            continue;
          }
          
          // Move the file
          console.log(`Moving: ${file.file_path} -> docs/${targetFolder}/${fileName}`);
          
          // Copy the file first
          fs.copyFileSync(sourcePath, targetPath);
          
          // Update the file_path in the database
          const newFilePath = `docs/${targetFolder}/${fileName}`;
          
          const { error: updateError } = await supabase
            .from('documentation_files')
            .update({ file_path: newFilePath })
            .eq('id', file.id);
            
          if (updateError) {
            console.error(`Error updating file path in database: ${updateError.message}`);
            docTypeStat.errors++;
            // Don't delete the source file if db update failed
            continue;
          }
          
          // Delete the original file
          fs.unlinkSync(sourcePath);
          docTypeStat.moved++;
          
        } catch (error) {
          console.error(`Error processing file "${file.title}":`, error instanceof Error ? error.message : 'Unknown error');
          docTypeStat.errors++;
        }
      }
      
      console.log(`Document type "${documentType}" processing complete:`);
      console.log(`- ${docTypeStat.moved} files moved successfully`);
      console.log(`- ${docTypeStat.skipped} files skipped`);
      console.log(`- ${docTypeStat.errors} errors`);
      
      result.stats.push(docTypeStat);
    }
    
    console.log('\nAll document types processed!');
    
    // Check if any errors occurred
    const totalErrors = result.stats.reduce((sum, stat) => sum + stat.errors, 0);
    if (totalErrors > 0) {
      result.success = false;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error moving files:', error instanceof Error ? error.message : 'Unknown error');
    return {
      success: false,
      stats: []
    };
  }
}

// Document type mapping can be exported as a constant
export const DOCUMENT_TYPE_MAPPING = {
  'Code Documentation Markdown': 'code-documentation',
  'Deployment Environment Guide': 'deployment-environment',
  'Git Repository Journal': 'git-repository',
  'Script Report': 'script-reports',
  'Solution Guide': 'solution-guides',
  'Technical Specification': 'technical-specs',
  'Cli Pipeline Markdown' : 'cli-pipeline'
} as const;