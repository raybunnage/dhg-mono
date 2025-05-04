# Script Classification Using Prompt Lookup

This document provides a comprehensive guide to the script classification functionality implemented in `scripts/cli-pipeline/classify-script-with-prompt.ts`. This script serves as an important reference for implementing similar AI-driven classification functionality across various scripts.

## Overview

The `classify-script-with-prompt.ts` script is designed to intelligently classify untyped scripts in the repository by leveraging the Claude API and the prompt lookup functionality from the Supabase database. The classification results are then saved back to the database for use in the application.

## Core Functionality

The script performs the following key steps:

1. Fetches an untyped script from the database
2. Retrieves the script's content from the file system
3. Fetches the script analysis prompt from the Supabase prompts table
4. Gets related document types (script types) using SQL queries stored in the prompt's metadata
5. Creates a comprehensive prompt with script content and available types
6. Calls the Claude API with zero temperature to ensure consistent results
7. Parses the JSON response and saves the classification back to the database

## Environment Requirements

The script requires several environment variables to function properly:

- `SUPABASE_URL`: URL for the Supabase instance
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Supabase authentication
- Claude API key (can be provided via any of these variables):
  - `CLAUDE_API_KEY`
  - `CLI_CLAUDE_API_KEY` 
  - `ANTHROPIC_API_KEY`
  - `VITE_ANTHROPIC_API_KEY`

## Key Components

### 1. Environment Configuration and API Key Management

The script implements flexible API key handling to ensure compatibility with various environment setups:

