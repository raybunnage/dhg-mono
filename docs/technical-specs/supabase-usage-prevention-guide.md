# Supabase Usage Prevention Guide

## The Problem That Keeps Happening

Despite clear instructions in CLAUDE.md, we keep creating duplicate Supabase services because:

1. **Too Many Options**: When you search for "supabase" in the codebase, you find 7+ different services
2. **Unclear Hierarchy**: It's not obvious which is the "correct" one
3. **Copy-Paste Propagation**: Developers copy from existing code that uses the wrong pattern
4. **AI Confusion**: Even AI assistants get confused by the multiple options

## The Solution: Make It Impossible to Get Wrong

### 1. File Structure Enforcement

```
packages/shared/services/
├── supabase-client/
│   ├── index.ts          ✅ The ONLY infrastructure service
│   └── README.md         ✅ "USE THIS FOR CLI/SERVER"
├── .deprecated/
│   ├── SupabaseClient.ts    ❌ MOVED HERE
│   ├── SupabaseService.ts   ❌ MOVED HERE
│   └── SupabaseAdapter.ts   ❌ MOVED HERE

apps/{app-name}/src/
└── lib/
    └── supabase.ts      ✅ The ONLY browser pattern
```

### 2. Import Path Standardization

```typescript
// ✅ ONLY TWO VALID IMPORTS IN THE ENTIRE CODEBASE

// For CLI/Server/Node environments:
import { SupabaseClientService } from '@shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();

// For Browser apps:
import { supabase } from '@/lib/supabase';  // Local to each app
```

### 3. Automated Detection and Prevention

#### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@supabase/supabase-js',
          message: 'Import from @shared/services/supabase-client or @/lib/supabase instead'
        }
      ],
      patterns: [
        {
          group: ['**/SupabaseClient', '**/SupabaseService', '**/SupabaseAdapter'],
          message: 'These are deprecated. Use SupabaseClientService or @/lib/supabase'
        }
      ]
    }],
    'no-restricted-syntax': ['error', {
      selector: 'NewExpression[callee.name="SupabaseClient"]',
      message: 'Do not instantiate SupabaseClient. Use SupabaseClientService.getInstance()'
    }]
  }
};
```

#### Pre-commit Hook
```bash
#!/bin/bash
# .husky/pre-commit

# Check for direct Supabase client creation
if git diff --cached --name-only | xargs grep -l "createClient\|new SupabaseClient\|SupabaseService\|SupabaseAdapter" 2>/dev/null; then
  echo "❌ Supabase usage error detected!"
  echo ""
  echo "Use one of these patterns instead:"
  echo "  CLI/Server: SupabaseClientService.getInstance().getClient()"
  echo "  Browser:    import { supabase } from '@/lib/supabase'"
  echo ""
  echo "See: docs/technical-specs/supabase-usage-prevention-guide.md"
  exit 1
fi
```

### 4. IDE Support

#### VS Code Snippets
```json
// .vscode/supabase.code-snippets
{
  "Supabase CLI Import": {
    "prefix": "supabase-cli",
    "body": [
      "import { SupabaseClientService } from '@shared/services/supabase-client';",
      "const supabase = SupabaseClientService.getInstance().getClient();"
    ],
    "description": "Import Supabase for CLI/Server use"
  },
  "Supabase Browser Import": {
    "prefix": "supabase-browser",
    "body": [
      "import { supabase } from '@/lib/supabase';"
    ],
    "description": "Import Supabase for Browser use"
  }
}
```

### 5. Clear Visual Indicators

```typescript
// packages/shared/services/supabase-client/index.ts
/**
 * ✅ SUPABASE CLIENT SERVICE - THE ONLY SERVER/CLI SUPABASE SERVICE
 * 
 * Usage:
 * ```typescript
 * const supabase = SupabaseClientService.getInstance().getClient();
 * ```
 * 
 * ❌ DO NOT:
 * - Create new SupabaseClient()
 * - Import from @supabase/supabase-js
 * - Use SupabaseService, SupabaseAdapter, etc.
 * 
 * 🌐 For Browser Apps: Use @/lib/supabase instead
 */
export class SupabaseClientService {
  // ... implementation
}
```

### 6. Monitoring and Alerts

```typescript
// scripts/cli-pipeline/services/check-supabase-duplication.ts
async function checkSupabaseDuplication() {
  const violations = [];
  
  // Check for new Supabase services
  const { data: services } = await supabase
    .from('sys_shared_services')
    .select('service_name, created_at')
    .ilike('service_name', '%supabase%')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Last week
    
  if (services?.some(s => s.service_name !== 'SupabaseClientService')) {
    violations.push('New Supabase service detected!');
  }
  
  // Check for direct imports
  const files = await glob('**/*.{ts,tsx,js,jsx}', { 
    ignore: ['node_modules', '.deprecated'] 
  });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    if (content.includes('@supabase/supabase-js') && 
        !file.includes('supabase-client/index.ts')) {
      violations.push(`Direct import in ${file}`);
    }
  }
  
  return violations;
}
```

### 7. Migration Checklist

- [ ] Move deprecated services to `.deprecated/` folder
- [ ] Update all imports to use correct patterns
- [ ] Add ESLint rules
- [ ] Set up pre-commit hooks
- [ ] Add VS Code snippets
- [ ] Update CLAUDE.md with warning box
- [ ] Create weekly monitoring job
- [ ] Add comments to every Supabase import

### 8. The Ultimate CLAUDE.md Update

```markdown
# ⚠️ CRITICAL: SUPABASE USAGE - ONLY TWO WAYS ⚠️

## 🚨 STOP AND READ BEFORE USING SUPABASE 🚨

### For CLI Scripts & Server Code:
```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

### For Browser Apps (React/Vite):
```typescript
import { supabase } from '@/lib/supabase';
```

### ❌ NEVER DO ANY OF THESE:
- `new SupabaseClient()`
- `import { createClient } from '@supabase/supabase-js'`
- `import { SupabaseService }`
- `import { SupabaseAdapter }`
- Create your own Supabase service

### 🚨 VIOLATIONS WILL BE CAUGHT BY:
- ESLint rules
- Pre-commit hooks
- Weekly monitoring
- Code review

### 📖 Full Guide: docs/technical-specs/supabase-usage-prevention-guide.md
```

## Making It Stick

### 1. Education
- Add this guide to onboarding docs
- Create a video showing correct usage
- Add warnings to all deprecated services

### 2. Automation
- ESLint catches errors during development
- Pre-commit hooks prevent bad commits
- CI/CD fails on violations

### 3. Monitoring
- Weekly reports on new violations
- Dashboard showing Supabase usage patterns
- Alerts for new service creation

### 4. Make Right Way Easier
- Single import path
- Clear examples everywhere
- IDE snippets for quick insertion

### 5. Make Wrong Way Harder
- Deprecated services throw warnings
- Direct imports fail linting
- Multiple barriers to creating duplicates

## Success Metrics

1. **Zero new Supabase services** created
2. **All imports use correct pattern** (weekly check)
3. **No direct createClient calls** (pre-commit catches)
4. **Single active connection** to database
5. **Clear error messages** when violations attempted

## The Psychology of Prevention

People create duplicates because:
1. They don't know which to use → Solution: Make it obvious
2. They copy existing code → Solution: Fix all existing code
3. They think they need something special → Solution: Document that they don't
4. AI suggests wrong pattern → Solution: Update training docs

By addressing each cause, we prevent the problem permanently.