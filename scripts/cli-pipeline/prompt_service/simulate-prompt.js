const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');

async function simulatePromptUsage() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get the prompt content
    console.log('Loading prompt...');
    const { data: prompt, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', 'document-classification-prompt-new')
      .single();
    
    if (promptError) {
      console.error('Error fetching prompt:', promptError);
      return;
    }
    
    console.log('Prompt loaded successfully');
    console.log('Prompt name:', prompt.name);
    console.log('Metadata keys:', Object.keys(prompt.metadata || {}));
    
    // Execute database queries
    const docTypesQuery = prompt.metadata?.databaseQuery;
    const templatesQuery = prompt.metadata?.databaseQuery2;
    
    let documentTypes = [];
    let templates = [];
    
    // Get document types
    if (docTypesQuery) {
      console.log('\nExecuting document types query...');
      const { data: docTypes, error: docTypesError } = await supabase.rpc('execute_sql', {
        sql: docTypesQuery
      });
      
      if (docTypesError) {
        console.error('Error executing document types query:', docTypesError);
      } else {
        documentTypes = docTypes;
        console.log('Document types retrieved:', documentTypes.length);
      }
    }
    
    // Get templates
    if (templatesQuery) {
      console.log('\nExecuting templates query...');
      const { data: templateData, error: templatesError } = await supabase.rpc('execute_sql', {
        sql: templatesQuery
      });
      
      if (templatesError) {
        console.error('Error executing templates query:', templatesError);
      } else {
        templates = templateData;
        console.log('Templates retrieved:', templates.length);
      }
    }
    
    // Output sample data
    console.log('\nSample document types (first 3):');
    console.log(JSON.stringify(documentTypes.slice(0, 3), null, 2));
    
    console.log('\nOutput templates:');
    console.log(JSON.stringify(templates, null, 2));
    
    // Simulate the complete prompt
    const simulatedPrompt = `
# ${prompt.name}

${prompt.content}

## Sample document types:
\`\`\`json
${JSON.stringify(documentTypes.slice(0, 3), null, 2)}
\`\`\`

## Output templates:
\`\`\`json
${JSON.stringify(templates, null, 2)}
\`\`\`
`;
    
    // Save to file for inspection
    const outputPath = '../../prompts/assembled-classification-prompt.md';
    fs.writeFileSync(outputPath, simulatedPrompt, 'utf8');
    console.log(`\nComplete assembled prompt saved to ${outputPath}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

simulatePromptUsage();