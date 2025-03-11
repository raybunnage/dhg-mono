const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

console.log('\n=== Markdown Document Classification ===\n');

// Get environment variables
// Determine if we're in the app directory or the repo root
let REPO_ROOT = process.cwd();
// Check if we need to adjust paths based on current directory
const inAppDir = REPO_ROOT.includes('/apps/dhg-improve-experts');
const inRepoRoot = fs.existsSync(path.join(REPO_ROOT, 'apps', 'dhg-improve-experts'));

// If in app directory, go up to repo root
if (inAppDir && !inRepoRoot) {
  REPO_ROOT = path.join(REPO_ROOT, '../../');
  console.log(`Adjusted repo root to: ${REPO_ROOT}`);
}

let ENV_FILE = path.join(REPO_ROOT, 'apps', 'dhg-improve-experts', '.env.development');
const TARGET_FILE = path.join(REPO_ROOT, 'docs', 'markdown-report.md');
const REPORT_FILE = path.join(REPO_ROOT, 'docs', 'markdown-classification-report.md');

// Load environment variables from .env.development
console.log(`Loading environment from: ${ENV_FILE}`);
if (!fs.existsSync(ENV_FILE)) {
  console.error(`ERROR: Environment file not found at ${ENV_FILE}`);
  process.exit(1);
}

// Use dotenv if available, otherwise try to load manually
try {
  require('dotenv').config({ path: ENV_FILE });
} catch (error) {
  console.log('Dotenv not available, loading environment file manually');
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    });
  } catch (error) {
    console.error(`ERROR loading environment: ${error.message}`);
    process.exit(1);
  }
}

// Check for required environment variables
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Required Supabase environment variables not found');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are in .env.development');
  process.exit(1);
}

console.log(`Supabase URL: ${process.env.VITE_SUPABASE_URL}`);

// Check if Anthropic API key is available
if (!process.env.VITE_ANTHROPIC_API_KEY) {
  console.error('ERROR: Anthropic API key not found in environment variables');
  console.error('Make sure VITE_ANTHROPIC_API_KEY is in .env.development');
  process.exit(1);
} else {
  console.log('Anthropic API key found');
  // Print first few characters of the key for debugging (safely)
  const KEY_PREFIX = process.env.VITE_ANTHROPIC_API_KEY.substring(0, 5) + '...';
  console.log(`API Key prefix: ${KEY_PREFIX}`);
}

// Check if target file exists
if (!fs.existsSync(TARGET_FILE)) {
  console.error(`ERROR: Target markdown file not found at ${TARGET_FILE}`);
  process.exit(1);
} else {
  console.log(`Target file found: ${TARGET_FILE}`);
  try {
    // Print file size
    const stats = fs.statSync(TARGET_FILE);
    console.log(`File size: ${(stats.size / 1024).toFixed(0)}K`);
  } catch (error) {
    console.error(`Error getting file stats: ${error.message}`);
  }
}

// Ensure docs directory exists
const docsDir = path.join(REPO_ROOT, 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Function to read a file
function readFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    console.log('Reading file: ' + fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.log('File does not exist: ' + fullPath);
      return {
        success: false,
        error: 'File not found: ' + fullPath,
        content: null
      };
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    console.log('Successfully read file with size: ' + content.length + ' bytes');
    
    return {
      success: true,
      error: null,
      content: content,
      path: fullPath
    };
  } catch (error) {
    console.log('Error reading file: ' + error.message);
    return {
      success: false,
      error: error.message,
      content: null
    };
  }
}

