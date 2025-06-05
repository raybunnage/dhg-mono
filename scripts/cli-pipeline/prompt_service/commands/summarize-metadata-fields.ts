import { promptManagementService, PromptMetadata } from '../../../../packages/shared/services/prompt-service/prompt-management-service';

/**
 * Command to summarize metadata fields across all prompt records
 */

// Define a type for metadata with index signature
interface IndexableMetadata extends PromptMetadata {
  [key: string]: any;
}
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
      // Cast to our indexable type for TypeScript
      const metadata = prompt.metadata ? (prompt.metadata as IndexableMetadata) : ({} as IndexableMetadata);
      
      // Count top-level fields
      Object.keys(metadata).forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        
        // Count nested fields for objects
        if (metadata[field] && typeof metadata[field] === 'object' && !Array.isArray(metadata[field])) {
          if (!fieldNestedCounts[field]) {
            fieldNestedCounts[field] = {};
          }
          
          Object.keys(metadata[field] as Record<string, any>).forEach(nestedField => {
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
        const metadata = prompt.metadata as IndexableMetadata | undefined;
        const hasField = metadata && field in metadata;
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
    const interestingFields = ['aiEngine.model', 'source.fileName', 'databaseQuery', 'databaseQuery2'];
    
    for (const fieldPath of interestingFields) {
      const [parentField, childField] = fieldPath.split('.');
      
      console.log(`\n${fieldPath}:`);
      
      // Collect and display full values for each prompt
      for (const prompt of prompts) {
        const metadata = prompt.metadata ? (prompt.metadata as IndexableMetadata) : ({} as IndexableMetadata);
        
        if (childField) {
          // Handle nested fields
          const parentValue = metadata[parentField];
          if (parentValue && typeof parentValue === 'object') {
            const nestedObj = parentValue as Record<string, any>;
            if (childField in nestedObj) {
              console.log(`\n  [${prompt.name}]:`);
              console.log(`  ${String(nestedObj[childField])}`);
            }
          }
        } else {
          // Handle top-level fields
          if (parentField in metadata) {
            const value = metadata[parentField];
            console.log(`\n  [${prompt.name}]:`);
            if (typeof value === 'string') {
              console.log(`  ${value}`);
            } else if (typeof value === 'object') {
              console.log(`  ${JSON.stringify(value, null, 2)}`);
            } else {
              console.log(`  ${String(value)}`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error summarizing metadata fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}