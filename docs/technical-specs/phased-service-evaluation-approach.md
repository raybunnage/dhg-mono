# Phased Service Evaluation Approach

## Current Situation Analysis

Based on our evaluation queries:
- **110 total services** in sys_shared_services
- **ALL show 0 usage** - usage tracking not implemented yet
- **68 potential duplicate pairs** identified
- **All services already classified** as 'business' with 'dependency_injection'
- This suggests the initial classification was done automatically without proper analysis

## Safe, Phased Approach

### Phase 0: Fix Usage Tracking First (Week 1)

Before we can make informed decisions, we need accurate usage data.

#### Step 1: Create Usage Scanner
```typescript
// scripts/cli-pipeline/services/scan-service-usage.ts
export async function scanServiceUsage() {
  // Scan imports in all TypeScript/JavaScript files
  const patterns = [
    'apps/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,js}',
    'packages/**/*.{ts,js}',
    '**/*-server.{js,ts,cjs,mjs}'
  ];
  
  for (const service of services) {
    const usage = await findImports(service.service_name);
    await updateUsage(service.id, usage);
  }
}
```

#### Step 2: Run Usage Scan
```bash
./scripts/cli-pipeline/services/services-cli.sh scan-usage
```

### Phase 1: Analyze High-Value Services (Week 1-2)

#### Safe Classification Process

1. **Start with obvious infrastructure services**
   ```sql
   -- These are clearly infrastructure (manage connections/resources)
   UPDATE sys_shared_services 
   SET service_type = 'infrastructure',
       instantiation_pattern = 'singleton'
   WHERE service_name IN (
     'SupabaseClientService',
     'claudeService',
     'logger',
     'AuthService',
     'GoogleAuthService'
   );
   ```

2. **Review each service manually**
   - Don't bulk update based on patterns
   - Check actual implementation
   - Test in dhg-service-test before changing

3. **Document each decision**
   ```sql
   -- Track why each classification was made
   UPDATE sys_shared_services
   SET service_type = 'infrastructure',
       instantiation_pattern = 'singleton',
       refactoring_notes = 'Manages database connection pool - must be singleton'
   WHERE service_name = 'SupabaseClientService';
   ```

### Phase 2: Handle Duplicates Safely (Week 2-3)

#### Duplicate Resolution Strategy

1. **Group similar services**
   ```
   Supabase Group:
   - SupabaseClient
   - SupabaseClientService ← Keep this (infrastructure)
   - SupabaseService
   - SupabaseClientAdapter
   - SupabaseAdapter
   - SupabaseCache
   - SupabaseHelpers
   
   Action: Analyze which is actually used, consolidate others
   ```

2. **Create compatibility matrix**
   ```typescript
   // Before removing any service, check:
   interface CompatibilityCheck {
     service: string;
     usedBy: string[];
     methods: string[];
     canReplacWith: string;
     breakingChanges: string[];
   }
   ```

3. **Deprecate before removing**
   ```typescript
   // Mark as deprecated first
   /**
    * @deprecated Use SupabaseClientService instead
    * Will be removed in version 2.0
    */
   export class SupabaseService {
     constructor() {
       console.warn('SupabaseService is deprecated. Use SupabaseClientService');
     }
   }
   ```

### Phase 3: Test in dhg-service-test (Ongoing)

#### Testing Protocol

1. **Add each service to test suite**
   ```typescript
   // apps/dhg-service-test/src/tests/infrastructure/TestSupabaseClientService.tsx
   export function TestSupabaseClientService() {
     // Test singleton behavior
     const instance1 = SupabaseClientService.getInstance();
     const instance2 = SupabaseClientService.getInstance();
     assert(instance1 === instance2, 'Should be singleton');
     
     // Test functionality
     const client = instance1.getClient();
     assert(client !== null, 'Should provide client');
   }
   ```

2. **Test before and after changes**
   - Baseline test with current implementation
   - Test after classification changes
   - Test after pattern refactoring

### Phase 4: Fix Pattern Mismatches (Week 3-4)

#### Safe Refactoring Process

