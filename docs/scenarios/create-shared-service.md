# Scenario: Create Shared Service

## Critical Evaluation Gates ⚠️ COMPLETE FIRST

### Gate 1: Necessity Check (30 seconds max)
- [ ] **Duplication Search**: 
  ```bash
  # Copy/paste these exact commands:
  ls packages/shared/services/
  grep -i "service_name\|functionality" packages/shared/services/*/
  find packages/shared/services/ -name "*.ts" | xargs grep -l "similar_functionality"
  ```
- [ ] **What did you find?**: ____________________
- [ ] **Usage Justification**: Is there clear evidence multiple apps/scripts need this vs one-off usage?
- [ ] **Complexity Check**: Will this add significant complexity to shared services ecosystem?

### Gate 2: Simplicity Assessment (2 minutes max)
- [ ] **Enhancement Alternative**: Could existing service be enhanced with new methods instead?
  - If yes: **STOP HERE** - enhance existing rather than create new
- [ ] **Pattern Check**: Is this truly reusable logic or app-specific business logic?
- [ ] **Right-Sized Solution**: Is a shared service the simplest approach vs utility functions?

### Gate 3: Quick Code Review (5 minutes max)
```bash
# Required searches (run these commands):
rg -i "class.*Service\|interface.*Service" packages/shared/services/
grep -r "singleton\|getInstance" packages/shared/services/
find packages/shared/services/ -name "*{similar_name}*"
```

**Document your findings**:
- Similar services found: ____________________
- Pattern usage (singleton vs DI): ____________________
- Naming conflicts or overlapping functionality: ____________________

### Gate 4: Go/No-Go Decision
- [ ] **Technical**: All searches completed, no major overlap with existing services
- [ ] **Architectural**: Clear whether this needs singleton or dependency injection pattern
- [ ] **Value**: Will be used by 2+ apps/scripts and provides clear reusable value
- [ ] **Timing**: Right priority vs enhancing existing services

**Decision**: APPROVE / REJECT / NEEDS_REVIEW

**If REJECT or NEEDS_REVIEW**: Document why and explore alternatives before proceeding.

---

## Implementation Steps (Only if APPROVED above)

### Step 1: Determine Service Pattern
**Human Action**: Decide between singleton (infrastructure) or dependency injection (business logic)
**Claude Code Translation**: 
```typescript
// Infrastructure services (database, API clients, loggers): Use singleton
// Business services (domain logic, data processing): Use dependency injection
// Document pattern choice and reasoning
```
**Verification**: Pattern choice is clear and documented
**Checkpoint**: 
```bash
git add docs/service-pattern-decision.md && git commit -m "decide: service pattern for {service-name}

Pattern: singleton|dependency-injection
Reasoning: {infrastructure|business-logic}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 2: Create Service Directory Structure
**Human Action**: Create directory and files in `packages/shared/services/{service-name}/`
**Claude Code Translation**:
```typescript
// Create directory: packages/shared/services/{service-name}/
// Create main service file: {service-name}.ts
// Create index file: index.ts
// Create test directory: __tests__/
// Create test file: __tests__/{service-name}.test.ts
```
**Verification**: Directory structure exists with all required files
**Checkpoint**:
```bash
git add packages/shared/services/{service-name}/ && git commit -m "scaffold: {service-name} service structure

Created directory structure
Files: service, index, tests

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 3: Implement Service Class
**Human Action**: Write service class following chosen pattern (singleton or DI)
**Claude Code Translation**:
```typescript
// For singleton pattern:
// - private constructor
// - static getInstance() method
// - export const serviceInstance = Service.getInstance()

// For DI pattern:
// - public constructor with dependencies
// - clear dependency interfaces
// - export class only

// Add proper TypeScript types
// Add error handling
// Add documentation comments
```
**Verification**: Service compiles without errors and follows pattern correctly
**Checkpoint**:
```bash
git add packages/shared/services/{service-name}/{service-name}.ts && git commit -m "implement: {service-name} service class

Pattern: {singleton|dependency-injection}
Methods: {list key methods}
Dependencies: {list dependencies}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 4: Create Comprehensive Tests
**Human Action**: Write unit tests covering all public methods and error cases
**Claude Code Translation**:
```typescript
// Set up test framework (vitest)
// Mock external dependencies
// Test all public methods
// Test error conditions
// Test pattern-specific behavior (singleton instance, DI constructor)
// Aim for >80% code coverage
```
**Verification**: Tests pass and provide good coverage
**Checkpoint**:
```bash
git add packages/shared/services/{service-name}/__tests__/ && git commit -m "test: comprehensive tests for {service-name}

