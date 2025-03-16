#!/bin/bash

# Script to validate AI assets and test Claude API connectivity
# This script:
# 1. Tests Claude 3.7 API connectivity
# 2. Validates required markdown files exist and are readable
# 3. Checks document_types in the database
# 4. Verifies the existence of specific prompts in the database
# 5. Generates a comprehensive report of all findings

echo "Starting AI assets validation..."

# Define important locations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_FILE="$REPO_ROOT/docs/ai-assets-validation-report.md"

# Load environment variables using the shared helper script
source "$SCRIPT_DIR/load-env.sh" --verbose

# Explicitly export the variables we'll use for the Node.js script
export SUPABASE_URL="$CLI_SUPABASE_URL"
export SUPABASE_KEY="$CLI_SUPABASE_KEY"
export ANTHROPIC_API_KEY="$CLI_CLAUDE_API_KEY"

# Check if required Supabase variables are available
if [[ -z "$CLI_SUPABASE_URL" || -z "$CLI_SUPABASE_KEY" ]]; then
  echo "ERROR: Required Supabase environment variables not found"
  echo "Make sure CLI_SUPABASE_URL and CLI_SUPABASE_KEY are set in .env.local"
  exit 1
fi

# Determine if Claude API test should be enabled
if [[ -n "$CLI_CLAUDE_API_KEY" ]]; then
  echo "Using Claude API key: ${CLI_CLAUDE_API_KEY:0:5}..."
  CLAUDE_API_TEST="enabled"
else
  echo "WARNING: No Claude API key found in environment variables"
  echo "Claude API test will be skipped"
  CLAUDE_API_TEST="skipped"
fi

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Create a Node.js script to validate AI assets and test the API
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Initialize Supabase client - using the exported variables from the shell script
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const repoRoot = '$REPO_ROOT';
const reportFile = '$REPORT_FILE';
const claudeApiTest = '$CLAUDE_API_TEST';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

