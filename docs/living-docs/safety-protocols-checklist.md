# Safety Protocols & Initial Checkpoint Setup

## 🚨 Current State Assessment

### Git Status
- **Branch**: `improve-cli-pipelines` 
- **Status**: Up to date with origin
- **Uncommitted Changes**: 
  - pnpm-lock.yaml (modified)
  - 2 new documentation files

### TypeScript Status  
- **⚠️ CRITICAL**: 263 TypeScript errors detected
- **Major Issues**:
  - Missing shared service modules (`@shared/services/*`)
  - Import path issues (ECMAScript modules)
  - Node.js/browser compatibility problems
  - Supabase adapter missing

### Existing .js Files (Potential Conflicts)
```
packages/shared/services/simple-coverage-test.js
packages/shared/services/supabase-service-refactored/__mocks__/fs.js
packages/shared/services/unified-classification-service/jest.config.js
packages/shared/services/test-all-services.test.js
```

## 🛡️ Safety Protocols Implementation

### Protocol 1: Initial State Backup
```bash
# Create safety checkpoint
git stash push -m "safety-checkpoint-pre-service-recovery-$(date +%Y%m%d)"
git add docs/living-docs/service-recovery-analysis.md docs/living-docs/service-refactoring-recovery-plan.md
git commit -m "docs: add service recovery analysis and implementation plan

Preparing for comprehensive service refactoring recovery

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Protocol 2: Service Recovery Rules

**🚨 MANDATORY CHECKS Before Each Service:**
1. ✅ **Clean Git State**: `git status` shows clean working tree
2. ✅ **Backup Point**: Create stash with service name
3. ✅ **No .js Files**: Verify no compiled files in packages/shared/services/
4. ✅ **TypeScript Clean**: Run `tsc --noEmit` on service directory only
5. ✅ **Test Import**: Verify service can be imported without errors

**🔄 CHECKPOINT PATTERN (Required):**
```bash
# Baseline
git add . && git commit -m "checkpoint: baseline - [ServiceName] migration start"

# Migration
[Do the work]
git add . && git commit -m "checkpoint: migrated - [ServiceName] refactored to extend [BaseClass]"

# Validation
[Test the service]
git add . && git commit -m "checkpoint: validated - [ServiceName] tests and benchmarks complete"

# Finalization
[Archive old code, update docs]
git add . && git commit -m "checkpoint: finalized - [ServiceName] migration complete with documentation and archival"
```

**🛑 STOP CONDITIONS:**
- Any .js file appears in packages/shared/services/
- TypeScript errors increase rather than decrease
- Browser console errors about Node.js modules
- Import/export resolution failures
- Service becomes unusable in CLI context

### Protocol 3: Validation Gates

**Per Service Validation:**
```bash
# 1. TypeScript check
tsc --noEmit packages/shared/services/[service-name]/**/*.ts

# 2. Import test
node -e "const svc = require('./packages/shared/services/[service-name]'); console.log('Import successful');"

# 3. Browser compatibility check (if applicable)
# Test in dhg-admin-code dev environment

# 4. CLI compatibility check
# Test with relevant CLI pipeline commands
```

**Full System Validation (Every 5 Services):**
```bash
# Full TypeScript check
tsc --noEmit

# Health check all pipelines
./scripts/cli-pipeline/all_pipelines/maintenance-cli.sh health-check

# Build verification
cd apps/dhg-admin-code && npm run build
cd apps/dhg-hub && npm run build
```

### Protocol 4: Emergency Recovery

**If Compilation Issues Reoccur:**
1. **STOP ALL WORK IMMEDIATELY**
2. **Document the exact change that triggered the issue**
3. **Revert to last known good checkpoint**: `git reset --hard HEAD~1`
4. **Remove any .js files**: `find packages/shared/services -name "*.js" -not -path "*/node_modules/*" -delete`
5. **Analyze the trigger and implement prevention**
6. **Update this protocol with new prevention measures**

**Rollback Commands:**
```bash
# Emergency rollback to baseline
git reset --hard [last-baseline-commit]

# Clean any generated files
find packages/shared/services -name "*.js" -not -path "*/node_modules/*" -not -path "*/__tests__/*" -delete

# Restore clean state
pnpm install
```

### Protocol 5: Service Migration Rules

**✅ REQUIRED PATTERNS:**

**SupabaseClientService (Foundation):**
```typescript
// CLI/Server Context
import { SupabaseClientService } from '@shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

**Browser Context:**
```typescript
// Browser App
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});
```

**Service Base Class Extensions:**
```typescript
// Singleton pattern (stateless utilities)
export class MyService extends SingletonService {
  // Implementation
}

// Business logic pattern (stateful operations)
export class MyService extends BusinessService {
  // Implementation  
}
```

**❌ FORBIDDEN PATTERNS:**
- Direct `createClient()` calls
- `import.meta.env` in shared services (use dependency injection)
- Mixed Node.js/browser dependencies
- Circular imports between services

### Protocol 6: Quality Assurance

**Code Quality Checklist:**
- [ ] Explicit TypeScript types (no `any`)
- [ ] Proper error handling with typed errors
- [ ] Environment variables via dependency injection
- [ ] Consistent naming conventions
- [ ] JSDoc comments for public methods
- [ ] Unit tests for core functionality

**Integration Checklist:**
- [ ] Service works in CLI scripts
- [ ] Service works in browser apps (if applicable)
- [ ] No console errors in development
- [ ] Proper cleanup in test environments
- [ ] Documentation updated

## 🎯 Ready to Start Indicator

**All Green Lights Required:**
- ✅ Git working tree clean
- ✅ Safety protocols documented
- ✅ Recovery plan prioritized
- ✅ Checkpoint pattern defined
- ✅ Emergency procedures ready
- ✅ Validation gates established

**Current Status**: ⚠️ **NEEDS INITIAL CLEANUP**
- TypeScript errors need resolution before starting
- Need to commit current documentation
- Need to identify root cause of current TS errors

## Next Steps

1. **Commit Current Analysis** (safe documentation-only changes)
2. **Investigate TypeScript Errors** (identify patterns and scope)
3. **Clean Foundation State** (resolve existing issues before migration)
4. **Begin Service Recovery** (starting with Category A foundation services)

This ensures we start from a stable, well-documented foundation and have clear procedures for maintaining quality throughout the recovery process.