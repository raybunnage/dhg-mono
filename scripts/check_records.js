// Check records in documentation_files and examine structure

const path = require('path');
const fs = require('fs');

// Try to load CLI client service
try {
  const cliPath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-client.js');
  if (fs.existsSync(cliPath)) {
    console.log('Using CLI Supabase client...');
    const { SupabaseClientService } = require(cliPath);
    const clientService = new SupabaseClientService();
    const client = clientService.getClient();
    
    if (!client) {
      console.error('Failed to initialize client');
      process.exit(1);
    }
    
    checkRecords(client);
  } else {
    console.error('CLI client not found at:', cliPath);
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing:', err);
  process.exit(1);
}

async function checkRecords(client) {
  try {
    // Check if status_recommendation column exists
    console.log('Checking table structure...');
    const { data: columns, error: columnsError } = await client.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'documentation_files'
        ORDER BY ordinal_position;
      `
    });
    
    if (columnsError) {
      console.error('Error checking table structure:', columnsError.message);
    } else {
      console.log('\nTable structure:');
      columns.forEach(col => {
        console.log(`${col.column_name}: ${col.data_type}`);
      });
      
      // Check if status_recommendation column exists
      const hasStatusCol = columns.some(col => col.column_name === 'status_recommendation');
      console.log(`\nStatus recommendation column exists: ${hasStatusCol ? 'YES' : 'NO'}`);
    }
    
    // Check total records
    const { count: totalCount, error: countError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('Error checking record count:', countError.message);
    } else {
      console.log(`\nTotal records in documentation_files: ${totalCount}`);
    }
    
    // Count records with status_recommendation
    const { count: statusCount, error: statusError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (statusError) {
      console.error('Error checking status count:', statusError.message);
    } else {
      console.log(`Records with populated status_recommendation: ${statusCount} (${Math.round((statusCount / totalCount) * 100 || 0)}%)`);
    }
    
    // Get sample records to examine metadata
    const { data: samples, error: sampleError } = await client
      .from('documentation_files')
      .select('id, title, created_at, metadata, status_recommendation')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (sampleError) {
      console.error('Error fetching samples:', sampleError.message);
    } else {
      console.log(`\nFetched ${samples.length} sample records:`);
      
      samples.forEach((record, i) => {
        console.log(`\nRecord #${i+1}:`);
        console.log(`ID: ${record.id}`);
        console.log(`Title: ${record.title}`);
        console.log(`Created: ${record.created_at}`);
        console.log(`Status Recommendation: ${record.status_recommendation || 'NULL'}`);
        
        // Check if metadata contains any status_recommendation fields
        const hasStatus = searchForStatusInMetadata(record.metadata);
        if (hasStatus.found) {
          console.log(`Has status_recommendation in metadata at path: ${hasStatus.path}`);
          console.log(`Value in metadata: ${hasStatus.value}`);
        } else {
          console.log('No status_recommendation found in metadata');
        }
        
        // Log metadata structure analysis
        analyzeMetadata(record.metadata);
      });
    }
    
    // Check for records with metadata but no status
    console.log('\nChecking for records with status in metadata but not in the column...');
    
    const { count: metadataStatusCount, error: metadataError } = await client.rpc('execute_sql', {
      sql: `
        SELECT COUNT(*) as count
        FROM documentation_files
        WHERE (
          metadata->>'status_recommendation' IS NOT NULL 
          OR metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
          OR metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
          OR metadata->'processed_content'->>'status_recommendation' IS NOT NULL
        )
      `
    });
    
    if (metadataError) {
      console.error('Error checking metadata status count:', metadataError.message);
    } else if (metadataStatusCount && metadataStatusCount.length > 0) {
      console.log(`Records with status in metadata: ${metadataStatusCount[0].count}`);
    }
    
    // Check for empty metadata records
    const { count: emptyMetadataCount, error: emptyError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .is('metadata', null);
      
    if (emptyError) {
      console.error('Error checking empty metadata:', emptyError.message);
    } else {
      console.log(`Records with NULL metadata: ${emptyMetadataCount} (${Math.round((emptyMetadataCount / totalCount) * 100)}%)`);
    }
  } catch (error) {
    console.error('Error in check records:', error);
  }
}

function searchForStatusInMetadata(metadata) {
  if (!metadata) {
    return { found: false };
  }
  
  // Check direct property
  if (metadata.status_recommendation) {
    return { 
      found: true, 
      path: 'metadata.status_recommendation', 
      value: metadata.status_recommendation 
    };
  }
  
  // Check in ai_assessment
  if (metadata.ai_assessment && metadata.ai_assessment.status_recommendation) {
    return { 
      found: true, 
      path: 'metadata.ai_assessment.status_recommendation', 
      value: metadata.ai_assessment.status_recommendation 
    };
  }
  
  // Check in processed_content.assessment
  if (metadata.processed_content && 
      metadata.processed_content.assessment && 
      metadata.processed_content.assessment.status_recommendation) {
    return { 
      found: true, 
      path: 'metadata.processed_content.assessment.status_recommendation', 
      value: metadata.processed_content.assessment.status_recommendation 
    };
  }
  
  // Check in processed_content
  if (metadata.processed_content && 
      metadata.processed_content.status_recommendation) {
    return { 
      found: true, 
      path: 'metadata.processed_content.status_recommendation', 
      value: metadata.processed_content.status_recommendation 
    };
  }
  
  return { found: false };
}

function analyzeMetadata(metadata) {
  if (!metadata) {
    console.log('Metadata is NULL');
    return;
  }
  
  if (Object.keys(metadata).length === 0) {
    console.log('Metadata is empty object {}');
    return;
  }
  
  console.log('Metadata top-level keys:', Object.keys(metadata).join(', '));
  
  // Check for specific structures that could contain status_recommendation
  if (metadata.ai_assessment) {
    console.log('ai_assessment keys:', Object.keys(metadata.ai_assessment).join(', '));
  }
  
  if (metadata.processed_content) {
    console.log('processed_content keys:', Object.keys(metadata.processed_content).join(', '));
    
    if (metadata.processed_content.assessment) {
      console.log('processed_content.assessment keys:', Object.keys(metadata.processed_content.assessment).join(', '));
    }
  }
}
