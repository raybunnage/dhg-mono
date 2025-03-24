# Document Classification Service Documentation

## 1. Service Overview
The Document Classification Service is a specialized TypeScript module that leverages the Claude AI API to analyze and classify documents within the CLI pipeline. It provides comprehensive capabilities for determining document types, extracting relevant metadata, and updating database records with classification results, with extensive logging and error handling throughout the process.

## 2. Dependencies
- `@supabase/supabase-js`: For database interactions
- `ClaudeService`: From `./claude-service` for AI-powered document analysis
- `FileService`: From `./file-service` for reading document files
- `PromptDocumentClassifier`: From `./prompt-document-classifier` for specialized document classification
- `PromptQueryService`: From `./prompt-query-service` for retrieving prompts and related data
- `Logger`: From `../utils/logger` for structured logging
- Node.js `fs` and `path` modules for file operations

## 3. Invocation Pattern
The service is instantiated with required connection details and then its methods are called directly:

```typescript
import { DocumentClassificationService } from '../services/document-classification-service';
import { createClient } from '@supabase/supabase-js';

// Set up Supabase client and connection details
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const claudeApiKey = process.env.CLAUDE_API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize service
const classificationService = new DocumentClassificationService(
  supabase, 
  claudeApiKey, 
  supabaseUrl, 
  supabaseKey,
  true // debug mode
);

// Classify a document
const result = await classificationService.classifyDocument(
  'docs/example-document.md', 
  'markdown-document-classification-prompt'
);
```

## 4. Input/Output

### Inputs:
- **Supabase Client**: An initialized Supabase client for database operations
- **API Keys**: Claude AI API key and Supabase credentials
- **Document Paths**: File paths for documents to be classified
- **Prompt Names**: Names of classification prompts stored in the database
- **Document IDs**: For updating document types in the database

### Outputs:
- **ClassificationResult**: Structured object containing:
  - `success`: Boolean indicating if classification succeeded
  - `document_type_id`: The identified document type ID
  - `document_type_name`: Human-readable document type name
  - `confidence`: Classification confidence score (0-1)
  - `error`: Error message (if classification failed)
  - `debugInfo`: Detailed diagnostic information
  - `rawResponse`: The complete Claude API response
  - `jsonResponse`: Parsed JSON data from Claude's response

## 5. Key Functions

### Initialization & Diagnostics
- `constructor(supabase, claudeApiKey, supabaseUrl, supabaseKey, debug)`: Initializes the service with required credentials
- `validateConnections()`: Validates all connection parameters
- `testSupabaseConnection()`: Tests database connectivity
- `logDebug(message, data)`: Enhanced logging with file output

### Document Operations
- `getNewestDocument()`: Retrieves the most recently added document
- `getDocumentsWithoutType(limit)`: Finds documents that need classification
- `updateDocumentType(documentId, documentTypeId)`: Updates a document's classification

### Classification Core
- `classifyDocument(documentPath, promptName, outputToMarkdown)`: Main method to classify a document using Claude AI
- `checkPromptTableAccess(promptName)`: Verifies if prompts can be accessed
- `getPromptWithQuery(promptName)`: Retrieves prompt data with query results
- `getDocumentTypes(category)`: Gets document types for classification
- `buildSystemPrompt(basePrompt, documentTypes)`: Constructs the Claude prompt
- `extractJsonFromResponse(responseContent)`: Parses Claude's response into structured data

## 6. Error Handling
- Comprehensive connection validation at startup
- Detailed error logging with context
- Multiple fallback strategies for retrieving document types
- Robust JSON extraction with multiple regex patterns
- Debug file writing for critical failures
- Structured error objects with detailed diagnostics
- Step-by-step operation logging for troubleshooting

## 7. Code Quality Assessment

### Strengths:
- Highly robust error handling and debugging capabilities
- Detailed logging throughout all operations
- Multiple fallback strategies for critical operations
- Good separation of concerns with focused methods
- Comprehensive credential validation
- Security-conscious design with masking of sensitive data
- Step-by-step debugging information for troubleshooting

### Areas for Improvement:
- Excessive direct console logging
- Complex, nested error handling paths
- Many fallback strategies add complexity
- Limited input validation
- High cyclomatic complexity in main classification method
- Debugging details stored in memory could lead to high memory usage
- Limited unit test coverage (not visible in the code)

## 8. Improvement Opportunities

