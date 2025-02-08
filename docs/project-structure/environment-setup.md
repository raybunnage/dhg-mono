# Environment Configuration Guide

## Overview
This guide explains how to set up environment variables for the DHG monorepo.

## Quick Start
1. Copy the example environment file:
```bash
# Run from root directory
cp .env.example .env
```

2. Edit the .env file with your values:
```plaintext
VITE_APP_TITLE=Your App Title
VITE_API_URL=Your API URL
```

## Environment Files

### Root Level
- `.env`: Main environment file (git-ignored)
- `.env.example`: Template file (committed to git)
- `.env.local`: Local overrides (git-ignored)

### App Level
Each app can have its own environment files:
```
apps/dhg-a/.env
apps/dhg-a/.env.local
apps/dhg-b/.env
apps/dhg-b/.env.local
```

## Variable Naming

### Vite Variables
- Must be prefixed with `VITE_`
- Accessible in code via `import.meta.env.VITE_*`
- Example: `VITE_API_URL`

### Build Variables
- Used in build scripts and configuration
- Example: `NODE_ENV`, `PORT`

## Best Practices

1. **Security**
   - Never commit .env files
   - Use .env.example as a template
   - Keep sensitive values secure

2. **Organization**
   - Group related variables
   - Use clear, descriptive names
   - Document purpose in comments

3. **App-Specific Variables**
   - Use app-level .env files for app-specific values
   - Use root .env for shared values

## Package Management

The .npmrc file configures pnpm behavior:

1. **Workspace Settings**
   - Shared lockfile
   - Strict peer dependencies
   - Workspace package preferences

2. **Version Control**
   - Exact versions for consistency
   - Engine strict mode
   - Peer dependency handling

3. **Registry Configuration**
   - Public registry settings
   - Authentication tokens
   - Scoped registry settings

## Common Tasks

### Adding New Variables
1. Add to .env.example with documentation
2. Update relevant .env files
3. Use in code with proper prefixing

### Updating Values
1. Edit your local .env file
2. Update .env.example if it's a structural change
3. Notify team of new requirements

### Deployment
1. Set variables in Netlify dashboard
2. Ensure all required variables are configured
3. Test in preview deployments 