// Function to make a Claude API call
async function callClaudeApi(messages) {
  return new Promise((resolve) => {
    try {
      console.log('Calling Claude 3.7 API...');
      
      const requestData = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0,
        messages: messages
      };
      
      const data = JSON.stringify(requestData);
      
      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      console.log('API request details:');
      console.log('- Endpoint: ' + options.hostname + options.path);
      console.log('- Model: ' + requestData.model);
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log('Response status code: ' + res.statusCode);
            
            if (res.statusCode === 200) {
              const parsedData = JSON.parse(responseData);
              resolve({
                success: true,
                message: 'Claude API call successful',
                result: parsedData
              });
            } else {
              console.log('Response body: ' + responseData);
              resolve({
                success: false,
                message: 'Claude API call failed with status ' + res.statusCode,
                result: responseData
              });
            }
          } catch (error) {
            console.log('Error parsing response: ' + error.message);
            console.log('Raw response: ' + responseData);
            resolve({
              success: false,
              message: 'Error parsing Claude API response: ' + error.message,
              result: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.log('Request error: ' + error.message);
        resolve({
          success: false,
          message: 'Error calling Claude API: ' + error.message,
          result: null
        });
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.log('Unexpected error: ' + error.message);
      resolve({
        success: false,
        message: 'Unexpected error in Claude API call: ' + error.message,
        result: null
      });
    }
  });
}

// Main function to classify markdown
async function classifyMarkdown() {
  const results = {
    timestamp: new Date().toISOString(),
    targetFile: {
      path: TARGET_FILE,
      success: false,
      content: null,
      error: null
    },
    prompt: {
      success: false,
      data: null,
      error: null
    },
    relatedAssets: {
      success: false,
      data: [],
      error: null
    },
    documentTypes: {
      success: false,
      data: [],
      error: null
    },
    claudeApiCall: {
      success: false,
      request: null,
      response: null,
      error: null
    }
  };
  
  try {
    console.log('Starting markdown classification...');
    
    // Step 1: Read the target markdown file
    console.log('\n1. Reading target markdown file...');
    const targetFileResult = readFile(TARGET_FILE);
    
    if (targetFileResult.success) {
      results.targetFile.success = true;
      results.targetFile.content = targetFileResult.content;
      console.log('✅ Successfully read target file: ' + TARGET_FILE);
      console.log('   Content length: ' + targetFileResult.content.length + ' characters');
    } else {
      results.targetFile.error = targetFileResult.error;
      throw new Error('Failed to read target file: ' + targetFileResult.error);
    }
    
    // Step 2: Retrieve the classification prompt
    console.log('\n2. Retrieving classification prompt...');
    
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .ilike('name', '%markdown-document-classification-prompt%')
      .limit(1);
    
    if (promptError) {
      results.prompt.error = promptError.message;
      throw new Error('Failed to retrieve prompt: ' + promptError.message);
    }
    
    if (!promptData || promptData.length === 0) {
      results.prompt.error = 'Prompt not found';
      throw new Error('Classification prompt not found in the database');
    }
    
    const prompt = promptData[0];
    results.prompt.success = true;
    results.prompt.data = prompt;
    console.log('✅ Found prompt: ' + prompt.name + ' (ID: ' + prompt.id + ')');
    console.log('   Created: ' + new Date(prompt.created_at).toLocaleString());
    console.log('   Content preview: ' + prompt.content.substring(0, 100) + '...');
    
    // Step 3: Find related assets
    console.log('\n3. Finding related assets...');
    
    const { data: relationshipsData, error: relationshipsError } = await supabase
      .from('prompt_relationships')
      .select('*')
      .eq('prompt_id', prompt.id);
    
    if (relationshipsError) {
      results.relatedAssets.error = relationshipsError.message;
      throw new Error('Failed to retrieve related assets: ' + relationshipsError.message);
    }
    
    if (!relationshipsData || relationshipsData.length === 0) {
      console.log('⚠️ No related assets found for this prompt');
    } else {
      console.log('✅ Found ' + relationshipsData.length + ' related assets');
      
      // Process each related asset
      const relatedAssets = [];
      
      for (const relationship of relationshipsData) {
        console.log('   - Processing asset: ' + relationship.asset_path);
        
        // Read the related file
        const assetContent = readFile(path.join(REPO_ROOT, relationship.asset_path));
        
        // Get document type if available
        let documentType = null;
        if (relationship.document_type_id) {
          const { data: docTypeData, error: docTypeError } = await supabase
            .from('document_types')
            .select('*')
            .eq('id', relationship.document_type_id)
            .single();
            
          if (!docTypeError && docTypeData) {
            documentType = docTypeData;
          }
        }
        
        relatedAssets.push({
          relationship: relationship,
          content: assetContent.success ? assetContent.content : null,
          documentType: documentType,
          success: assetContent.success,
          error: assetContent.error
        });
        
        if (assetContent.success) {
          console.log('     ✅ Successfully read file: ' + relationship.asset_path);
          console.log('        Content length: ' + assetContent.content.length + ' characters');
        } else {
          console.log('     ❌ Failed to read file: ' + assetContent.error);
        }
      }
      
      results.relatedAssets.success = true;
      results.relatedAssets.data = relatedAssets;
    }
    
    // Step 4: Get document types with category "Documentation"
    console.log('\n4. Getting document types with category "Documentation"...');
    
    const { data: documentTypesData, error: documentTypesError } = await supabase
      .from('document_types')
      .select('*')
      .eq('category', 'Documentation');
    
    if (documentTypesError) {
      results.documentTypes.error = documentTypesError.message;
      throw new Error('Failed to retrieve document types: ' + documentTypesError.message);
    }
    
    if (!documentTypesData || documentTypesData.length === 0) {
      console.log('⚠️ No document types found with category "Documentation"');
    } else {
      results.documentTypes.success = true;
      results.documentTypes.data = documentTypesData;
      console.log('✅ Found ' + documentTypesData.length + ' document types with category "Documentation"');
      
      for (const docType of documentTypesData) {
        console.log('   - ' + docType.name + ' (ID: ' + docType.id + ')');
      }
    }
    
    // Step 5: Assemble the Claude API request
    console.log('\n5. Assembling Claude API request...');
    
    // Prepare the context for the API call
    const documentTypesJson = JSON.stringify(results.documentTypes.data, null, 2);
    
    // Prepare related assets context
    let relatedAssetsContext = '';
    if (results.relatedAssets.data.length > 0) {
      for (const asset of results.relatedAssets.data) {
        if (asset.success) {
          relatedAssetsContext += '\n--- Related Asset: ' + asset.relationship.asset_path + ' ---\n';
          if (asset.relationship.relationship_context) {
            relatedAssetsContext += 'Context: ' + asset.relationship.relationship_context + '\n\n';
          }
          relatedAssetsContext += asset.content + '\n\n';
        }
      }
    }
    
    // Assemble the messages for the API call
    const promptText = 'I need you to analyze and classify a markdown document according to our document types.\n\n' +
      'Here is the prompt for classification:\n' + prompt.content + 
      '\n\nHere are the document types with category "Documentation" in JSON format:\n' +
      documentTypesJson +
      '\n\nHere are the related assets and their context:\n' +
      relatedAssetsContext +
      '\n\nNow, please analyze the following markdown document and classify it according to the document types:\n\n' +
      results.targetFile.content +
      '\n\nPlease provide your classification in JSON format, including the document type ID, name, and explanation for your choice. Also include any metadata you can extract from the document.';
    
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText
          }
        ]
      }
    ];
    
    results.claudeApiCall.request = messages;
    console.log('✅ API request assembled');
    
    // Step 6: Make the Claude API call
    console.log('\n6. Making Claude API call...');
    
    const claudeResponse = await callClaudeApi(messages);
    
    if (claudeResponse.success) {
      results.claudeApiCall.success = true;
      results.claudeApiCall.response = claudeResponse.result;
      console.log('✅ Claude API call successful');
    } else {
      results.claudeApiCall.error = claudeResponse.message;
      results.claudeApiCall.response = claudeResponse.result;
      console.log('❌ Claude API call failed: ' + claudeResponse.message);
    }
    
    // Step 7: Generate the report
    console.log('\n7. Generating classification report...');
    
    // Create report content
    let report = '# Markdown Classification Report\n\n';
    report += 'Generated: ' + new Date().toLocaleString() + '\n\n';
    
    // Target file section
    report += '## 1. Target File\n\n';
    report += '**Path:** ' + TARGET_FILE + '\n';
    report += '**Status:** ' + (results.targetFile.success ? '✅ Successfully read' : '❌ Failed to read') + '\n';
    if (results.targetFile.error) {
      report += '**Error:** ' + results.targetFile.error + '\n';
    }
    report += '**Content Preview:**\n\n';
    report += '```markdown\n' + results.targetFile.content.substring(0, 500) + '...\n```\n\n';
    
    // Prompt section
    report += '## 2. Classification Prompt\n\n';
    report += '**Status:** ' + (results.prompt.success ? '✅ Found' : '❌ Not found') + '\n';
    if (results.prompt.error) {
      report += '**Error:** ' + results.prompt.error + '\n';
    }
    
    if (results.prompt.success) {
      report += '**Name:** ' + results.prompt.data.name + '\n';
      report += '**ID:** ' + results.prompt.data.id + '\n';
      report += '**Created:** ' + new Date(results.prompt.data.created_at).toLocaleString() + '\n\n';
      report += '**Content:**\n\n';
      report += '```\n' + results.prompt.data.content + '\n```\n\n';
    }
    
    // Related assets section
    report += '## 3. Related Assets\n\n';
    report += '**Status:** ' + (results.relatedAssets.success ? '✅ Found' : '❌ None found') + '\n';
    report += '**Count:** ' + results.relatedAssets.data.length + ' assets\n';
    if (results.relatedAssets.error) {
      report += '**Error:** ' + results.relatedAssets.error + '\n';
    }
    report += '\n';
    
    if (results.relatedAssets.data.length > 0) {
      for (let i = 0; i < results.relatedAssets.data.length; i++) {
        const asset = results.relatedAssets.data[i];
        report += '### Asset ' + (i + 1) + '\n\n';
        report += '**Path:** ' + asset.relationship.asset_path + '\n';
        report += '**Relationship Type:** ' + asset.relationship.relationship_type + '\n';
        
        if (asset.relationship.relationship_context) {
          report += '**Context:** ' + asset.relationship.relationship_context + '\n';
        }
        
        if (asset.documentType) {
          report += '**Document Type:** ' + asset.documentType.name + ' (ID: ' + asset.documentType.id + ')\n';
        }
        
        report += '**Status:** ' + (asset.success ? '✅ Successfully read' : '❌ Failed to read') + '\n';
        
        if (asset.error) {
          report += '**Error:** ' + asset.error + '\n';
        }
        
        if (asset.success) {
          report += '**Content Preview:**\n\n';
          report += '```\n' + asset.content.substring(0, 300) + '...\n```\n\n';
        }
      }
    }
    
    // Document types section
    report += '## 4. Document Types\n\n';
    report += '**Status:** ' + (results.documentTypes.success ? '✅ Found' : '❌ None found') + '\n';
    report += '**Count:** ' + results.documentTypes.data.length + ' document types\n';
    if (results.documentTypes.error) {
      report += '**Error:** ' + results.documentTypes.error + '\n';
    }
    report += '\n';
    
    if (results.documentTypes.success) {
      report += '**Document Types JSON:**\n\n';
      report += '```json\n' + JSON.stringify(results.documentTypes.data, null, 2) + '\n```\n\n';
    }
    
    // Claude API call section
    report += '## 5. Claude API Call\n\n';
    report += '**Status:** ' + (results.claudeApiCall.success ? '✅ Successful' : '❌ Failed') + '\n';
    if (results.claudeApiCall.error) {
      report += '**Error:** ' + results.claudeApiCall.error + '\n';
    }
    report += '\n';
    
    // API request - stringify with null,2 for pretty printing
    report += '### API Request\n\n';
    report += '```json\n' + JSON.stringify(results.claudeApiCall.request, null, 2) + '\n```\n\n';
    
    // API response
    report += '### API Response\n\n';
    if (results.claudeApiCall.success) {
      report += '```json\n' + JSON.stringify(results.claudeApiCall.response, null, 2) + '\n```\n\n';
      
      // Extract and display the classification result
      report += '## 6. Classification Result\n\n';
      // Use safe access pattern for the response
      const responseText = results.claudeApiCall.response && 
                          results.claudeApiCall.response.content && 
                          results.claudeApiCall.response.content[0] && 
                          results.claudeApiCall.response.content[0].text
                          ? results.claudeApiCall.response.content[0].text
                          : 'No text content in response';
      
      report += responseText;
    } else {
      report += '```\n' + JSON.stringify(results.claudeApiCall.response, null, 2) + '\n```\n\n';
    }
    
    // Write the report to file
    fs.writeFileSync(REPORT_FILE, report);
    console.log('✅ Classification report written to: ' + REPORT_FILE);
    
  } catch (error) {
    console.error('Error during markdown classification:', error.message);
    
    // Generate error report
    let errorReport = '# Markdown Classification Error\n\n';
    errorReport += 'Generated: ' + new Date().toLocaleString() + '\n\n';
    errorReport += '## Error\n\n';
    errorReport += error.message + '\n\n';
    
    // Include partial results if available
    errorReport += '## Partial Results\n\n';
    
    if (results.targetFile.success) {
      errorReport += '### Target File\n\n';
      errorReport += 'Successfully read: ' + TARGET_FILE + '\n\n';
    }
    
    if (results.prompt.success) {
      errorReport += '### Prompt\n\n';
      errorReport += 'Found prompt: ' + results.prompt.data.name + '\n\n';
    }
    
    if (results.relatedAssets.success) {
      errorReport += '### Related Assets\n\n';
      errorReport += 'Found ' + results.relatedAssets.data.length + ' related assets\n\n';
    }
    
    if (results.documentTypes.success) {
      errorReport += '### Document Types\n\n';
      errorReport += 'Found ' + results.documentTypes.data.length + ' document types\n\n';
    }
    
    // Write the error report to file
    fs.writeFileSync(REPORT_FILE, errorReport);
    console.log('❌ Error report written to: ' + REPORT_FILE);
  }
}

// Run the classification
classifyMarkdown()
  .then(() => {
    console.log('\n=== Classification completed. Report saved to ' + REPORT_FILE + ' ===\n');
  })
  .catch(error => {
    console.error('\nFATAL ERROR:', error.message);
    process.exit(1);
  });