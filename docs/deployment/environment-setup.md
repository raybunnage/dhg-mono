# Environment Setup and Deployment

## Initial Setup

1. **Initialize Environments**
```bash
# Setup environments for dhg-a
pnpm deploy:init dhg-a

# Setup environments for dhg-b
pnpm deploy:init dhg-b
```

2. **Configure Branch Deployments**
- Go to Netlify UI
- Enable branch deployments
- Link branches:
  - `main` → Production
  - `development` → Development
  - `feature/*` → Deploy previews

## Environment Files

### Root Level
`.env.example` - Template for environment variables
```env
VITE_APP_NAME=DHG Hub
VITE_API_URL=https://api.dhg-hub.org
```

### App Level
`apps/dhg-a/.env.development`
```env
VITE_APP_NAME="DHG Hub (Dev)"
VITE_API_URL=https://dev-api.dhg-hub.org
```

`apps/dhg-a/.env.production`
```env
VITE_APP_NAME="DHG Hub"
VITE_API_URL=https://api.dhg-hub.org
```

## Deployment Commands

### Development Deployments
```bash
# Deploy dhg-a to development
pnpm deploy:dhg-a:dev

# Deploy dhg-b to development
pnpm deploy:dhg-b:dev
```

### Production Deployments
```bash
# Deploy dhg-a to production
pnpm deploy:dhg-a:prod

# Deploy dhg-b to production
pnpm deploy:dhg-b:prod
```

### Environment Backups
```bash
# Backup dhg-a environments
pnpm deploy:backup dhg-a

# Backup dhg-b environments
pnpm deploy:backup dhg-b
```

## Version Requirements

- Node.js: v18 (LTS)
- PNPM: v8.15.1

These versions are specified in the root `netlify.toml` and ensure consistent builds across all environments.

## Environment Variables

Variables are loaded in this order:
1. Root `.env`
2. App-specific `.env`
3. Environment-specific `.env.[environment]`
4. Netlify environment variables

## Best Practices

1. **Always backup before changes**
```bash
pnpm deploy:backup dhg-a
```

2. **Test in development first**
```bash
pnpm deploy:dhg-a:dev
# Verify changes at dev.dhg-hub.org
```

3. **Use preview deployments for features**
```bash
git checkout -b feature/new-feature
# Make changes
git push origin feature/new-feature
# Netlify will create a preview deployment
```

4. **Production deployments**
```bash
# After testing in development
git checkout main
git merge development
pnpm deploy:dhg-a:prod
``` 