1. **Infrastructure services that need singleton pattern**
   ```typescript
   // Before: Using dependency injection (wrong for infrastructure)
   export class DatabaseService {
     constructor(private config: Config) {}
   }
   
   // After: Singleton pattern
   export class DatabaseService {
     private static instance: DatabaseService;
     private constructor(private config: Config) {}
     
     static getInstance(): DatabaseService {
       if (!this.instance) {
         this.instance = new DatabaseService(getConfig());
       }
       return this.instance;
     }
   }
   ```

2. **Business services that need dependency injection**
   ```typescript
   // Before: Singleton (wrong for business logic)
   export class UserService {
     private static instance: UserService;
     static getInstance() { /* ... */ }
   }
   
   // After: Dependency injection
   export class UserService {
     constructor(
       private supabase: SupabaseClient,
       private logger: Logger
     ) {}
   }
   ```

### Phase 5: Remove Unused Services (Week 4-5)

#### Safe Removal Process

1. **Verify truly unused**
   ```bash
   # Double-check with grep
   grep -r "ServiceName" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx"
   ```

2. **Check for dynamic imports**
   ```typescript
   // These won't show in static analysis
   const service = await import(`@shared/services/${serviceName}`);
   ```

3. **Archive before deleting**
   ```bash
   # Move to archive first
   mv packages/shared/services/unused-service packages/shared/services/.archived/unused-service.20250613
   
   # Add archive note
   echo "Archived on 2025-06-13: No usage found in 30 days" > packages/shared/services/.archived/unused-service.20250613/ARCHIVE_NOTE.md
   ```

## Quick Wins (Do These First)

### 1. Fix Obvious Infrastructure Services
```sql
-- These 5 are clearly infrastructure
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton'
WHERE service_name IN (
  'SupabaseClientService',  -- Database connection
  'claudeService',          -- AI API connection
  'logger',                 -- Logging infrastructure
  'BrowserAuthService',     -- Auth state management
  'GoogleAuthService'       -- Google API connection
);
```

### 2. Consolidate Obvious Duplicates
```
Group 1: Supabase (keep SupabaseClientService)
Group 2: Auth (keep AuthService for business, BrowserAuthService for infrastructure)
Group 3: File operations (keep FileService)
Group 4: Document operations (keep DocumentService)
```

### 3. Fix Case-Sensitive Duplicates
```sql
-- ClaudeService vs claudeService
UPDATE sys_shared_services
SET service_name = 'claudeService'
WHERE service_name = 'ClaudeService';

-- Then remove duplicate
DELETE FROM sys_shared_services
WHERE service_name = 'ClaudeService';
```

## Safety Checklist

Before making ANY change:
- [ ] Check current usage (even if showing 0)
- [ ] Test in dhg-service-test
- [ ] Document the decision
- [ ] Create compatibility layer if needed
- [ ] Update imports gradually
- [ ] Monitor for errors

## Daily Progress Tracking

```sql
-- Run daily to track progress
SELECT 
  DATE(NOW()) as date,
  COUNT(*) as total_services,
  COUNT(*) FILTER (WHERE service_type = 'infrastructure') as infrastructure,
  COUNT(*) FILTER (WHERE service_type = 'business') as business,
  COUNT(*) FILTER (WHERE service_type = 'hybrid') as hybrid,
  COUNT(DISTINCT CASE 
    WHEN service_name IN (SELECT unnest(overlaps_with) FROM sys_shared_services WHERE overlaps_with IS NOT NULL)
    THEN service_name 
  END) as duplicates_remaining
FROM sys_shared_services;
```

## Risk Mitigation

1. **Never bulk update** - Review each service individually
2. **Test everything** - Use dhg-service-test for validation
3. **Deprecate first** - Give time for migration
4. **Keep backups** - Archive before removing
5. **Monitor errors** - Watch logs after changes

## Expected Outcomes

Week 1: Usage tracking implemented, 5 infrastructure services properly classified
Week 2: Top 20 services reviewed and classified correctly
Week 3: Major duplicate groups consolidated (50% reduction in duplicates)
Week 4: Pattern mismatches fixed, all services follow correct patterns
Week 5: Unused services archived, clean service registry

## Remember

- **Small steps** - One service at a time
- **Test always** - Before and after changes
- **Document why** - Future you will thank you
- **Usage drives decisions** - Get accurate data first
- **Safety first** - Better slow and correct than fast and broken