```typescript
// Ensure both ANTHROPIC_API_KEY and CLAUDE_API_KEY are set correctly
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  console.log('Setting ANTHROPIC_API_KEY from CLAUDE_API_KEY for config compatibility');
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
} else if (process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
  console.log('Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY for API compatibility');
  process.env.CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
}

function getClaudeApiKey(): string {
  const possibleEnvVars: string[] = [
    'CLAUDE_API_KEY',
    'CLI_CLAUDE_API_KEY',
    'ANTHROPIC_API_KEY',
    'VITE_ANTHROPIC_API_KEY'
  ];
  
  for (const envVar of possibleEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ Using ${envVar} for Claude API key`);
      return process.env[envVar] || '';
    }
  }
  
  return '';
}
```

### 2. Database Interaction: Prompt Lookup

The core of the functionality is retrieving the proper prompt from the database. The script looks for a specific prompt named `"script-analysis-prompt"` in the prompts table:

```typescript
async function getScriptAnalysisPrompt(): Promise<Prompt | null> {
  try {
    console.log('🔍 Fetching "script-analysis-prompt" from database prompts table...');
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', 'script-analysis-prompt')
      .single();
    
    // Important: The metadata contains SQL queries to fetch document types
    if (data.metadata) {
      console.log('📊 PROMPT METADATA (contains the SQL queries):');
      console.log(JSON.stringify(data.metadata, null, 2));
    }
    
    return data as Prompt;
  } catch (error) {
    console.error('❌ Error in getScriptAnalysisPrompt:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
```

### 3. SQL Query Execution from Prompt Metadata

A critical feature is that the SQL queries to fetch document types are stored in the prompt's metadata, not hardcoded in the script. This allows for flexible adjustment of classification categories without changing code:

```typescript
async function getScriptTypes(prompt: Prompt): Promise<ScriptType[]> {
  try {
    // If the prompt has a database query in metadata, use it
    if (prompt.metadata.database_query) {
      console.log('📊 Using database_query from prompt metadata...');
      const data = await executeCustomQuery(prompt.metadata.database_query);
      
      if (data && data.length > 0) {
        return data as ScriptType[];
      }
    }
    
    // Try alternative queries if available
    if (prompt.metadata.databaseQuery) {
      console.log('📊 Using databaseQuery from prompt metadata...');
      const data = await executeCustomQuery(prompt.metadata.databaseQuery);
      // ...
    }
    
    if (prompt.metadata.databaseQuery2) {
      console.log('📊 Using databaseQuery2 from prompt metadata...');
      const data = await executeCustomQuery(prompt.metadata.databaseQuery2);
      // ...
    }
    
    // Standard query fallback if none of the metadata queries worked
    // ...
  } catch (error) {
    // ...
  }
}
```

### 4. Dynamic SQL Query Execution

The script uses an RPC function to execute SQL queries dynamically, removing trailing semicolons which can cause issues:

```typescript
async function executeCustomQuery(queryText: string): Promise<any[]> {
  try {
    // Remove trailing semicolons which cause syntax errors in RPC calls
    queryText = queryText.trim().replace(/;+$/, '');
    
    // Execute custom query using RPC
    const { data, error } = await supabase.rpc('execute_sql', { sql: queryText });
    
    // Handle results...
  } catch (error) {
    // ...
  }
}
```

### 5. Claude API Integration with Error Handling

The Claude API integration is designed with robust error handling, multiple JSON extraction attempts, and zero temperature to ensure deterministic results:

```typescript
async function callClaudeAPI(finalPrompt: string): Promise<Classification | null> {
  try {
    const claudeRequest: ClaudeRequest = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      temperature: 0, // ZERO temperature to avoid hallucinations
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: finalPrompt
            }
          ]
        }
      ]
    };
    
    // API call and response handling...
    
    // Multiple JSON extraction strategies:
    // 1. Try to extract JSON with regex pattern matching
    // 2. Fallback to finding JSON start/end brackets
    // 3. Additional error handling for malformed responses
  } catch (error) {
    // ...
  }
}
```

### 6. Script Metadata Collection

The script collects important metadata about the script file, such as whether it has a shebang, its size, and if it's executable:

```typescript
function getScriptContent(scriptPath: string): string | null {
  try {
    // Read the file...
    
    // Get file stats to determine if it has a shebang, is executable, etc.
    const stats = fs.statSync(scriptPath);
    const isExecutable = !!(stats.mode & 0o111); // Check if any execute bit is set
    
    global.scriptMetadata = {
      file_size: scriptContent.length,
      has_shebang: scriptContent.startsWith('#!'),
      shebang: scriptContent.startsWith('#!') ? scriptContent.split('\n')[0] : null,
      is_executable: isExecutable
    };
    
    return scriptContent;
  } catch (error) {
    // ...
  }
}
```

### 7. Classification Data Storage

The final classification results are saved back to the database with proper data transformation:

```typescript
async function saveClassificationToDatabase(
  scriptId: string,
  classification: Classification
): Promise<boolean> {
  try {
    // Convert 'size' to 'file_size' for UI compatibility
    let metadata = classification.metadata || {};
    if (metadata.size && !metadata.file_size) {
      metadata.file_size = metadata.size;
      delete metadata.size;
    }
    
    const updateData = {
      script_type_id: classification.script_type_id || null,
      summary: classification.summary || null,
      ai_generated_tags: classification.tags || [],
      ai_assessment: classification.assessment || null,
      metadata: {
        ...metadata,
        document_type_classification: classification.document_type_classification || null
      },
      updated_at: new Date().toISOString()
    };
    
    // Update the database...
  } catch (error) {
    // ...
  }
}
```

## Prompt Structure and Classification Format

The prompt sent to Claude is constructed dynamically with:

1. The base prompt template retrieved from the database
2. A table of available script types with ID, name, and description
3. The actual script content to analyze

Expected JSON output format from Claude:

```json
{
  "script_type_id": "uuid-of-selected-type",
  "summary": {
    "brief": "Brief summary of script purpose",
    "detailed": {
      "purpose": "Script purpose and business value",
      "recommendation": "What action should be taken and why",
      "integration": "How it integrates with other systems",
      "importance": "Critical/high/medium/low importance with justification"
    }
  },
  "tags": ["tag1", "tag2", "tag3"],
  "assessment": {
    "script_quality": {
      "code_quality": 7,
      "maintainability": 8,
      "utility": 9,
      "documentation": 6
    },
    "current_relevance": {
      "score": 8,
      "reasoning": "Explanation of relevance score"
    },
    "status_recommendation": "ACTIVE|UPDATE_NEEDED|OBSOLETE|DUPLICATE|UNUSED"
  },
  "document_type_classification": {
    "selected_document_type_id": "uuid-of-selected-type",
    "document_type_name": "Name of selected type",
    "classification_confidence": 8,
    "classification_reasoning": "Explanation of why this type was selected"
  }
}
```

## Integration with Bash Wrapper

The TypeScript script is wrapped by a Bash script (`classify-script-with-prompt.sh`) that:

1. Sets up the environment by sourcing `.env` and `.env.local` files
2. Checks for required dependencies (ts-node)
3. Passes environment variables to the TypeScript script
4. Provides a clean execution interface for other scripts (like script-manager.sh)

## Script Manager Integration

The script is integrated into the larger `script-manager.sh` which provides higher-level functions including:

1. `classify_untyped_scripts` - Processes multiple untyped scripts in sequence
2. Environment variable preparation and validation
3. Error handling and reporting
4. Integration with the complete script pipeline

## Implementing Similar Functionality

To implement similar AI-driven classification for other script types or content:

1. Create a new prompt in the Supabase prompts table with:
   - Detailed instruction text
   - Example JSON output format
   - SQL queries in the metadata to fetch relevant document types
   
2. Create a wrapper script similar to `classify-script-with-prompt.ts` that:
   - Fetches items to classify from the database
   - Retrieves content from files if needed
   - Fetches the appropriate prompt by name
   - Gets document types via metadata SQL queries
   - Builds a comprehensive prompt
   - Calls Claude with zero temperature
   - Parses the JSON response and saves it to the database

3. Create a Bash wrapper to handle environment setup and invocation

4. Integrate with higher-level management scripts as needed

## Common Issues and Troubleshooting

- **Missing Environment Variables**: Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a Claude API key are set
- **JSON Parsing Errors**: Check the prompt instructions to ensure Claude's output matches expected format
- **Database Connection Issues**: Verify Supabase credentials and connectivity
- **Empty Document Types**: Ensure the SQL queries in the prompt metadata correctly fetch document types
- **Execution Permission Issues**: Check the script has execute permissions (`chmod +x`)

## Sample Database Schema

For implementing similar functionality, ensure these tables exist:

- `prompts`: Stores the AI prompts with instruction text and metadata
- `prompt_relationships`: Links prompts to assets and document types
- `document_types`: Stores the classification categories
- `scripts`: The target table where classifications are stored

## Conclusion

The `classify-script-with-prompt.ts` script demonstrates an effective pattern for integrating AI-based classification into your application workflow. By leveraging dynamic prompts and SQL queries stored in the database, the system remains flexible and maintainable while providing powerful classification capabilities.

When implementing similar functionality, focus on these key aspects:
1. Proper environment configuration
2. Dynamic prompt lookup from database
3. SQL query storage in prompt metadata
4. Structured prompt creation with content and options
5. Low-temperature Claude API calls for consistent results
6. Robust error handling and JSON parsing
7. Well-defined database update patterns

This approach allows for powerful AI-driven classification while maintaining flexibility and separation of concerns.