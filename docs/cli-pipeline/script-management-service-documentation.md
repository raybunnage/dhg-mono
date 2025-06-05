# Script Management Service Documentation

## 1. Service Overview
The Script Management Service is a comprehensive TypeScript module that manages the full lifecycle of scripts within the CLI pipeline. It handles script discovery, synchronization with the database, classification using AI, assessment of quality, and generation of summary reports. The service serves as the central hub for all script-related operations, ensuring consistent script metadata and organization throughout the codebase.

## 2. Dependencies
- `FileService`: For reading and finding script files
- `SupabaseClientService`: For database interactions using a singleton pattern
- `PromptQueryService`: For retrieving prompts and metadata for script analysis
- `ClaudeService`: For general AI operations
- `ScriptClaudeService`: For script-specific AI operations
- Node.js `crypto`, `path`, and `fs`: For file system operations and hashing
- `Logger`: For structured logging
- Configuration utilities for centralized access to settings

## 3. Invocation Pattern
The service is instantiated and its methods are called directly to perform script management operations:

```typescript
import { ScriptManagementService } from '../services/script-management-service';

// Initialize the service
const scriptManager = new ScriptManagementService();

// Discover and process scripts
const scripts = await scriptManager.discoverScripts('./scripts');
const syncResult = await scriptManager.syncWithDatabase(scripts);

// Classify and generate reports
const classification = await scriptManager.classifyScript('scripts/backup.sh');
await scriptManager.generateSummary({ limit: 100 });
```

## 4. Input/Output

### Inputs:
- **Directory Paths**: For script discovery operations
- **File Paths**: For specific script operations like classification
- **Script Data**: Metadata for scripts to manage
- **Configuration**: From centralized config utility
- **Options**: Parameters for controlling summary generation and other operations

### Outputs:
- **ScriptFile[]**: Discovered script files from the filesystem
- **SyncResult**: Information about added, updated, and deleted scripts during synchronization
- **ClassificationResult**: AI-generated metadata about scripts
- **Report Paths**: Locations of generated report files
- **Script[]**: Database records of scripts with various filters

## 5. Key Functions

### Script Discovery & Management
- `discoverScripts(scanDir: string)`: Finds all script files in a directory matching specified patterns
- `syncWithDatabase(scripts: ScriptFile[])`: Synchronizes filesystem scripts with the database
- `cleanScriptResults()`: Removes analysis results from scripts in the database

### Path Handling
- `toAbsolutePath(filePath: string)`: Converts a relative path to absolute
- `toRelativePath(absolutePath: string)`: Converts an absolute path to project-relative
- `normalizePath(filePath: string)`: Normalizes paths for consistent comparison

### AI Classification
- `classifyScript(filePath: string)`: Classifies a script using Claude AI
- `parseAIResponse(aiResponse: string)`: Parses AI responses into structured data
- `updateScriptWithClassification(scriptId, result)`: Updates a script record with classification data

### Database Operations
- `getUntypedScripts(limit: number)`: Retrieves scripts without type assignments
- `getRecentScripts(limit: number)`: Gets the most recently updated scripts

### Reporting
- `generateSummary(options: SummaryOptions)`: Creates a comprehensive summary report
- `categorizeScript(script: Script)`: Assigns scripts to predefined categories
- `assessScriptQuality(script: Script)`: Evaluates script quality metrics

## 6. Error Handling
- Comprehensive try/catch blocks around all operations
- Detailed error logging with context
- Graceful fallbacks for missing AI responses
- Transaction-based database updates to prevent partial updates
- Path normalization to handle path inconsistencies
- Hash-based change detection to minimize unnecessary updates
- Script categorization handles missing data gracefully

## 7. Code Quality Assessment

### Strengths:
- Well-organized with clear separation of concerns
- Consistent error handling patterns
- Robust path normalization for cross-platform compatibility
- Effective use of hash-based change detection
- Comprehensive logging throughout
- Flexible categorization algorithm for scripts
- Good use of singleton pattern for database connectivity

### Areas for Improvement:
- Limited transaction support for bulk operations
- Some hard-coded values could be moved to configuration
- No explicit validation of script metadata
- Limited support for different script languages beyond shell and JavaScript
- No dedicated backup/restore functionality
- Limited pagination for large result sets

## 8. Improvement Opportunities

1. **Bulk Operations**: Add transaction support for more efficient bulk updates
2. **Configuration Externalization**: Move more constants to configuration
3. **Extended Language Support**: Add support for more scripting languages
4. **Validation Logic**: Add explicit validation for script metadata
5. **Backup/Restore**: Add functionality to save and restore script metadata
6. **Streaming Processing**: Implement streaming for large script sets
7. **Relationship Management**: Add explicit handling of script relationships

## 9. Usage Examples

