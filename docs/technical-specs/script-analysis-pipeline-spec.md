# Technical Specification: CLI Pipeline for Script Analysis and Document Type Classification

## Overview

This technical specification outlines the design and implementation of a CLI pipeline for processing and analyzing script files to identify, categorize, and track document types within a monorepo. The pipeline will automate the extraction, analysis, and storage of document type information from various script files, with a focus on categorizing them into predefined categories: "AI", "Integration", "Operations", and "Development".

## Goals

1. Create a robust CLI pipeline to analyze script files for document type definitions
2. Extract and categorize document types according to predefined categories
3. Generate structured reports of document types for documentation purposes
4. Update the Supabase database with document type information
5. Provide integration with the existing web application
6. Implement a consistent assessment methodology using the script-analysis-prompt

## Architecture

The pipeline will consist of several modular components that align with the existing CLI structure:

1. **File Scanner**: Identifies and collects script files for analysis
2. **Parser**: Extracts document type definitions from different file formats
3. **Analyzer**: Categorizes and validates document type information
4. **Reporter**: Generates structured reports in various formats
5. **Database Updater**: Synchronizes document type information with Supabase
6. **API Integration**: Provides endpoints for triggering the pipeline from the web application

## Component Specifications

### 1. File Scanner (src/services/file-service.ts)

**Purpose**: Locate and collect script files containing document type definitions.

**Implementation**:
- Use recursive directory traversal to find relevant files
- Support filtering by file extension, path patterns, and exclusion rules
- Handle large codebases efficiently with parallel processing

**Configuration Options**:
- Root directory path
- Include/exclude patterns
- File extension filters
- Depth limit for recursion

### 2. Parser (src/commands/documentation-processor.ts)

**Purpose**: Extract document type definitions from script files.

**Implementation**:
- Support multiple file formats (JavaScript, TypeScript, SQL, etc.)
- Use language-specific parsers for accurate extraction
- Implement a plugin architecture for extensibility

**Document Type Extraction**:
- Identify type definitions, interfaces, and schemas
- Extract metadata such as field names, types, and constraints
- Preserve documentation comments and annotations

### 3. Analyzer (src/commands/classify-markdown.ts)

**Purpose**: Process and categorize extracted document types into the predefined categories.

**Implementation**:
- Validate document type structures
- Categorize document types into "AI", "Integration", "Operations", and "Development"
- Identify relationships between document types
- Detect inconsistencies or potential issues

**Analysis Features**:
- Type validation
- Category assignment
- Relationship mapping
- Duplicate detection
- Consistency checking

### 4. Reporter (src/services/report-service.ts)

**Purpose**: Generate structured reports of document types.

**Implementation**:
- Support multiple output formats (JSON, Markdown, HTML)
- Create hierarchical documentation
- Include visualization capabilities

**Report Types**:
- Summary reports
- Detailed documentation
- Relationship diagrams
- Change reports (comparing to previous state)

### 5. Database Updater (src/services/supabase-service.ts)

**Purpose**: Synchronize document type information with Supabase.

**Implementation**:
- Use Supabase client for database operations
- Implement safe update strategies
- Support transaction-based updates

**Database Operations**:
- Insert new document types
- Update existing document types
- Track document type history
- Maintain relationships

### 6. API Integration (apps/dhg-improve-experts/src/app/api/docs-sync/route.ts)

**Purpose**: Provide endpoints for triggering the pipeline from the web application.

**Implementation**:
- Enhance existing API routes for pipeline operations
- Implement proper error handling and response formatting
- Support authentication and authorization

**API Endpoints**:
- `/api/docs-sync` - Trigger document synchronization
- Support for different actions (update, report, etc.)

## Database Schema

The pipeline will utilize the existing database schema defined in `supabase/script_tracking/scripts-table-sql.sql`:

### Key Tables:
- `scripts`: Stores metadata and assessments for script files
- `script_relationships`: Tracks relationships between scripts (duplicates, dependencies)

### Enums:
- `script_status`: ACTIVE, UPDATE_NEEDED, OBSOLETE, DUPLICATE, UNUSED
- `script_type`: UTILITY, DEPLOYMENT, DATABASE, BUILD, SETUP, OTHER
- `script_usage_status`: DIRECTLY_REFERENCED, INDIRECTLY_REFERENCED, NOT_REFERENCED

### Views:
- `active_scripts_view`: Shows active scripts with assessment data
- `script_duplicates_view`: Shows duplicate script relationships

## Document Type Categories

The pipeline will classify document types into the following categories:

