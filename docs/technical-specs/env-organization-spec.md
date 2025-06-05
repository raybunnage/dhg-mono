Environment Variable Organization for CLI Pipeline Services
Overview
This specification outlines the organization and management of environment variables for the DHG monorepo, specifically focusing on centralizing secrets and API keys required by the shared CLI pipeline services.
Goals
Centralize environment variables needed by shared CLI services
Maintain clear separation between shared and app-specific variables
Establish consistent naming conventions
Provide clear documentation for required variables
Ensure secure handling of secrets
Directory Structure

/
├── .env                  # Base shared environment variables
├── .env.development     # Development overrides
├── .env.production      # Production overrides
├── .env.local          # Local overrides (gitignored)
└── packages/
    └── cli/
        └── .env.example  # Example template showing required variables


Shared Services: SHARED_
App-Specific: APP_
Examples

# CLI Pipeline Services
CLI_OPENAI_API_KEY=
CLI_GOOGLE_API_KEY=
CLI_CLAUDE_API_KEY=
CLI_SUPABASE_URL=
CLI_SUPABASE_KEY=

# Shared Services
SHARED_DATABASE_URL=
SHARED_REDIS_URL=

# App-Specific (in app .env files)
APP_PORT=
APP_NAME=

Implementation Details
1. Root Level Configuration
The root .env file should contain:
All shared service configurations
Default values for non-sensitive variables
References to required secret variables
Example:

# CLI Pipeline Configuration
CLI_ENVIRONMENT=development
CLI_LOG_LEVEL=info

# Required Secrets (populated in .env.local)
CLI_OPENAI_API_KEY=
CLI_CLAUDE_API_KEY=

2. Example Template
The packages/cli/.env.example file should:
List all required variables
Include descriptions and example values
Document any specific requirements or formats
Example:
.env
.env.*
!.env.example

const apiKey = process.env.CLI_OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('CLI_OPENAI_API_KEY is required');
}

Local Development
Developers should:
Copy .env.example to .env.local
Fill in required secrets
Never commit .env.local
Security Considerations
Never commit actual secrets to the repository
Use appropriate access controls for production secrets
Rotate secrets regularly
Monitor for accidental secret commits
Migration Plan
Phase 1: Setup
Create root level .env files
Add .env.example to packages/cli
Update .gitignore
Phase 2: Migration
Move shared secrets from apps to root
Update CLI services to use new variables
Update documentation
Phase 3: Cleanup
Remove duplicate variables from apps
Verify all services working
Archive old configurations
Monitoring and Maintenance
Regular audit of environment variables
Clean up unused variables
Update documentation as needed
Review security practices
Conclusion
This organization provides a clear, secure, and maintainable way to manage environment variables across the monorepo, with special consideration for shared CLI pipeline services.
The centralized approach ensures consistency while maintaining flexibility for individual apps to override when needed.

# Environment Variable Organization Specification

## Overview
This document outlines the organization and management of environment variables across the monorepo, with focus on CLI pipeline services.

## Structure

### 1. Root Level Environment Files
- `.env` - Base configuration
- `.env.development` - Development overrides
- `.env.production` - Production settings
- `.env.local` - Local overrides (gitignored)

### 2. Example Template
The `packages/cli/.env.example` file should:
- List all required variables
- Include descriptions and example values
- Document specific requirements/formats

Example:
