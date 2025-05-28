import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkPromptTablesStructure() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Analyzing existing prompt-related tables...\n');
  
  // Tables we know exist
  const existingTables = ['prompts', 'prompt_categories'];
  
  for (const tableName of existingTables) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Table: ${tableName}`);
    console.log('='.repeat(60));
    
    try {
      // Get sample data to understand structure
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(3);
        
      if (error) {
        console.error(`Error querying ${tableName}:`, error.message);
        continue;
      }
      
      console.log(`Total rows: ${count || 0}`);
      
      if (data && data.length > 0) {
        // Get column info from first row
        const columns = Object.keys(data[0]);
        console.log(`\nColumns (${columns.length}):`);
        columns.forEach(col => {
          const sampleValue = data[0][col];
          const type = sampleValue === null ? 'null' : typeof sampleValue;
          console.log(`  - ${col}: ${type}`);
        });
        
        console.log('\nSample data:');
        data.forEach((row, idx) => {
          console.log(`\nRow ${idx + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              const displayValue = typeof value === 'string' && value.length > 50 
                ? value.substring(0, 50) + '...' 
                : value;
              console.log(`  ${key}: ${displayValue}`);
            }
          });
        });
      }
    } catch (error) {
      console.error(`Error processing ${tableName}:`, error);
    }
  }
  
  // Check if there are any references to the missing tables in existing migrations
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('Checking for references to missing tables in prompts table...');
  console.log('='.repeat(60));
  
  const missingTables = ['prompt_output_templates', 'prompt_template_associations', 'auth_user_profiles'];
  
  for (const missingTable of missingTables) {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .or(`prompt_text.ilike.%${missingTable}%,metadata.cs.{"table":"${missingTable}"}`)
      .limit(5);
      
    if (!error && data && data.length > 0) {
      console.log(`\nFound ${data.length} references to "${missingTable}" in prompts table`);
    } else {
      console.log(`\nNo references found to "${missingTable}"`);
    }
  }
  
  // Check profiles table structure (since auth_user_profiles is missing)
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('Checking profiles table (potential replacement for auth_user_profiles)');
  console.log('='.repeat(60));
  
  const { data: profileData, error: profileError, count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .limit(3);
    
  if (!profileError && profileData) {
    console.log(`Total profiles: ${profileCount || 0}`);
    
    if (profileData.length > 0) {
      const columns = Object.keys(profileData[0]);
      console.log(`\nColumns (${columns.length}):`);
      columns.forEach(col => {
        const sampleValue = profileData[0][col];
        const type = sampleValue === null ? 'null' : typeof sampleValue;
        console.log(`  - ${col}: ${type}`);
      });
    }
  }
  
  // Save findings
  const findings = {
    existingTables: {
      prompts: { rowCount: count },
      prompt_categories: { rowCount: 1 },
      profiles: { rowCount: profileCount }
    },
    missingTables: missingTables,
    recommendation: 'The requested tables do not exist. You may need to create them or restore them from a backup.'
  };
  
  const fs = await import('fs/promises');
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono/docs/database/prompt-tables-analysis.json';
  await fs.writeFile(reportPath, JSON.stringify(findings, null, 2));
  console.log(`\n\nAnalysis saved to: ${reportPath}`);
}

// Run the check
checkPromptTablesStructure().catch(console.error);