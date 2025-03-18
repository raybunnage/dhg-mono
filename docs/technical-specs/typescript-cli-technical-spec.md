# Technical Specification: Modular TypeScript CLI for AI Workflows

## Overview

This document outlines the technical specification for a modular TypeScript CLI application designed to handle complex AI workflows, specifically for markdown document classification and processing. The application will replace the current approach of embedding Node.js code within shell scripts, providing better organization, error handling, and maintainability.

## Problem Statement

The current implementation uses shell scripts with embedded Node.js code to:
1. Read markdown files from disk
2. Query Supabase for prompts and relationships
3. Process related assets
4. Retrieve document types
5. Make AI API calls to Claude
6. Generate reports

This approach has encountered challenges with:
- Complex error handling across shell/Node.js boundaries
- Debugging difficulties
- String escaping issues with template literals
- Maintainability concerns as functionality grows

## Proposed Solution

A modular TypeScript CLI application with clear separation of concerns, proper error handling, and comprehensive logging.

### Project Structure

```
scripts/cli/
├── src/
│   ├── commands/
│   │   ├── classify-markdown.ts       # Main command for markdown classification
│   │   ├── validate-assets.ts         # Command to validate required assets
│   │   └── index.ts                   # Command registration
│   ├── services/
│   │   ├── file-service.ts            # File reading/writing operations
│   │   ├── supabase-service.ts        # Database operations
│   │   ├── claude-service.ts          # AI API calls
│   │   └── report-service.ts          # Report generation
│   ├── models/
│   │   ├── document-type.ts           # Document type interfaces
│   │   ├── prompt.ts                  # Prompt interfaces
│   │   ├── relationship.ts            # Relationship interfaces
│   │   └── index.ts                   # Type exports
│   ├── utils/
│   │   ├── logger.ts                  # Logging utilities
│   │   ├── error-handler.ts           # Error handling utilities
│   │   └── config.ts                  # Configuration management
│   └── index.ts                       # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Core Components

#### 1. Command-Line Interface

Uses Commander.js to provide a user-friendly CLI:

```typescript
// index.ts
import { Command } from 'commander';
import commands from './commands';

const program = new Command();

program
  .version('1.0.0')
  .description('AI workflow tools for document processing');

// Register all commands
commands.forEach(cmd => cmd(program));

program.parse();
```

#### 2. File Service

Handles all file system operations:

```typescript
// file-service.ts
export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
  stats?: {
    size: number;
    modified: Date;
    lines: number;
  };
}

export class FileService {
  readFile(path: string): FileResult;
  writeFile(path: string, content: string): FileResult;
  ensureDirectoryExists(path: string): boolean;
  getFileStats(path: string): FileResult['stats'];
}
```

#### 3. Supabase Service

Manages all database operations:

```typescript
// supabase-service.ts
export class SupabaseService {
  constructor(url: string, key: string);
  
  getPromptByName(name: string): Promise<Prompt | null>;
  getRelationshipsByPromptId(promptId: string): Promise<Relationship[]>;
  getDocumentTypesByCategory(category: string): Promise<DocumentType[]>;
  getDocumentTypeById(id: string): Promise<DocumentType | null>;
}
```

#### 4. Claude Service

Handles AI API interactions:

```typescript
// claude-service.ts
export interface ClaudeRequest {
  messages: Message[];
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export class ClaudeService {
  constructor(apiKey: string);
  
  callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse>;
  classifyDocument(document: string, prompt: string, context: string): Promise<ClaudeResponse>;
}
```

#### 5. Report Service

Generates markdown reports:

```typescript
// report-service.ts
export interface ReportSection {
  title: string;
  content: string;
  level: number;
}

export class ReportService {
  constructor(templatePath?: string);
  
  addSection(section: ReportSection): void;
  generateReport(): string;
  writeReportToFile(path: string): FileResult;
}
```

#### 6. Logger

Provides consistent logging across the application:

```typescript
// logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  static level: LogLevel;
  
