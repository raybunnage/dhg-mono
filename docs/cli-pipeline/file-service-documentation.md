# File Service Documentation

## 1. Service Overview
The File Service is a TypeScript module that handles file system operations within the CLI application. It provides methods for reading, writing, and finding files, with detailed error handling and logging capabilities, abstracting away the complexities of file manipulation.

## 2. Dependencies
- `fs`: Node.js built-in file system module
- `path`: Node.js built-in path manipulation module
- `glob`: Third-party library for file pattern matching
- `Logger`: From `../utils/logger` for logging
- `AppError`, `ErrorHandler`: From `../utils/error-handler` for error management

## 3. Invocation Pattern
The service is instantiated and its methods are called directly:

```typescript
import { FileService } from '../services/file-service';

// Create instance
const fileService = new FileService();

// Call methods
const fileResult = fileService.readFile('/path/to/file.txt');
```

## 4. Input/Output

### Inputs:
- **File Paths**: Strings representing file or directory locations
- **Content**: String data to write to files
- **Patterns**: Regular expressions or glob patterns for file searching

### Outputs:
- **FileResult**: Standardized response object containing:
  - `success`: Boolean indicating operation success
  - `content`: File contents (for read operations)
  - `error`: Error message (if operation failed)
  - `path`: Absolute file path
  - `stats`: Object with file metadata (size, modified date, line count)

## 5. Key Functions

### 1. `readFile(filePath: string): FileResult`
Reads a file from the filesystem with error handling.

### 2. `writeFile(filePath: string, content: string): FileResult`
Writes content to a file, creating directories if needed.

### 3. `ensureDirectoryExists(dirPath: string): boolean`
Creates a directory if it doesn't exist.

### 4. `getFileStats(filePath: string): FileResult['stats']`
Retrieves metadata about a file including size, modification date, and line count.

### 5. `findFiles(options): Promise<string[]>`
Modern method to find files matching patterns using glob.

### 6. `findFilesLegacy(directoryPath, pattern, excludePatterns): string[]`
Legacy method for finding files using regular expressions.

## 6. Error Handling
- Thorough try/catch blocks around all file operations
- Path resolution to prevent relative path issues
- Existence checking before file operations
- Standardized error response format
- Detailed error logging using the Logger service

## 7. Code Quality Assessment

### Strengths:
- Well-organized with clear separation of concerns
- Comprehensive error handling for all file operations
- Standardized return format for consistency
- Both synchronous and asynchronous file finding methods
- Good path normalization using path.resolve()

### Areas for Improvement:
- No async versions of basic file operations (readFile, writeFile)
- No file locking or concurrent access handling
- Missing append, rename, and delete operations
- Limited file metadata extraction

## 8. Improvement Opportunities

1. **Async Methods**: Add Promise-based versions of file operations
2. **Extended Operations**: Add methods for append, rename, delete, and copy operations
3. **Streaming Support**: Add methods for handling large files via streams
4. **File Watching**: Implement file watching capabilities for detecting changes
5. **File Locking**: Add concurrency protection for critical file operations
6. **Caching**: Implement an optional caching layer for frequent file access

## 9. Usage Examples

### Example 1: Reading and Writing Files
```typescript
import { FileService } from '../services/file-service';
import path from 'path';

async function processConfigFile(configPath) {
  const fileService = new FileService();
  
  // Read configuration file
  const configResult = fileService.readFile(configPath);
  if (!configResult.success) {
    throw new Error(`Failed to read config: ${configResult.error}`);
  }
  
  // Modify configuration
  const config = JSON.parse(configResult.content);
  config.lastUpdated = new Date().toISOString();
  
  // Write updated configuration
  const backupPath = path.join(path.dirname(configPath), 'backup', path.basename(configPath));
  fileService.ensureDirectoryExists(path.dirname(backupPath));
  
  const writeResult = fileService.writeFile(
    backupPath, 
    JSON.stringify(config, null, 2)
  );
  
  if (!writeResult.success) {
    throw new Error(`Failed to write backup: ${writeResult.error}`);
  }
  
  return writeResult.path;
}
```

### Example 2: Finding and Processing Markdown Files
```typescript
import { FileService } from '../services/file-service';

async function summarizeMarkdownFiles(directory) {
  const fileService = new FileService();
  
  // Find all markdown files
  const markdownFiles = await fileService.findFiles({
    directory,
    includePatterns: ['**/*.md', '**/*.markdown'],
    excludePatterns: ['**/node_modules/**', '**/dist/**'],
    recursive: true
  });
  
  // Process each file
  const summaries = [];
  for (const filePath of markdownFiles) {
    const result = fileService.readFile(filePath);
    if (result.success) {
      summaries.push({
        path: result.path,
        lines: result.stats.lines,
        size: result.stats.size,
        modified: result.stats.modified,
        title: extractTitle(result.content)
      });
    }
  }
  
  return summaries;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'Untitled';
}
```

## 10. Integration Points
- Used by script scanning services to discover files for analysis
- Integrated with document classification services for reading and writing markdown files
- Used by report services to output analysis results
- Provides file operations for workflow commands
- Essential for prompt management and lookup

## Known Limitations
- Synchronous operations can block the event loop
- Not optimized for very large files or directories
- No built-in encryption or compression functionality
- Limited error recovery mechanisms

## Performance Considerations
- File stats collection includes reading the entire file to count lines, which could be inefficient for large files
- The legacy file finder recursively traverses directories, which can be slow on large codebases
- Modern findFiles method offers better performance through the glob library
- Files are sorted by modification time, which requires additional stat calls