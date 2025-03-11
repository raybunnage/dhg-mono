# Using the AI Workflow CLI with PNPM in a Monorepo

This document explains how to use the AI Workflow CLI in a pnpm monorepo context.

## Prerequisites

- pnpm installed globally
- Access to the .env.development file with Supabase and Anthropic credentials

## Build and Run

### Building the CLI

```bash
# From the app directory (dhg-mono/apps/dhg-improve-experts)
pnpm run cli:build
```

Or from the monorepo root:

```bash
# From the monorepo root
pnpm --filter dhg-improve-experts run cli:build
```

Note: The CLI itself uses npm internally for its dependencies to avoid PNPM workspace conflicts, but the main app commands are called using PNPM.

### Running the Workflow

To run the workflow with real credentials:

```bash
# From the app directory
pnpm run cli:workflow
```

Or from the monorepo root:

```bash
# From the monorepo root
pnpm --filter dhg-improve-experts run cli:workflow
```

## Workflow Steps

When you run the workflow, it performs these steps:

1. Reads the target markdown file (defaults to docs/markdown-report.md)
2. Queries Supabase for the prompt named "markdown-document-classification-prompt"
3. Gets the ID and content of the prompt
4. Queries Supabase for relationships associated with this prompt
5. Tries to read the content of each related asset file
6. Extracts the relationship context for each asset

## Other Available Commands

The CLI offers other useful commands:

```bash
# Classify a markdown document with AI (full process)
pnpm --filter dhg-improve-experts run cli:classify

# Examine a markdown document and its relationships
pnpm --filter dhg-improve-experts run cli:examine
```

## Environment Configuration

The CLI looks for the .env.development file in these locations:

1. Current directory
2. App directory (dhg-mono/apps/dhg-improve-experts)
3. Fallback to absolute path

The .env.development file should contain:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

## Troubleshooting

If you encounter issues:

1. Check that the .env.development file exists and contains all required variables
2. Ensure the CLI is built with `pnpm run cli:build`
3. Make sure you're running the command from the correct directory
4. Check that pnpm is using the right workspace configuration