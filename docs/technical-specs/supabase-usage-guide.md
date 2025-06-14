# Supabase Usage Guide - Consolidated Patterns

## ⚠️ CRITICAL: Use Only These Approved Patterns

There is only ONE Supabase singleton service. Do not create new Supabase services or adapters.

## 1. CLI/Script Usage (Node.js Environment)

```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';

// Always use the singleton
const supabase = SupabaseClientService.getInstance().getClient();

// Make queries
const { data, error } = await supabase
  .from('table_name')
  .select('*');
```

## 2. Browser/React App Usage

```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Create adapter with environment variables
const supabase = createSupabaseAdapter({ 
  env: import.meta.env 
});

// Use in components
const { data, error } = await supabase
  .from('table_name')
  .select('*');
```

## 3. Shared Service Pattern (Dependency Injection)

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export class MyService {
  constructor(private supabase: SupabaseClient<any>) {}
  
  async myMethod() {
    const { data, error } = await this.supabase
      .from('table_name')
      .select('*');
  }
}

// Usage in CLI:
const supabase = SupabaseClientService.getInstance().getClient();
const service = new MyService(supabase);

// Usage in Browser:
const supabase = createSupabaseAdapter({ env: import.meta.env });
const service = new MyService(supabase);
```

## ❌ DO NOT CREATE

- New Supabase singleton services
- New Supabase adapter classes
- Direct createClient() calls
- Alternative Supabase wrappers

## 📊 Current Status (as of 2025-06-13)

- **Primary Service**: SupabaseClientService (packages/shared/services/supabase-client.ts)
- **Browser Adapter**: createSupabaseAdapter (packages/shared/adapters/supabase-adapter.ts)
- **Total References**: 1,285+ uses of the primary service
- **Consolidation Progress**: Removed 4 duplicate services

## 🚨 Common Mistakes to Avoid

1. **Creating a new singleton**: Use SupabaseClientService.getInstance()
2. **Direct client creation**: Use the singleton or adapter
3. **Environment confusion**: CLI uses process.env, Browser uses import.meta.env
4. **Multiple instances**: Always reuse the singleton instance

## 🔍 How to Check Your Code

```bash
# Find any direct createClient calls
grep -r "createClient" --include="*.ts" --include="*.tsx" .

# Find any new Supabase services
find . -name "*supabase*.ts" -o -name "*supabase*.tsx" | grep -v node_modules

# Check for proper singleton usage
grep -r "SupabaseClientService.getInstance()" --include="*.ts" .
```

## 📚 Migration Examples

### Before (Wrong):
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
```

### After (Correct):
```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();
```

## 🎯 Free Tier Optimization

Using a single Supabase client instance helps optimize for the free tier:
- Reduces connection count
- Prevents connection pool exhaustion
- Improves performance through connection reuse
- Easier to monitor and debug issues

## 📝 Checklist for New Code

- [ ] Using SupabaseClientService singleton for CLI/scripts?
- [ ] Using createSupabaseAdapter for browser apps?
- [ ] No direct createClient() calls?
- [ ] No new Supabase service files created?
- [ ] Following dependency injection for shared services?