  static debug(message: string, data?: any): void;
  static info(message: string, data?: any): void;
  static warn(message: string, data?: any): void;
  static error(message: string, data?: any): void;
}
```

### Main Workflow Implementation

The main classify-markdown command will orchestrate the services:

```typescript
// classify-markdown.ts
export const classifyMarkdown = async (filePath: string, options: any) => {
  const logger = new Logger(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  
  try {
    logger.info(`Starting classification of ${filePath}`);
    
    // 1. Initialize services
    const fileService = new FileService();
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    const claudeService = new ClaudeService(config.anthropicApiKey);
    const reportService = new ReportService();
    
    // 2. Read target file
    logger.debug(`Reading target file: ${filePath}`);
    const fileResult = fileService.readFile(filePath);
    if (!fileResult.success) {
      throw new Error(`Failed to read file: ${fileResult.error}`);
    }
    
    // 3. Get classification prompt
    logger.debug('Retrieving classification prompt');
    const prompt = await supabaseService.getPromptByName('markdown-document-classification-prompt');
    if (!prompt) {
      throw new Error('Classification prompt not found');
    }
    
    // 4. Get related assets
    logger.debug(`Finding related assets for prompt: ${prompt.id}`);
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    // 5. Process related assets
    const relatedAssets = await Promise.all(
      relationships.map(async (rel) => {
        const assetContent = fileService.readFile(rel.asset_path);
        const documentType = rel.document_type_id 
          ? await supabaseService.getDocumentTypeById(rel.document_type_id)
          : null;
          
        return {
          relationship: rel,
          content: assetContent.success ? assetContent.content : null,
          documentType,
          success: assetContent.success,
          error: assetContent.error
        };
      })
    );
    
    // 6. Get document types
    logger.debug('Retrieving document types');
    const documentTypes = await supabaseService.getDocumentTypesByCategory('Documentation');
    
    // 7. Prepare context for AI
    const context = prepareContext(documentTypes, relatedAssets);
    
    // 8. Call Claude API
    logger.info('Calling Claude API for classification');
    const claudeResponse = await claudeService.classifyDocument(
      fileResult.content,
      prompt.content,
      context
    );
    
    // 9. Generate report
    logger.debug('Generating classification report');
    const outputPath = options.output || 'docs/markdown-classification-report.md';
    
    // Add report sections
    reportService.addSection({
      title: 'Markdown Classification Report',
      content: `Generated: ${new Date().toLocaleString()}`,
      level: 1
    });
    
    // Add more sections...
    
    // Write report
    const reportResult = reportService.writeReportToFile(outputPath);
    
    if (reportResult.success) {
      logger.info(`Classification complete. Report saved to: ${outputPath}`);
    } else {
      logger.error(`Failed to write report: ${reportResult.error}`);
    }
    
  } catch (error) {
    logger.error(`Classification failed: ${error.message}`);
    process.exit(1);
  }
};
```

## Implementation Plan

### Phase 1: Project Setup and Core Services

1. Initialize TypeScript project with necessary dependencies
2. Implement Logger and basic error handling
3. Implement FileService with comprehensive testing
4. Implement SupabaseService with proper error handling
5. Implement basic CLI structure with Commander.js

### Phase 2: AI Integration and Command Implementation

1. Implement ClaudeService for AI API interactions
2. Implement ReportService for generating markdown reports
3. Develop the classify-markdown command
4. Add comprehensive logging throughout the workflow
5. Implement proper error handling and recovery

### Phase 3: Testing and Refinement

1. Develop unit tests for all services
2. Create integration tests for the main workflow
3. Implement validation command for prerequisites
4. Add configuration management for different environments
5. Create documentation and usage examples

## Dependencies

- TypeScript: For type safety and modern JavaScript features
- ts-node: For running TypeScript directly
- Commander.js: For CLI argument parsing
- @supabase/supabase-js: For database interactions
- dotenv: For environment variable management
- axios: For HTTP requests to Claude API
- winston: For advanced logging (optional)

## Configuration

The application will use environment variables for configuration, with a fallback to a config file:

```typescript
// config.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Try to load from app-specific location if exists
const appEnvPath = path.resolve(process.cwd(), 'apps/dhg-improve-experts/.env.development');
if (fs.existsSync(appEnvPath)) {
  dotenv.config({ path: appEnvPath });
}

export default {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: process.env.VITE_ANTHROPIC_API_KEY,
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultOutputDir: process.env.OUTPUT_DIR || 'docs'
};
```

## Usage Examples

### Basic Usage

```bash
# Classify a markdown file
npx ts-node src/index.js classify docs/markdown-report.md

# Classify with custom output location
npx ts-node src/index.js classify docs/markdown-report.md -o reports/classification.md

# Run with verbose logging
npx ts-node src/index.js classify docs/markdown-report.md --verbose
```

### Integration with npm scripts

Add to package.json:

```json
"scripts": {
  "classify": "ts-node src/index.js classify",
  "validate": "ts-node src/index.js validate",
  "build": "tsc",
  "test": "jest"
}
```

Then use:

```bash
npm run classify -- docs/markdown-report.md
```

## Benefits Over Current Approach

1. **Modularity**: Clear separation of concerns with dedicated services
2. **Type Safety**: TypeScript provides compile-time checks for complex data structures
3. **Error Handling**: Proper error propagation and recovery
4. **Testability**: Services can be tested independently
5. **Maintainability**: Easier to understand and modify
6. **Logging**: Comprehensive logging for debugging
7. **Extensibility**: New commands can be added easily

## Conclusion

This modular TypeScript CLI approach provides a robust foundation for implementing complex AI workflows. By separating concerns into dedicated services and using TypeScript for type safety, the application will be easier to maintain, debug, and extend as requirements evolve.

The implementation follows software engineering best practices while providing the flexibility needed for AI-powered document processing workflows. 