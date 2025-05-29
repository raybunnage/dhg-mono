# Monorepo Continuous Development Best Practices

## Overview

This document outlines best practices for maintaining a healthy, productive continuous development workflow in a monorepo environment. These practices have been refined through experience with the DHG monorepo and are designed to minimize friction while maximizing developer productivity.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Branch Management](#branch-management)
3. [Development Workflow](#development-workflow)
4. [Code Organization](#code-organization)
5. [Dependency Management](#dependency-management)
6. [Testing Strategies](#testing-strategies)
7. [Build and Cache Management](#build-and-cache-management)
8. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
9. [Tooling and Automation](#tooling-and-automation)
10. [Documentation Standards](#documentation-standards)

## Core Principles

### 1. Minimize Blast Radius
- Changes should affect the smallest possible surface area
- Use proper abstractions to isolate changes
- Test incrementally to catch issues early

### 2. Maintain Clear Boundaries
- Apps should be independent and deployable separately
- Shared code belongs in `packages/shared`
- Avoid cross-app dependencies

### 3. Consistent Standards
- Use the same tools and patterns across all apps
- Maintain a single source of truth for configurations
- Document deviations and reasons

## Branch Management

### Branching Strategy

```
main
├── development (default branch)
├── feature/task-management
├── fix/auth-issues
├── refactor/shared-services
└── experiment/new-ui-framework
```

### Best Practices

1. **Use Descriptive Branch Names**
   ```
   ✅ feature/claude-task-management
   ✅ fix/supabase-connection-timeout
   ✅ refactor/expert-service-to-shared
   ❌ feature/new-thing
   ❌ fix-bug
   ```

2. **Keep Branches Focused**
   - One feature/fix per branch
   - Merge frequently to avoid conflicts
   - Delete branches after merging

3. **Task-Specific Branches** (New with Task Management)
   - Auto-generated format: `task/{type}/{id}-{title}`
   - Example: `task/feature/a1b2c3-add-search-functionality`
   - Provides traceability between tasks and code

## Development Workflow

### 1. Starting New Work

```bash
# Always start from latest development
git checkout development
git pull origin development

# Create feature branch
git checkout -b feature/my-new-feature

# Clear caches if switching between major changes
./scripts/clear-all-caches.sh
```

### 2. During Development

#### Frequent Commits
```bash
# Commit logical units of work
git add -p  # Review changes
git commit -m "feat(auth): add email validation"

# Use conventional commits:
# feat: new feature
# fix: bug fix
# refactor: code refactoring
# docs: documentation only
# test: test additions/changes
# chore: maintenance tasks
```

#### Regular Syncing
```bash
# Keep branch updated with development
git checkout development
git pull origin development
git checkout feature/my-feature
git merge development
```

### 3. Before Submitting

#### Quality Checks
```bash
# Run TypeScript checks
pnpm tsc --noEmit

# Run linting
pnpm lint

# Test affected apps
pnpm test --filter=./apps/affected-app

# Build to verify
pnpm build --filter=./apps/affected-app
```

## Code Organization

### 1. File Placement Rules

```
dhg-mono/
├── apps/                      # Individual applications
│   ├── dhg-admin-code/       # Code-focused admin tools
│   ├── dhg-hub/              # Main hub application
│   └── dhg-audio/            # Audio processing app
├── packages/                  # Shared code
│   └── shared/
│       ├── components/       # Reusable UI components
│       ├── services/         # Business logic services
│       ├── utils/            # Utility functions
│       └── types/            # Shared TypeScript types
├── scripts/                   # Development scripts
│   └── cli-pipeline/         # CLI tools by domain
├── supabase/                 # Database schema and migrations
└── docs/                     # Documentation
```

### 2. When to Create Shared Code

**Create shared code when:**
- The same logic is needed in 2+ apps
- The functionality is generic and reusable
- You're extracting from a working implementation

**Keep in app when:**
- It's app-specific business logic
- It's still evolving rapidly
- It has app-specific dependencies

### 3. Service Design Patterns

```typescript
// ❌ Bad: Singleton with hardcoded initialization
export class MyService {
  private static instance = new MyService();
  private supabase = createClient(...); // Breaks in different environments
}

// ✅ Good: Flexible initialization
export class MyService {
  constructor(private supabase: SupabaseClient) {}
  
  static create(config: ServiceConfig) {
    return new MyService(config.supabase);
  }
}
```

## Dependency Management

### 1. Version Consistency

```json
// pnpm-workspace.yaml ensures consistent versions
{
  "packages": [
    "apps/*",
    "packages/*"
  ]
}
```

### 2. Adding Dependencies

```bash
# Add to specific app
pnpm add lucide-react --filter=dhg-admin-code

# Add to shared packages
pnpm add date-fns --filter=@shared/utils

# Add dev dependency to root
pnpm add -D @types/node -w
```

### 3. Dependency Rules

- **Production deps**: Only what's needed for runtime
- **Dev deps**: Build tools, types, linters
- **Peer deps**: For packages that expect host to provide
- **Avoid duplicates**: Use pnpm's deduplication

## Testing Strategies

### 1. Test Pyramid in Monorepo

```
        E2E Tests (Few)
       /            \
    Integration    Tests
   /                  \
Unit Tests (Many)  Component Tests
```

### 2. Testing Patterns

```bash
# Test single app
pnpm test --filter=dhg-admin-code

# Test affected by changes
pnpm test --filter=...{packages/shared}

# Test everything
pnpm test

# Watch mode for development
pnpm test:watch --filter=dhg-admin-code
```

### 3. Shared Test Utilities

```typescript
// packages/shared/test-utils/supabase-mock.ts
export function createMockSupabaseClient() {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    // ... other methods
  };
}
```

## Build and Cache Management

### 1. Vite Cache Issues

**Problem**: Stale cache causing old code to run

**Solutions**:
```bash
# Clear specific app cache
./scripts/clear-app-cache.sh dhg-admin-code

# Clear all caches
./scripts/clear-all-caches.sh

# Fresh dev start (clear + start)
./scripts/dev-fresh.sh dhg-admin-code
```

### 2. Build Optimization

```typescript
// vite.config.ts - Share base config
import baseConfig from '../../vite.config.base';

export default {
  ...baseConfig,
  // App-specific overrides
};
```

### 3. Incremental Builds

```bash
# Build only changed packages
pnpm build --filter=...[origin/development]

# Build specific app and dependencies
pnpm build --filter=dhg-admin-code...
```

## Common Pitfalls and Solutions

### 1. Environment Variable Confusion

**Problem**: Different prefixes in browser vs CLI
```typescript
// ❌ Wrong
const url = process.env.SUPABASE_URL; // Undefined in browser

// ✅ Correct
const url = import.meta.env.VITE_SUPABASE_URL; // Browser
const url = process.env.SUPABASE_URL; // CLI/Node
```

**Solution**: Use environment adapters
```typescript
// packages/shared/adapters/env-adapter.ts
export function getSupabaseUrl() {
  return typeof window !== 'undefined' 
    ? import.meta.env.VITE_SUPABASE_URL
    : process.env.SUPABASE_URL;
}
```

### 2. Cross-App Imports

**Problem**: Direct imports between apps
```typescript
// ❌ In dhg-hub
import { Something } from '../../dhg-admin/src/utils';
```

**Solution**: Extract to shared
```typescript
// ✅ Move to shared
import { Something } from '@shared/utils';
```

### 3. Migration Conflicts

**Problem**: Multiple developers creating migrations
```bash
# Both create migrations with same timestamp
20250601000000_add_user_fields.sql
20250601000000_add_product_table.sql
```

**Solution**: Coordination and naming
```bash
# Use more specific timestamps
20250601143022_add_user_fields.sql
20250601143156_add_product_table.sql

# Or use branch prefixes
20250601000000_feature_auth_add_user_fields.sql
```

### 4. Type Synchronization

**Problem**: Database types out of sync
```typescript
// Types don't match actual database
interface User {
  name: string; // But column was renamed to full_name
}
```

**Solution**: Single source of truth
```bash
# Always regenerate after schema changes
pnpm supabase gen types typescript --local > supabase/types.ts
```

## Tooling and Automation

### 1. Essential Scripts

```bash
# Development
./scripts/dev-fresh.sh {app}          # Fresh start
./scripts/clear-all-caches.sh         # Clear caches

# Database
./scripts/cli-pipeline/database/database-cli.sh migration validate
./scripts/cli-pipeline/database/database-cli.sh migration test

# Maintenance
./scripts/cli-pipeline/maintenance-cli.sh health-check
```

### 2. Git Hooks (Recommended)

```bash
# .husky/pre-commit
#!/bin/sh
pnpm tsc --noEmit
pnpm lint-staged
```

### 3. CI/CD Considerations

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: pnpm install --frozen-lockfile

- name: Build affected
  run: pnpm build --filter=...[origin/main]

- name: Test affected  
  run: pnpm test --filter=...[origin/main]
```

## Documentation Standards

### 1. Code Documentation

```typescript
/**
 * Service for managing Claude Code tasks
 * 
 * @example
 * const task = await TaskService.createTask({
 *   title: 'Add search feature',
 *   type: 'feature'
 * });
 */
export class TaskService {
  /**
   * Creates a new task
   * @param task - Partial task object (id will be generated)
   * @returns The created task with generated id
   * @throws {Error} If user is not authenticated
   */
  static async createTask(task: Partial<DevTask>): Promise<DevTask> {
    // Implementation
  }
}
```

### 2. README Structure

Each app should have:
```markdown
# App Name

## Purpose
Brief description of what this app does

## Development
\```bash
pnpm dev
\```

## Key Features
- Feature 1
- Feature 2

## Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

## Architecture Notes
Any important architectural decisions
```

### 3. Migration Documentation

```sql
-- Migration: 20250601000000_add_task_management.sql
-- Purpose: Adds tables for Claude Code task management system
-- Author: [Your name]
-- Related PR: #123

-- This migration creates the foundation for tracking
-- development tasks that will be processed by Claude Code
```

## Continuous Improvement

### 1. Regular Maintenance

**Weekly**:
- Clean up merged branches
- Review and merge dependabot PRs
- Clear old cache files

**Monthly**:
- Review shared code for optimization opportunities
- Update dependencies
- Archive unused code

**Quarterly**:
- Review monorepo structure
- Evaluate tool effectiveness
- Update documentation

### 2. Performance Monitoring

```bash
# Monitor build times
time pnpm build

# Check bundle sizes
pnpm build && ls -la apps/*/dist/assets/*.js

# Database query performance
./scripts/cli-pipeline/database/database-cli.sh analyze-queries
```

### 3. Feedback Loops

- Track pain points in daily development
- Document solutions in CLAUDE.md
- Share learnings with team
- Iterate on processes

## Conclusion

Successful continuous development in a monorepo requires:

1. **Discipline**: Follow established patterns
2. **Communication**: Coordinate on shared resources
3. **Tooling**: Automate repetitive tasks
4. **Flexibility**: Adapt practices as needed

The key is finding the right balance between standardization and flexibility, enabling rapid development while maintaining code quality and system stability.