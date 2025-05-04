# Supabase Service Documentation

## 1. Service Overview
The Supabase Service is a TypeScript module that provides a centralized interface for interacting with the Supabase database within the CLI application. It offers comprehensive functionalities for database operations, environment diagnostics, path normalization, and specialized queries for various entity types including scripts, document types, documentation files, and their relationships.

## 2. Dependencies
- `@supabase/supabase-js`: The official Supabase client for JavaScript/TypeScript
- `path` and `fs`: Node.js built-in modules for file system and path operations
- `Logger`: From `../utils/logger` for logging operations
- `AppError`, `ErrorHandler`: From `../utils/error-handler` for standardized error handling
- Various models including `DocumentType`, `Prompt`, and `Relationship`

## 3. Invocation Pattern
The service is instantiated with connection details and then its methods are called directly:

```typescript
import { SupabaseService } from '../services/supabase-service';

// Initialize with connection details
const supabaseService = new SupabaseService(supabaseUrl, supabaseKey);

// Call methods
const documentType = await supabaseService.getDocumentTypeById('some-id');
```

## 4. Input/Output

### Inputs:
- **Connection Details**: Supabase URL and API key required for initialization
- **Query Parameters**: IDs, paths, filter criteria, and entity-specific data for various operations
- **Environment Variables**: Uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc., for configuration and diagnostics

### Outputs:
- **Database Records**: Structured data from the Supabase database
- **Query Results**: Results of custom queries, often with type-specific formatting
- **Diagnostic Information**: Detailed reports on connection status and environment configuration
- **Operation Results**: Success/failure indicators and related metadata for database operations

## 5. Key Functions

### Connection & Diagnostics
- `constructor(url: string, key: string)`: Initializes the service with connection details
- `static runEnvDiagnostics()`: Comprehensive checks of environment variables and connection status
- `static readEnvFile(filePath: string)`: Reads and parses environment files with security masking
- `getDiagnostics()`: Runs all diagnostics and returns a consolidated report

### Path Management
- `static normalizePath(filePath: string)`: Converts absolute file paths to project-relative format

### Generic Database Operations
- `executeQuery(table, action, options)`: Flexible query builder for various database operations
- `getById(table, id)`: Generic method to retrieve a record by ID
- `update(table, id, updates)`: Updates a record with specified changes

### Document Type Management
- `getDocumentTypesByCategory(category)`: Retrieves document types by category
- `getDocumentTypeById(id)`: Gets a specific document type by ID

### Prompt Management
- `getPromptByName(name)`: Retrieves a prompt configuration by name
- `getRelationshipsByPromptId(promptId)`: Gets relationships for a prompt

### Documentation File Management
- `getDocumentationFileByPath(filePath)`: Finds a file using multiple path normalization strategies
- `updateDocumentationFilePaths(dryRun)`: Normalizes paths in the database
- `updateDocumentationFileAssessment(docFileId, assessment, documentTypeId)`: Updates AI assessment data

### Script Management
- `getScriptByPath(filePath)`: Retrieves a script record by its file path
- `getAllScripts()`: Gets all script records
- `getScriptsByDocumentType(documentType)`: Filters scripts by document type
- `getScriptsByStatus(status)`: Filters scripts by status
- `upsertScript(scriptData)`: Creates or updates a script record
- `deleteScript(filePath)`: Removes a script record
- `addScriptRelationship(relationshipData)`: Creates a relationship between scripts
- `getScriptRelationships(scriptPath)`: Retrieves relationships for a script

## 6. Error Handling
- Uses the `ErrorHandler.wrap()` pattern for consistent error handling
- Detailed error logging with context and causes
- Standardized error responses with categorized error types
- Graceful fallbacks for common failure scenarios
- Path normalization attempts multiple strategies before failing

## 7. Code Quality Assessment

### Strengths:
- Comprehensive error handling with detailed diagnostics
- Effective abstraction of database operations
- Robust path normalization strategies
- Security-conscious design (masking sensitive data)
- Detailed logging throughout
- Well-organized by entity type
- Strong input validation

