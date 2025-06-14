# Supabase Migration Action Plan - Safe Steps

## Current State
- 7 Supabase services with 902+ references
- SupabaseClientService (1,285) is correct
- Others need migration

## Safe Migration Steps

### Step 1: Test Current State (Today)
```bash
# 1. Run the consolidation test in dhg-service-test
cd apps/dhg-service-test
pnpm dev
# Navigate to "Supabase Consolidation" tab
# Run all tests - document results

# 2. Backup current state
git checkout -b backup/pre-supabase-migration
git add -A && git commit -m "backup: pre-supabase migration state"
git push origin backup/pre-supabase-migration
```

### Step 2: Create Compatibility Layer (Today)
```typescript
// packages/shared/services/supabase-compatibility.ts
// This allows gradual migration without breaking anything

import { SupabaseClientService } from './supabase-client';

// Temporary compatibility exports
export const SupabaseClient = new Proxy({}, {
  get() {
    console.warn('⚠️ SupabaseClient is deprecated. Use SupabaseClientService');
    return SupabaseClientService;
  }
});

export const SupabaseService = new Proxy({}, {
  get() {
    console.warn('⚠️ SupabaseService is deprecated. Use SupabaseClientService');
    return SupabaseClientService;
  }
});

// Add similar proxies for other variants
```

### Step 3: Fix High-Impact Files First (Day 1-2)

Priority based on usage:
1. **CLI Scripts** (easiest to test)
   ```bash
   # Find and fix CLI usage
   grep -r "SupabaseClient" scripts/cli-pipeline --include="*.ts" --include="*.js"
   
   # Test each fixed script
   ./scripts/cli-pipeline/[domain]/[command] --test
   ```

2. **Shared Services** (medium complexity)
   ```bash
   # Find service usage
   grep -r "SupabaseClient\|SupabaseService" packages/shared/services
   
   # Fix and test each service
   ```

3. **Apps** (most complex, do last)
   ```bash
   # Each app needs individual attention
   # Start with dhg-service-test since we have tests there
   ```

### Step 4: Migration Script for Safe Replacement

```typescript
// scripts/cli-pipeline/services/migrate-supabase-safely.ts

const safeReplacements = [
  {
    // Pattern 1: Direct SupabaseClient usage
    pattern: /import\s*{\s*SupabaseClient\s*}\s*from\s*['"].*?['"]/g,
    replacement: "import { SupabaseClientService } from '@shared/services/supabase-client'",
    filePattern: '**/*.{ts,js}'
  },
  {
    // Pattern 2: new SupabaseClient()
    pattern: /new\s+SupabaseClient\(\)/g,
    replacement: 'SupabaseClientService.getInstance().getClient()',
    filePattern: '**/*.{ts,js}'
  }
];

// Run with --dry-run first!
```

### Step 5: Test After Each Change

```bash
# After each file/module migration:

# 1. Run type check
pnpm tsc --noEmit

# 2. Run the specific test
pnpm test [affected-module]

# 3. Run integration test in dhg-service-test
# Check connection count didn't increase

# 4. Commit working state
git add [changed-files]
git commit -m "refactor: migrate [module] from SupabaseClient to SupabaseClientService"
```

### Step 6: Remove Deprecated Services (Week 2)

Only after all migrations are complete:

```bash
# 1. Move to deprecated folder
mkdir packages/shared/services/.deprecated
mv packages/shared/services/SupabaseClient.ts packages/shared/services/.deprecated/
mv packages/shared/services/SupabaseService.ts packages/shared/services/.deprecated/

# 2. Update sys_shared_services
DELETE FROM sys_shared_services 
WHERE service_name IN ('SupabaseClient', 'SupabaseService', 'SupabaseAdapter')
AND usage_count = 0;

# 3. Add deprecation notice
echo "These services are deprecated. See migration guide." > packages/shared/services/.deprecated/README.md
```

### Step 7: Implement Prevention (Week 2)

1. **Add ESLint rules** (from prevention guide)
2. **Set up pre-commit hooks**
3. **Update CLAUDE.md** with big warning box
4. **Add monitoring script** to weekly tasks

## Daily Checklist

- [ ] Morning: Run consolidation test to check baseline
- [ ] Migrate 5-10 files 
- [ ] Test each change
- [ ] Commit working state
- [ ] Evening: Run consolidation test to verify progress

## Success Criteria

1. All tests in TestSupabaseConsolidation pass
2. Connection count stays at 1
3. No TypeScript errors
4. All existing functionality works
5. Usage count for deprecated services reaches 0

## Rollback Plan

If things go wrong:
```bash
# Immediate rollback
git checkout origin/integration/bug-fixes-tweaks

# Or use compatibility layer
# The proxy pattern allows old code to keep working
```

## Red Flags to Stop

STOP migration if you see:
- Connection count increases beyond 5
- Multiple TypeScript errors that cascade
- Runtime errors in production code
- Tests start failing that weren't before

## Remember

- Small incremental changes
- Test after every change
- Commit working states frequently
- Use compatibility layer for safety
- Don't rush - better safe than broken