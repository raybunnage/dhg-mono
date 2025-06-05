# Technical Specification: Batch Processing for Documentation Analysis Pipeline

## Overview

This document outlines the technical specifications for enhancing the existing documentation analysis pipeline to support batch processing of files from the `documentation_files` table. The current implementation processes a single markdown file at a time, but needs to be extended to efficiently process multiple files in sequence or in parallel.

## Current Implementation

The current pipeline:
1. Takes a single markdown file path as input
2. Reads the file content
3. Calls the AI service to analyze the document
4. Updates the corresponding record in the `documentation_files` table

## Requirements for Enhancement

1. **Parameterization**: Accept command-line arguments to control behavior
2. **Batch Processing**: Process multiple files from the database
3. **Progress Tracking**: Monitor and report on processing status
4. **Error Handling**: Gracefully handle and report errors
5. **Configurability**: Allow customization of batch size, limits, etc.

## Proposed Solution

### 1. Command-Line Interface

Enhance the CLI to accept various parameters:

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('documentation-processor')
  .description('Process documentation files from the database')
  .version('1.0.0');

program
  .command('process')
  .description('Process documentation files')
  .argument('[file_path]', 'Path to a specific markdown file (optional)')
  .option('-i, --id <id>', 'Process a specific documentation file by ID')
  .option('-a, --all', 'Process all non-deleted documentation files')
  .option('-l, --limit <number>', 'Limit the number of files to process')
  .option('-b, --batch-size <number>', 'Number of files to process in parallel', '5')
  .option('-d, --dry-run', 'Show what would be processed without making changes')
  .option('-r, --retries <number>', 'Number of retry attempts for failed processing', '3')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (filePath, options) => {
    // Implementation details below
  });

program.parse();
```

### 2. Database Query Functions

Create functions to retrieve files from the database:

```typescript
interface DocumentationFile {
  id: string;
  file_path: string;
  is_deleted: boolean;
  classification?: any;
  metadata?: any;
  assessment_date?: string;
  created_at: string;
  updated_at: string;
}

