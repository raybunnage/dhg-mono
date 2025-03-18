# Environment Variable Organization for DHG Monorepo

This document outlines how environment variables are organized within the DHG monorepo, with a specific focus on the shared CLI pipeline services.

## Directory Structure

```
/ (repository root)
├── .env                   # Base shared environment variables
├── .env.development       # Development overrides 
├── .env.production        # Production overrides
├── .env.local             # Local overrides (gitignored)
├── .env.local.example     # Template for local overrides
└── packages/
    └── cli/
        └── .env.example   # Example template showing required CLI variables
```

## Naming Conventions

Environment variables follow these prefix conventions:

- `CLI_*`: Variables needed by the CLI pipeline utilities
- `SHARED_*`: Variables shared across multiple apps
- `APP_*`: App-specific variables (in app-level .env files)
- `VITE_*`: Variables exposed to the frontend via Vite

## Variable Organization

### Root Level

The root `.env` file contains:
- All shared configuration values
- Default values for non-sensitive variables
- References to sensitive variables (populated in `.env.local`)

### Environment-Specific Overrides

- `.env.development`: Development-specific settings
- `.env.production`: Production-specific settings

### Local Secrets

`.env.local` contains sensitive information and secrets:
- API keys
- Service credentials
- Other secrets

This file is excluded from Git to prevent accidental credential exposure.

## CLI Pipeline Variables

The CLI pipeline requires these environment variables:

```
# CLI Configuration
CLI_ENVIRONMENT=development|production
CLI_LOG_LEVEL=debug|info|warn|error

# API Keys
CLI_CLAUDE_API_KEY=...
CLI_OPENAI_API_KEY=...
CLI_GOOGLE_API_KEY=...

# Supabase Connection
CLI_SUPABASE_URL=...
CLI_SUPABASE_KEY=...
```

## Variable Inheritance

To reduce duplication, the CLI variables reference the root variables where possible:

```
# In .env
ANTHROPIC_API_KEY=...
CLI_CLAUDE_API_KEY=${ANTHROPIC_API_KEY}
```

This ensures consistency across the application.

## Best Practices

1. Never commit secrets to the repository
2. Always use `.env.local` for sensitive information
3. Use descriptive prefixes to organize variables by service
4. Document required variables in `.env.example` files
5. Use variable references to avoid duplication

## Setup For New Developers

New developers should:

1. Copy `.env.local.example` to `.env.local`
2. Fill in the required secrets
3. Ensure `.env.local` is never committed to Git