### Areas for Improvement:
- Some methods have overlapping functionality
- Limited transaction support
- Excessive direct console logging
- Hardcoded table names and query structures
- Inconsistent async/await usage
- Limited connection pooling and performance optimization

## 8. Improvement Opportunities

1. **Query Builder Enhancement**: Implement a more flexible query builder pattern
2. **Transaction Support**: Add methods for grouped operations in transactions
3. **Connection Management**: Implement connection pooling and re-use
4. **Caching Layer**: Add caching for frequently accessed data
5. **Batch Operations**: Support for bulk inserts, updates, and deletes
6. **Pagination**: Standardized pagination for large result sets
7. **Schema Validation**: Add runtime validation of entity schemas
8. **Structured Logging**: Replace direct console logging with structured logger

## 9. Usage Examples

### Example 1: Environment Diagnostics
```typescript
import { SupabaseService } from '../services/supabase-service';

async function checkDatabaseConnection() {
  // Run diagnostics without creating a client instance
  const diagnostics = await SupabaseService.runEnvDiagnostics();
  
  console.log(`Connection Status: ${diagnostics.connectionSuccess ? 'Connected' : 'Failed'}`);
  console.log(`Supabase URL: ${diagnostics.supabaseUrl || 'Not configured'}`);
  
  // Check critical tables
  if (diagnostics.tablesInfo) {
    console.log('Table Status:');
    diagnostics.tablesInfo.forEach(table => {
      console.log(`- ${table.name}: ${table.exists ? 'Exists' : 'Missing'}`);
      if (table.exists) {
        console.log(`  Columns: ${table.columns.map(col => col.name).join(', ')}`);
      }
    });
  }
  
  return diagnostics.connectionSuccess;
}
```

### Example 2: Script Analysis Integration
```typescript
import { SupabaseService } from '../services/supabase-service';
import { FileService } from '../services/file-service';

async function analyzeAndStoreScript(scriptPath) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables');
  }
  
  const supabase = new SupabaseService(supabaseUrl, supabaseKey);
  const fileService = new FileService();
  
  // Read the script file
  const fileResult = fileService.readFile(scriptPath);
  if (!fileResult.success) {
    throw new Error(`Failed to read script: ${fileResult.error}`);
  }
  
  // Normalize the path for storage
  const normalizedPath = SupabaseService.normalizePath(scriptPath);
  
  // Check if script already exists
  const existingScript = await supabase.getScriptByPath(normalizedPath);
  
  // Prepare script data
  const scriptData = {
    file_path: normalizedPath,
    title: path.basename(scriptPath),
    language: path.extname(scriptPath).replace('.', ''),
    content: fileResult.content,
    last_analyzed: new Date().toISOString(),
    // Add additional script data here
  };
  
  // Create or update the script record
  const result = await supabase.upsertScript(scriptData);
  
  return {
    scriptId: result.id,
    isNew: !existingScript,
    scriptData: result
  };
}
```

## 10. Integration Points
- Core database service used by nearly all other CLI services
- Provides database access for document classification and processing
- Integrated with script analysis and management features
- Supports report generation with database-sourced content
- Used for diagnostic checks throughout the application
- Central component for all prompt and document type management

## Configuration Options
- **Environment Files**: Supports `.env`, `.env.local`, `.env.development` and `.env.production`
- **Connection Variables**: Configurable through `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **Alternative Keys**: Falls back to `SUPABASE_ANON_KEY` if service role key is not available

## Known Limitations
- Limited transaction support
- No built-in data validation beyond basic type checking
- Path normalization is heuristic-based and may not handle all edge cases
- Database operations are not batched or optimized for performance
- No schema migration management built into the service

## Security Considerations
- API keys are appropriately masked in logs
- Environment variable values containing keywords like "KEY" or "SECRET" are redacted
- Service role key provides full database access, which may be excessive for some operations
- No built-in query sanitization beyond what Supabase client provides