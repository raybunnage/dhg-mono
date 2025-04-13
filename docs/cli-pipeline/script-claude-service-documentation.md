# Script Claude Service Documentation

## 1. Service Overview
The Script Claude Service is a specialized TypeScript module that provides an optimized interface for performing AI-powered script analysis using Anthropic's Claude API. It offers enhanced error reporting, robust rate limiting, URL validation, and specific script analysis functionality, tailored for analyzing shell and JavaScript scripts within the CLI pipeline.

## 2. Dependencies
- `axios`: For making HTTP requests to the Claude API
- `Logger`: From `../utils/logger` for standardized logging
- `AppError`, `ErrorHandler`: From `../utils/error-handler` for error management
- Custom `SimpleRateLimiter` class: For API request rate limiting

## 3. Invocation Pattern
The service is instantiated with an API key and its methods are called directly:

```typescript
import { ScriptClaudeService } from '../services/script-claude-service';

// Initialize with API key
const scriptClaudeService = new ScriptClaudeService(apiKey);

// Analyze a script
const result = await scriptClaudeService.analyzeScript(
  scriptContent,
  scriptPath,
  prompt,
  scriptTypes
);
```

## 4. Input/Output

### Inputs:
- **API Key**: Required for authentication with Claude API
- **Script Content**: The actual code content to analyze
- **Script Path**: File path for context
- **Prompt**: The analysis prompt template
- **Script Types**: Available script type definitions for classification

### Outputs:
- **ClaudeResponse**: Standardized response object containing:
  - `success`: Boolean indicating operation success
  - `result`: API response data (if successful)
  - `error`: Error message (if failed)

## 5. Key Functions

### 1. `constructor(apiKey: string)`
Initializes the service with thorough API key validation and verbose logging of configuration.

### 2. `callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse>`
Makes an API call to Claude with extensive error handling, URL validation, and rate limiting.

### 3. `analyzeScript(scriptContent, scriptPath, prompt, scriptTypes): Promise<ClaudeResponse>`
Specialized method for script analysis that formats prompts and handles the specific needs of script classification.

### 4. `SimpleRateLimiter` (Internal Class)
Provides token bucket-based rate limiting to prevent API overuse.

## 6. Error Handling
- Comprehensive validation of API key and URL
- Detailed classification of errors (network, timeout, auth, URL)
- User-friendly, context-aware error messages
- Verbose console logging for debugging
- Rate limiting to prevent API errors
- Specialized error handling for different types of failure scenarios
- Thoughtful error categorization (network, timeout, auth, URL)

## 7. Code Quality Assessment

### Strengths:
- Excellent error handling with detailed classification of error types
- Thorough validation of inputs before API calls
- Extensive logging for debugging and troubleshooting
- Robust rate limiting to prevent API overuse
- Script-specific prompt formatting
- Effective use of TypeScript interfaces
- Clear separation of concerns between API communication and script analysis

### Areas for Improvement:
- Excessive direct console logging
- Hard-coded model name and API version
- Limited configuration options for rate limiting
- No caching of results for similar analyses
- Lack of structured logging in favor of direct console output
- No unit tests visible in the code
- Limited handling of very large scripts

## 8. Improvement Opportunities

1. **Structured Logging**: Replace direct console.log calls with structured Logger usage
2. **Configuration Externalization**: Move hardcoded values to configuration
3. **Response Caching**: Add caching for similar script analyses
4. **Streaming Support**: Add streaming responses for large scripts
5. **Template Handling**: Improve prompt template management
6. **Middleware Pattern**: Implement request/response middleware for extensibility
7. **Advanced Rate Limiting**: Add more sophisticated rate limiting strategies

## 9. Usage Examples

