# Migration Guide: Shell Scripts to TypeScript CLI

This document explains how to migrate from the existing shell-script based workflow to the new modular TypeScript CLI for AI workflows.

## What's New?

The new TypeScript CLI provides several advantages over the old shell script approach:

1. **Better organization**: Clear separation of concerns with dedicated services
2. **Type safety**: TypeScript provides compile-time checks for complex data structures
3. **Error handling**: Proper error propagation and recovery
4. **Testability**: Services can be tested independently
5. **Maintainability**: Easier to understand and modify
6. **Logging**: Comprehensive logging for debugging
7. **Extensibility**: New commands can be added easily

## Current Implementation

The current implementation is a Node.js script (`classify-markdowns.js`) that is called from a shell script (`classify-markdowns.sh`). This approach has several limitations:

- Complex error handling across shell/Node.js boundaries
- Debugging difficulties
- String escaping issues with template literals
- Maintainability concerns as functionality grows

## New Implementation

The new implementation is a modular TypeScript CLI application with the following components:

- **Commands**: `classify` and `validate` commands with proper argument parsing
- **Services**: Dedicated services for file operations, Supabase interactions, Claude API calls, and report generation
- **Models**: Type definitions for document types, prompts, and relationships
- **Utils**: Logging, error handling, and configuration utilities

## How to Use the New CLI

### Building the CLI

```bash
# Build the CLI
npm run cli:build
```

### Using the CLI

```bash
# Classify a markdown document
npm run cli:classify

# Or directly use the CLI
node scripts/cli/dist/index.js classify docs/markdown-report.md

# Validate assets for a prompt
node scripts/cli/dist/index.js validate --prompt markdown-document-classification-prompt
```

### Advanced Usage

```bash
# Enable verbose logging
node scripts/cli/dist/index.js classify docs/markdown-report.md --verbose

# Specify output location
node scripts/cli/dist/index.js classify docs/markdown-report.md -o reports/custom-report.md
```

## Compatibility

The existing `classify-markdowns.sh` script has been updated to use the new CLI if it's available, or fall back to the old implementation if not. This ensures a smooth transition period.

## Benefits Over Current Approach

1. **Modularity**: Clear separation of concerns with dedicated services
2. **Type Safety**: TypeScript provides compile-time checks for complex data structures
3. **Error Handling**: Proper error propagation and recovery
4. **Testability**: Services can be tested independently
5. **Maintainability**: Easier to understand and modify
6. **Logging**: Comprehensive logging for debugging
7. **Extensibility**: New commands can be added easily

## Future Work

- Add unit tests for all services
- Implement additional commands for other AI workflows
- Add more sophisticated error handling and recovery mechanisms
- Improve documentation and provide more examples