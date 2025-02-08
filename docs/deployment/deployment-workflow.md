# Development and Deployment Workflow

## Deployment Commands

### Quick Reference
```bash
# Deploy to Preview Environment (for feature branches)
pnpm deploy:dhg-a:preview
# Creates: feature-name--dhg-hub.netlify.app
# Shows: Yellow environment badge
# Features: Debug, beta, and experimental flags enabled

# Deploy to Development Environment
pnpm deploy:dhg-a:development
# Creates: dev.dhg-hub.org
# Shows: Blue environment badge
# Features: Debug and beta flags enabled

# Deploy to Production Environment
pnpm deploy:dhg-a:prod
# Creates: dhg-hub.org
# Shows: Green environment badge
# Features: Release flags only
```

### Environment Characteristics

| Command | URL Pattern | Badge | API URL | Feature Flags |
|---------|------------|--------|---------|---------------|
| `deploy:dhg-a:preview` | `feature-*--site.netlify.app` | Yellow | preview-api | debug,beta,experimental |
| `deploy:dhg-a:development` | `dev.site.com` | Blue | dev-api | debug,beta |
| `deploy:dhg-a:prod` | `site.com` | Green | prod-api | release |

### Usage Examples

#### Feature Development
```bash
# Start new feature
git checkout -b feature/new-button

# Deploy to preview environment for team review
pnpm deploy:dhg-a:preview
```

#### Development Integration
```bash
# Merge feature to development
git checkout development
git merge feature/new-button

# Deploy to development environment
pnpm deploy:dhg-a:development
```

#### Production Release
```bash
# Merge development to main
git checkout main
git merge development

# Deploy to production
pnpm deploy:dhg-a:prod
```

### Visual Indicators

Each environment has distinct visual cues:
- **Header Color**: Matches the environment (Green/Blue/Yellow)
- **Status Badge**: Shows environment name with matching color
- **App Name**: Includes environment suffix (except production)
- **API URL**: Points to environment-specific API
- **Feature Flags**: Shows available features for that environment

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

### 3. Testing
```bash
# Run tests before committing
pnpm test:run --filter dhg-a

# Build and preview locally
pnpm build --filter dhg-a
pnpm preview --filter dhg-a
```

## Deployment Flow

### 1. Feature Branch Deployment
```bash
# Commit your changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Deploy feature branch to Netlify
cd apps/dhg-a
pnpm build
netlify deploy --dir=dist --message "Preview: Feature branch deployment"

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
pnpm build
netlify deploy --dir=dist --message "Development deployment"

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
pnpm build
netlify deploy --dir=dist --prod --message "Production deployment"

# Production URL: dhg-hub.org
```