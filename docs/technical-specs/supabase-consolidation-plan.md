# Supabase Service Consolidation Plan

## The Problem

We have 7 different Supabase services with 902+ references:
- **SupabaseClientService** (1,285 uses) ✅ - The correct singleton infrastructure service
- **SupabaseClient** (826 uses) ❌ - Direct client usage, should use singleton
- **SupabaseAdapter** (62 uses) ❌ - Duplicate functionality
- **SupabaseService** (13 uses) ❌ - Another duplicate
- **SupabaseClientAdapter** (1 use) ❌ - Yet another variant
- **SupabaseCache** (0 uses) ❌ - Unused
- **SupabaseHelpers** (0 uses) ❌ - Unused

## Root Cause Analysis

### Why This Keeps Happening

1. **Confusing Documentation**: CLAUDE.md mentions both patterns without clear "always use this"
2. **Multiple Valid-Looking Options**: When developers see multiple Supabase services, they pick randomly
3. **Import Path Confusion**: Some use `@shared/services`, others use relative paths
4. **Browser vs CLI Confusion**: Different patterns for different environments not clearly documented
5. **No Linting Rules**: Nothing prevents creating new Supabase clients

## The Solution: One Service, Multiple Adapters

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Code                      │
├─────────────────────────────────────────────────────────┤
│                         ↓                                │
│              Always use one of these:                    │
│                         ↓                                │
├─────────────────────────────────────────────────────────┤
│   Browser Apps          │        CLI/Server Code        │
│   ------------          │        ---------------        │
│   supabaseAdapter       │   SupabaseClientService      │
│   (from local lib)      │   (singleton)                │
└─────────────────────────────────────────────────────────┘
                          ↓
              Both connect to same database
