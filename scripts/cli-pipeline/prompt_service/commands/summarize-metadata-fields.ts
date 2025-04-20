import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';

/**
 * Command to summarize metadata fields across all prompt records
 */
export async function summarizeMetadataFieldsCommand() {
  try {
    console.log('Summarizing metadata fields across all prompt records...');
    
    // Get all prompts from the database
    const prompts = await promptManagementService.getDatabasePrompts();
    
    if (prompts.length === 0) {
      console.log('No prompts found in database.');
      return;
    }
    
    console.log(`Found ${prompts.length} prompts in database.`);
    
    // Track field usage statistics
    const fieldCounts: Record<string, number> = {};
    const fieldNestedCounts: Record<string, Record<string, number>> = {};
    
    // Process each prompt
    for (const prompt of prompts) {
      const metadata = prompt.metadata || {};
      
      // Count top-level fields
      Object.keys(metadata).forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        
        // Count nested fields for objects
        if (metadata[field] && typeof metadata[field] === 'object' && !Array.isArray(metadata[field])) {
          if (!fieldNestedCounts[field]) {
            fieldNestedCounts[field] = {};
          }
          
          Object.keys(metadata[field]).forEach(nestedField => {
            fieldNestedCounts[field][nestedField] = (fieldNestedCounts[field][nestedField] || 0) + 1;
          });
        }
      });
    }
    
    // Display results
    console.log('\nMetadata Fields Summary:');
    console.log('======================');
    
    // First show a table of field presence by prompt
    console.log('\nField Presence By Prompt:');
    console.log('-----------------------');
    
    // Get all unique field names
    const allFields = Object.keys(fieldCounts).sort();
    
    // Table header with prompt names
    const header = ['Field', ...prompts.map(p => p.name.substring(0, 12) + (p.name.length > 12 ? '...' : ''))];
    console.log(header.join(' | '));
    console.log(header.map(h => '-'.repeat(h.length)).join(' | '));
    
    // Create rows for each field
    for (const field of allFields) {
      const row = [field];
      
      for (const prompt of prompts) {
        const hasField = prompt.metadata && field in prompt.metadata;
        row.push(hasField ? '✓' : ' ');
      }
      
      console.log(row.join(' | '));
    }
    
    // Display field usage statistics
    console.log('\nField Usage Counts:');
    console.log('-----------------');
    
    // Sort fields by frequency
    const sortedFields = Object.entries(fieldCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([field, count]) => ({ field, count, percentage: (count / prompts.length) * 100 }));
    
    for (const { field, count, percentage } of sortedFields) {
      console.log(`${field}: ${count}/${prompts.length} prompts (${percentage.toFixed(0)}%)`);
      
      // Show nested fields if present
      if (fieldNestedCounts[field]) {
        const nestedFields = Object.entries(fieldNestedCounts[field])
          .sort((a, b) => b[1] - a[1]);
        
        for (const [nestedField, nestedCount] of nestedFields) {
          const nestedPercentage = (nestedCount / count) * 100;
          console.log(`  └─ ${nestedField}: ${nestedCount}/${count} (${nestedPercentage.toFixed(0)}%)`);
        }
      }
    }
    
    // Display value examples for key fields
    console.log('\nExample Values:');
    console.log('--------------');
    
    // Select interesting fields to show examples for
    const interestingFields = ['aiEngine.model', 'source.fileName', 'databaseQuery'];
    
    for (const fieldPath of interestingFields) {
      const [parentField, childField] = fieldPath.split('.');
      
      console.log(`\n${fieldPath}:`);
      const uniqueValues = new Set<string>();
      
      // Collect unique values
      for (const prompt of prompts) {
        const metadata = prompt.metadata || {};
        
        if (childField) {
          // Handle nested fields
          if (metadata[parentField] && metadata[parentField][childField]) {
            uniqueValues.add(String(metadata[parentField][childField]));
          }
        } else {
          // Handle top-level fields
          if (parentField in metadata) {
            if (typeof metadata[parentField] === 'string') {
              uniqueValues.add(metadata[parentField].substring(0, 80));
            } else if (typeof metadata[parentField] === 'object') {
              uniqueValues.add(JSON.stringify(metadata[parentField]).substring(0, 80));
            } else {
              uniqueValues.add(String(metadata[parentField]));
            }
          }
        }
      }
      
      // Display unique values
      if (uniqueValues.size === 0) {
        console.log('  No values found');
      } else {
        Array.from(uniqueValues).forEach(value => {
          console.log(`  - ${value}`);
        });
      }
    }
    
  } catch (error) {
    console.error(`Error summarizing metadata fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}