Coverage: >80%
Tests: {list test categories}
Mocks: {list mocked dependencies}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 5: Update Shared Services Index
**Human Action**: Export new service from `packages/shared/services/index.ts`
**Claude Code Translation**:
```typescript
// Read packages/shared/services/index.ts
// Add export line: export * from './{service-name}';
// Maintain alphabetical order
// Ensure no duplicate exports
```
**Verification**: Service can be imported from `@shared/services`
**Checkpoint**:
```bash
git add packages/shared/services/index.ts && git commit -m "export: {service-name} from shared services

Added to main shared services index
Import: import { Service } from '@shared/services'

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 6: Add to Service Registry
**Human Action**: Create database migration to register service
**Claude Code Translation**:
```typescript
// Create migration file with timestamp
// Add INSERT to sys_shared_services table
// Include service metadata: pattern type, dependencies, description
// Set initial usage_count to 0
```
**Verification**: Migration runs and service appears in registry
**Checkpoint**:
```bash
git add supabase/migrations/{timestamp}_add_{service_name}_service.sql && git commit -m "database: register {service-name} in system

Added to sys_shared_services
Pattern: {singleton|dependency-injection}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 7: Create Usage Documentation
**Human Action**: Document service API and usage examples
**Claude Code Translation**:
```typescript
// Create docs/shared-services/{service-name}-service.md
// Document purpose and use cases
// Provide code examples for both patterns
// Document configuration options
// Include troubleshooting guide
```
**Verification**: Documentation is clear and includes working examples
**Checkpoint**:
```bash
git add docs/shared-services/{service-name}-service.md && git commit -m "docs: {service-name} usage guide

Purpose: {brief description}
Examples: {list example scenarios}
API: {list main methods}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Post-Implementation Validation
- [ ] Service compiles: `tsc --noEmit packages/shared/services/{service-name}/{service-name}.ts`
- [ ] Tests pass: `pnpm test packages/shared/services/{service-name}`
- [ ] Can import: `import { Service } from '@shared/services'` works in test file
- [ ] Pattern compliance: Singleton has getInstance(), DI has public constructor
- [ ] Documentation complete: Clear usage examples and API reference
- [ ] Database entry: Service appears in `sys_shared_services` table
- [ ] No naming conflicts: Service name doesn't conflict with existing services

## 30-Day Retrospective Schedule
```bash
# Add to calendar for 30 days from now:
echo "$(date -d '+30 days'): Review {service-name} service - is it being used? Was it worth it?"
```

**Retrospective Questions**:
- Is the service actually being used by multiple apps/scripts?
- Did it reduce code duplication as intended?
- Is the chosen pattern (singleton vs DI) working well?
- Would we make the same design decisions knowing what we know now?
- Should this be continued/optimized/consolidated/deprecated?

## Common Issues & Solutions

**TypeScript Compilation Errors**:
- Check import paths are correct
- Verify all dependencies are properly typed
- Ensure export/import statements match

**Tests Failing**:
- Check mocks are set up correctly
- Verify async/await usage in tests
- Ensure test environment has required dependencies

**Import Errors in Apps**:
- Verify service is exported from shared index
- Check tsconfig.json path mappings
- Ensure shared package is built (run `pnpm build` in packages/shared)

**Pattern Implementation Issues**:
- Singleton: Ensure constructor is private and getInstance() is static
- DI: Ensure constructor properly accepts and stores dependencies
- Check existing services for pattern examples

**Service Not Found in Registry**:
- Verify database migration ran successfully
- Check service name matches between code and database
- Ensure migration SQL syntax is correct