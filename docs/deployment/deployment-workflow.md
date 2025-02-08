# Development and Deployment Workflow

## Branch Structure
- `main` → Production branch (dhg-hub.org)
- `development` → Development branch (dev.dhg-hub.org)
- `feature/*` → Feature branches (feature-name--dhg-hub.netlify.app)

## Local Development Flow

### 1. Initial Setup
```bash
# Run from root directory
git checkout main
pnpm install              # Install all dependencies
pnpm build               # Build all apps
```

### 2. Feature Development
```bash
# Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/new-feature

# Start development
pnpm dev --filter dhg-a  # Start development server
```

### 3. Merging Features
```bash
# After PR is approved, merge feature to development
git checkout development
git pull origin development
git merge feature/new-feature

# Clean and rebuild to ensure new features are properly integrated
pnpm clean              # Clean all build artifacts
pnpm install           # Reinstall dependencies
pnpm build            # Rebuild all apps

# Deploy to development
pnpm deploy:dhg-a:dev

# After testing in development, merge to main
git checkout main
git pull origin main
git merge development

# Clean and rebuild again before production deployment
pnpm clean
pnpm install
pnpm build

# Deploy to production
pnpm deploy:dhg-a:prod
```

### Important Notes
- Always clean and rebuild after merges
- Test the build locally before deploying
- Verify new features in development before merging to main
- Use --filter flag for app-specific operations

## Deployment Flow

### 1. Feature Branch Deployment
```bash
# Commit your changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Deploy feature branch to Netlify
cd apps/dhg-a
netlify deploy

# Preview URL will be: feature-name--dhg-hub.netlify.app
```

### 2. Development Branch Deployment
```bash
# After feature is approved, merge to development
git checkout development
git pull origin development
git merge feature/new-feature
git push origin development

# Deploy development branch
cd apps/dhg-a
netlify deploy

# Development URL: dev.dhg-hub.org
```

### 3. Production Deployment
```bash
# After thorough testing on development
git checkout main
git pull origin main
git merge development
git push origin main

# Deploy to production
cd apps/dhg-a
netlify deploy --prod

# Production URL: dhg-hub.org
```

## Environment Stages

### Feature Branch (feature-name--dhg-hub.netlify.app)
- For testing new features
- Temporary deployments
- Development environment variables
- Accessible to team for review

### Development (dev.dhg-hub.org)
- Integration environment
- Latest merged features
- Development environment variables
- Staging for production

### Production (dhg-hub.org)
- Stable production site
- Production environment variables
- Public-facing site

## Common Workflows

### Starting New Feature
```bash
git checkout development
git pull origin development
git checkout -b feature/my-feature
# Make changes...
pnpm test:run --filter dhg-a
pnpm build --filter dhg-a
cd apps/dhg-a && netlify deploy
```

### Merging Feature to Development
```bash
# After feature is tested and approved
git checkout development
git pull origin development
git merge feature/my-feature
git push origin development
cd apps/dhg-a && netlify deploy
```

### Promoting to Production
```bash
# After development is stable
git checkout main
git pull origin main
git merge development
git push origin main
cd apps/dhg-a && netlify deploy --prod
```

## Best Practices

1. **Branch Management**
   - Always branch from development
   - Keep feature branches short-lived
   - Delete feature branches after merge

2. **Testing**
   - Test locally first
   - Deploy to feature branch
   - Test on development
   - Final test before production

3. **Deployments**
   - Use feature branch deployments for review
   - Keep development site stable
   - Deploy to production during low-traffic periods

4. **Environment Variables**
   - Different values per environment
   - Production secrets only in production
   - Use .env.example for documentation

## Netlify Configuration

### Branch Deployments
```toml
[build]
  base = "apps/dhg-a"
  command = "pnpm build"
  publish = "dist"

[context.production]
  environment = { NODE_ENV = "production" }

[context.development]
  environment = { NODE_ENV = "development" }

[context.deploy-preview]
  environment = { NODE_ENV = "development" }
```

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