```

## Phase 1: Test Current Behavior (Today)

### 1.1 Create Comprehensive Test in dhg-service-test

```typescript
// apps/dhg-service-test/src/components/TestSupabaseConsolidation.tsx
export function TestSupabaseConsolidation() {
  const tests = [
    {
      name: 'SupabaseClientService Singleton',
      test: async () => {
        const instance1 = SupabaseClientService.getInstance();
        const instance2 = SupabaseClientService.getInstance();
        return instance1 === instance2; // Must be same instance
      }
    },
    {
      name: 'Supabase Adapter Pattern',
      test: async () => {
        const adapter = createSupabaseAdapter({ env: import.meta.env });
        const { data } = await adapter.from('sys_shared_services').select('count');
        return data !== null;
      }
    },
    {
      name: 'All Services Return Same Client',
      test: async () => {
        // Test that different services actually use same connection
        const results = await Promise.all([
          testWithSupabaseClient(),
          testWithSupabaseService(),
          testWithSupabaseAdapter()
        ]);
        return results.every(r => r.url === 'same-supabase-url');
      }
    }
  ];
}
```

### 1.2 Create Migration Test Suite

```typescript
// scripts/cli-pipeline/services/test-supabase-migration.ts
async function testSupabaseMigration() {
  // 1. Find all current usage patterns
  const patterns = [
    /new SupabaseClient/g,
    /SupabaseClient\(/g,
    /createClient\(/g,
    /supabase\.from/g
  ];
  
  // 2. Test each pattern still works
  // 3. Test replacement pattern works identically
  // 4. Measure performance difference
}
```

## Phase 2: Create Migration Tools (Week 1)

### 2.1 Automated Migration Script

```typescript
// scripts/cli-pipeline/services/migrate-supabase-usage.ts
const migrations = [
  {
    // Direct client usage in CLI
    from: `import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)`,
    to: `import { SupabaseClientService } from '@shared/services/supabase-client'
const supabase = SupabaseClientService.getInstance().getClient()`
  },
  {
    // SupabaseClient usage
    from: `import { SupabaseClient } from 'path/to/client'`,
    to: `import { SupabaseClientService } from '@shared/services/supabase-client'`
  },
  {
    // Browser usage
    from: `import { SupabaseService } from '@shared/services'`,
    to: `import { supabase } from './lib/supabase' // Use local adapter`
  }
];
```

### 2.2 Compatibility Layer (Temporary)

```typescript
// packages/shared/services/supabase-compatibility.ts
// Temporary compatibility layer during migration
export const SupabaseClient = SupabaseClientService;
export const SupabaseService = SupabaseClientService;
export const SupabaseAdapter = SupabaseClientService;

// Log deprecation warnings
const logDeprecation = (oldName: string) => {
  console.warn(`⚠️ ${oldName} is deprecated. Use SupabaseClientService or createSupabaseAdapter`);
};
```

## Phase 3: Safe Migration Process (Week 1-2)

### Step 1: Update High-Traffic Services First

Priority order based on usage:
1. Fix SupabaseClient (826 uses) - Biggest impact
2. Fix SupabaseAdapter (62 uses)
3. Fix SupabaseService (13 uses)
4. Remove unused services

### Step 2: Migration by Category

```bash
# 1. Migrate CLI scripts (easiest)
./scripts/cli-pipeline/services/migrate-supabase.sh --target cli

# 2. Migrate shared services
./scripts/cli-pipeline/services/migrate-supabase.sh --target services

# 3. Migrate apps (most complex)
./scripts/cli-pipeline/services/migrate-supabase.sh --target apps

# 4. Migrate proxy servers
./scripts/cli-pipeline/services/migrate-supabase.sh --target servers
```

### Step 3: Test After Each Migration

```typescript
// Run after each batch
async function validateMigration(target: string) {
  // 1. Run existing tests
  await runTestSuite(target);
  
  // 2. Check for connection leaks
  const connectionCount = await getActiveConnections();
  assert(connectionCount === 1, 'Should only have one connection');
  
  // 3. Performance check
  const metrics = await measurePerformance();
  assert(metrics.avgQueryTime < 100, 'Performance should not degrade');
}
```

## Phase 4: Prevent Future Duplication (Week 2)

### 4.1 ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/SupabaseClient', '**/SupabaseService', '**/SupabaseAdapter'],
          message: 'Use SupabaseClientService or createSupabaseAdapter instead'
        },
        {
          group: ['@supabase/supabase-js'],
          message: 'Do not import createClient directly. Use shared services.'
        }
      ]
    }]
  }
};
```

### 4.2 Git Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
if git diff --cached --name-only | xargs grep -l "new SupabaseClient\|createClient" ; then
  echo "❌ Error: Direct Supabase client creation detected!"
  echo "Use SupabaseClientService.getInstance().getClient() instead"
  exit 1
fi
```

### 4.3 Clear Documentation

```markdown
# Supabase Usage - THE ONLY WAY

## Browser Apps (React/Vite)
```typescript
// apps/{app-name}/src/lib/supabase.ts
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
export const supabase = createSupabaseAdapter({ env: import.meta.env });

// Then in components
import { supabase } from '@/lib/supabase';
```

## CLI Scripts & Servers
```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

## ❌ NEVER DO THIS
- `new SupabaseClient()`
- `createClient(url, key)`
- `import from '@supabase/supabase-js'`
- Create multiple instances
```

## Phase 5: Caching Strategy (Future)

### 5.1 Query Result Caching

```typescript
class SupabaseClientService {
  private cache = new Map<string, CachedResult>();
  
  async cachedQuery(key: string, query: () => Promise<any>, ttl = 60000) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const data = await query();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

### 5.2 Connection Pooling

```typescript
// Reduce connections by sharing single client
const config = {
  db: {
    poolSize: 1, // Single connection for free tier
    maxRetries: 3,
    retryDelay: 1000
  }
};
```

## Testing Strategy in dhg-service-test

### 1. Pre-Migration Tests
- Capture current behavior
- Record performance baseline
- Document all usage patterns

### 2. Migration Tests
- Test each replacement works identically
- Verify single connection usage
- Check for memory leaks

### 3. Post-Migration Tests
- Verify all services use singleton
- Check connection count stays at 1
- Monitor query performance

### 4. Continuous Monitoring
```typescript
// Add to dhg-service-test
export function SupabaseHealthMonitor() {
  useEffect(() => {
    const interval = setInterval(async () => {
      const health = await checkSupabaseHealth();
      if (health.connectionCount > 1) {
        console.error('Multiple connections detected!');
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);
}
```

## Success Metrics

1. **Single Connection**: Only 1 active database connection
2. **No Duplicates**: 7 services → 1 service + 1 adapter
3. **Zero Errors**: All existing code continues working
4. **Performance**: No degradation in query times
5. **Prevention**: No new Supabase services created

## Rollback Plan

If issues arise:
1. Compatibility layer provides immediate rollback
2. Git revert for specific files
3. Feature flag for gradual rollout
4. Keep old services with deprecation warnings

## Timeline

- **Today**: Create tests, analyze usage patterns
- **Day 2-3**: Implement migration tools
- **Day 4-7**: Migrate by category (CLI → Services → Apps)
- **Week 2**: Remove old services, implement prevention
- **Ongoing**: Monitor for new duplicates

## The Key to Making It Stick

1. **Make the Right Way the Easy Way**
   - Single import path
   - Clear examples
   - IDE snippets

2. **Make the Wrong Way Impossible**
   - ESLint rules
   - Pre-commit hooks
   - CI/CD checks

3. **Education**
   - Update CLAUDE.md with crystal clear instructions
   - Add comments to every Supabase import
   - Create video showing correct usage

4. **Monitoring**
   - Weekly service duplication check
   - Connection count monitoring
   - Alert on new Supabase imports