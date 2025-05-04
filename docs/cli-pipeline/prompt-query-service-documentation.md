# Prompt Query Service Documentation

## 1. Service Overview
The Prompt Query Service is a TypeScript module that serves as a bridge between prompts stored in the database and dynamic data needed for those prompts. It enables prompts to include database queries in their metadata, executes those queries with robust error handling and fallback strategies, and provides the results to be integrated into the prompts, allowing for dynamic, data-driven AI interactions within the CLI pipeline.

## 2. Dependencies
- `@supabase/supabase-js`: For database connectivity and query execution
- `Logger`: From `../utils/logger` for standardized logging

## 3. Invocation Pattern
The service is instantiated with optional configuration and then its methods are called directly:

```typescript
import { PromptQueryService } from '../services/prompt-query-service';

// Create with environment variables or explicit config
const queryService = new PromptQueryService({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_KEY
});

// Get a prompt with its query results
const result = await queryService.getPromptWithQueryResults('document-classification-prompt');
```

## 4. Input/Output

### Inputs:
- **Configuration**: Optional Supabase URL and API key (defaults to environment variables)
- **Prompt Names**: String identifiers for prompts stored in the database
- **Prompt IDs**: For retrieving relationships associated with a prompt
- **SQL Queries**: Either directly provided or extracted from prompt metadata

### Outputs:
- **PromptQueryResult**: Composite object containing:
  - `prompt`: The prompt object with its content and metadata
  - `databaseQueryResults`: Results from the primary metadata query
  - `databaseQuery2Results`: Results from the secondary metadata query
  - `error`: Error message (if operation failed)

## 5. Key Functions

### 1. `constructor(config?: { url?: string; key?: string })`
Initializes the service with database connection details, using provided values or environment variables.

### 2. `getPromptByName(promptName: string): Promise<Prompt | null>`
Retrieves a prompt from the database by its name.

### 3. `getRelationshipsByPromptId(promptId: string): Promise<any[]>`
Gets relationships associated with a specific prompt, useful for query parameter substitution.

### 4. `executeQuery(queryText: string): Promise<any[] | null>`
Executes a database query with multiple fallback strategies and special handling for common query patterns.

### 5. `getPromptWithQueryResults(promptName: string): Promise<PromptQueryResult>`
Main workflow method that gets a prompt and executes any queries defined in its metadata.

## 6. Error Handling
- Multiple fallback strategies for query execution
- Special handling for common SQL syntax patterns
- Automatic fixing of unquoted UUIDs
- Quote style normalization (double to single quotes)
- Comprehensive logging of errors at each stage
- Graceful degradation with sensible defaults
- Parameter substitution with fallbacks

## 7. Code Quality Assessment

### Strengths:
- Robust error handling with multiple fallback strategies
- Good separation of concerns
- Comprehensive logging
- Special case handling for common query patterns
- Parameter substitution capabilities
- Graceful degradation when queries fail

### Areas for Improvement:
- Limited type safety for query results
- Some duplication in fallback logic
- No transaction support
- Limited query sanitization
- No pagination support for large result sets
- Hardcoded queries in fallback logic

## 8. Improvement Opportunities

1. **Type Safety**: Add generic type parameters for query results
2. **Query Builder**: Implement a more structured query building approach
3. **Caching Layer**: Add caching for frequently accessed prompts and results
4. **Query Sanitization**: Enhance input validation and sanitization
5. **Pagination**: Add support for paginated results in large datasets
6. **Dynamic SQL Generation**: More flexible SQL generation for complex cases
7. **Transaction Support**: Add methods for transactional operations

## 9. Usage Examples

### Example 1: Document Classification with Dynamic Document Types
```typescript
import { PromptQueryService } from '../services/prompt-query-service';

async function classifyDocumentWithDynamicTypes(documentContent) {
  // Create prompt query service
  const queryService = new PromptQueryService();
  
  // Get classification prompt with document types from database
  const result = await queryService.getPromptWithQueryResults('markdown-document-classification-prompt');
  
  if (!result.prompt) {
    throw new Error('Classification prompt not found');
  }
  
  // Access the document types from query results
  const documentTypes = result.databaseQueryResults || [];
  
  console.log(`Found ${documentTypes.length} document types for classification`);
  
  // Build the classification prompt with document types
  const systemPrompt = result.prompt.content + '\n\n' + 
    'Available document types:\n' + 
    documentTypes.map(type => `- ${type.name}: ${type.description}`).join('\n');
  
  // Now you can use this prompt with Claude API
  // For example: claudeService.classifyDocument(documentContent, systemPrompt);
  
  return {
    prompt: systemPrompt,
    documentTypes
  };
}
```

### Example 2: Script Analysis with Relationship Context
```typescript
import { PromptQueryService } from '../services/prompt-query-service';
import { FileService } from '../services/file-service';

async function analyzeScriptWithRelatedFiles(scriptPath) {
  const queryService = new PromptQueryService();
  const fileService = new FileService();
  
  // Read the script content
  const scriptContent = fileService.readFile(scriptPath);
  if (!scriptContent.success) {
    throw new Error(`Failed to read script: ${scriptContent.error}`);
  }
  
  // Get the script analysis prompt with related script information
  const result = await queryService.getPromptWithQueryResults('script-analysis-prompt');
  
  if (!result.prompt) {
    throw new Error('Script analysis prompt not found');
  }
  
  // The first query might return script metadata
  const scriptMetadata = result.databaseQueryResults || [];
  
  // The second query might return related scripts
  const relatedScripts = result.databaseQuery2Results || [];
  
  console.log(`Found ${relatedScripts.length} related scripts for context`);
  
  // Build the analysis prompt with script relationships
  let analysisPrompt = result.prompt.content + '\n\n';
  
  if (relatedScripts.length > 0) {
    analysisPrompt += 'Related scripts:\n';
    relatedScripts.forEach(script => {
      analysisPrompt += `- ${script.file_path}: ${script.title || 'No title'}\n`;
    });
  }
  
  // Now you can use this prompt with Claude API for script analysis
  
  return {
    prompt: analysisPrompt,
    metadata: scriptMetadata,
    relatedScripts
  };
}
```

## 10. Integration Points
- Used by document classification services to retrieve document types
- Integrated with script analysis workflows to provide context
- Supports AI prompting systems with dynamic database data
- Provides relationship context for interconnected assets
- Essential component for prompt-based workflows in the CLI pipeline
- Leveraged by batch processing operations

## Known Limitations
- Limited type safety for query results
- No support for advanced SQL features (joins, CTEs, etc.)
- Fixed fallback strategy may not work for all query patterns
- No support for result pagination
- Limited parameter substitution capabilities
- Connection is created for each instance rather than pooled

## Security Considerations
- Limited SQL injection protection
- Automatic quote handling could potentially modify query semantics
- No explicit validation of query structures
- Parameter substitution is basic and could be improved
- Hard-coded queries in fallback logic may expose database structure