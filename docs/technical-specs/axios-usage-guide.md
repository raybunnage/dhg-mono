# Axios Usage Guide in DHG Monorepo

## Overview

This document provides an overview of how Axios is used within the DHG monorepo project, particularly for Claude AI API integration. Axios is an HTTP client library that enables making HTTP requests from JavaScript/TypeScript applications.

## What is Axios?

Axios is a popular, promise-based HTTP client for browser and Node.js environments. It provides:

- An easy-to-use API for HTTP requests
- Automatic JSON data transformation
- Request and response interceptors
- Client-side protection against XSRF
- Built-in error handling with type detection
- Broad browser support with fallbacks
- TypeScript integration

## Primary Uses in the Project

Axios serves three main purposes in our codebase:

### 1. Making HTTP Requests to External APIs

Axios is primarily used to communicate with the Claude AI API:

```typescript
// Example from claude-service.ts
const response = await axios.post(
  `${this.baseUrl}/v1/messages`,
  requestBody,
  {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.apiVersion
    }
  }
);
```

The project uses standard request methods, primarily POST, to send data to Claude's API endpoints.

### 2. Request Configuration and Headers

Axios allows configuring requests with headers, parameters, and other options:

```typescript
// Headers configuration in Claude service
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': this.apiKey,             // Authentication
  'anthropic-version': this.apiVersion  // API version control
};

// Request body structure
const requestBody = {
  model: "claude-3-7-sonnet-20250219",  // Model selection
  max_tokens: 4000,                     // Token limit
  temperature: 0,                       // Randomness factor
  messages: [
    {
      role: 'user',
      content: prompt                   // User's prompt text
    }
  ],
  // Optional system message
  system: "You are a helpful AI assistant..."  // When provided
};
```

The Claude service implementation uses this configuration to ensure proper authentication and parameters for API calls.

### 3. Error Handling and Response Processing

Axios provides specialized error handling and automatic response parsing:

```typescript
try {
  const response = await axios.post(/* ... */);
  
  // Response processing
  return response.data.content[0].text;
} catch (error) {
  // Type-specific error handling
  if (axios.isAxiosError(error)) {
    Logger.error(`Error calling Claude API: ${error.response?.data || error.message}`);
    throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
  } else {
    Logger.error(`Unknown error calling Claude API: ${error}`);
    throw error;
  }
}
```

The `isAxiosError` type guard allows differentiating between network/HTTP errors and other runtime errors.

## JSON Response Handling

The project includes specialized handling for JSON responses from Claude:

```typescript
public async getJsonResponse<T = any>(
  prompt: string,
  options: {
    jsonMode?: boolean,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    system?: string,
  } = {}
): Promise<T> {
  // Set JSON-specific options
  options.temperature = 0;
  options.jsonMode = options.jsonMode ?? true;
  
  // Add special system message for JSON
  if (!options.system) {
    options.system = "You are a helpful AI assistant that ONLY provides responses in valid JSON format...";
  }
  
  // Get and parse the response
  const responseText = await this.sendPrompt(enhancedPrompt, options);
  
  // Parsing logic including fallbacks for various JSON formats
  try {
    return JSON.parse(responseText) as T;
  } catch (initialParseError) {
    // Fallback parsing code for markdown-formatted JSON
    // ...
  }
}
```

This method handles multiple JSON response formats, including JSON embedded in markdown code blocks.

## Project Dependencies

Axios is specified as a dependency in multiple package.json files:

- Root package.json: `"axios": "^1.8.4"`
- packages/shared/package.json: `"axios": "^1.6.7"`
- packages/dal/package.json: `"axios": "^1.6.7"`
- packages/cli/package.json: `"axios": "^1.6.7"`

## Best Practices for Using Axios

When using Axios in the project, follow these guidelines:

1. **Error Handling**: Always use try/catch with the `isAxiosError` type guard
   ```typescript
   try {
     const response = await axios.get('/endpoint');
   } catch (error) {
     if (axios.isAxiosError(error)) {
       // Handle HTTP errors
     } else {
       // Handle other errors
     }
   }
   ```

2. **Timeout Configuration**: Set appropriate timeouts for external API calls
   ```typescript
   axios.get('/endpoint', { timeout: 5000 }); // 5 seconds
   ```

3. **Response Validation**: Always validate response structure before accessing properties
   ```typescript
   if (response.data && response.data.content) {
     // Process content
   }
   ```

4. **Request Cancelation**: For long-running requests, implement cancelation tokens
   ```typescript
   const source = axios.CancelToken.source();
   axios.get('/endpoint', { cancelToken: source.token });
   
   // To cancel:
   source.cancel('Operation canceled by user');
   ```

5. **Service Encapsulation**: Encapsulate Axios calls in service classes (as done with ClaudeService)

## When to Use Axios vs. Alternatives

- **Use Axios** when interacting with external APIs, especially when needing advanced features like timeout handling, error type checking, and interceptors
- **Consider fetch API** for simple internal requests where the advanced features aren't needed
- **Use the singleton service pattern** as implemented in `ClaudeService` to ensure consistent configuration and reusability

## References

- [Axios Documentation](https://axios-http.com/docs/intro)
- [Anthropic Claude API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)