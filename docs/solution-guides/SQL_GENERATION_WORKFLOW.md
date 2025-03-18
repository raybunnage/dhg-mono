# SQL Generation Workflow

This document details the complete workflow for the AI-powered SQL generation feature found in the "SQL Editor" tab of the "Supabase Admin" page.

## Overview

The SQL generation workflow allows users to:
1. Click "Ask AI" to open a dialog
2. Enter a natural language request for SQL query generation
3. Submit this request to Claude API
4. Receive and review AI-generated SQL queries
5. Execute or modify the generated SQL

## Component Architecture

The feature is primarily implemented in:
- `/src/pages/SupabaseAdmin.tsx` - Main UI component
- `/src/services/claudeApiService.ts` - Service for Claude API integration
- `/src/api/claude-api.ts` - Server API endpoint for Claude
- `/src/api/proxy.ts` - Claude API proxy function
- `/server.js` - Express server handling API requests

## Detailed Workflow

### 1. User Interface Interaction

When users click the "Ask AI" button, the dialog is opened via state change:

```tsx
// SupabaseAdmin.tsx - Line 2204
<Button 
  variant="outline" 
  className="bg-blue-50 border-blue-200 hover:bg-blue-100"
  onClick={() => setShowAskAiDialog(true)}
>
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C7.58 3 4 6.58 4 11C4 13.03 4.74 14.89 6 16.28V21L8.5 19.5L10.5 21L12.5 19.5L14.5 21L16.5 19.5L19 21V16.28C20.26 14.89 21 13.03 21 11C21 6.58 17.42 3 12 3ZM13 15H11V13H13V15ZM13 11H11V7H13V11Z" fill="#4285F4"/>
  </svg>
  Ask AI
  {import.meta.env.VITE_ANTHROPIC_API_KEY ? (
    <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" title="Claude API key is set in environment variables"></span>
  ) : (
    <span className="ml-1 w-2 h-2 bg-red-500 rounded-full" title="Claude API key is missing from environment variables"></span>
  )}
</Button>
```

### 2. Submitting the Request to AI

When "Generate SQL" is clicked in the dialog, the following code is executed:

```tsx
// SupabaseAdmin.tsx - Lines 2520-2633 (shortened for clarity)
<Button 
  onClick={async () => {
    if (!aiPrompt.trim()) return;
    
    // Check for API key first
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      toast.error('Claude API key not found in environment variables. Please set VITE_ANTHROPIC_API_KEY in your .env.development file.');
      setShowApiKeyDialog(true);
      return;
    }
    
    setGeneratingSql(true);
    
    try {
      // 1. Get the SQL guide prompt from the database
      const { data: promptData, error: promptError } = await supabase
        .from('prompts')
        .select('content')
        .eq('name', 'supabase-sql-query-guide')
        .single();
      
      if (promptError) {
        throw new Error(`Failed to get SQL prompt: ${promptError.message}`);
      }
      
      const promptTemplate = promptData?.content?.prompt || 
        "You are an expert SQL assistant helping to generate SQL queries for a Supabase PostgreSQL database.";
      
      // 2. Get database schema information
      const { data: schemaData, error: schemaError } = await supabase.rpc(
        'get_schema_info',
        { schema_name: 'public' }
      );
      
      if (schemaError) {
        console.warn("Could not get schema via RPC, using types.ts information instead");
      }
      
      // Generate a schema summary from the database schema or types.ts
      let schemaContext = '';
      
      if (schemaData) {
        // Format the schema data for the prompt
        schemaContext = JSON.stringify(schemaData, null, 2);
      } else {
        // Generate schemaContext from dbObjects 
        schemaContext = dbObjects.map(obj => {
          return `Table: ${obj.name}\nDefinition: ${obj.definition}\n`;
        }).join('\n');
      }
      
      // 3. Set up the prompt for Claude
      const fullPrompt = `${promptTemplate}
        
## Database Schema Information
${schemaContext}

## User Request
${aiPrompt}

Please generate a PostgreSQL SQL query that addresses the request above. 
Return only the SQL query with brief comments explaining key parts.
Make sure the query is valid PostgreSQL SQL and follows best practices.
`;
      
      // 4. Call Claude API using our service
      const { makeClaudeRequest } = await import('@/services/claudeApiService');
      
      // Use the service to make the API call
      const result = await makeClaudeRequest({
        prompt: fullPrompt,
        temperature: 0.2,
        maxTokens: 4000,
        model: 'claude-3-7-sonnet-20250219'
      });
      
      const generatedSql = result.completion;
      
      // Set the SQL content
      setSqlContent(generatedSql);
      
      // Close dialog and reset
      setShowAskAiDialog(false);
      setAiPrompt("");
      
      // Show success message
      toast.success("SQL query generated! You can now run it or make adjustments.");
    } catch (error) {
      console.error("Error generating SQL query:", error);
      toast.error(`Failed to generate SQL: ${error.message}`);
    } finally {
      setGeneratingSql(false);
    }
  }}
  disabled={!aiPrompt.trim() || generatingSql}
  className="bg-blue-600 hover:bg-blue-700 text-white"
>
  {generatingSql ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Generating...
    </>
  ) : (
    <>Generate SQL</>
  )}
</Button>
```

### 3. Claude API Service

The `makeClaudeRequest` function in `claudeApiService.ts` handles the API call:

