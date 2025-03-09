# Claude API Integration Fix

This document explains how the Claude API integration works in the DHG Improve Experts application. Use this as a reference when troubleshooting or implementing Claude API calls.

## Overview

The application uses a two-part system to make Claude API calls:

1. A dedicated proxy server (claude-proxy.js) to handle the actual API calls and avoid CORS issues
2. A TypeScript module (ai-processing.ts) that provides a clean API for other parts of the application

This architecture ensures reliable API communication while maintaining a consistent interface for developers.

## Key Components

### 1. Claude Proxy Server (claude-proxy.js)

This is a simple Express server that:

- Listens on port 3002
- Handles CORS for browser requests
- Forwards API requests to Anthropic's Claude API
- Forwards the API key securely (without exposing it to the client)
- Handles errors gracefully

```javascript
// Simple Claude API proxy server
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;

// Enable CORS for local development
app.use(cors());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Claude API proxy endpoint
app.post(['/api/claude-api', '/api/claude-proxy'], async (req, res) => {
  try {
    // Get API key from environment
    const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Forward the request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    
    // Return the response to the client
    const responseData = await response.json();
    return res.json(responseData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Claude API proxy listening at http://localhost:${PORT}`);
});
```

### 2. AI Processing Module (ai-processing.ts)

This TypeScript module provides the main interface for making Claude API calls:

- Handles both legacy and modern API formats
- Formats requests correctly for the Claude API
- Processes responses into consistent structures
- Provides proper error handling
- Uses TypeScript interfaces for type safety

#### Key Functions

The main function used for Claude API calls is `processWithAI`:

```typescript
export async function processWithAI<T = any>({
  messages,
  model = MODEL_NAME_NEW,
  temperature = 0,
  maxTokens = 4000,
  responseSchema,
  validateResponse,
  signal
}: ProcessWithAIOptions<T>): Promise<AIProcessingResult<T>> {
  try {
    // Make sure messages is defined and is an array
    if (!Array.isArray(messages)) {
      console.error("Invalid messages parameter:", messages);
      throw new Error("Messages must be an array of message objects");
    }
    
    console.log(`Processing with AI: ${model}`, { 
      messageCount: messages.length,
      messagesPresent: messages.length > 0
    });
    
    // Special handling for old-style API calls
    if (arguments[0].systemPrompt && arguments[0].userMessage) {
      console.log('Converting old-style API call to new-style');
      // For backward compatibility
      messages = [
        { role: 'user', content: arguments[0].userMessage }
      ];
    }
    
    // Use the proxy server to avoid CORS issues
    const PROXY_URL = 'http://localhost:3002/api/claude-api';
    console.log(`Making Claude API request via proxy: ${PROXY_URL}`);
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    
    // Process validation if needed
    let validatedResponse = contentResponse;
    if (validateResponse) {
      validatedResponse = validateResponse(contentResponse);
    }
    
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

## Correct Usage in Application Code

When calling Claude API from any component, use the `processWithAI` function like this:

```typescript
import { processWithAI } from '@/utils/ai-processing';

// Later in your code:
const result = await processWithAI({
  messages: [{ role: 'user', content: 'Your prompt text here' }],
  model: "claude-3-7-sonnet-20250219", // Or another Claude model
  temperature: 0.7, // Adjust as needed
  maxTokens: 4000  // Adjust as needed
});

// Access the raw text response
const generatedText = result.rawResponse;
```

## Testing the Implementation

1. Start the proxy server first:
   ```bash
   node claude-proxy.js
   ```

2. Ensure the environment variable for the API key is set:
   ```
   VITE_ANTHROPIC_API_KEY=your-api-key-here
   ```

3. Test with a simple API call in your application

## Troubleshooting Common Issues

1. **CORS errors**: Make sure the proxy server is running on port 3002

2. **404 Not Found**: Check that the proxy URL in ai-processing.ts matches the actual server address

3. **API Key errors**: Verify the environment variable is set correctly

4. **Invalid messages parameter**: Ensure you're passing an array of message objects with role and content properties

## Architecture Diagram

```
┌──────────────────┐     ┌─────────────────┐     ┌───────────────────┐
│                  │     │                 │     │                   │
│  React Component │────▶│ ai-processing.ts│────▶│  claude-proxy.js  │────▶ Claude API
│                  │     │                 │     │                   │
└──────────────────┘     └─────────────────┘     └───────────────────┘
      Client-side           Client-side              Server-side
```

This separation of concerns provides a clean and maintainable API integration pattern while avoiding common issues like CORS and API key exposure.