// Debug API key
console.log('Checking API key availability:');
if (anthropicApiKey) {
  console.log(\`API key is available. First 5 chars: \${anthropicApiKey.substring(0, 5)}...\`);
} else {
  console.log('API key is NOT available. Check .env.development file.');
}

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
      
      // Simple request for Claude 3.7 - using the exact same format as the working code
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
      console.log(\`- Content-Length: \${options.headers['Content-Length']}\`);
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log(\`Response status code: \${res.statusCode}\`);
            console.log(\`Response headers: \${JSON.stringify(res.headers)}\`);
            
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

// Function to validate a markdown file
function validateMarkdownFile(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = fs.statSync(fullPath);
      
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        contentPreview: content.substring(0, 150).replace(/\\n/g, ' ') + '...',
        error: null
      };
    } else {
      return {
        exists: false,
        error: 'File not found'
      };
    }
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

// Main function to validate all AI assets
async function validateAiAssets() {
  const results = {
    timestamp: new Date().toISOString(),
    claudeApiTest: null,
    requiredFiles: {},
    documentTypes: {
      count: 0,
      records: [],
      error: null
    },
    prompts: {
      found: false,
      data: null,
      error: null
    }
  };
  
  try {
    console.log('Starting AI assets validation...');
    
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
    
    // 2. Validate required markdown files
    console.log('\\n2. Validating required markdown files...');
    const requiredFiles = [
      'docs/markdown-report.md',
      'prompts/development-process-specification.md'
    ];
    
    for (const filePath of requiredFiles) {
      console.log(\`Checking file: \${filePath}\`);
      const validation = validateMarkdownFile(filePath);
      results.requiredFiles[filePath] = validation;
      
      if (validation.exists) {
        console.log(\`✅ \${filePath} - Found and readable\`);
        console.log(\`   Size: \${validation.size} bytes | Created: \${new Date(validation.created).toLocaleString()} | Modified: \${new Date(validation.modified).toLocaleString()}\`);
        console.log(\`   Preview: \${validation.contentPreview}\`);
      } else {
        console.log(\`❌ \${filePath} - Error: \${validation.error}\`);
      }
    }
    
    // 3. Count and list document_types
    console.log('\\n3. Counting and listing document_types...');
    try {
      const { count, error: countError } = await supabase
        .from('document_types')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.log(\`❌ Error counting document_types: \${countError.message}\`);
        results.documentTypes.error = countError.message;
      } else {
        results.documentTypes.count = count;
        console.log(\`✅ Found \${count} document_types records\`);
        
        // Get all document types
        const { data: documentTypes, error: fetchError } = await supabase
          .from('document_types')
          .select('id, name, description')
          .order('name');
        
        if (fetchError) {
          console.log(\`❌ Error fetching document_types: \${fetchError.message}\`);
          results.documentTypes.error = fetchError.message;
        } else {
          results.documentTypes.records = documentTypes;
          console.log('Document types found:');
          documentTypes.forEach(type => {
            console.log(\`  - \${type.name} (ID: \${type.id}): \${type.description || 'No description'}\`);
          });
        }
      }
    } catch (error) {
      console.log(\`❌ Error accessing document_types: \${error.message}\`);
      results.documentTypes.error = error.message;
    }
    
    // 4. Find specific prompt in prompts table
    console.log('\\n4. Looking for \"markdown-document-classification-prompt\" in prompts table...');
    try {
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('*')
        .ilike('name', '%markdown-document-classification-prompt%')
        .limit(1);
      
      if (promptError) {
        console.log(\`❌ Error querying prompts table: \${promptError.message}\`);
        results.prompts.error = promptError.message;
      } else if (promptData && promptData.length > 0) {
        const prompt = promptData[0];
        results.prompts.found = true;
        results.prompts.data = prompt;
        console.log(\`✅ Found prompt: \${prompt.name} (ID: \${prompt.id})\`);
        console.log(\`   Created: \${new Date(prompt.created_at).toLocaleString()}\`);
        console.log(\`   Content preview: \${prompt.content.substring(0, 100)}...\`);
      } else {
        console.log('❌ Prompt \"markdown-document-classification-prompt\" not found');
        results.prompts.found = false;
      }
    } catch (error) {
      console.log(\`❌ Error accessing prompts table: \${error.message}\`);
      results.prompts.error = error.message;
    }
    
    // Generate report
    console.log('\\nGenerating AI assets validation report...');
    
    // Format document types for report
    const documentTypesReport = results.documentTypes.records.map(type => 
      \`- **\${type.name}** (ID: \${type.id}): \${type.description || 'No description'}\`
    ).join('\\n');
    
    // Create report content with proper line breaks for markdown
    const reportContent = \`# AI Assets Validation Report

Generated: \${new Date().toLocaleString()}

## 1. Claude API Test

**Status:** \${results.claudeApiTest.success ? '✅ SUCCESS' : '❌ FAILED'}  
**Message:** \${results.claudeApiTest.message}

\${results.claudeApiTest.success ? '### Claude API Response:\\n\\n' + results.claudeApiTest.result : results.claudeApiTest.result ? '### Error Response:\\n\\n```\\n' + results.claudeApiTest.result + '\\n```' : ''}

## 2. Required Markdown Files

\${Object.entries(results.requiredFiles).map(([filePath, validation]) => {
  if (validation.exists) {
    return \`### ✅ \${filePath}  
- **Size:** \${validation.size} bytes  
- **Created:** \${new Date(validation.created).toLocaleString()}  
- **Modified:** \${new Date(validation.modified).toLocaleString()}  
- **Preview:** \${validation.contentPreview}\`;
  } else {
    return \`### ❌ \${filePath}  
- **Error:** \${validation.error}\`;
  }
}).join('\\n\\n')}

## 3. Document Types

**Count:** \${results.documentTypes.count} document types found  
\${results.documentTypes.error ? \`**Error:** \${results.documentTypes.error}\` : ''}

\${documentTypesReport || 'No document types found'}

## 4. Prompt Verification

**Prompt Name:** markdown-document-classification-prompt  
**Status:** \${results.prompts.found ? '✅ Found' : '❌ Not Found'}  
\${results.prompts.error ? \`**Error:** \${results.prompts.error}\` : ''}

\${results.prompts.data ? \`### Prompt Details
- **ID:** \${results.prompts.data.id}  
- **Created:** \${new Date(results.prompts.data.created_at).toLocaleString()}  
- **Updated:** \${new Date(results.prompts.data.updated_at).toLocaleString()}  

### Content Preview
\\\`\\\`\\\`
\${results.prompts.data.content.substring(0, 500)}...
\\\`\\\`\\\`\` : ''}

## Summary

| Asset | Status | Notes |
|-------|--------|-------|
| Claude API | \${results.claudeApiTest.success ? '✅ Working' : '❌ Failed'} | \${results.claudeApiTest.message} |
| docs/markdown-report.md | \${results.requiredFiles['docs/markdown-report.md']?.exists ? '✅ Found' : '❌ Missing'} | \${results.requiredFiles['docs/markdown-report.md']?.exists ? \`\${results.requiredFiles['docs/markdown-report.md'].size} bytes\` : results.requiredFiles['docs/markdown-report.md']?.error} |
| prompts/development-process-specification.md | \${results.requiredFiles['prompts/development-process-specification.md']?.exists ? '✅ Found' : '❌ Missing'} | \${results.requiredFiles['prompts/development-process-specification.md']?.exists ? \`\${results.requiredFiles['prompts/development-process-specification.md'].size} bytes\` : results.requiredFiles['prompts/development-process-specification.md']?.error} |
| Document Types | \${results.documentTypes.count > 0 ? '✅ Found' : '❌ Missing'} | \${results.documentTypes.count} types available |
| Classification Prompt | \${results.prompts.found ? '✅ Found' : '❌ Missing'} | \${results.prompts.found ? \`ID: \${results.prompts.data.id}\` : 'Not found in database'} |

## Next Steps

1. Ensure all missing assets are created or fixed
2. If Claude API is not working, check your API key and subscription
3. Proceed with implementing the sophisticated prompt once all assets are validated
\`;

    // Write report to file
    fs.writeFileSync(reportFile, reportContent);
    console.log(\`Report written to \${reportFile}\`);
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

// Run the validation
validateAiAssets();
"

echo "AI assets validation completed. Report saved to $REPORT_FILE" 