```typescript
// claudeApiService.ts
export const makeClaudeRequest = async (options: ClaudeRequestOptions): Promise<ClaudeResponse> => {
  const { prompt, temperature = 0, maxTokens = 4000, model = 'claude-3-7-sonnet-20250219' } = options;
  
  console.log(`Making Claude API request to model: ${model} with temperature: ${temperature}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    // Make API request through our proxy API
    const response = await fetch('/api/claude-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText}\n${errorData}`);
    }
    
    const data = await response.json();
    const completion = data.content?.[0]?.text || '';
    
    return { completion };
  } catch (error) {
    console.error('Error in Claude API request:', error);
    throw error;
  }
};
```

### 4. Server API Endpoint

The Claude API endpoint in `claude-api.ts` proxies the request to Claude:

```typescript
// claude-api.ts
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('Missing API key for Claude');
      res.status(500).json({ error: 'API key not configured on server' });
      return;
    }

    // Forward the payload to Claude API
    const { model, max_tokens, temperature, messages, system } = req.body;
    
    const payload = {
      model,
      max_tokens,
      temperature,
      messages,
      system
    };

    console.log('Proxying Claude API request', {
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey?.length,
      model
    });

    const result = await proxyClaudeAPI(payload, apiKey);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in Claude API proxy:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
```

### 5. Claude API Proxy

The `proxyClaudeAPI` function in `proxy.ts` makes the actual request to Claude:

```typescript
// proxy.ts
export async function proxyClaudeAPI(payload: any, apiKey: string) {
  const url = 'https://api.anthropic.com/v1/messages';
  
  console.log('Making Claude API request via proxy', {
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey?.length,
    payloadSize: JSON.stringify(payload).length
  });
  
  // Server-side fetch to avoid CORS
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}
```

### 6. Express Server Configuration

The Express server in `server.js` is responsible for handling API requests:

```javascript
// server.js - Claude API proxy endpoint
app.post(['/api/claude-proxy', '/api/claude-api'], async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }
    
    console.log('Proxying Claude API request via Express server');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Claude API error:', responseData);
      return res.status(response.status).json({
        error: responseData.error || 'Error from Claude API',
        status: response.status,
        statusText: response.statusText
      });
    }
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error in Claude proxy:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
```

### 7. Response Handling and UI Updates

After receiving the response from Claude, the application:
1. Takes the SQL query from the response text
2. Updates the SQL editor with the generated query
3. Closes the dialog
4. Shows a success message
5. The user can then execute or modify the SQL query

## Key Differences from Document Classification

While the SQL Generation feature follows a similar pattern to the Document Classification feature, there are some key differences:

1. **Direct Service Call**: SQL Generation calls `makeClaudeRequest` directly instead of using the intermediary `processWithAI` function.

2. **Schema Loading**: It fetches database schema information from an RPC function called `get_schema_info` to provide context.

3. **Simpler Response Handling**: The response is treated as plain text rather than extracting JSON.

4. **No Validation Schema**: It doesn't use a validation schema for the response structure.

## Implementation Guide for New AI Features

To implement a similar AI-powered feature:

1. **Create Prompt in Database**:
   - Add a new entry to the `prompts` table with a specific name
   - Define your prompt template with placeholders like `{{VARIABLE}}`

2. **Fetch Context Data**:
   ```typescript
   // Get prompt from database
   const { data: promptData } = await supabase
     .from('prompts')
     .select('content')
     .eq('name', 'your-prompt-name')
     .single();
   
   const promptTemplate = promptData?.content?.prompt || fallbackPrompt;
   
   // Fetch relevant context
   const { data: contextData } = await supabase
     .from('your_context_table')
     .select('*');
   
   // Format context for the prompt
   const formattedContext = contextData.map(item => 
     `${item.name}: ${item.description}`
   ).join('\n');
   ```

3. **Prepare the Full Prompt**:
   ```typescript
   const fullPrompt = `${promptTemplate}
   
   ## Context Information
   ${formattedContext}
   
   ## User Request
   ${userInput}
   
   Please respond with [specific instructions]...`;
   ```

4. **Make the API Call**:
   ```typescript
   const { makeClaudeRequest } = await import('@/services/claudeApiService');
   
   const result = await makeClaudeRequest({
     prompt: fullPrompt,
     temperature: 0.2, // Adjust as needed
     maxTokens: 4000,
     model: 'claude-3-7-sonnet-20250219'
   });
   
   const generatedContent = result.completion;
   ```

5. **Handle and Display the Response**:
   ```typescript
   // Set the result in state
   setGeneratedContent(generatedContent);
   
   // Close dialog and show success message
   setShowDialog(false);
   toast.success("Content generated successfully!");
   ```

## Running the Application

To ensure proper API connectivity:

1. Set the `VITE_ANTHROPIC_API_KEY` environment variable in `.env.development`
2. Start the Express server using `dev-start.sh` script
3. The Express server handles API requests to `/api/claude-api`
4. Requests are proxied to the Claude API with proper authentication

## Troubleshooting

If API calls are failing:

1. Check that the API key is correctly set in environment variables
2. Verify the Express server is running alongside the Vite dev server
3. Check browser console for any errors in the request/response cycle
4. Ensure the Claude API endpoint URL and version headers are correct

## Summary of Key Components

1. **Prompt Management**: Prompts are stored in the database and fetched when needed
2. **Context Loading**: Database schema information is fetched to provide context
3. **API Call Chain**: UI → makeClaudeRequest → /api/claude-api → proxyClaudeAPI → Claude API
4. **Response Handling**: Update SQL editor with generated query
5. **Server Configuration**: Express server handles API requests to avoid CORS issues

This architecture provides a robust foundation for integrating AI-powered SQL generation into the application.