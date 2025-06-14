# Singleton vs Dependency Injection Patterns in DHG Monorepo

## Executive Summary

This document clarifies the confusion around singleton patterns vs dependency injection in our codebase, specifically addressing the CLIRegistryService case and providing clear guidelines for when to use each pattern.

**Key Finding**: The CLAUDE.md requirement for "always use existing singletons" specifically refers to **infrastructure services** (Supabase, Claude AI) that manage expensive resources. It does NOT mean all services must be singletons.

## Table of Contents

1. [Understanding Singleton Pattern](#understanding-singleton-pattern)
2. [Understanding Dependency Injection](#understanding-dependency-injection)
3. [When to Use Each Pattern](#when-to-use-each-pattern)
4. [The CLIRegistryService Case Study](#the-cliregistryservice-case-study)
5. [Browser vs Server Considerations](#browser-vs-server-considerations)
6. [Best Practices and Guidelines](#best-practices-and-guidelines)
7. [Common Misconceptions](#common-misconceptions)

## Understanding Singleton Pattern

### What is a Singleton?

A singleton is a design pattern that ensures only ONE instance of a class exists throughout the application lifecycle.

```typescript
// Example: Singleton Pattern
class MySingletonService {
  private static instance: MySingletonService;
  
  private constructor() {
    // Private constructor prevents direct instantiation
  }
  
  static getInstance(): MySingletonService {
    if (!this.instance) {
      this.instance = new MySingletonService();
    }
    return this.instance;
  }
}

// Usage - always returns the same instance
const service1 = MySingletonService.getInstance();
const service2 = MySingletonService.getInstance();
console.log(service1 === service2); // true - same instance!
```

### Why Use Singletons?

1. **Resource Management**: Prevents multiple expensive connections (database, API clients)
2. **State Consistency**: Ensures global state is managed in one place
3. **Memory Efficiency**: Avoids duplicate instances of heavy objects
4. **Connection Pooling**: Manages limited resources effectively

### Problems with Singletons

1. **Testing Difficulty**: Hard to mock or reset between tests
2. **Hidden Dependencies**: Not clear what a class depends on
3. **Global State**: Can lead to unexpected side effects
4. **Tight Coupling**: Creates hard dependencies throughout codebase

## Understanding Dependency Injection

### What is Dependency Injection?

Dependency injection is a pattern where dependencies are provided to a class rather than created by it.

```typescript
// Example: Dependency Injection Pattern
class MyService {
  constructor(private supabase: SupabaseClient) {
    // Dependencies are injected, not created
  }
  
  async getData() {
    return this.supabase.from('table').select('*');
  }
}

// Usage - you control the dependencies
const supabase = createSupabaseClient();
const service1 = new MyService(supabase);
const service2 = new MyService(supabase); // Same supabase, different service instance
```

### Why Use Dependency Injection?

1. **Testability**: Easy to mock dependencies
2. **Flexibility**: Can use different implementations
3. **Explicit Dependencies**: Clear what a class needs
4. **Loose Coupling**: Classes don't depend on specific implementations

## When to Use Each Pattern

### Use Singletons For:

1. **Infrastructure Services** (What CLAUDE.md refers to)
   ```typescript
   // ✅ CORRECT: Expensive connection management
   const supabase = SupabaseClientService.getInstance().getClient();
   const claude = claudeService; // Pre-initialized singleton
   ```

2. **Global Configuration**
   ```typescript
   // ✅ CORRECT: App-wide settings
   const config = ConfigService.getInstance();
   ```

3. **Resource Pools**
   ```typescript
   // ✅ CORRECT: Connection pooling
   const dbPool = DatabasePool.getInstance();
   ```

### Use Dependency Injection For:

1. **Business Logic Services**
   ```typescript
   // ✅ CORRECT: Service that uses infrastructure
   const registryService = new CLIRegistryService(supabase);
   ```

2. **Feature-Specific Services**
   ```typescript
   // ✅ CORRECT: Page-specific functionality
   const taskService = new TaskService(supabase, logger);
   ```

3. **Testable Components**
   ```typescript
   // ✅ CORRECT: Easy to test with mocks
   const authManager = new AuthManager(authService, userService);
   ```

## The CLIRegistryService Case Study

### Why CLIRegistryService Uses Dependency Injection

```typescript
// From dhg-admin-code
const registryService = new CLIRegistryService(supabase);
```

**This is CORRECT because:**

1. **It's a business service, not infrastructure**
   - CLIRegistryService provides business logic for managing CLI commands
   - It's not managing expensive resources like database connections

2. **It uses infrastructure, doesn't provide it**
   - Takes a Supabase client as dependency
   - Doesn't create or manage the connection itself

3. **Multiple instances are fine**
   - Each page/component can have its own instance
   - No shared state between instances
   - No resource waste (just lightweight objects)

4. **Testability is important**
   - Easy to test with mock Supabase client
   - Can test different scenarios with different clients

### What CLAUDE.md Actually Means

When CLAUDE.md says:
> "**Singleton Services**: Always use existing singletons:
> - ⚠️ **Supabase**: `SupabaseClientService.getInstance().getClient()`
> - ⚠️ **Claude AI**: `import { claudeService } from '...';`
> - ⚠️ **NEVER create direct clients**"

It means:
- ✅ Don't create new Supabase/Claude clients (expensive)
- ✅ Use the singleton infrastructure services
- ❌ It does NOT mean all services must be singletons
- ❌ It does NOT prohibit dependency injection for business services

## Browser vs Server Considerations

### Browser Environment

```typescript
// Browser: Lightweight, single-user context
const supabase = createSupabaseAdapter({ env: import.meta.env });
const registryService = new CLIRegistryService(supabase);
// Each browser tab could have its own instance - that's fine!
```

### Server/CLI Environment

```typescript
// Server: Shared resources, multiple users
const supabase = SupabaseClientService.getInstance().getClient();
const registryService = new CLIRegistryService(supabase);
// Still not a singleton - just uses singleton infrastructure
```

### CLI Commands from Browser

You're correct that CLI commands can't run directly in the browser. Here's why:

1. **Node.js Dependencies**: CLI scripts use fs, path, child_process
2. **File System Access**: Browsers can't access local files
3. **Process Execution**: Browsers can't spawn processes

**Solution**: Proxy server pattern
```typescript
// Browser side
const result = await fetch('/api/execute-cli', {
  method: 'POST',
  body: JSON.stringify({ command: 'sync', args: [...] })
});

// Server side (proxy)
app.post('/api/execute-cli', async (req, res) => {
  const { command, args } = req.body;
  const result = await executeCommand(command, args);
  res.json(result);
});
```

## Best Practices and Guidelines

### 1. Infrastructure vs Business Services

```typescript
// Infrastructure (Singleton) - Manages expensive resources
class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient;
  
  static getInstance() { /* singleton logic */ }
}

// Business Service (Dependency Injection) - Uses infrastructure
class UserManagementService {
  constructor(private supabase: SupabaseClient) {}
  
  async getUsers() {
    return this.supabase.from('users').select('*');
  }
}
```

### 2. Service Initialization Timing

```typescript
// Early initialization (app startup)
// infrastructure-init.ts
export const supabase = createSupabaseAdapter({ env: import.meta.env });
export const authService = BrowserAuthService.initialize(supabase);

// Late initialization (when needed)
// in-component.tsx
const handleClick = () => {
  const registryService = new CLIRegistryService(supabase);
  const data = await registryService.getPipelines();
};
```

### 3. Testing Patterns

```typescript
// Dependency Injection - Easy to test
describe('CLIRegistryService', () => {
  it('should get pipelines', async () => {
    const mockSupabase = createMockSupabase();
    const service = new CLIRegistryService(mockSupabase);
    const result = await service.getPipelines();
    expect(result).toHaveLength(3);
  });
});

// Singleton - Harder to test
describe('SupabaseClientService', () => {
  beforeEach(() => {
    // Need to reset singleton state - tricky!
    SupabaseClientService['instance'] = null;
  });
});
```

## Common Misconceptions

### Misconception 1: "All services must be singletons"

**Reality**: Only infrastructure services managing expensive resources should be singletons.

### Misconception 2: "Dependency injection violates CLAUDE.md"

**Reality**: CLAUDE.md specifically warns against creating new infrastructure clients, not against dependency injection patterns.

### Misconception 3: "Multiple service instances waste resources"

**Reality**: Business service instances are lightweight objects. The expensive part (database connection) is managed by the singleton infrastructure.

### Misconception 4: "Singletons are always better"

**Reality**: Singletons make testing harder and create hidden dependencies. Use them only when truly needed.

## Recommendations

1. **Keep infrastructure services as singletons**
   - SupabaseClientService
   - Claude AI Service
   - Logger (if it manages file handles)

2. **Use dependency injection for business services**
   - CLIRegistryService
   - UserService
   - TaskService
   - Any feature-specific service

3. **Be explicit about dependencies**
   ```typescript
   // ✅ GOOD: Clear what this service needs
   constructor(
     private supabase: SupabaseClient,
     private logger: Logger,
     private config: Config
   ) {}
   
   // ❌ BAD: Hidden dependencies
   constructor() {
     this.supabase = SupabaseClientService.getInstance().getClient();
     this.logger = Logger.getInstance();
     this.config = Config.getInstance();
   }
   ```

4. **Document service patterns**
   ```typescript
   /**
    * UserService - Business logic for user management
    * Pattern: Dependency Injection
    * Dependencies: SupabaseClient, Logger
    * 
    * @example
    * const userService = new UserService(supabase, logger);
    */
   ```

## Conclusion

The CLIRegistryService pattern is **correct** and does **not** violate CLAUDE.md guidelines. The confusion arose from misinterpreting "always use singleton services" to mean "all services must be singletons" when it actually means "always use THE singleton services (for infrastructure)".

**Key Takeaways**:
1. Infrastructure services (Supabase, Claude) → Singleton
2. Business services (CLIRegistry, User, Task) → Dependency Injection
3. Browser can't run CLI directly → Need proxy server
4. Multiple lightweight instances are fine → The expensive resources are managed by singletons
5. Dependency injection improves testability and flexibility

This pattern provides the best of both worlds: efficient resource management through singleton infrastructure, and flexible, testable business logic through dependency injection.