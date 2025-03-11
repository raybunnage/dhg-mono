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
   - Updates the assessment fields in the database record
   - Shows the updated document with assessment information

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

## Monorepo Usage

See [PNPM-USAGE.md](./PNPM-USAGE.md) for details on how to use this CLI in a pnpm monorepo context.