### Example 1: Script Analysis with Error Handling
```typescript
import { ScriptClaudeService } from '../services/script-claude-service';
import { FileService } from '../services/file-service';
import { Logger } from '../utils/logger';

async function analyzeShellScript(scriptPath, promptTemplate) {
  const fileService = new FileService();
  const claudeService = new ScriptClaudeService(process.env.CLAUDE_API_KEY || '');
  
  try {
    // Read the script file
    const fileResult = fileService.readFile(scriptPath);
    if (!fileResult.success) {
      throw new Error(`Failed to read script: ${fileResult.error}`);
    }
    
    // Get available script types for classification
    const scriptTypes = [
      { id: 'backup', name: 'Backup Script', description: 'Handles data backup operations', category: 'Operations' },
      { id: 'deploy', name: 'Deployment Script', description: 'Manages application deployment', category: 'Operations' },
      { id: 'build', name: 'Build Script', description: 'Compiles and builds applications', category: 'Development' }
    ];
    
    // Analyze the script
    const analysisResult = await claudeService.analyzeScript(
      fileResult.content,
      scriptPath,
      promptTemplate,
      scriptTypes
    );
    
    if (!analysisResult.success) {
      Logger.error(`Script analysis failed: ${analysisResult.error}`);
      return null;
    }
    
    Logger.info(`Successfully analyzed script: ${scriptPath}`);
    return analysisResult.result;
  } catch (error) {
    Logger.error(`Error in script analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}
```

### Example 2: Batch Script Analysis with Rate Limiting
```typescript
import { ScriptClaudeService } from '../services/script-claude-service';
import { FileService } from '../services/file-service';
import { ReportService } from '../services/report-service';
import path from 'path';

async function analyzeBatchScripts(scriptPaths, promptTemplate) {
  const fileService = new FileService();
  const claudeService = new ScriptClaudeService(process.env.CLAUDE_API_KEY || '');
  const reportService = new ReportService();
  
  // Add report header
  reportService.addSection({
    title: 'Script Analysis Batch Report',
    content: `Analysis performed on ${new Date().toISOString()}\nTotal scripts: ${scriptPaths.length}`,
    level: 1
  });
  
  // Process each script
  const results = [];
  for (const scriptPath of scriptPaths) {
    try {
      // Read the script
      const fileResult = fileService.readFile(scriptPath);
      if (!fileResult.success) {
        console.error(`Failed to read ${scriptPath}: ${fileResult.error}`);
        continue;
      }
      
      // Analyze the script
      const analysisResult = await claudeService.analyzeScript(
        fileResult.content,
        scriptPath,
        promptTemplate,
        []
      );
      
      if (!analysisResult.success) {
        console.error(`Analysis failed for ${scriptPath}: ${analysisResult.error}`);
        continue;
      }
      
      // Extract useful information from response
      const responseContent = analysisResult.result.content?.[0]?.text || '';
      
      // Parse JSON from response if available
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/);
      const analysisData = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
      
      // Add to report
      reportService.addSection({
        title: path.basename(scriptPath),
        content: `
- **Path**: ${scriptPath}
- **Size**: ${fileResult.content.length} bytes
- **Purpose**: ${analysisData?.summary?.purpose || 'Not determined'}
- **Script Type**: ${analysisData?.script_type_id || 'Unknown'}
- **Tags**: ${analysisData?.tags?.join(', ') || 'None'}
        `,
        level: 2
      });
      
      results.push({
        path: scriptPath,
        analysis: analysisData,
        success: true
      });
    } catch (error) {
      console.error(`Error processing ${scriptPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      results.push({
        path: scriptPath,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Write report to file
  const reportPath = `script-analysis-report-${Date.now()}.md`;
  reportService.writeReportToFile(reportPath);
  
  return {
    results,
    reportPath,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length
  };
}
```

## 10. Integration Points
- Used by the ScriptManagementService for script analysis and classification
- Integrated with CLI commands for script operations
- Provides AI capabilities to script-related workflows
- Helps organize and classify scripts in the database
- Supports report generation with AI-powered insights
- Enables discovery of script relationships and dependencies

## Configuration Options
- **Rate Limiting**: Configured for 3 request burst capacity with 10 requests per minute
- **API Version**: Set to '2023-06-01'
- **Model**: Uses 'claude-3-7-sonnet-20250219' for script analysis
- **Max Tokens**: Set to 4000 to accommodate detailed analysis
- **Temperature**: Set to 0 for most deterministic output

## Known Limitations
- Not optimized for streaming responses
- Limited to text-only analysis (no file metadata analysis)
- Rate limiting is simplistic and doesn't handle distributed usage
- Hard-coded model and API parameters
- Debugging information goes straight to console instead of structured logs
- No built-in validation for very large scripts

## Security Considerations
- API key is logged in truncated form for debugging
- Script content is transmitted to an external API
- No additional authentication mechanisms beyond API key
- Verbose error logging could expose file paths or script details
- No explicit validation of script content before transmission