### Example 1: Full Script Discovery and Classification Workflow
```typescript
import { ScriptManagementService } from '../services/script-management-service';
import { Logger } from '../utils/logger';

async function processAllScripts() {
  const scriptManager = new ScriptManagementService();
  
  try {
    // Discover scripts
    Logger.info('Starting script discovery...');
    const scripts = await scriptManager.discoverScripts('./scripts');
    
    // Sync with database
    Logger.info(`Found ${scripts.length} scripts. Syncing with database...`);
    const syncResult = await scriptManager.syncWithDatabase(scripts);
    Logger.info(`Sync result: Added=${syncResult.added}, Updated=${syncResult.updated}, Deleted=${syncResult.deleted}`);
    
    // Get untyped scripts and classify them
    const untypedScripts = await scriptManager.getUntypedScripts(10);
    Logger.info(`Classifying ${untypedScripts.length} untyped scripts...`);
    
    for (const script of untypedScripts) {
      Logger.info(`Classifying script: ${script.file_path}`);
      const classification = await scriptManager.classifyScript(script.file_path);
      
      if (classification) {
        await scriptManager.updateScriptWithClassification(script.id, classification);
        Logger.info(`Successfully classified script: ${script.file_path}`);
      } else {
        Logger.warn(`Failed to classify script: ${script.file_path}`);
      }
    }
    
    // Generate a summary report
    Logger.info('Generating summary report...');
    const reportPath = await scriptManager.generateSummary({ limit: 100 });
    
    return {
      discovered: scripts.length,
      syncResult,
      classified: untypedScripts.length,
      reportPath
    };
  } catch (error) {
    Logger.error(`Error processing scripts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
```

### Example 2: Targeted Script Assessment
```typescript
import { ScriptManagementService } from '../services/script-management-service';
import { ReportService } from '../services/report-service';
import * as path from 'path';

async function assessSpecificScript(scriptPath: string) {
  const scriptManager = new ScriptManagementService();
  const reportService = new ReportService();
  
  // Get absolute path
  const absolutePath = path.isAbsolute(scriptPath) ? 
    scriptPath : path.join(process.cwd(), scriptPath);
  
  // Classify the script
  const classification = await scriptManager.classifyScript(absolutePath);
  
  if (!classification) {
    throw new Error(`Failed to classify script: ${scriptPath}`);
  }
  
  // Generate a detailed report
  reportService.addSection({
    title: `Assessment of ${path.basename(scriptPath)}`,
    content: `Script assessment performed on ${new Date().toISOString()}`,
    level: 1
  });
  
  // Add script details
  reportService.addSection({
    title: 'Script Details',
    content: `
- **File Path**: ${scriptPath}
- **Script Type**: ${classification.scriptTypeId || 'Not determined'}
- **Tags**: ${classification.aiGeneratedTags.join(', ')}
    `,
    level: 2
  });
  
  // Add summary
  if (classification.summary) {
    const summary = classification.summary;
    reportService.addSection({
      title: 'Summary',
      content: typeof summary === 'string' ? summary : summary.description || 'No description provided',
      level: 2
    });
    
    if (typeof summary !== 'string') {
      // Add purpose, if available
      if (summary.purpose) {
        reportService.addSection({
          title: 'Purpose',
          content: summary.purpose,
          level: 3
        });
      }
      
      // Add recommendation, if available
      if (summary.recommendation) {
        reportService.addSection({
          title: 'Recommendation',
          content: summary.recommendation,
          level: 3
        });
      }
    }
  }
  
  // Generate and save the report
  const reportPath = `./reports/script-assessment-${path.basename(scriptPath)}.md`;
  reportService.writeReportToFile(reportPath);
  
  return {
    scriptPath,
    classification,
    reportPath
  };
}
```

## 10. Integration Points
- Used by CLI commands for script discovery and analysis
- Provides data for script-related dashboards and reports
- Integrates with Claude AI for intelligent script classification
- Connects to the database for persistent storage of script metadata
- Supports workflow automation through script categorization
- Delivers contextual information through summary reports

## Configuration Options
- **Script Extensions**: Configurable list of file extensions to consider as scripts
- **Exclude Directories**: Directories to exclude from script discovery
- **AI Model**: Uses the specified Claude model for script analysis
- **Category Definitions**: Rules for categorizing scripts into predefined groups
- **Report Options**: Configurable options for report generation

## Known Limitations
- Limited to JavaScript and shell scripts by default
- Classification quality depends on the AI model
- Path normalization may not handle all edge cases
- No built-in scheduling for periodic script discovery
- Single-threaded processing may be slow for large repositories
- Classification is dependent on Claude API availability

## Security Considerations
- Script content is transmitted to external AI service
- Database credentials are managed through a shared configuration
- No explicit security scanning of discovered scripts
- Content hashing helps detect unauthorized modifications
- Directory exclusion patterns help prevent analysis of sensitive directories