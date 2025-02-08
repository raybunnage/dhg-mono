# Development and Deployment Workflow

## Local Development Flow

### 1. Initial Setup
```bash
# Run from root directory
pnpm install              # Install all dependencies
pnpm build               # Build all apps (runs turbo build)
```

### 2. Development
```bash
# Run from root directory
pnpm dev                 # Start development servers for all apps
# or for specific app
pnpm dev --filter dhg-a  # Start only dhg-a development server
```

### 3. Testing
```bash
# Run from root directory
pnpm test               # Run tests for all apps
# or for specific app
pnpm test --filter dhg-a
```

## Deployment Flow

### 1. Local Testing
```bash
# Run from root directory
pnpm build              # Build all apps
pnpm preview           # Preview built apps locally
```

### 2. Netlify Preview Deploy
```bash
# Run from app directory (cd apps/dhg-a)
netlify deploy          # Deploy to preview URL
```

### 3. Production Deploy
```bash
# Run from app directory (cd apps/dhg-a)
netlify deploy --prod   # Deploy to production URL
```

## What Each Command Does

### Build Commands
- `pnpm install`
  - Installs all dependencies
  - Creates node_modules in root and apps
  - Uses shared lockfile for consistency

- `pnpm build`
  - Runs Turbo build pipeline
  - Builds all apps in parallel
  - Creates production-ready assets in dist/
  - Generates sourcemaps if configured

### Development Commands
- `pnpm dev`
  - Starts Vite dev servers
  - Enables hot module replacement
  - dhg-a runs on port 5173
  - dhg-b runs on port 5174
  - Watches for file changes

- `pnpm preview`
  - Serves built production files
  - dhg-a preview on port 4173
  - dhg-b preview on port 4174
  - Tests production build locally

### Netlify Commands
- `netlify deploy`
  - Creates preview deployment
  - Generates unique preview URL
  - No impact on production
  - Great for testing/sharing

- `netlify deploy --prod`
  - Deploys to production URL
  - Updates live site
  - Generates permanent URL
  - Creates deployment record

## Environment Stages

### Development (Local)
- Uses Vite dev server
- Hot module replacement
- Source maps enabled
- Development environment variables

### Preview (Netlify Draft)
- Production build
- Temporary URL
- Testing environment
- Preview environment variables

### Production (Netlify Production)
- Production build
- Live site URL
- Production environment
- Production environment variables

## Common Workflows

### Feature Development
```bash
# 1. Start development
pnpm dev --filter dhg-a

# 2. Make changes and test locally

# 3. Build and preview
pnpm build --filter dhg-a
pnpm preview --filter dhg-a

# 4. Deploy preview
cd apps/dhg-a
netlify deploy

# 5. If approved, deploy to production
netlify deploy --prod
```

### Full Site Update
```bash
# 1. Build all apps
pnpm build

# 2. Preview locally
pnpm preview

# 3. Deploy previews
cd apps/dhg-a && netlify deploy
cd ../dhg-b && netlify deploy

# 4. If approved, deploy production
cd ../dhg-a && netlify deploy --prod
cd ../dhg-b && netlify deploy --prod
```

## Best Practices

1. **Always Test Locally First**
   - Use `pnpm build` and `pnpm preview`
   - Check all features work
   - Verify environment variables

2. **Use Preview Deployments**
   - Deploy to preview URL first
   - Share with team for review
   - Test on different devices

3. **Production Deployments**
   - Deploy during low-traffic periods
   - Have rollback plan ready
   - Monitor deployment success

4. **Environment Variables**
   - Verify correct variables set
   - Check Netlify environment settings
   - Use different values per environment

## Troubleshooting

### Build Issues
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Debug specific app
pnpm build --filter dhg-a --debug
```

### Deployment Issues
```bash
# Check Netlify status
netlify status

# View deploy logs
netlify deploy --debug
```

### Additional Testing Dependencies
```bash
# Run from root directory
pnpm add -D @testing-library/dom @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom vitest --filter dhg-a 