# Service Architecture Diagram

## Visual Service Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                           │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Component  │  │   Component  │  │   Component  │             │
│  │      A       │  │      B       │  │      C       │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                      │
│         ▼                  ▼                  ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Service    │  │   Service    │  │   Service    │ ◄─── Multiple│
│  │   Instance   │  │   Instance   │  │   Instance   │     Instances│
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     OK!     │
└─────────┼──────────────────┼──────────────────┼────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BUSINESS SERVICE LAYER                          │
│                    (Dependency Injection Pattern)                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  new CLIRegistryService(supabase)  ◄─── Injected dependency│    │
│  │  new UserService(supabase)         ◄─── Not singletons    │    │
│  │  new TaskService(supabase, logger) ◄─── That's OK!        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                            │                                         │
│                            ▼                                         │
│         All use the SAME infrastructure instances                   │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                              │
│                      (Singleton Pattern)                             │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │    Supabase     │  │    Claude AI    │  │     Logger      │    │
│  │   (SINGLETON)   │  │   (SINGLETON)   │  │   (SINGLETON)   │    │
│  │                 │  │                 │  │                 │    │
│  │ One DB          │  │ One API         │  │ One log         │    │
│  │ connection      │  │ connection      │  │ handler         │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                      │
│  ⚠️  NEVER create multiple instances of these!                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Code Examples

### ❌ WRONG: Creating infrastructure clients
```typescript
// Component A
const supabase1 = createClient(url, key); // ❌ New connection!

// Component B  
const supabase2 = createClient(url, key); // ❌ Another connection!

// Result: Multiple database connections = BAD
```

### ✅ CORRECT: Using singleton infrastructure
```typescript
// infrastructure-init.ts
export const supabase = SupabaseClientService.getInstance().getClient();

// Component A
import { supabase } from './infrastructure-init';
const serviceA = new CLIRegistryService(supabase); // ✅ Same connection

// Component B
import { supabase } from './infrastructure-init';
const serviceB = new UserService(supabase); // ✅ Same connection

// Result: One database connection shared = GOOD
```

## The CLIRegistryService Example

```typescript
// Page 1: CLI Commands Registry
const registryService1 = new CLIRegistryService(supabase);
// Creates instance #1 of CLIRegistryService
// Uses THE SAME supabase singleton

// Page 2: Command Dashboard  
const registryService2 = new CLIRegistryService(supabase);
// Creates instance #2 of CLIRegistryService
// Still uses THE SAME supabase singleton

// This is CORRECT because:
// - Only ONE database connection (supabase singleton)
// - Multiple lightweight service instances
// - Each page manages its own instance lifecycle
// - No shared state between pages
```

## Browser vs CLI Execution

```
BROWSER                           PROXY SERVER                      CLI ENVIRONMENT
┌─────────────┐                  ┌──────────────┐                 ┌───────────────┐
│             │    HTTP POST     │              │   exec()        │               │
│  Browser    │ ───────────────► │   Express    │ ──────────────►│  CLI Script   │
│  App        │  /api/execute    │   Server     │  ts-node       │  (Node.js)    │
│             │ ◄─────────────── │              │ ◄──────────────│               │
│             │    JSON Result   │              │   stdout        │               │
└─────────────┘                  └──────────────┘                 └───────────────┘
     │                                   │                                │
     │                                   │                                │
     ▼                                   ▼                                ▼
 Can't access:                    Bridge between:                   Has access to:
 - File system                    - Browser limits                  - File system
 - Node modules                   - CLI capabilities                - Node modules  
 - Child processes                                                  - Child processes
```

## Summary

1. **Singleton Pattern** = One instance forever (infrastructure)
2. **Dependency Injection** = New instances with shared dependencies (business logic)
3. **CLIRegistryService** = Business service, uses DI pattern correctly
4. **Browser Limitation** = Can't run CLI directly, needs proxy server
5. **CLAUDE.md guidance** = About infrastructure singletons, not all services