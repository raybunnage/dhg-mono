#!/bin/bash

# validate-prompt-relationships.sh - A script to validate prompt relationships
# This script:
# 1. Tests Claude 3.7 API connectivity
# 2. Queries the prompts table for "markdown-document-classification-prompt"
# 3. Retrieves related records from prompt_relationships
# 4. Queries document_types with category "Documentation"
# 5. Reads and displays content from docs/markdown-report.md
# 6. Writes the results to docs/ai-assets-validation-report.md

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Define important locations
REPO_ROOT="$(pwd)"
ENV_FILE="$REPO_ROOT/apps/dhg-improve-experts/.env.development"
REPORT_FILE="$REPO_ROOT/docs/ai-assets-validation-report.md"

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "${RED}ERROR: Environment file not found at $ENV_FILE${NC}"
  exit 1
fi

# Load environment variables from .env.development file
echo -e "${BLUE}Loading Supabase and API credentials from $ENV_FILE...${NC}"
set -a
source "$ENV_FILE"
set +a

# Check if required environment variables are loaded
if [[ -z "$VITE_SUPABASE_URL" || -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
  echo -e "${RED}ERROR: Required Supabase environment variables not found${NC}"
  echo "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are in $ENV_FILE"
  exit 1
fi

echo -e "${GREEN}Supabase URL: $VITE_SUPABASE_URL${NC}"

# Check if Anthropic API key is available
if [[ -z "$VITE_ANTHROPIC_API_KEY" ]]; then
  echo -e "${YELLOW}WARNING: Anthropic API key not found in environment variables${NC}"
  echo "Claude API test will be skipped"
  CLAUDE_API_TEST="skipped"
else
  echo -e "${GREEN}Anthropic API key found, will test Claude API${NC}"
  # Print first few characters of the key for debugging (safely)
  KEY_PREFIX="${VITE_ANTHROPIC_API_KEY:0:5}..."
  echo "API Key prefix: $KEY_PREFIX"
  CLAUDE_API_TEST="enabled"
fi

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Create a Node.js script to query the database and generate the report
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const repoRoot = '$REPO_ROOT';
const reportFile = '$REPORT_FILE';
const claudeApiTest = '$CLAUDE_API_TEST';
const anthropicApiKey = process.env.VITE_ANTHROPIC_API_KEY;

// Function to test Claude API
async function testClaudeApi() {
  if (claudeApiTest !== 'enabled' || !anthropicApiKey) {
    return {
      success: false,
      message: 'Claude API test skipped - API key not available',
      result: null
    };
  }
  
  return new Promise((resolve) => {
    try {
      console.log('Testing Claude 3.7 API...');
      console.log(\`API Key prefix: \${anthropicApiKey.substring(0, 5)}...\`);
      
      // Simple request for Claude 3.7
      const requestData = {
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 300,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Please analyze the current state of the documentation_files table in our database. What are some best practices for maintaining documentation files in a monorepo? Provide 3 specific recommendations.'
          }
        ]
      };
      
      const data = JSON.stringify(requestData);
      
      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      console.log('API request details:');
      console.log(\`- Endpoint: \${options.hostname}\${options.path}\`);
      console.log(\`- Model: \${requestData.model}\`);
      console.log(\`- API Version: \${options.headers['anthropic-version']}\`);
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(\`Response status code: \${res.statusCode}\`);
            
            if (res.statusCode === 200) {
              const parsedData = JSON.parse(responseData);
              resolve({
                success: true,
                message: 'Claude API test successful',
                result: parsedData.content[0].text
              });
            } else {
              console.log(\`Response body: \${responseData}\`);
              resolve({
                success: false,
                message: \`Claude API test failed with status \${res.statusCode}\`,
                result: responseData
              });
            }
          } catch (error) {
            console.log(\`Error parsing response: \${error.message}\`);
            console.log(\`Raw response: \${responseData}\`);
            resolve({
              success: false,
              message: \`Error parsing Claude API response: \${error.message}\`,
              result: responseData
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(\`Request error: \${error.message}\`);
        resolve({
          success: false,
          message: \`Error calling Claude API: \${error.message}\`,
          result: null
        });
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      console.log(\`Unexpected error: \${error.message}\`);
      resolve({
        success: false,
        message: \`Unexpected error in Claude API test: \${error.message}\`,
        result: null
      });
    }
  });
}

// Function to read a file and get a preview
function getFilePreview(filePath, maxLines = 10) {
  try {
    const fullPath = path.join(repoRoot, filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        exists: false,
        error: 'File not found',
        content: null,
        preview: null
      };
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\\n');
    const preview = lines.slice(0, maxLines).join('\\n');
    
    return {
      exists: true,
      error: null,
      content: content,
      preview: preview,
      totalLines: lines.length
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message,
      content: null,
      preview: null
    };
  }
}

// Main function to validate prompt relationships
async function validatePromptRelationships() {
  const results = {
    timestamp: new Date().toISOString(),
    claudeApiTest: null,
    markdownReport: {
      success: false,
      preview: null,
      error: null
    },
    promptQuery: {
      success: false,
      prompt: null,
      error: null
    },
    relationships: {
      success: false,
      data: [],
      enriched: [],
      error: null
    },
    documentTypes: {
      success: false,
      data: [],
      error: null
    }
  };
  
  try {
    console.log('Starting validation...');
    
    // 1. Test Claude API
    console.log('\\n1. Testing Claude API...');
    results.claudeApiTest = await testClaudeApi();
    console.log(\`Claude API test result: \${results.claudeApiTest.success ? '✅ SUCCESS' : '❌ FAILED'}\`);
    if (results.claudeApiTest.success) {
      console.log('Claude API response preview:');
      console.log(results.claudeApiTest.result.substring(0, 100) + '...');
    } else {
      console.log(\`Claude API error: \${results.claudeApiTest.message}\`);
    }
    
    // 2. Read docs/markdown-report.md
    console.log('\\n2. Reading docs/markdown-report.md...');
    const markdownReportPath = 'docs/markdown-report.md';
    const markdownReport = getFilePreview(markdownReportPath);
    
    if (markdownReport.exists) {
      results.markdownReport.success = true;
      results.markdownReport.preview = markdownReport.preview;
      console.log(\`✅ Successfully read \${markdownReportPath}\`);
      console.log(\`   Total lines: \${markdownReport.totalLines}\`);
      console.log('   Preview:');
      console.log(markdownReport.preview);
    } else {
      results.markdownReport.error = markdownReport.error;
      console.log(\`❌ Error reading \${markdownReportPath}: \${markdownReport.error}\`);
    }
    
    // 3. Query the prompts table for the specific prompt
    console.log('\\n3. Querying prompts table for \"markdown-document-classification-prompt\"...');
    
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .ilike('name', '%markdown-document-classification-prompt%')
      .limit(1);
    
    if (promptError) {
      console.log(\`❌ Error querying prompts table: \${promptError.message}\`);
      results.promptQuery.error = promptError.message;
    } else if (promptData && promptData.length > 0) {
      const prompt = promptData[0];
      results.promptQuery.success = true;
      results.promptQuery.prompt = prompt;
      console.log(\`✅ Found prompt: \${prompt.name} (ID: \${prompt.id})\`);
      console.log(\`   Created: \${new Date(prompt.created_at).toLocaleString()}\`);
      console.log(\`   Content preview: \${prompt.content.substring(0, 100)}...\`);
      
      // 4. Query the prompt_relationships table for related records
      console.log('\\n4. Querying prompt_relationships table for related records...');
      
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('prompt_relationships')
        .select('*')
        .eq('prompt_id', prompt.id);
      
      if (relationshipsError) {
        console.log(\`❌ Error querying prompt_relationships table: \${relationshipsError.message}\`);
        results.relationships.error = relationshipsError.message;
      } else {
        results.relationships.success = true;
        results.relationships.data = relationshipsData || [];
        
        if (relationshipsData && relationshipsData.length > 0) {
          console.log(\`✅ Found \${relationshipsData.length} related records\`);
          
          // Get all document types for lookup
          const { data: allDocTypes } = await supabase
            .from('document_types')
            .select('*');
          
          const docTypesMap = {};
          if (allDocTypes) {
            allDocTypes.forEach(dt => {
              docTypesMap[dt.id] = dt;
            });
          }
          
          // Enrich relationship data with file content and document type
          for (const relationship of relationshipsData) {
            console.log(\`   - Relationship ID: \${relationship.id}\`);
            console.log(\`     Asset Path: \${relationship.asset_path}\`);
            console.log(\`     Relationship Type: \${relationship.relationship_type}\`);
            
            if (relationship.relationship_context) {
              console.log(\`     Context: \${relationship.relationship_context}\`);
            }
            
            // Get document type if available
            let documentType = null;
            if (relationship.document_type_id && docTypesMap[relationship.document_type_id]) {
              documentType = docTypesMap[relationship.document_type_id];
              console.log(\`     Document Type: \${documentType.name}\`);
            }
            
            // Read file content if available
            const filePreview = getFilePreview(relationship.asset_path, 5);
            if (filePreview.exists) {
              console.log(\`     File Preview (first 5 lines):\\n\${filePreview.preview}\`);
            } else {
              console.log(\`     File not found: \${filePreview.error}\`);
            }
            
            // Add enriched data to results
            results.relationships.enriched.push({
              relationship,
              documentType,
              filePreview: {
                exists: filePreview.exists,
                preview: filePreview.preview,
                totalLines: filePreview.totalLines,
                error: filePreview.error
              }
            });
          }
        } else {
          console.log('❌ No related records found');
        }
      }
    } else {
      console.log('❌ Prompt \"markdown-document-classification-prompt\" not found');
      results.promptQuery.error = 'Prompt not found';
    }
    
    // 5. Query document_types with category "Documentation"
    console.log('\\n5. Querying document_types with category \"Documentation\"...');
    
    const { data: documentTypesData, error: documentTypesError } = await supabase
      .from('document_types')
      .select('*')
      .eq('category', 'Documentation');
    
    if (documentTypesError) {
      console.log(\`❌ Error querying document_types table: \${documentTypesError.message}\`);
      results.documentTypes.error = documentTypesError.message;
    } else {
      results.documentTypes.success = true;
      results.documentTypes.data = documentTypesData || [];
      
      if (documentTypesData && documentTypesData.length > 0) {
        console.log(\`✅ Found \${documentTypesData.length} document types with category \"Documentation\"\`);
        
        for (const docType of documentTypesData) {
          console.log(\`   - \${docType.name} (ID: \${docType.id})\`);
          if (docType.description) {
            console.log(\`     Description: \${docType.description}\`);
          }
        }
      } else {
        console.log('❌ No document types found with category \"Documentation\"');
      }
    }
    
    // Generate report - using a much simpler approach to avoid template literal issues
    console.log('\\nGenerating validation report...');
    
    // Create report parts as separate files to avoid string escaping issues
    const tempDir = path.join(repoRoot, 'temp_report_parts');
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Write JSON data to temporary files
    fs.writeFileSync(path.join(tempDir, 'prompt.json'), 
                    JSON.stringify(results.promptQuery.prompt, null, 2));
    fs.writeFileSync(path.join(tempDir, 'relationships.json'), 
                    JSON.stringify(results.relationships.data, null, 2));
    fs.writeFileSync(path.join(tempDir, 'document_types.json'), 
                    JSON.stringify(results.documentTypes.data, null, 2));
    fs.writeFileSync(path.join(tempDir, 'enriched_relationships.json'), 
                    JSON.stringify(results.relationships.enriched, null, 2));
    
    // Write API response if available
    if (results.claudeApiTest.success && results.claudeApiTest.result) {
      fs.writeFileSync(path.join(tempDir, 'api_response.txt'), results.claudeApiTest.result);
    } else if (results.claudeApiTest.result) {
      fs.writeFileSync(path.join(tempDir, 'api_error.txt'), 
                      String(results.claudeApiTest.result));
    }
    
    // Write markdown report preview if available
    if (results.markdownReport.success && results.markdownReport.preview) {
      fs.writeFileSync(path.join(tempDir, 'markdown_preview.txt'), results.markdownReport.preview);
    }
    
    // Create report header
    let report = '# Validation Report\\n\\n';
    report += 'Generated: ' + new Date().toLocaleString() + '\\n\\n';
    
    // Claude API section
    report += '## 1. Claude API Test\\n\\n';
    report += '**Status:** ' + (results.claudeApiTest.success ? '✅ SUCCESS' : '❌ FAILED') + '\\n';
    report += '**Message:** ' + results.claudeApiTest.message + '\\n\\n';
    
    if (results.claudeApiTest.success && results.claudeApiTest.result) {
      report += '### Claude API Response\\n\\n';
      report += fs.readFileSync(path.join(tempDir, 'api_response.txt'), 'utf8');
      report += '\\n\\n';
    } else if (results.claudeApiTest.result) {
      report += '### Error Response\\n\\n```\\n';
      report += fs.readFileSync(path.join(tempDir, 'api_error.txt'), 'utf8');
      report += '\\n```\\n\\n';
    }
    
    // Markdown report section
    report += '## 2. Markdown Report File\\n\\n';
    report += '**Status:** ' + (results.markdownReport.success ? '✅ SUCCESS' : '❌ FAILED') + '\\n';
    report += '**Error:** ' + (results.markdownReport.error || 'None') + '\\n\\n';
    
    if (results.markdownReport.success && results.markdownReport.preview) {
      report += '### File Preview\\n\\n```markdown\\n';
      report += fs.readFileSync(path.join(tempDir, 'markdown_preview.txt'), 'utf8');
      report += '\\n```\\n\\n';
    }
    
    // Prompt section
    report += '## 3. Prompt Query\\n\\n';
    report += '**Status:** ' + (results.promptQuery.success ? '✅ SUCCESS' : '❌ FAILED') + '\\n';
    report += '**Error:** ' + (results.promptQuery.error || 'None') + '\\n\\n';
    report += '### Prompt Details\\n\\n```\\n';
    report += fs.readFileSync(path.join(tempDir, 'prompt.json'), 'utf8');
    report += '\\n```\\n\\n';
    
    // Relationships section
    report += '## 4. Related Records\\n\\n';
    report += '**Status:** ' + (results.relationships.success ? '✅ SUCCESS' : '❌ FAILED') + '\\n';
    report += '**Count:** ' + results.relationships.data.length + ' records found\\n';
    report += '**Error:** ' + (results.relationships.error || 'None') + '\\n\\n';
    
    // Enhanced relationship details
    if (results.relationships.enriched.length > 0) {
      report += '### Enriched Relationship Details\\n\\n';
      
      for (let i = 0; i < results.relationships.enriched.length; i++) {
        const item = results.relationships.enriched[i];
        const rel = item.relationship;
        const docType = item.documentType;
        const filePreview = item.filePreview;
        
        report += '#### Relationship ' + (i + 1) + '\\n\\n';
        report += '- **ID:** ' + rel.id + '\\n';
        report += '- **Asset Path:** ' + rel.asset_path + '\\n';
        report += '- **Relationship Type:** ' + rel.relationship_type + '\\n';
        
        if (rel.relationship_context) {
          report += '- **Context:** ' + rel.relationship_context + '\\n';
        }
        
        if (docType) {
          report += '- **Document Type:** ' + docType.name + ' (ID: ' + docType.id + ')\\n';
          if (docType.description) {
            report += '  - **Description:** ' + docType.description + '\\n';
          }
        } else {
          report += '- **Document Type:** Not specified\\n';
        }
        
        report += '\\n**File Status:** ' + (filePreview.exists ? '✅ Found' : '❌ Not Found') + '\\n';
        
        if (filePreview.exists) {
          report += '- **Total Lines:** ' + filePreview.totalLines + '\\n';
          report += '- **Preview:**\\n\\n```\\n' + filePreview.preview + '\\n```\\n';
        } else {
          report += '- **Error:** ' + filePreview.error + '\\n';
        }
        
        report += '\\n';
      }
    }
    
    report += '### Relationships JSON\\n\\n```\\n';
    report += fs.readFileSync(path.join(tempDir, 'relationships.json'), 'utf8');
    report += '\\n```\\n\\n';
    
    // Document types section
    report += '## 5. Document Types with Category "Documentation"\\n\\n';
    report += '**Status:** ' + (results.documentTypes.success ? '✅ SUCCESS' : '❌ FAILED') + '\\n';
    report += '**Count:** ' + results.documentTypes.data.length + ' records found\\n';
    report += '**Error:** ' + (results.documentTypes.error || 'None') + '\\n\\n';
    report += '### Document Types JSON\\n\\n```\\n';
    report += fs.readFileSync(path.join(tempDir, 'document_types.json'), 'utf8');
    report += '\\n```\\n\\n';
    
    // Summary section
    report += '## Summary\\n\\n';
    report += '| Item | Status | Details |\\n';
    report += '|------|--------|---------|\\n';
    report += '| Claude API | ' + (results.claudeApiTest.success ? '✅ Working' : '❌ Failed') + ' | ' + results.claudeApiTest.message + ' |\\n';
    report += '| Markdown Report | ' + (results.markdownReport.success ? '✅ Found' : '❌ Not Found') + ' | docs/markdown-report.md |\\n';
    report += '| Prompt | ' + (results.promptQuery.success ? '✅ Found' : '❌ Not Found') + ' | ' + (results.promptQuery.prompt ? results.promptQuery.prompt.name : 'N/A') + ' |\\n';
    report += '| Relationships | ' + (results.relationships.success ? '✅ Success' : '❌ Failed') + ' | ' + results.relationships.data.length + ' records found |\\n';
    report += '| Document Types | ' + (results.documentTypes.success ? '✅ Success' : '❌ Failed') + ' | ' + results.documentTypes.data.length + ' records found |\\n\\n';
    
    // Next steps section
    report += '## Next Steps\\n\\n';
    report += '1. ' + (results.promptQuery.success ? 'Ensure prompt content is up-to-date' : 'Create the markdown-document-classification-prompt in the prompts table') + '\\n';
    report += '2. ' + (results.relationships.data.length > 0 ? 'Verify that all relationships are correctly defined' : 'Add relationships to supporting assets for the prompt') + '\\n';
    report += '3. ' + (results.documentTypes.data.length > 0 ? 'Ensure document types are properly categorized' : 'Add document types with category "Documentation"') + '\\n';
    report += '4. ' + (results.markdownReport.success ? 'Review the markdown report content' : 'Create the markdown-report.md file') + '\\n';
    
    // Write report to file
    fs.writeFileSync(reportFile, report);
    console.log(\`Report written to \${reportFile}\`);
    
    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
    
    // Write error report - simple version
    const errorReport = '# Validation Error\\n\\n' +
                       'Generated: ' + new Date().toLocaleString() + '\\n\\n' +
                       '## Error\\n\\n```\\n' + 
                       (error.stack || error.message) + 
                       '\\n```\\n\\n' +
                       '## Summary\\n\\n' +
                       'The validation process encountered an unexpected error. Please check the error details above.';
    
    fs.writeFileSync(reportFile, errorReport);
  }
}

// Run the validation
validatePromptRelationships();
"

echo -e "${GREEN}Validation completed. Report saved to $REPORT_FILE${NC}" 