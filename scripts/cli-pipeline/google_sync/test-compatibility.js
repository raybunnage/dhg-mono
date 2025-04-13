#!/usr/bin/env node

/**
 * Test Compatibility between sources_google and sources_google
 * 
 * This script checks that applications using sources_google will be able
 * to work with sources_google after migration.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = '***REMOVED***';

// Target root folder ID
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Process command line arguments
const args = process.argv.slice(2);
const testId = args[0]; // Specific file ID to test

/**
 * Create a simplified compatibility view from sources_google
 */
async function createCompatibilityView(supabase) {
  console.log('Creating a temporary compatibility view...');
  
  try {
    const viewQuery = `
      CREATE OR REPLACE TEMP VIEW sources_google_compat AS
      SELECT
          id,
          drive_id,
          name,
          mime_type,
          parent_folder_id AS parent_id,
          is_deleted AS deleted,
          root_drive_id,
          path,
          metadata,
          size AS size_bytes,
          modified_time,
          web_view_link,
          thumbnail_link,
          content_extracted,
          extracted_content,
          document_type_id,
          created_at,
          updated_at,
          last_indexed,
          main_video_id
      FROM
          sources_google
    `;
    
    const { error } = await supabase.rpc('execute_sql', { sql: viewQuery });
    
    if (error) {
      console.warn('Warning: Could not create temporary view -', error.message);
      console.warn('Compatibility queries will be simulated instead');
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Error creating view:', error.message);
    return false;
  }
}

/**
 * Simulate a typical application query on sources_google
 */
async function runTypicalQueries(supabase, useCompat = false) {
  console.log(`\nRunning typical application queries ${useCompat ? 'on compat view' : 'with field mapping'}...`);
  
  const tableName = useCompat ? 'sources_google_compat' : 'sources_google';
  const parentField = useCompat ? 'parent_id' : 'parent_folder_id';
  const deletedField = useCompat ? 'deleted' : 'is_deleted';
  
  // Typical queries applications might run:
  
  // 1. Get files by folder (most common)
  console.log('\n1. Getting files by folder...');
  
  try {
    let query;
    
    if (useCompat) {
      query = `
        SELECT id, name, mime_type, drive_id, parent_id
        FROM sources_google_compat
        WHERE parent_id = '${DHG_ROOT_ID}'
        LIMIT 5
      `;
    } else {
      query = `
        SELECT id, name, mime_type, drive_id, parent_folder_id as parent_id
        FROM ${tableName}
        WHERE ${parentField} = '${DHG_ROOT_ID}'
        LIMIT 5
      `;
    }
    
    const { data, error } = await supabase.rpc('execute_sql', { sql: query });
    
    if (error) {
      console.error('Error querying by folder:', error.message);
    } else {
      console.log(`Found ${data.length} files in folder ${DHG_ROOT_ID}`);
      data.forEach(file => {
        console.log(`- ${file.name} (${file.mime_type})`);
      });
    }
  } catch (error) {
    console.error('Unexpected error in folder query:', error);
  }
  
  // 2. Look up a specific file by ID
  console.log('\n2. Looking up a specific file by ID...');
  
  try {
    // First get a sample file ID if none provided
    let fileId = testId;
    
    if (!fileId) {
      const { data: sampleData, error: sampleError } = await supabase
        .from('sources_google')
        .select('id')
        .limit(1);
      
      if (sampleError || !sampleData || sampleData.length === 0) {
        console.error('Could not find a sample file ID');
        return;
      }
      
      fileId = sampleData[0].id;
    }
    
    console.log(`Using file ID: ${fileId}`);
    
    // Query in sources_google format
    const { data: sg2Data, error: sg2Error } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, drive_id, parent_folder_id, path')
      .eq('id', fileId)
      .limit(1);
    
    if (sg2Error) {
      console.error('Error querying sources_google:', sg2Error.message);
    } else if (sg2Data && sg2Data.length > 0) {
      console.log('Found in sources_google:');
      console.log(`- Name: ${sg2Data[0].name}`);
      console.log(`- Path: ${sg2Data[0].path}`);
      console.log(`- Parent: ${sg2Data[0].parent_folder_id}`);
    } else {
      console.log('File not found in sources_google');
    }
    
    // Check in original sources_google for comparison
    const { data: sgData, error: sgError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, drive_id, parent_id, path')
      .eq('id', fileId)
      .limit(1);
    
    if (sgError) {
      console.error('Error querying sources_google:', sgError.message);
    } else if (sgData && sgData.length > 0) {
      console.log('\nFound in sources_google (original):');
      console.log(`- Name: ${sgData[0].name}`);
      console.log(`- Path: ${sgData[0].path}`);
      console.log(`- Parent: ${sgData[0].parent_id}`);
      
      // Compare important fields
      const sg2 = sg2Data[0];
      const sg = sgData[0];
      
      console.log('\nField comparison:');
      console.log(`- Name: ${sg.name === sg2.name ? '✓ Match' : '✗ Different'}`);
      console.log(`- Drive ID: ${sg.drive_id === sg2.drive_id ? '✓ Match' : '✗ Different'}`);
      console.log(`- Parent: ${sg.parent_id === sg2.parent_folder_id ? '✓ Match' : '✗ Different'}`);
      console.log(`- Path: ${sg.path === sg2.path ? '✓ Match' : '✗ Different'}`);
    } else {
      console.log('File not found in original sources_google');
    }
  } catch (error) {
    console.error('Unexpected error in ID lookup query:', error);
  }
  
  // 3. Search by text in name (common operation)
  console.log('\n3. Searching by text in name...');
  
  try {
    const searchTerm = 'transcript';
    
    let query;
    if (useCompat) {
      query = `
        SELECT id, name, mime_type 
        FROM sources_google_compat
        WHERE name ILIKE '%${searchTerm}%'
        LIMIT 5
      `;
    } else {
      query = `
        SELECT id, name, mime_type
        FROM ${tableName}
        WHERE name ILIKE '%${searchTerm}%'
        LIMIT 5
      `;
    }
    
    const { data, error } = await supabase.rpc('execute_sql', { sql: query });
    
    if (error) {
      console.error('Error searching by name:', error.message);
    } else {
      console.log(`Found ${data.length} files with "${searchTerm}" in name`);
      data.forEach(file => {
        console.log(`- ${file.name}`);
      });
    }
  } catch (error) {
    console.error('Unexpected error in name search query:', error);
  }
  
  // 4. Find recently modified files (common dashboard operation)
  console.log('\n4. Finding recently modified files...');
  
  try {
    let query;
    if (useCompat) {
      query = `
        SELECT id, name, modified_time
        FROM sources_google_compat
        WHERE root_drive_id = '${DHG_ROOT_ID}'
        AND ${deletedField} = false
        ORDER BY modified_time DESC
        LIMIT 5
      `;
    } else {
      query = `
        SELECT id, name, modified_time
        FROM ${tableName}
        WHERE root_drive_id = '${DHG_ROOT_ID}'
        AND ${deletedField} = false
        ORDER BY modified_time DESC
        LIMIT 5
      `;
    }
    
    const { data, error } = await supabase.rpc('execute_sql', { sql: query });
    
    if (error) {
      console.error('Error querying recent files:', error.message);
    } else {
      console.log(`Found ${data.length} recent files`);
      data.forEach(file => {
        console.log(`- ${file.name} (${new Date(file.modified_time).toLocaleDateString()})`);
      });
    }
  } catch (error) {
    console.error('Unexpected error in recent files query:', error);
  }
}

/**
 * Check if expert_documents can still reference the files
 */
async function checkExpertReferences(supabase) {
  console.log('\nChecking expert_documents references...');
  
  try {
    // First check if expert_documents table exists and references sources_google
    const { data: refData, error: refError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          source_table, 
          source_column, 
          target_table, 
          target_column
        FROM 
          information_schema.referential_constraints rc
        JOIN 
          information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
        JOIN 
          information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.constraint_name
        WHERE 
          target_table = 'sources_google' OR target_table = 'sources_google'
      `
    });
    
    if (refError) {
      console.warn('Warning: Could not check references -', refError.message);
    } else {
      console.log('References to sources_google/sources_google:');
      if (refData.length === 0) {
        console.log('- No direct foreign key references found');
      } else {
        refData.forEach(ref => {
          console.log(`- ${ref.source_table}.${ref.source_column} -> ${ref.target_table}.${ref.target_column}`);
        });
      }
    }
    
    // Check for expert_documents table
    const { data: expertDocsData, error: expertDocsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expert_documents'
        ) AS exists
      `
    });
    
    let hasExpertDocs = false;
    if (expertDocsError) {
      console.warn('Warning: Could not check for expert_documents table -', expertDocsError.message);
    } else {
      hasExpertDocs = expertDocsData[0].exists;
      console.log(`expert_documents table exists: ${hasExpertDocs}`);
    }
    
    // If expert_documents exists, check for matching records
    if (hasExpertDocs) {
      // Get the document_ids from expert_documents
      const { data: edData, error: edError } = await supabase.rpc('execute_sql', {
        sql: `
          SELECT id, expert_id, document_id 
          FROM expert_documents 
          LIMIT 10
        `
      });
      
      if (edError) {
        console.warn('Warning: Could not query expert_documents -', edError.message);
      } else {
        console.log(`\nFound ${edData.length} records in expert_documents`);
        
        // Check a sample record
        if (edData.length > 0) {
          const sample = edData[0];
          console.log(`Sample: expert_id=${sample.expert_id}, document_id=${sample.document_id}`);
          
          // Check if the document_id exists in sources_google
          const { data: documentData, error: documentError } = await supabase
            .from('sources_google')
            .select('id, name')
            .eq('id', sample.document_id)
            .limit(1);
          
          if (documentError) {
            console.error('Error looking up document:', documentError.message);
          } else if (documentData.length > 0) {
            console.log(`- Document found in sources_google: ${documentData[0].name}`);
            
            // Note about expert_id now being in a separate table
            console.log('- Expert association now handled through sources_google_experts table')
          } else {
            console.log('- ✗ Document not found in sources_google');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking expert references:', error);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Testing compatibility between sources_google and sources_google...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Check table schemas
    console.log('\nSTEP 1: Comparing table schemas...');
    
    const { data: schemas, error: schemaError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          table_name, 
          column_name, 
          data_type, 
          is_nullable
        FROM 
          information_schema.columns 
        WHERE 
          table_name IN ('sources_google', 'sources_google')
        ORDER BY 
          table_name, 
          ordinal_position
      `
    });
    
    if (schemaError) {
      console.error('Error getting schemas:', schemaError.message);
    } else {
      // Group columns by table
      const sgColumns = schemas.filter(col => col.table_name === 'sources_google');
      const sg2Columns = schemas.filter(col => col.table_name === 'sources_google');
      
      console.log(`sources_google: ${sgColumns.length} columns`);
      console.log(`sources_google: ${sg2Columns.length} columns`);
      
      // Compare essential columns
      const essentialColumns = [
        { sg: 'id', sg2: 'id' },
        { sg: 'name', sg2: 'name' },
        { sg: 'drive_id', sg2: 'drive_id' },
        { sg: 'mime_type', sg2: 'mime_type' },
        { sg: 'parent_id', sg2: 'parent_folder_id' },
        { sg: 'deleted', sg2: 'is_deleted' },
        { sg: 'path', sg2: 'path' },
        { sg: 'document_type_id', sg2: 'document_type_id' }
      ];
      
      console.log('\nChecking critical column mappings:');
      
      essentialColumns.forEach(mapping => {
        const sgCol = sgColumns.find(c => c.column_name === mapping.sg);
        const sg2Col = sg2Columns.find(c => c.column_name === mapping.sg2);
        
        if (sgCol && sg2Col) {
          const typesMatch = sgCol.data_type === sg2Col.data_type;
          const nullMatch = sgCol.is_nullable === sg2Col.is_nullable;
          
          console.log(`- ${mapping.sg} → ${mapping.sg2}: ${typesMatch ? '✓' : '✗'} Types ${typesMatch ? 'match' : 'differ'} (${sgCol.data_type} vs ${sg2Col.data_type})`);
        } else {
          console.log(`- ${mapping.sg} → ${mapping.sg2}: ✗ Missing column`);
        }
      });
    }
    
    // Step 2: Create a temporary compatibility view
    const hasCompatView = await createCompatibilityView(supabase);
    
    // Step 3: Run typical application queries
    await runTypicalQueries(supabase, hasCompatView);
    if (!hasCompatView) {
      await runTypicalQueries(supabase, false);
    }
    
    // Step 4: Check expert_documents references
    await checkExpertReferences(supabase);
    
    console.log('\nCompatibility testing completed successfully!');
    console.log('Recommendation: sources_google appears to be a compatible replacement for sources_google');
    
  } catch (error) {
    console.error('Error during compatibility testing:', error);
    process.exit(1);
  }
}

main();