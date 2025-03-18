# Document Classification API Workflow

This document details the complete workflow for the AI-powered document classification feature found in the "Classify" section under the "Document Types" tab.

## Overview

The document classification workflow allows users to:
1. Enter a request for a new document type classification
2. Submit this request to Claude API
3. Receive and review AI-generated document type definitions
4. Add approved document types to the database

## Component Architecture

The feature is primarily implemented in:
- `/src/pages/ClassifyDocument.tsx` - Main UI component
- `/src/utils/ai-processing.ts` - Core AI processing logic
- `/src/api/claude-api.ts` - Server API endpoint for Claude
- `/src/api/proxy.ts` - Claude API proxy function

## Detailed Workflow

### 1. User Interface Interaction

When users click "AI Request" button, the `handleAiRequestClick()` function is called:

```tsx
// ClassifyDocument.tsx - Lines 704-712
const handleAiRequestClick = () => {
  setCurrentView('ai-request');
  setAiRequestInput('');
  setAiProcessing(false);
  setAiResponse(null);
  setAiResponseComments('');
  setAiResponseJson('');
  setShowProposedTypeForm(false);
};
```

### 2. Submitting the Request to AI

When "Submit Request to AI" is clicked, the `handleSubmitAiRequest()` function is triggered:

```tsx
// ClassifyDocument.tsx - Lines 713-867 (shortened for clarity)
const handleSubmitAiRequest = async () => {
  if (!aiRequestInput.trim()) {
    toast.error('Please enter a request first');
    return;
  }

  setAiProcessing(true);
  setAiResponse(null);
  
  try {
    // Fetch existing document types to provide context
    const { data: documentTypes, error: fetchError } = await supabase
      .from('document_types')
      .select('*')
      .order('document_type');
    
    if (fetchError) throw new Error(fetchError.message);

    // Format existing document types as examples
    const existingTypesContext = documentTypes
      .map(dt => `${dt.document_type} (${dt.category}): ${dt.description || 'No description'}`)
      .join('\n');

    // Get prompt from database
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', 'document-classification')
      .single();
    
    if (promptError) throw new Error(`Failed to load prompt: ${promptError.message}`);
    
    const promptTemplate = promptData?.content?.prompt || defaultPrompt;

    // Replace variables in prompt template
    const fullPrompt = promptTemplate
      .replace('{{EXISTING_DOCUMENT_TYPES}}', existingTypesContext)
      .replace('{{USER_REQUEST}}', aiRequestInput);

    // Process request with AI
    const result = await processWithAI<ClassificationResponse>({
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.7,
      responseSchema: ClassificationResponseSchema,
      validateResponse: validateClassificationResponse
    });

    // Parse and separate JSON from explanatory comments
    const jsonMatch = result.rawResponse.match(/```json\n([\s\S]*?)\n```/);
    
    if (jsonMatch && jsonMatch[1]) {
      setAiResponseJson(jsonMatch[1]);
      
      // Extract comments (everything before and after the JSON block)
      const parts = result.rawResponse.split(/```json\n[\s\S]*?\n```/);
      setAiResponseComments(parts.join('\n'));
      
      // Parse the JSON response
      try {
        const parsedJson = JSON.parse(jsonMatch[1]);
        setAiResponse(parsedJson);
        setShowProposedTypeForm(true);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        toast.error('Error parsing AI response');
      }
    } else {
      setAiResponseComments(result.rawResponse);
      toast.warning('The AI response did not contain properly formatted JSON');
    }
  } catch (error) {
    console.error('Error processing AI request:', error);
    toast.error(`Error: ${error.message}`);
    setAiResponseComments(`Error: ${error.message}`);
  } finally {
    setAiProcessing(false);
  }
};
```

### 3. Core AI Processing Function

The `processWithAI` function in `ai-processing.ts` handles the actual API call:

```typescript
// ai-processing.ts - Lines 272-297 (key parts)
export async function processWithAI<T = any>({
  messages,
  model = MODEL_NAME_NEW,
  temperature = 0,
  maxTokens = 4000,
  responseSchema,
  validateResponse
}: ProcessWithAIOptions<T>): Promise<AIProcessingResult<T>> {
  try {
    console.log(`Processing with AI: ${model}`, { messageCount: messages.length });
    
    // Make the API request to Claude
    const response = await fetch('/api/claude-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    const contentResponse = data.content?.[0]?.text || '';
    
    // Validate and process the response
    // [Validation code omitted for brevity]
    
    return {
      rawResponse: contentResponse,
      parsedResponse: validatedResponse as T
    };
  } catch (error) {
    console.error("Error in processWithAI:", error);
    throw error;
  }
}
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
1. Parses the JSON data from the response
2. Updates the UI to display the AI's analysis
3. Shows a form to edit and confirm the proposed document type
4. On confirmation, adds the document type to the database

## Implementation Guide for New Features

To implement a similar AI-powered feature:

1. **Create Prompt in Database**:
   - Add a new entry to the `prompts` table with a specific name
   - Define your prompt template with placeholders like `{{VARIABLE}}`

2. **Build UI Component**:
   - Create input form for user request
   - Add UI for displaying and editing AI response
   - Implement loading states for processing

3. **Fetch Prompt and Context**:
   ```typescript
   // Get prompt from database
   const { data: promptData } = await supabase
     .from('prompts')
     .select('*')
     .eq('name', 'your-prompt-name')
     .single();
   
   const promptTemplate = promptData?.content?.prompt || fallbackPrompt;
   
   // Fetch relevant context
   const { data: contextData } = await supabase
     .from('your_table')
     .select('*');
   
   // Format context and insert into prompt
   const formattedContext = formatYourContextData(contextData);
   const fullPrompt = promptTemplate
     .replace('{{YOUR_CONTEXT}}', formattedContext)
     .replace('{{USER_INPUT}}', userInput);
   ```

4. **Process with AI**:
   ```typescript
   // Define response schema if needed
   const result = await processWithAI({
     messages: [{ role: 'user', content: fullPrompt }],
     temperature: 0.7, // Adjust as needed
     responseSchema: YourResponseSchema, // Optional
     validateResponse: validateYourResponse // Optional
   });
   ```

5. **Parse and Handle Response**:
   ```typescript
   // For JSON responses
   const jsonMatch = result.rawResponse.match(/```json\n([\s\S]*?)\n```/);
   if (jsonMatch && jsonMatch[1]) {
     try {
       const parsedJson = JSON.parse(jsonMatch[1]);
       // Handle parsed JSON
     } catch (parseError) {
       // Handle parsing error
     }
   }
   ```

6. **Save Results to Database**:
   ```typescript
   const { data, error } = await supabase
     .from('your_target_table')
     .insert([{
       // Your data fields
       ...parsedData,
       created_at: new Date().toISOString()
     }]);
   ```

## Summary of Key Components

1. **Prompt Management**: Prompts are stored in the database and fetched when needed
2. **Context Loading**: Existing data is fetched to provide context for the AI
3. **API Call Chain**: UI → processWithAI → /api/claude-api → proxyClaudeAPI → Claude API
4. **Response Parsing**: Extract JSON and explanatory text from the response
5. **Result Handling**: Display results and provide user controls for review/editing
6. **Database Integration**: Save approved results to the appropriate table

This architecture provides a flexible foundation for adding AI-powered features throughout the application.