async function getFilesToProcess(limit?: number): Promise<DocumentationFile[]> {
  try {
    let query = supabase
      .from('documentation_files')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch documentation files: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
}

async function getFileById(id: string): Promise<DocumentationFile | null> {
  try {
    const { data, error } = await supabase
      .from('documentation_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch documentation file: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching file with ID ${id}:`, error);
    return null;
  }
}

async function getFileByPath(filePath: string): Promise<DocumentationFile | null> {
  try {
    const { data, error } = await supabase
      .from('documentation_files')
      .select('*')
      .eq('file_path', filePath)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch documentation file: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching file with path ${filePath}:`, error);
    return null;
  }
}
```

### 3. Processing Functions

Refactor the existing processing logic:

```typescript
async function processSingleFile(filePath: string): Promise<boolean> {
  try {
    // Find the file in the database
    const file = await getFileByPath(filePath);
    
    if (!file) {
      throw new Error(`File not found in database: ${filePath}`);
    }
    
    return await processFileById(file.id);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

async function processFileById(id: string): Promise<boolean> {
  try {
    // Get file details from database
    const file = await getFileById(id);
    
    if (!file) {
      throw new Error(`File with ID ${id} not found`);
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(file.file_path)) {
      console.warn(`File ${file.file_path} does not exist on disk. Marking as deleted.`);
      await supabase
        .from('documentation_files')
        .update({ is_deleted: true })
        .eq('id', id);
      return false;
    }
    
    // Read file content
    const fileContent = fs.readFileSync(file.file_path, 'utf8');
    
    // Call AI analysis function
    const analysisResult = await analyzeDocument(fileContent);
    
    // Update the database with results
    const { error: updateError } = await supabase
      .from('documentation_files')
      .update({
        classification: analysisResult.classification,
        metadata: analysisResult.metadata,
        assessment_date: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      throw new Error(`Failed to update database: ${updateError.message}`);
    }
    
    console.log(`Successfully processed ${file.file_path} (ID: ${id})`);
    return true;
  } catch (error) {
    console.error(`Error processing file ID ${id}:`, error);
    return false;
  }
}

async function processFileWithRetry(id: string, maxRetries = 3): Promise<boolean> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const success = await processFileById(id);
      if (success) return true;
      
      retries++;
      console.warn(`Retry ${retries}/${maxRetries} for file ID ${id}`);
      
      if (retries >= maxRetries) {
        console.error(`Failed to process file ID ${id} after ${maxRetries} attempts`);
        return false;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    } catch (error) {
      retries++;
      console.warn(`Retry ${retries}/${maxRetries} for file ID ${id} due to error:`, error);
      
      if (retries >= maxRetries) {
        console.error(`Failed to process file ID ${id} after ${maxRetries} attempts`);
        return false;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
  
  return false;
}
```

### 4. Batch Processing Implementation

Implement the batch processing logic:

```typescript
async function processAllFiles(options: {
  batchSize?: number;
  limit?: number;
  dryRun?: boolean;
  retries?: number;
  verbose?: boolean;
}): Promise<void> {
  const {
    batchSize = 5,
    limit,
    dryRun = false,
    retries = 3,
    verbose = false
  } = options;
  
  try {
    console.log('Fetching files to process...');
    const files = await getFilesToProcess(limit);
    
    console.log(`Found ${files.length} files to process${limit ? ` (limited to ${limit})` : ''}`);
    
    if (dryRun) {
      console.log('DRY RUN - Would process these files:');
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.file_path} (ID: ${file.id})`);
      });
      return;
    }
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${files.length} files in ${batches.length} batches of up to ${batchSize} files each`);
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();
    const errors: Array<{ id: string; path: string; error: any }> = [];
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      
      const results = await Promise.all(
        batches[i].map(async (file) => {
          try {
            if (verbose) {
              console.log(`Processing ${file.file_path} (ID: ${file.id})...`);
            }
            
            const success = await processFileWithRetry(file.id, retries);
            return { 
              success, 
              id: file.id, 
              path: file.file_path 
            };
          } catch (error) {
            return { 
              success: false, 
              id: file.id, 
              path: file.file_path, 
              error 
            };
          }
        })
      );
      
      results.forEach(result => {
        processed++;
        if (result.success) {
          successful++;
        } else {
          failed++;
          if (result.error) {
            errors.push({
              id: result.id,
              path: result.path,
              error: result.error
            });
          }
          if (verbose) {
            console.error(`Failed to process ${result.path} (ID: ${result.id})`);
          }
        }
      });
      
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const filesPerSecond = processed / elapsedSeconds;
      const estimatedRemaining = (files.length - processed) / filesPerSecond;
      
      console.log(`Progress: ${processed}/${files.length} files (${(processed/files.length*100).toFixed(1)}%)`);
      console.log(`Stats: ${successful} successful, ${failed} failed`);
      console.log(`Speed: ${filesPerSecond.toFixed(2)} files/sec, Est. remaining: ${formatTime(estimatedRemaining)}`);
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\nProcessing complete!`);
    console.log(`Processed ${files.length} files in ${formatTime(totalTime)}`);
    console.log(`Results: ${successful} successful, ${failed} failed`);
    
    // Generate report
    generateProcessingReport({
      totalFiles: files.length,
      successful,
      failed,
      processingTimeSeconds: totalTime,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in batch processing:', error);
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function generateProcessingReport(data: {
  totalFiles: number;
  successful: number;
  failed: number;
  processingTimeSeconds: number;
  errors?: Array<{ id: string; path: string; error: any }>;
}): void {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const report = {
    timestamp,
    ...data,
    averageTimePerFile: data.processingTimeSeconds / data.totalFiles
  };
  
  // Write JSON report
  fs.writeFileSync(
    `docs/reports/documentation-processing-report-${timestamp}.json`,
    JSON.stringify(report, null, 2)
  );
  
  // Write markdown report
  const markdownReport = `# Documentation Processing Report

## Summary
- **Timestamp:** ${new Date(timestamp).toLocaleString()}
- **Total Files:** ${report.totalFiles}
- **Successful:** ${report.successful}
- **Failed:** ${report.failed}
- **Processing Time:** ${formatTime(report.processingTimeSeconds)}
- **Average Time Per File:** ${(report.averageTimePerFile).toFixed(2)}s

${report.errors && report.errors.length > 0 ? `
## Errors
${report.errors.map(err => `- **${err.path}** (ID: ${err.id}): ${err.error}`).join('\n')}
` : ''}
`;

  // Ensure directory exists
  if (!fs.existsSync('docs/reports')) {
    fs.mkdirSync('docs/reports', { recursive: true });
  }
  
  fs.writeFileSync(
    `docs/reports/documentation-processing-report-${timestamp}.md`,
    markdownReport
  );
  
  console.log(`Report saved to docs/reports/documentation-processing-report-${timestamp}.md`);
}
```

### 5. Main Command Implementation

Implement the main command action:

```typescript
program
  .command('process')
  .description('Process documentation files')
  .argument('[file_path]', 'Path to a specific markdown file (optional)')
  .option('-i, --id <id>', 'Process a specific documentation file by ID')
  .option('-a, --all', 'Process all non-deleted documentation files')
  .option('-l, --limit <number>', 'Limit the number of files to process')
  .option('-b, --batch-size <number>', 'Number of files to process in parallel', '5')
  .option('-d, --dry-run', 'Show what would be processed without making changes')
  .option('-r, --retries <number>', 'Number of retry attempts for failed processing', '3')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (filePath, options) => {
    try {
      if (filePath) {
        // Process single file by path
        console.log(`Processing file: ${filePath}`);
        const success = await processSingleFile(filePath);
        process.exit(success ? 0 : 1);
      } else if (options.id) {
        // Process single file by ID
        console.log(`Processing file with ID: ${options.id}`);
        const success = await processFileWithRetry(options.id, options.retries);
        process.exit(success ? 0 : 1);
      } else if (options.all) {
        // Process all files
        await processAllFiles({
          batchSize: options.batchSize ? parseInt(options.batchSize) : undefined,
          limit: options.limit ? parseInt(options.limit) : undefined,
          dryRun: options.dryRun,
          retries: options.retries ? parseInt(options.retries) : undefined,
          verbose: options.verbose
        });
      } else {
        console.error('Error: Please provide a file path, ID, or use --all flag');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });
```

## Implementation Plan

### Phase 1: Refactoring

1. Refactor the existing script to separate concerns:
   - File operations
   - Database operations
   - AI analysis
   - Reporting

2. Create modular functions for:
   - Processing a single file by path
   - Processing a single file by ID
   - Retrieving files from the database

### Phase 2: CLI Enhancement

1. Implement the command-line interface using Commander.js
2. Add parameter parsing and validation
3. Implement the main command action

### Phase 3: Batch Processing

1. Implement the batch processing function
2. Add progress tracking and reporting
3. Implement error handling and retry logic

### Phase 4: Testing and Optimization

1. Test with small batches
2. Optimize batch size for performance
3. Add comprehensive error handling
4. Implement detailed logging

## Usage Examples

```bash
# Process all non-deleted files
npm run cli -- process --all

# Process a specific file by ID
npm run cli -- process --id 123e4567-e89b-12d3-a456-426614174000

# Process a specific file by path
npm run cli -- process /path/to/docs/experts-audit.md

# Process the 10 most recent files
npm run cli -- process --all --limit 10

# Dry run to see what would be processed
npm run cli -- process --all --dry-run

# Process with smaller batch size (for memory-intensive operations)
npm run cli -- process --all --batch-size 2

# Process with more retries for unreliable operations
npm run cli -- process --all --retries 5

# Process with verbose logging
npm run cli -- process --all --verbose
```

## Considerations

### Performance

- **Batch Size**: Adjust based on system resources and API rate limits
- **Parallelization**: Process files in parallel for efficiency
- **Rate Limiting**: Implement backoff strategies for API calls

### Error Handling

- **Retries**: Implement exponential backoff for transient errors
- **Logging**: Detailed logging for debugging
- **Reporting**: Comprehensive error reporting

### Database Considerations

- **Transactions**: Use transactions for data consistency
- **Locking**: Consider row-level locking for concurrent updates
- **Indexing**: Ensure proper indexes for query performance

## Conclusion

This enhancement will transform the current script into a robust, flexible CLI tool capable of processing both individual files and batches from the database. The parameterized approach allows for various usage patterns while maintaining the core functionality of the original script.

By implementing batch processing with proper error handling and reporting, the tool will efficiently process large numbers of documentation files, providing visibility into the process and results. 