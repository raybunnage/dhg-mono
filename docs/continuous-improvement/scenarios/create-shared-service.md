# Scenario: Create Shared Service

**Purpose**: Add a new shared service to packages/shared/services  
**Time Estimate**: 20-40 minutes  
**Complexity**: Medium

## Pre-flight Checks (3 minutes)

```bash
# 1. Check if similar service exists
ls packages/shared/services/ | grep -i "your-keyword"

# 2. Check if functionality exists elsewhere
grep -r "YourFunctionality" packages/shared --include="*.ts"

# 3. Verify this is truly shared (used by 2+ apps/scripts)
# If only one consumer, put it there instead
```

## Steps

### 1. Create Service Directory (2 minutes)
```bash
mkdir -p packages/shared/services/your-service
cd packages/shared/services/your-service
```

### 2. Create Service Class (15 minutes)

Create `YourService.ts`:
```typescript
/**
 * Your Service Description
 * Purpose: What this service does in one line
 */
export class YourService {
  private static instance: YourService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): YourService {
    if (!YourService.instance) {
      YourService.instance = new YourService();
    }
    return YourService.instance;
  }

  // Your methods here
  async doSomething(param: string): Promise<string> {
    // Implementation
    return `Processed: ${param}`;
  }
}

// Export singleton instance
export const yourService = YourService.getInstance();
```

### 3. Create Index Export (2 minutes)

Create `index.ts`:
```typescript
export * from './YourService';
```

### 4. Add Tests (10 minutes)

Create `__tests__/YourService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { yourService } from '../YourService';

describe('YourService', () => {
  it('should be a singleton', () => {
    const instance1 = yourService;
    const instance2 = yourService;
    expect(instance1).toBe(instance2);
  });

  it('should do something', async () => {
    const result = await yourService.doSomething('test');
    expect(result).toBe('Processed: test');
  });
});
```

### 5. Update Shared Services Index (2 minutes)

Edit `packages/shared/services/index.ts`:
```typescript
// Add your export
export * from './your-service';
```

### 6. Test the Service (5 minutes)
```bash
# Run tests
cd packages/shared
npm test YourService

# Build to check TypeScript
npm run build
```

## Verification Checklist
- [ ] Service follows singleton pattern (if applicable)
- [ ] Service has clear single responsibility
- [ ] Tests pass
- [ ] TypeScript compiles without errors
- [ ] Exported from shared/services/index.ts
- [ ] Can be imported in apps/scripts

## Integration Test
```bash
# Quick test in a script
cat > test-service.ts << 'EOF'
import { yourService } from '../packages/shared/services';

async function test() {
  const result = await yourService.doSomething('test');
  console.log('Result:', result);
}

test().catch(console.error);
EOF

ts-node test-service.ts
rm test-service.ts
```

## Git Checkpoint
```bash
git add -A && git commit -m "add: YourService shared service

- Purpose: {one-line description}
- Methods: {list main methods}
- Pattern: Singleton (or specify other)

Tests: All passing
Used by: {list planned consumers}

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

## Rollback if Needed
```bash
# If something went wrong
git reset --hard HEAD
rm -rf packages/shared/services/your-service
# Remove from index.ts
```

## Design Guidelines
1. **Single Responsibility**: Service does one thing well
2. **No Hard Dependencies**: Use dependency injection for Supabase, etc.
3. **Singleton Pattern**: Only for stateless services
4. **Clear Naming**: ServiceNameService (e.g., EmailService, CacheService)
5. **Minimal API**: Start with few methods, add as needed

## When NOT to Create Shared Service
- Only one consumer → Put in that app/script
- Trivial functionality → Use inline function  
- External library wrapper → Use library directly
- Business logic → Keep in app, not shared

## Next Steps
- Document usage in service file
- Add more tests as methods grow
- Monitor usage - if only one consumer after 30 days, move it there