# Deployment Management System
**Living Document - Last Updated: 2025-06-11**

## Overview

This document describes the deployment management system for safely promoting code from the development branch to the main branch, which is deployed to the dhg-hub website via Netlify. The system is designed for a single developer workflow using Claude Code for all git operations, prioritizing safety and simplicity over formal PR processes.

## System Components

### 1. Deployment Service (`packages/shared/services/deployment-service`)
- Core service handling all deployment logic
- Pre-deployment validation and checks
- Rollback capabilities
- Deployment history tracking

### 2. Deployment CLI Pipeline (`scripts/cli-pipeline/deployment/`)
- Command-line interface for deployment operations
- Interactive deployment wizard
- Automated testing and validation commands
- Rollback and recovery tools

### 3. Deployment UI (`apps/dhg-admin-code/src/pages/DeploymentPage.tsx`)
- Visual deployment dashboard
- Real-time deployment status
- Deployment history viewer
- One-click rollback interface

## Deployment Workflow

### Pre-Deployment Phase
1. **Code Freeze Check**
   - Ensure no active development work in progress
   - Verify all worktrees are in stable state

2. **TypeScript Validation**
   ```bash
   ./deployment-cli.sh validate-typescript
   ```
   - Run `tsc --noEmit` across all apps and packages
   - Fix any TypeScript errors that are normally ignored
   - Special attention to import.meta.env issues

3. **Dependency Validation**
   ```bash
   ./deployment-cli.sh validate-dependencies
   ```
   - Check for version mismatches
   - Ensure pnpm-lock.yaml is consistent
   - Verify no missing dependencies

4. **Environment Configuration**
   ```bash
   ./deployment-cli.sh validate-env
   ```
   - Verify all required environment variables
   - Check Netlify environment configuration
   - Validate API keys and service connections

5. **Test Suite Execution**
   ```bash
   ./deployment-cli.sh run-tests
   ```
   - Run unit tests
   - Execute integration tests
   - Perform smoke tests on critical paths

### Deployment Phase
1. **Create Deployment Branch**
   ```bash
   ./deployment-cli.sh create-deployment
   ```
   - Creates temporary deployment branch
   - Applies production-specific fixes
   - Generates deployment manifest

2. **Build Verification**
   ```bash
   ./deployment-cli.sh verify-build
   ```
   - Run production build locally
   - Check bundle sizes
   - Verify all assets compile correctly

3. **Deploy to Staging** (Optional)
   ```bash
   ./deployment-cli.sh deploy-staging
   ```
   - Deploy to Netlify preview URL
   - Run automated tests against staging
   - Manual verification checklist

4. **Deploy to Production**
   ```bash
   ./deployment-cli.sh deploy-production
   ```
   - Merge to main branch
   - Trigger Netlify deployment
   - Monitor deployment status

### Post-Deployment Phase
1. **Health Checks**
   - Automated health check of production site
   - Verify all critical features working
   - Check API connections

2. **Monitoring**
   - Watch for errors in first 30 minutes
   - Check performance metrics
   - Monitor user reports

3. **Documentation**
   - Update deployment log
   - Record any issues encountered
   - Document fixes applied

## Common Deployment Issues & Solutions

### TypeScript Errors
**Problem**: Strict mode errors that don't appear during development
**Solution**: 
- Pre-deployment TypeScript validation
- Automated fixes for common patterns
- Manual review for complex cases

### Environment Variable Issues
**Problem**: Missing or incorrect environment variables in Netlify
**Solution**:
- Environment validation checklist
- Automated sync from .env.production
- Pre-deployment environment audit

### Build Failures
**Problem**: Production build fails due to optimization issues
**Solution**:
- Local production build verification
- Memory limit adjustments
- Bundle splitting strategies

### Import Path Issues
**Problem**: Relative imports break in production build
**Solution**:
- Path alias verification
- Import resolver checks
- Automated import fixes

## Safety Mechanisms

### Rollback Strategy
1. **Immediate Rollback** (< 5 minutes)
   ```bash
   ./deployment-cli.sh rollback-immediate
   ```
   - Revert main branch to previous commit
   - Trigger Netlify redeploy

2. **Standard Rollback** (> 5 minutes)
   ```bash
   ./deployment-cli.sh rollback --to-commit <commit-hash>
   ```
   - Create rollback branch
   - Apply necessary fixes
   - Deploy rollback branch

### Deployment Locks
- Prevent concurrent deployments
- Lock during critical operations
- Automatic unlock on timeout

### Audit Trail
- All deployments logged to database
- Capture deployment metadata
- Track who deployed what and when

## Database Schema

### deployment_runs
```sql
CREATE TABLE deployment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id TEXT UNIQUE NOT NULL,
  branch_from TEXT NOT NULL,
  branch_to TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, validating, deploying, completed, failed, rolled_back
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deployment_type TEXT NOT NULL, -- staging, production
  commit_hash TEXT,
  deployment_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### deployment_validations
```sql
CREATE TABLE deployment_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_run_id UUID REFERENCES deployment_runs(id),
  validation_type TEXT NOT NULL, -- typescript, dependencies, env, tests, build
  status TEXT NOT NULL, -- pending, running, passed, failed, skipped
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## CLI Commands

### Core Commands
- `validate-all` - Run all pre-deployment validations
- `create-deployment` - Create deployment branch and manifest
- `deploy-staging` - Deploy to staging environment
- `deploy-production` - Deploy to production
- `rollback` - Rollback to previous deployment
- `status` - Check current deployment status
- `history` - View deployment history

### Utility Commands
- `fix-typescript` - Auto-fix common TypeScript issues
- `sync-env` - Sync environment variables with Netlify
- `verify-build` - Test production build locally
- `health-check` - Check production site health

## UI Features

### Deployment Dashboard
- Current deployment status
- Pre-flight checklist
- One-click deployment button
- Real-time progress tracking

### History View
- Past deployments table
- Deployment details modal
- Rollback from history
- Deployment comparisons

### Configuration Panel
- Environment variable management
- Deployment settings
- Notification preferences
- Safety check toggles

## Implementation Timeline

1. **Phase 1: Core Service** (Week 1)
   - Deployment service architecture
   - Basic validation framework
   - Database schema implementation

2. **Phase 2: CLI Pipeline** (Week 1-2)
   - Command structure
   - Validation implementations
   - Deployment commands

3. **Phase 3: UI Development** (Week 2)
   - Dashboard layout
   - Real-time updates
   - History viewer

4. **Phase 4: Testing & Refinement** (Week 3)
   - End-to-end testing
   - Error handling improvements
   - Documentation updates

## Success Metrics

- Zero failed deployments due to preventable issues
- < 5 minute deployment time for standard deployments
- < 2 minute rollback time
- 100% deployment traceability
- Automated recovery from common issues

## Future Enhancements

- Automated canary deployments
- A/B testing support
- Performance regression detection
- Automated rollback triggers
- Slack/Discord notifications
- Multi-environment support

## Notes for Single Developer Workflow

Since all git operations are performed through Claude Code:
- No formal PR process needed
- Direct branch operations are acceptable
- Focus on automation over manual review
- Emphasis on pre-deployment validation
- Simple rollback mechanisms

The system assumes trust in the developer but provides safety nets through automated validation and easy rollback capabilities.