1. **AI**: Document types related to AI/ML models, prompts, and configurations
2. **Integration**: Document types for external system integrations
3. **Operations**: Document types for operational tasks and infrastructure
4. **Development**: Document types for development tools and processes

## Script Analysis Prompt

The pipeline will use the `script-analysis-prompt.md` template to analyze scripts. This prompt instructs the AI to:

1. Analyze script content, purpose, and functionality
2. Determine the script's primary purpose
3. Assess quality, relevancy, and potential value
4. Check for package.json references
5. Detect potential duplicates
6. Generate appropriate tags
7. Recommend a status (ACTIVE, UPDATE_NEEDED, OBSOLETE, DUPLICATE, UNUSED)

The analysis will produce a structured JSON response that includes:
- Script metadata (file path, title, language, etc.)
- AI-generated summary and tags
- Quality assessment (code quality, maintainability, utility, documentation)
- Relevance scores and reasoning
- Status recommendation and confidence score

## Implementation Details

### CLI Structure

The pipeline will be implemented using the existing CLI structure:

```
cli/
├── src/
│   ├── commands/
│   │   ├── classify-markdown.ts
│   │   ├── documentation-processor.ts
│   │   ├── examine-markdown.ts
│   │   ├── index.ts
│   │   ├── validate-assets.ts
│   │   └── workflow.ts
│   ├── models/
│   │   ├── document-type.ts
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   └── relationship.ts
│   ├── services/
│   │   ├── claude-service.ts
│   │   ├── file-service.ts
│   │   ├── index.ts
│   │   ├── report-service.ts
│   │   └── supabase-service.ts
│   └── utils/
│       ├── config.ts
│       ├── error-handler.ts
│       └── logger.ts
```

### New Components to Implement:

1. **Script Scanner Command**: Add a new command to scan for script files
2. **Script Analyzer Command**: Add a command to analyze scripts using the prompt template
3. **Document Type Classifier**: Enhance the classifier to categorize into the specified categories
4. **Database Integration**: Update the Supabase service to work with the scripts table

### Shell Script Integration

The pipeline will be accessible through a custom update script and will leverage the existing `scripts/script-report.sh` for generating script reports in markdown format. This script-report.sh generates the script-report.md that contains valuable information about the scripts in the repository.

The custom update script will:
1. Scan the repository for script files
2. Process each script using the script-analysis-prompt
3. Categorize the scripts into document types
4. Update the Supabase database with the results

## Safety Measures

Following the established safety guidelines:

- All database operations will use targeted writes
- Schema changes will be properly validated
- Backup mechanisms will be implemented
- Rollback procedures will be documented

## Error Handling

The pipeline will implement comprehensive error handling:

- Detailed error messages
- Logging at appropriate levels
- Graceful failure modes
- Recovery procedures

## Integration with Web Application

The pipeline will integrate with the existing web application through:

1. API routes for triggering document synchronization
2. Shared database schema for document types
3. Common visualization components

### API Route Implementation

The existing `/api/docs-sync/route.ts` will be enhanced to:

- Support additional actions
- Provide more detailed progress information
- Implement better error handling
- Support authentication for secure operations

## Development Plan

1. **Phase 1**: Implement script scanning and parsing
   - Enhance file-service.ts to scan for script files
   - Update documentation-processor.ts to extract document types

2. **Phase 2**: Develop analyzer and classifier
   - Enhance classify-markdown.ts to categorize document types
   - Implement the script-analysis-prompt integration

3. **Phase 3**: Create database updater
   - Update supabase-service.ts to work with the scripts table
   - Implement safe update strategies

4. **Phase 4**: Enhance API integration
   - Update the docs-sync API route
   - Implement progress reporting

5. **Phase 5**: Add visualization and reporting
   - Enhance report-service.ts for script reports
   - Implement relationship visualization

## Testing Strategy

1. **Unit Tests**: For individual components
2. **Integration Tests**: For component interactions
3. **End-to-End Tests**: For complete pipeline operation
4. **Performance Tests**: For large codebases

## Deployment Considerations

- Scripts will be located in the `/scripts` directory
- Environment variables will be used for configuration
- No hardcoded secrets or credentials
- Proper permissions for script execution

## Monitoring and Maintenance

- Logging of all pipeline operations
- Performance metrics collection
- Regular validation of document type integrity
- Scheduled runs for keeping documentation up-to-date

## Conclusion

This CLI pipeline will provide a robust solution for managing document types across the codebase. By automating the extraction, analysis, and documentation of document types, it will improve developer productivity and ensure consistency in the application's data model. The integration with the script-analysis-prompt and the predefined document type categories will enable comprehensive classification and assessment of scripts throughout the monorepo. 