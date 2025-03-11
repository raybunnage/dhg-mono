# AI Workflow CLI

A modular TypeScript CLI application designed to handle complex AI workflows, specifically for markdown document classification and processing.

## Features

- Markdown document classification using Claude 3 API
- Asset validation for prompt relationships
- Comprehensive error handling and logging
- Modular architecture with clear separation of concerns

## Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Link the CLI for local development
npm link
```

## Usage

### Classify a Markdown Document

```bash
# Basic usage
ai-workflow classify docs/markdown-report.md

# Specify output location
ai-workflow classify docs/markdown-report.md -o reports/classification.md

# Enable verbose logging
ai-workflow classify docs/markdown-report.md --verbose
```

### Validate Assets

```bash
# Validate assets for a specific prompt
ai-workflow validate --prompt markdown-document-classification-prompt

# Enable verbose logging
ai-workflow validate --prompt markdown-document-classification-prompt --verbose
```

## Environment Variables

The application requires the following environment variables:

- `VITE_SUPABASE_URL`: The URL of your Supabase instance
- `VITE_SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `VITE_ANTHROPIC_API_KEY`: Your Anthropic API key for Claude

Optional environment variables:

- `LOG_LEVEL`: The log level (debug, info, warn, error)
- `OUTPUT_DIR`: The default output directory for reports

## Project Structure

```
src/
├── commands/             # Command implementations
│   ├── classify-markdown.ts
│   ├── validate-assets.ts
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

## Development

To add a new command:

1. Create a new file in the `src/commands` directory
2. Implement the command function and registration function
3. Import and register the command in `src/commands/index.ts`

To add a new service:

1. Create a new file in the `src/services` directory
2. Implement the service class
3. Export the service in `src/services/index.ts`