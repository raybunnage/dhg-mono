# Service Classification and Environment Adaptation Patterns

## Your Questions Answered

### 1. Are all CLI pipelines using dependency injection?

**Answer: YES, but in different ways**

CLI scripts typically follow these patterns:

```typescript
// Pattern 1: Direct singleton usage in simple scripts
// scripts/cli-pipeline/google_sync/sync-files.ts
import { SupabaseClientService } from '@shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();
// Direct usage, no class wrapper needed
```

```typescript
// Pattern 2: Service class with dependency injection
// scripts/cli-pipeline/document/process-documents.ts
class DocumentProcessor {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}
}

// Usage in CLI
const processor = new DocumentProcessor(
  SupabaseClientService.getInstance().getClient(),
  Logger.getInstance()
);
```

**Key insight**: CLI scripts get infrastructure from singletons but may create business service instances with dependency injection.

### 2. Should we track service type in the database?

**Answer: YES, this would be valuable!**

Proposed database schema enhancement:

```sql
-- Add to sys_shared_services or create new tracking table
ALTER TABLE sys_shared_services ADD COLUMN IF NOT EXISTS
  service_type VARCHAR(50) CHECK (service_type IN ('infrastructure', 'business', 'hybrid')),
  instantiation_pattern VARCHAR(50) CHECK (instantiation_pattern IN ('singleton', 'dependency_injection', 'factory')),
  environment_support TEXT[] DEFAULT '{}'; -- ['browser', 'node', 'both']

-- Example entries
UPDATE sys_shared_services SET
  service_type = 'infrastructure',
  instantiation_pattern = 'singleton',
  environment_support = ARRAY['both']
WHERE service_name = 'SupabaseClientService';

UPDATE sys_shared_services SET  
  service_type = 'business',
  instantiation_pattern = 'dependency_injection',
  environment_support = ARRAY['both']
WHERE service_name = 'CLIRegistryService';
```

### 3. Does service type impact how it's built?

**Answer: ABSOLUTELY YES**

#### Infrastructure Service Pattern
```typescript
// MUST be singleton, MUST handle resources carefully
export class DatabaseConnectionService {
  private static instance: DatabaseConnectionService;
  private pool: DatabasePool;
  
  private constructor() {
    // Expensive initialization
    this.pool = createDatabasePool({
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new DatabaseConnectionService();
    }
    return this.instance;
  }
  
  // MUST handle cleanup
  async shutdown() {
    await this.pool.end();
  }
}
```

#### Business Service Pattern
```typescript
// NO singleton, receives dependencies
export class InvoiceService {
  constructor(
    private db: DatabaseClient,
    private emailService: EmailService,
    private logger: Logger
  ) {}
  
  // Pure business logic, no resource management
  async createInvoice(data: InvoiceData) {
    const invoice = await this.db.insert('invoices', data);
    await this.emailService.sendInvoiceEmail(invoice);
    this.logger.info('Invoice created', { id: invoice.id });
    return invoice;
  }
}
```

### 4. Is environment adaptation necessary for all services?

**Answer: NO, only for services that need to work in multiple environments**

#### Services That NEED Environment Adaptation

1. **Supabase Adapter** - Works in both browser and Node.js
   ```typescript
   export function createSupabaseAdapter(options) {
     const isBrowser = typeof window !== 'undefined';
     if (isBrowser) {
       // Use VITE_ prefixed env vars
     } else {
       // Use process.env
     }
   }
   ```

2. **Auth Service** - Different implementations for browser vs server
   ```typescript
   // browser-auth-service.ts - Uses localStorage
   // server-auth-service.ts - Uses session cookies
   ```

3. **File Service** - Completely different implementations
   ```typescript
   // Browser: Uses File API, blob storage
   // Server: Uses fs module, disk storage
   ```

#### Services That DON'T Need Environment Adaptation

1. **Pure Business Logic Services**
   ```typescript
   // Works the same everywhere - just processes data
   export class PricingCalculator {
     calculateDiscount(items: Item[], coupon?: Coupon) {
       // Pure computation, no environment dependencies
     }
   }
   ```

2. **Database Query Builders**
   ```typescript
   // Just builds SQL, doesn't execute
   export class QueryBuilder {
     select(table: string, columns: string[]) {
       return `SELECT ${columns.join(', ')} FROM ${table}`;
     }
   }
   ```

3. **Validation Services**
   ```typescript
   // Pure functions, no external dependencies
   export class ValidationService {
     isValidEmail(email: string): boolean {
       return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
     }
   }
   ```

## Classification Matrix

| Service | Type | Pattern | Environments | Needs Adaptation |
|---------|------|---------|--------------|------------------|
| SupabaseClientService | Infrastructure | Singleton | Both | Yes |
| CLIRegistryService | Business | Dependency Injection | Both | No |
| BrowserAuthService | Infrastructure | Singleton | Browser | N/A |
| ServerAuthService | Infrastructure | Singleton | Node.js | N/A |
| FileService | Hybrid | Factory | Both | Yes |
| Logger | Infrastructure | Singleton | Both | Yes |
| ValidationService | Business | Static/Instance | Both | No |
| ClaudeService | Infrastructure | Singleton | Node.js | N/A |
| PricingCalculator | Business | Instance | Both | No |

## Key Principles

### 1. Service Type Determines Pattern

```typescript
// Infrastructure → Singleton
if (service.managesExpensiveResources) {
  return 'singleton';
}

// Business → Dependency Injection  
if (service.implementsBusinessLogic) {
  return 'dependency-injection';
}

// Hybrid → Factory Pattern
if (service.needsDifferentImplementations) {
  return 'factory';
}
```

### 2. Environment Support Determines Complexity

```typescript
// Single environment = Simple
export class NodeOnlyService {
  readFile(path: string) {
    return fs.readFileSync(path);
  }
}

// Multiple environments = Adapter pattern
export class CrossEnvService {
  readData(source: string) {
    if (typeof window !== 'undefined') {
      return fetch(source);
    } else {
      return fs.readFile(source);
    }
  }
}
```

### 3. Business Services Can Ignore Environment

Most business services don't care about the environment because they:
- Receive infrastructure through dependency injection
- Work with abstract interfaces
- Focus on business logic, not implementation details

```typescript
// This service doesn't know or care where it runs
class OrderService {
  constructor(
    private db: DatabaseInterface,
    private email: EmailInterface
  ) {}
  
  async processOrder(order: Order) {
    // Pure business logic
    await this.db.save('orders', order);
    await this.email.send(order.customerEmail, 'Order confirmed');
  }
}
```

## Recommendations

1. **Add service classification to database**
   - Track service_type, instantiation_pattern, environment_support
   - Use this metadata to generate documentation
   - Validate service implementations against their type

2. **Create service templates**
   ```bash
   # Generate appropriate boilerplate
   ./create-service.sh --name UserService --type business --env both
   ./create-service.sh --name CacheService --type infrastructure --env node
   ```

3. **Enforce patterns through linting**
   ```typescript
   // eslint rule: infrastructure-must-be-singleton
   // eslint rule: business-no-singleton
   ```

4. **Document environment requirements**
   ```typescript
   /**
    * @service-type business
    * @pattern dependency-injection
    * @environments browser, node
    * @dependencies SupabaseClient, Logger
    */
   export class UserManagementService {
   ```

## Conclusion

Your confusion is understandable because:
1. Not all services follow the same pattern
2. Environment adaptation is only needed for some services
3. The documentation wasn't explicit about these distinctions

The key insight: **Service type (infrastructure vs business) determines the pattern, not the environment it runs in.** Environment adaptation is a separate concern that only applies to services that need to run in multiple environments.