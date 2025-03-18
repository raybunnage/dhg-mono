import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create a test prompt file if it doesn't exist
const promptsDir = path.join(process.cwd(), 'prompts');
const promptFileName = 'test-in-query-prompt.md';
const promptFilePath = path.join(promptsDir, promptFileName);

// Ensure prompts directory exists
if (!fs.existsSync(promptsDir)) {
  console.log(`Creating prompts directory at ${promptsDir}`);
  fs.mkdirSync(promptsDir, { recursive: true });
}

// Create the test prompt file if it doesn't exist
if (!fs.existsSync(promptFilePath)) {
  console.log(`Creating test prompt file at ${promptFilePath}`);
  const promptContent = `# Test IN Query Prompt

A simple test prompt to verify SQL IN queries work.

<\!--
{
  "database_query": "SELECT * FROM document_types WHERE category IN ('AI', 'Development', 'Integration', 'Operations')",
  "title": "Test IN Query",
  "test_with_file": true
}
-->
`;

  fs.writeFileSync(promptFilePath, promptContent, 'utf8');
  console.log('Test prompt file created');
}

// Function to run the prompt-lookup script with our test prompt
function runPromptLookup() {
  console.log('Running prompt-lookup with test-in-query-prompt...');

  // Build the command to run the prompt lookup script
  const command = 'npx ts-node scripts/cli-pipeline/prompt-lookup.ts test-in-query-prompt';
  
  // Execute the command
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.error(`Command stderr: ${stderr}`);
    }
    
    console.log('Prompt lookup output:');
    console.log(stdout);
    
    // Check if a markdown file was created
    const docsDir = path.join(process.cwd(), 'docs');
    const outputFilePath = path.join(docsDir, 'prompt-lookup-test-in-query-prompt.md');
    
    if (fs.existsSync(outputFilePath)) {
      console.log(`\nOutput file created at: ${outputFilePath}`);
      
      // Read the file content to verify the RPC call worked
      const fileContent = fs.readFileSync(outputFilePath, 'utf8');
      
      // Check if the file contains successful query results
      if (fileContent.includes('Records found:') && 
          !fileContent.includes('Error executing query:')) {
        console.log('✅ Success! The execute_sql RPC function was called successfully');
      } else if (fileContent.includes('Error executing query:')) {
        console.log('❌ Error in query execution. Check the markdown file for details.');
      } else {
        console.log('⚠️ Query execution status unclear. Please check the markdown file.');
      }
    } else {
      console.log('❌ Output file was not created. The prompt lookup may have failed.');
    }
  });
}

// Run the test
runPromptLookup();
