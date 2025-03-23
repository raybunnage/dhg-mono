# Claude Service Documentation

## 1. Service Overview
The Claude Service is a TypeScript module that facilitates interactions with Anthropic's Claude AI API within a CLI application. It provides structured methods to make API requests to Claude, with built-in error handling, rate limiting, request formatting, and specialized document classification functionality.

## 2. Dependencies
- `axios`: For making HTTP requests to the Claude API
- `Logger`: From `../utils/logger` for standardized logging
- `AppError`, `ErrorHandler`: From `../utils/error-handler` for error management

## 3. Invocation Pattern
The service is instantiated with an API key and then its methods are called directly:

```typescript
import { ClaudeService } from '../services/claude-service';

// Initialize with API key
const claudeService = new ClaudeService(apiKey);

// Call methods
const response = await claudeService.classifyDocument(document, prompt, context);
```

## 4. Input/Output

### Inputs:
- **API Key**: Required for authentication with Claude API
- **Environment Variables**: Uses `CLAUDE_API_KEY` and `NODE_ENV` for configuration
- **Request Parameters**: Model name, messages, temperature, etc.

### Outputs:
- **ClaudeResponse**: Standardized response object with:
  - `success`: Boolean indicating operation success
  - `result`: API response data (if successful)
  - `error`: Error message (if failed)

## 5. Key Functions

### 1. Constructor
Initializes the service with API key validation and logging of configuration.

### 2. `callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse>`
Makes an API call to Claude with extensive error handling and rate limiting.

### 3. `classifyDocument(document: string, prompt: string, context: string): Promise<ClaudeResponse>`
Specialized method to classify documents using Claude, formatting the prompt with the necessary context.

### 4. `SimpleRateLimiter` (Internal Class)
Provides token bucket-based rate limiting to prevent API overuse.

## 6. Error Handling
The service implements comprehensive error handling:

- Validates API key before making requests
- URL validation to prevent malformed requests
- Detailed classification of errors (network, timeout, auth, URL)
- User-friendly error messages with context
- Detailed console logs for debugging
- Standardized error response format

## 7. Code Quality Assessment

### Strengths:
- Excellent error handling with detailed differentiation of error types
- Robust logging throughout for debugging
- Clear separation of concerns between API interaction and business logic
- Effective rate limiting implementation
- Strong input validation

### Areas for Improvement:
- Excessive direct console logging could be better channeled through Logger
- Missing unit tests (not visible in the code)
- Debug output is too verbose for production use
- Some hardcoded values should be configurable

## 8. Improvement Opportunities

1. **Logging Refinement**: Replace direct `console.log` calls with structured Logger usage
2. **Configuration Options**: Move hardcoded values (model, rate limits) to configuration
3. **Response Parsing**: Add response validation and parsing for more type safety
4. **Documentation**: Add JSDoc comments to interface definitions
5. **Middleware Pattern**: Implement request/response middleware for more extensibility

## 9. Usage Examples

### Example 1: Document Classification
```typescript
import { ClaudeService } from '../services/claude-service';
import { readFile } from 'fs/promises';

async function classifyMarkdownDocument(filePath, promptPath, contextPath) {
  // Load files
  const document = await readFile(filePath, 'utf8');
  const prompt = await readFile(promptPath, 'utf8');
  const context = await readFile(contextPath, 'utf8');
  
  // Initialize service
  const apiKey = process.env.CLAUDE_API_KEY;
  const claude = new ClaudeService(apiKey);
  
  // Classify document
  const result = await claude.classifyDocument(document, prompt, context);
  
  if (result.success) {
    return result.result.content;
  } else {
    throw new Error(`Classification failed: ${result.error}`);
  }
}
```

### Example 2: Raw API Call
```typescript
import { ClaudeService, ClaudeRequest } from '../services/claude-service';

async function generateText(prompt) {
  const apiKey = process.env.CLAUDE_API_KEY;
  const claude = new ClaudeService(apiKey);
  
  const request: ClaudeRequest = {
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: prompt }]
    }]
  };
  
  const response = await claude.callClaudeApi(request);
  
  if (!response.success) {
    throw new Error(`API call failed: ${response.error}`);
  }
  
  return response.result;
}
```

## 10. Integration Points
- Used by document classification services for classifying markdown files and scripts
- Integrated with script management services for script analysis
- Called by CLI commands that need AI analysis (analyze-script, batch-analyze, workflow)
- Provides AI capabilities to other parts of the CLI pipeline

## Configuration Options
- **Rate Limiting**: Configured for 3 request burst capacity with 10 requests per minute
- **API Version**: Set to '2023-06-01' (could be outdated)
- **Default Model**: Uses 'claude-3-7-sonnet-20250219' for classification

## Known Limitations
- Not optimized for streaming responses
- Limited to text-only interactions (no multimodal support)
- Rate limiting is simplistic and doesn't handle distributed usage

## Security Considerations
- API key is logged in truncated form for debugging
- No additional authentication mechanisms beyond API key
- Verbose error logging could potentially expose sensitive information