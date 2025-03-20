# CLI Pipeline Guidance for Claude Code

This document provides guidance for Claude Code when working with the CLI pipeline tools in this project. It addresses common issues, provides best practices, and introduces the shared services architecture for consistent code patterns.

## TypeScript Guidance

- Please verify all TypeScript code compiles without errors before submitting changes
- Add proper types to all parameters, return values, and variables to avoid type errors
- Use interfaces for complex data structures
- Implement proper error handling with try/catch blocks
- Favor async/await over promise chains for readability
- Return typed objects from functions to provide consistent status reporting

## Shared Services Architecture

The CLI pipeline uses a shared services architecture with singleton patterns to ensure consistent behavior across commands:

### Configuration Management

Always use the Config or ConfigService for accessing environment variables and configuration:

```typescript
// Import the shared config singleton
import config from '../../packages/cli/src/utils/config';

// OR use the ConfigService singleton in scripts
const configService = ConfigService.getInstance();
const supabaseUrl = configService.getSupabaseUrl();
const supabaseKey = configService.getSupabaseKey();
```

### Database Connection

Use the SupabaseClientService singleton to manage database connections:

```typescript
// Import the client service
import { SupabaseClientService, getSupabaseClient } from '../../packages/cli/src/services/supabase-client';

// Get the shared instance
const supabaseService = SupabaseClientService.getInstance();

// Check if already initialized
if (supabaseService.isInitialized()) {
  // Reuse existing client
  const supabase = supabaseService.getClient(false);
} else {
  // Initialize new client using config
  const supabase = supabaseService.initializeFromEnv();
  
  // OR initialize with explicit params
  const configService = ConfigService.getInstance();
  const supabaseUrl = configService.getSupabaseUrl();
  const supabaseKey = configService.getSupabaseKey();
  const supabase = supabaseService.initialize(supabaseUrl, supabaseKey);
}
```

### Claude API Interactions

Use the shared ClaudeService for all AI interactions:

```typescript
import { ClaudeService } from '../../packages/cli/src/services/claude-service';

// Create service with API key from config
const configService = ConfigService.getInstance();
const claudeApiKey = configService.getClaudeApiKey();
const claudeService = new ClaudeService(claudeApiKey);

// Call the API with proper error handling
const response = await claudeService.callClaudeApi(request);
if (!response.success) {
  // Handle error
}x
```

## Common Issues and Fixes

### API Connection Issues

- Always use the ConfigService to get valid API keys and URLs
- Use the SupabaseClientService for database connections
- Implement proper error handling with typed return values
- Include detailed logging with appropriate log levels
- Handle rate limiting using the rate-limiter utility

### JSON Parsing Errors

- Always use try/catch when parsing JSON
- Implement multiple extraction strategies for Claude API responses
- Log detailed information about parsing failures
- Verify the structure of responses before accessing nested properties
- Return typed objects with success/error status

### File System Operations

- Use the FileService for consistent file operations
- Always check that files exist before reading them
- Use absolute paths rather than relative paths
- Create parent directories with `{ recursive: true }` option
- Implement proper error handling with typed return values

## Key CLI Pipeline Files and Services

### Core Services (src/services/*)

- **supabase-client.ts** - Singleton service for database connections. Uses a shared instance pattern to maintain a single connection. All database interactions should use this service instead of creating new connections.
  ```typescript
  const supabaseService = SupabaseClientService.getInstance();
  const supabase = supabaseService.getClient();
  ```

- **claude-service.ts** - Core service for interacting with Claude AI API. Handles request formatting, rate limiting, error handling, and response processing. Critical for all AI functionality.
  ```typescript
  const claudeService = new ClaudeService(config.anthropicApiKey);
  const response = await claudeService.callClaudeApi(request);
  ```

- **file-service.ts** - Core utility for file system operations. Provides consistent interfaces for reading, writing, and managing files with proper error handling.
  ```typescript
  const fileService = new FileService();
  const fileResult = fileService.readFile(filePath);
  if (fileResult.success) {
    // Use fileResult.content
  }
  ```

- **prompt-query-service.ts** - Handles database queries related to prompts. Fetches prompt content, executes associated database queries, and processes relationships.
  ```typescript
  const promptQueryService = new PromptQueryService(supabaseUrl, supabaseKey);
  const result = await promptQueryService.getPromptWithQueryResults(promptName);
  ```

- **document-classification-service.ts** - Specialized service for document classification using Claude AI. Handles database integration, document type matching, and confidence scoring.

- **prompt-document-classifier.ts** - Service for classifying documents using prompts stored in the database. Integrates with Claude AI and handles prompt resolution.

### Domain-Specific Services

- **document-organization/file-organizer.ts** - Service for organizing files based on their content and classification. Manages file relationships and directory structures.

- **document-organization/file-discovery.ts** - Service for finding and indexing documentation files in the repository.

- **document-type-checker.ts** - Service for checking and validating document types.

### Core Utilities (src/utils/*)

- **config.ts** - Singleton configuration manager. Access through the exported instance:
  ```typescript
  import config from '../../packages/cli/src/utils/config';
  // Now use config.supabaseUrl, config.anthropicApiKey, etc.
  ```

