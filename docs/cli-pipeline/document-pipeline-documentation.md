# Document Pipeline System Documentation

## Purpose
This document provides comprehensive documentation for the document pipeline system used in our monorepo's CLI pipeline, focusing specifically on the relationship between `document-pipeline-main.sh` and `document-pipeline-manager.sh`.

## 1. Service Overview

The document pipeline system is a set of Bash scripts that manage documentation files within our monorepo structure. It provides functionality to synchronize, discover, classify, and generate reports about documentation files stored in a Supabase database. 

The system is designed around a modular architecture:
- `document-pipeline-main.sh`: Acts as a command router and user interface
- `document-pipeline-manager.sh`: Contains the core implementation of all operations
- `classify-document-with-prompt.sh`: Specialized script for AI-powered document classification

This architecture allows for easier maintenance and separation of concerns, making it more maintainable and extensible.

## 2. Dependencies

### External Services
- **Supabase**: For database storage and querying
- **Claude/Anthropic API**: For AI-powered document classification

### Required Tools
- Bash
- Node.js
- npm
- ts-node (for TypeScript execution)

### Library Dependencies
- @supabase/supabase-js: For Supabase database interactions
- @anthropic-ai/sdk: For Claude API communication (used in classification)

### Scripts
- `document-pipeline-main.sh`: Main entry point and command router
- `document-pipeline-manager.sh`: Contains core implementation functions
- `classify-document-with-prompt.sh`: Specialized script for document classification
- `supabase-connect.js`: Helper for managing Supabase connections

## 3. Invocation Pattern

The system is primarily invoked through the `document-pipeline-main.sh` script with command options:

```bash
scripts/cli-pipeline/document-pipeline-main.sh [option] [count]
```

Where `[option]` is one of:
- `sync`: Synchronize database with files on disk
- `find-new`: Find and insert new files into the database
- `show-untyped`: Show all untyped documentation files
- `show-recent`: Show recent files
- `classify-recent [n]`: Classify recent files (default: 20)
- `classify-untyped [n]`: Classify untyped files (default: 10)
- `clean-script-results`: Clean script-analysis-results from database
- `generate-summary [n] [i]`: Generate summary report
- `all`: Run complete pipeline (sync, find-new, classify-recent)
- `help`: Show help message

## 4. Input/Output

### Inputs
- **Command line arguments**:
  - Option/command to execute
  - Count parameter (for classification and summary commands)
  - Include deleted flag (for summary command)

- **Environment variables**:
  - `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY`: Required for classification commands
  - `SUPABASE_URL`: URL of the Supabase instance
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for database access
  - `NODE_ENV`: Environment setting (defaults to "development")

- **File system**:
  - Documentation files on disk to process
  - `.env.development` and `.env.local` files for environment variables

### Outputs
- **Console output**: Progress and status messages
- **Database changes**: Creation, update, and deletion of records
- **Log files**: Written to `document-analysis-results/document-pipeline-*.log`
- **Report files**: Generated summaries saved to `document-analysis-results/document-summary-*.md`

## 5. Key Functions

### In document-pipeline-main.sh
- `show_help()`: Displays usage information
- Main case statement: Routes commands to appropriate functions in the manager script

### In document-pipeline-manager.sh
- `sync_files()`: Synchronizes database with files on disk, updating metadata and removing deleted files
- `find_new_files()`: Discovers and adds new document files to the database
- `show_untyped_files()`: Displays files without assigned document types
- `show_recent_files()`: Shows recently updated files
- `classify_recent_files()`: Classifies recent documents using Claude API
- `classify_untyped_files()`: Classifies documents that have no assigned document type
- `clean_script_results()`: Removes script analysis results from the database
- `generate_summary()`: Creates a markdown report of document statistics
- `run_complete_pipeline()`: Runs the main pipeline steps in sequence

## 6. Error Handling

The script implements several error handling strategies:

1. **Function-level error codes**: Each function returns success (0) or failure (non-zero) status
2. **Exit code propagation**: Main script propagates error codes from functions
3. **Explicit error messages**: Descriptive error messages with emojis (✅, ❌, ⚠️)
4. **Environment validation**: Checks for required environment variables before executing operations
5. **Dependency checks**: Validates presence of required scripts and tools
6. **Database error handling**: Captures and reports Supabase errors
7. **File system checks**: Validates file existence before operations
8. **Try-catch blocks**: JavaScript components use try-catch for error management

## 7. Code Quality Assessment

