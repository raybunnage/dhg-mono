# AI Workflow CLI

A modular TypeScript CLI application designed to handle complex AI workflows, specifically for markdown document classification and processing.

## Features

- Markdown document classification using Claude 3 API
- Supabase integration for prompts and relationships
- Asset validation
- Comprehensive error handling and logging
- Modular architecture with clear separation of concerns

## Installation

```bash
# From the app directory
cd /path/to/dhg-mono/apps/dhg-improve-experts

# Install dependencies and build the CLI
pnpm run cli:build
```

## Usage

### Workflow Command (Main Command)

```bash
# Run the workflow that examines markdown files and their relationships
pnpm run cli:workflow
```

This command:
1. Reads the target markdown file
2. Queries Supabase for the prompt named "markdown-document-classification-prompt"
3. Gets the ID and content of the prompt
4. Queries for relationships using the prompt ID
5. Reads the content of each related asset file
6. Extracts the relationship context for each asset
7. Gets document types with category "Documentation"
8. When run with `--execute` flag:
   - Makes an API call to Claude with all assembled data
   - Parses the JSON response
   - Updates the documentation_files table with:
     - ai_assessment (JSONB field with the full response)
     - document_type_id (from the response)
     - summary (from the response)
     - ai_generated_tags (from key_topics/tags/keywords)
     - assessment_quality_score (from confidence)
     - assessment_created_at (timestamp)
     - assessment_updated_at (timestamp)
     - assessment_model (Claude model used)
     - assessment_version (version number)
   - Shows the updated documentation file record with all assessment information

### Classify Command (Full Process)

```bash
# Run the full classification process with Claude API
pnpm run cli:classify
```

### Examine Command

```bash
# Examine a markdown document and its relationships
pnpm run cli:examine
```

### Validate Assets

```bash
# Directly using the CLI
cd scripts/cli
node dist/index.js validate --prompt markdown-document-classification-prompt
```

## Project Structure

```
src/
├── commands/             # Command implementations
│   ├── classify-markdown.ts
│   ├── examine-markdown.ts
│   ├── validate-assets.ts
│   ├── workflow.ts       # Main workflow command
│   └── index.ts
├── services/             # Service implementations
│   ├── file-service.ts
│   ├── supabase-service.ts
│   ├── claude-service.ts
│   ├── report-service.ts
│   └── index.ts
├── models/               # Type definitions
│   ├── document-type.ts
│   ├── prompt.ts
│   ├── relationship.ts
│   └── index.ts
├── utils/                # Utility functions
│   ├── logger.ts
│   ├── error-handler.ts
│   └── config.ts
└── index.ts              # Entry point
```

## Environment Configuration

The CLI requires the following environment variables:

- `VITE_SUPABASE_URL`: The URL of your Supabase instance
- `VITE_SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

These are loaded from the `.env.development` file in the app directory.

## Claude API Response Format

The Claude API response follows a structured format that directly maps to the documentation_files table fields:

```json
{
  "document_type_id": "uuid-of-matched-document-type-from-document_types-list",
  "document_type": "Name of the document type EXACTLY as it appears in document_types list",
  "title": "Document title extracted from content",
  "summary": "Concise summary of document purpose and content",
  "ai_generated_tags": ["topic1", "topic2", "topic3"],
  "assessment_quality_score": 0.85,
  "classification_reasoning": "Detailed explanation for why this document type was chosen",
  "audience": "Target audience for this document",
  "quality_assessment": {
    "completeness": 4,
    "clarity": 4,
    "accuracy": 4,
    "overall": 4
  },
  "suggested_improvements": [
    "Improvement suggestion 1",
    "Improvement suggestion 2"
  ]
}
```

Note the direct field mapping to the database:
- `document_type_id`: Maps directly to documentation_files.document_type_id
- `title`: Maps directly to documentation_files.title
- `summary`: Maps directly to documentation_files.summary
- `ai_generated_tags`: Maps directly to documentation_files.ai_generated_tags
- `assessment_quality_score`: Maps directly to documentation_files.assessment_quality_score

### Document Type ID Matching

The system employs a multi-stage approach to ensure the correct document_type_id is set:

1. Claude is instructed to use the exact document_type_id from the document_types list provided
2. If Claude returns a valid document_type_id, it's verified against the list of available types
3. If no direct ID is provided, the system matches by document_type name:
   - Tries exact name match first (case-insensitive)
   - Falls back to partial matches if needed
   - Uses default first document type as last resort
4. The matched ID is added to the assessment JSON and set in the documentation_files record

This ensures reliable document type classification even when the model doesn't return an exact ID match.

## Monorepo Usage

See [PNPM-USAGE.md](./PNPM-USAGE.md) for details on how to use this CLI in a pnpm monorepo context.