- **error-handler.ts** - Centralized error handling and reporting:
  ```typescript
  import { errorHandler } from '../../packages/cli/src/utils/error-handler';
  try {
    // code
  } catch (error) {
    errorHandler(error);
  }
  ```

- **logger.ts** - Structured logging utility:
  ```typescript
  import logger from '../../packages/cli/src/utils/logger';
  logger.info('Operation started');
  logger.error('Operation failed', error);
  ```

- **rate-limiter.ts** - Token bucket algorithm for API rate limiting.

### Command Files (src/commands/*)

- **analyze-script.ts** - Command to analyze a script file using Claude AI to categorize and assess it. Uses the claude-service for API calls.

- **batch-analyze-scripts.ts** - Processes multiple script files in batch mode. Shows how to implement parallel processing for efficiency.

- **classify-markdown.ts** - Classifies markdown documents based on document types from the database. Demonstrates integration with document-classification-service.

- **documentation-processor.ts** - Processes documentation files by analyzing content, updating metadata, and maintaining database records.

- **examine-markdown.ts** - Detailed analysis tool for markdown files. Shows how to extract key information and provide quality assessment.

## Best Practices

1. **Singleton Pattern**: Use singleton services for config, database connections, etc.
   ```typescript
   // ✅ CORRECT - Use the singleton instance
   const supabaseService = SupabaseClientService.getInstance();
   const supabase = supabaseService.getClient();

   // ❌ INCORRECT - Creates new connection each time
   const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
   ```

2. **Return Typed Results**: Use structured return objects with success/error status
   ```typescript
   // ✅ CORRECT - Return structured result
   async function processDocument(): Promise<{success: boolean, error?: string}> {
     try {
       // processing
       return { success: true };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error'
       };
     }
   }

   // ❌ INCORRECT - Inconsistent error handling
   async function processDocument(): Promise<void> {
     // processing
     // Errors simply thrown or logged
   }
   ```

3. **Reuse Shared Services**:
   ```typescript
   // ✅ CORRECT - Use shared services
   const fileService = new FileService();
   const claudeService = new ClaudeService(config.anthropicApiKey);
   
   // ❌ INCORRECT - Direct API calls or file operations
   const fileContent = fs.readFileSync(path, 'utf8');
   const response = await axios.post('https://api.anthropic.com/v1/messages', ...);
   ```

4. **Configuration Management**: Use config.ts or ConfigService for all environment variables
   ```typescript
   // ✅ CORRECT - Use config
   import config from '../../packages/cli/src/utils/config';
   const apiKey = config.anthropicApiKey;
   
   // ❌ INCORRECT - Direct environment access
   const apiKey = process.env.ANTHROPIC_API_KEY || '';
   ```

5. **Structured Error Handling**: Use error-handler.ts or structured try/catch
   ```typescript
   // ✅ CORRECT - Structured error handling
   import { errorHandler } from '../../packages/cli/src/utils/error-handler';
   try {
     // code
   } catch (error) {
     errorHandler(error);
     // OR return structured error
     return { success: false, error: formatError(error) };
   }
   ```

6. **Consistent Logging**: Use logger.ts with appropriate levels
   ```typescript
   // ✅ CORRECT - Use logger with levels
   import logger from '../../packages/cli/src/utils/logger';
   logger.debug('Starting process with options:', options);
   logger.info('Process complete');
   logger.error('Process failed:', error);
   
   // ❌ INCORRECT - Direct console logs
   console.log('Starting process');
   console.error('Error', error);
   ```

## Connection Troubleshooting Guide

If encountering connection issues:

1. **Check Configuration**: Verify API keys/URLs are properly set and formatted:
   ```typescript
   // Debug configuration sources
   const configService = ConfigService.getInstance();
   console.log(`Using URL: ${configService.getSupabaseUrl().substring(0, 20)}...`);
   ```

2. **Test Connection**: Use SupabaseClientService test methods:
   ```typescript
   const connectionTest = await supabaseService.testConnection();
   if (!connectionTest.success) {
     console.error(`Connection failed: ${connectionTest.error}`);
   }
   ```

3. **Check Network Status**: Test basic connectivity:
   ```bash
   curl -Is https://api.supabase.com | head -n 1
   ```

4. **Check Rate Limits**: Look for 429 errors which indicate rate limiting.

5. **Refresh Tokens**: If authentication fails, check token expiration.

## Document Classification Workflow

When implementing document classification:

1. Load configuration values from ConfigService singleton
2. Use PromptQueryService to retrieve prompts and their metadata
3. Use DocumentClassificationService for classifying documents
4. Structure your workflow to handle failures gracefully with typed responses

```typescript
// Example classification workflow
const configService = ConfigService.getInstance();
const supabase = getSupabaseClient();
const claudeApiKey = configService.getClaudeApiKey();

const classificationService = new DocumentClassificationService(
  supabase,
  claudeApiKey,
  configService.getSupabaseUrl(),
  configService.getSupabaseKey()
);

const result = await classificationService.classifyDocument(
  documentPath,
  'markdown-document-classification-prompt'
);

if (result.success) {
  console.log(`Classified as: ${result.document_type_name}`);
} else {
  console.error(`Classification failed: ${result.error}`);
}
```

This guidance should help you work effectively with the CLI pipeline tools in this project by following a consistent pattern of singleton services, typed responses, and proper error handling.