### Strengths
- **Modular design**: Clear separation between interface (main) and implementation (manager)
- **Comprehensive logging**: Good visibility into operations with timestamped logs
- **Consistent error handling**: Uniform approach to error reporting and exit codes
- **Parameter validation**: Input validation for user-provided parameters
- **Good documentation**: Clear comments and descriptive function names
- **Environment flexibility**: Supports multiple environment variable sources
- **Batch processing**: Efficient batch operations for better performance

### Areas for Improvement
- **Duplicate code**: Some redundancy in API key handling across functions
- **Hard-coded paths**: Some paths are hardcoded rather than configurable
- **Mixed languages**: Combines Bash and JavaScript with embedded scripts
- **Limited testing**: No apparent automated testing
- **Limited configurability**: Some behavior is not configurable without code changes
- **Some legacy code**: References to is_deleted field which appears to be deprecated

## 8. Improvement Opportunities

1. **Extract common utilities**:
   - Create a separate file for common functions (e.g., API key validation, Supabase connection)
   - Refactor duplicate code in classification functions

2. **Enhance configurability**:
   - Move hardcoded values to a configuration file
   - Support configuration via command-line arguments

3. **Improve JavaScript integration**:
   - Move embedded JavaScript to separate files
   - Use TypeScript consistently for better type safety

4. **Add testing**:
   - Create unit tests for critical functions
   - Implement integration tests for the pipeline

5. **Modernize architecture**:
   - Replace embedded scripts with TypeScript modules
   - Implement a plugin system for extensibility

6. **Performance optimizations**:
   - Parallelize operations where possible
   - Cache database results to reduce queries

## 9. Usage Examples

### Example 1: Running the complete pipeline
```bash
# Set required environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export CLAUDE_API_KEY="your-claude-api-key"

# Run the complete pipeline
scripts/cli-pipeline/document-pipeline-main.sh all
```

### Example 2: Classifying untyped documents
```bash
# Classify up to 15 untyped documents
scripts/cli-pipeline/document-pipeline-main.sh classify-untyped 15
```

### Example 3: Generating a summary report
```bash
# Generate a summary of all documents
scripts/cli-pipeline/document-pipeline-main.sh generate-summary all false
```

## 10. Integration Points

The document pipeline integrates with several other systems in the monorepo:

1. **Supabase Database**:
   - Stores document metadata, content hashes, and classification information
   - Maintains relationships between documents and document types

2. **Claude/Anthropic API**:
   - Provides AI-based document classification
   - Uses specialized prompts to determine document types

3. **Filesystem**:
   - Scans for document files (.md, .txt, .pdf, etc.)
   - Tracks file changes through hash comparison

4. **CLI Pipeline Architecture**:
   - Follows similar patterns to other pipeline scripts (e.g., script-pipeline-main.sh)
   - Shares common utilities and approaches

## Process Flow Diagram

```
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────┐
│                 │     │                       │     │                 │
│ User invokes    │────▶│ document-pipeline-    │────▶│ document-       │
│ command         │     │ main.sh routes        │     │ pipeline-       │
│                 │     │ command               │     │ manager.sh      │
└─────────────────┘     └───────────────────────┘     └────────┬────────┘
                                                               │
                                                               ▼
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────┐
│                 │     │                       │     │                 │
│ Results         │◀────│ Temporary JS scripts  │◀────│ Function        │
│ returned to     │     │ execute specific      │     │ executes        │
│ user            │     │ operations            │     │ operations      │
└─────────────────┘     └───────────────────────┘     └─────────────────┘
```

## Component Architecture

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│                  document-pipeline-main.sh                │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Environment │  │ Command     │  │ Help/Usage        │  │
│  │ Setup       │  │ Routing     │  │ Information       │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
│                                                           │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                                                           │
│                document-pipeline-manager.sh               │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ Sync        │  │ Find/Show   │  │ Classification    │  │
│  │ Functions   │  │ Functions   │  │ Functions         │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐                         │
│  │ Reporting   │  │ Pipeline    │                         │
│  │ Functions   │  │ Functions   │                         │
│  └─────────────┘  └─────────────┘                         │
│                                                           │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                  External Dependencies                     │
│                                                            │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│   │ Supabase     │   │ Claude API   │   │ Node.js      │   │
│   │ Database     │   │              │   │ Runtime      │   │
│   └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Conclusion

The document pipeline system provides a comprehensive solution for managing documentation files across the monorepo. It follows good practices in terms of modularity and error handling, though there are opportunities for further improvement in code organization and testing. The system successfully integrates with Supabase for storage and Claude API for intelligent document classification, making it a valuable tool for documentation management.