1. **Structured Logging**: Replace direct console.log calls with structured logger
2. **Modularization**: Break down the large classifyDocument method into smaller components
3. **Configuration Management**: Move hardcoded values to centralized configuration
4. **Result Caching**: Add caching layer for frequently accessed document types
5. **Error Abstraction**: Standardize error handling patterns
6. **Memory Optimization**: Stream debug logs rather than storing in memory
7. **Metrics Collection**: Add performance monitoring points
8. **Input Validation**: Add stronger validation of input parameters

## 9. Usage Examples

### Example 1: Batch Processing Unclassified Documents
```typescript
import { DocumentClassificationService } from '../services/document-classification-service';
import { createClient } from '@supabase/supabase-js';

async function batchClassifyDocuments() {
  // Set up Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Initialize service
  const classificationService = new DocumentClassificationService(
    supabase, claudeApiKey, supabaseUrl, supabaseKey, true
  );
  
  // Get documents that need classification
  const unclassifiedDocs = await classificationService.getDocumentsWithoutType(5);
  console.log(`Found ${unclassifiedDocs.length} documents to classify`);
  
  // Process each document
  const results = [];
  for (const doc of unclassifiedDocs) {
    console.log(`Classifying ${doc.file_path}...`);
    
    // Classify the document
    const classification = await classificationService.classifyDocument(
      doc.file_path,
      'markdown-document-classification-prompt'
    );
    
    // Update the document type if classification succeeded
    if (classification.success && classification.document_type_id) {
      await classificationService.updateDocumentType(
        doc.id,
        classification.document_type_id
      );
      
      results.push({
        id: doc.id,
        path: doc.file_path,
        type: classification.document_type_name,
        confidence: classification.confidence,
        success: true
      });
    } else {
      results.push({
        id: doc.id,
        path: doc.file_path,
        error: classification.error,
        success: false
      });
    }
  }
  
  return results;
}
```

### Example 2: Single Document Classification with Custom Prompt
```typescript
import { DocumentClassificationService } from '../services/document-classification-service';
import { createClient } from '@supabase/supabase-js';
import { FileService } from '../services/file-service';

async function classifySpecificDocument(documentPath, promptName) {
  // Set up services
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const fileService = new FileService();
  
  // Check if document exists
  const fileResult = fileService.readFile(documentPath);
  if (!fileResult.success) {
    throw new Error(`Document not found: ${fileResult.error}`);
  }
  
  // Initialize classification service
  const classificationService = new DocumentClassificationService(
    supabase, claudeApiKey, supabaseUrl, supabaseKey
  );
  
  // Perform classification
  const result = await classificationService.classifyDocument(
    documentPath,
    promptName,
    true // output to markdown for review
  );
  
  // Log results
  if (result.success) {
    console.log(`Document classified as: ${result.document_type_name}`);
    console.log(`Confidence: ${result.confidence * 100}%`);
    console.log(`Document Type ID: ${result.document_type_id}`);
    
    // Get document record from database for updating
    const docRecord = await supabase
      .from('documentation_files')
      .select('id, file_path')
      .eq('file_path', documentPath)
      .single();
      
    if (docRecord.data) {
      // Update document classification
      await classificationService.updateDocumentType(
        docRecord.data.id,
        result.document_type_id
      );
      console.log('Database record updated successfully');
    }
    
    return {
      success: true,
      documentType: result.document_type_name,
      confidence: result.confidence,
      databaseUpdated: !!docRecord.data
    };
  } else {
    console.error(`Classification failed: ${result.error}`);
    return {
      success: false,
      error: result.error
    };
  }
}
```

## 10. Integration Points
- Called by CLI commands for document classification
- Integrated with file scanning and discovery processes
- Uses the Claude service for AI-powered analysis
- Updates Supabase database with classification results
- Leverages prompt management system for classification templates
- Integrates with document organization services

## Configuration Options
- **Debug Mode**: Toggles detailed logging and diagnostics
- **Prompt Selection**: Different prompts can be used for different classification needs
- **Markdown Output**: Optional output of classification results to markdown files
- **Rate Limiting**: Inherits rate limiting from underlying Claude service

## Known Limitations
- High latency due to AI API call dependencies
- Classification quality depends on Claude AI capabilities
- Limited to text-based document formats
- No built-in handling for very large documents
- Prompt-dependent classification results
- High verbosity in debug mode can impact performance

## Security Considerations
- API keys are masked in logs
- Document content is transmitted to external AI service
- Debug logs may contain document content
- Connection diagnostics expose database table structure
- No sanitization of document content before transmission