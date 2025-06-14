# Service Class Architecture Pilot Plan

## Overview
Create a standardized class hierarchy for ~120 services to ensure consistency, maintainability, and proper pattern implementation.

## Proposed Base Class Hierarchy

### 1. BaseService (Abstract)
Common functionality for all services:
```typescript
export abstract class BaseService {
  protected readonly serviceName: string;
  protected readonly logger?: Logger;
  protected initialized: boolean = false;
  
  constructor(serviceName: string, logger?: Logger) {
    this.serviceName = serviceName;
    this.logger = logger;
  }
  
  // Lifecycle hooks
  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  
  // Health check
  abstract healthCheck(): Promise<{ healthy: boolean; details?: any }>;
  
  // Metadata
  getMetadata(): ServiceMetadata {
    return {
      name: this.serviceName,
      initialized: this.initialized,
      type: this.constructor.name
    };
  }
}
```

### 2. SingletonService (Infrastructure)
For services that manage expensive resources:
```typescript
export abstract class SingletonService extends BaseService {
  private static instances: Map<string, SingletonService> = new Map();
  
  protected constructor(serviceName: string, logger?: Logger) {
    super(serviceName, logger);
  }
  
  protected static getInstance<T extends SingletonService>(
    this: new(...args: any[]) => T,
    serviceName: string,
    factory: () => T
  ): T {
    if (!SingletonService.instances.has(serviceName)) {
      SingletonService.instances.set(serviceName, factory());
    }
    return SingletonService.instances.get(serviceName) as T;
  }
  
  // Resource management
  protected abstract releaseResources(): Promise<void>;
}
```

### 3. BusinessService (Business Logic)
For services implementing business logic with dependency injection:
```typescript
export abstract class BusinessService extends BaseService {
  protected readonly dependencies: ServiceDependencies;
  
  constructor(serviceName: string, dependencies: ServiceDependencies, logger?: Logger) {
    super(serviceName, logger);
    this.dependencies = dependencies;
    this.validateDependencies();
  }
  
  protected abstract validateDependencies(): void;
  
  // Transaction support
  protected async withTransaction<T>(
    operation: (transaction: any) => Promise<T>
  ): Promise<T> {
    // Transaction handling
  }
}
```

### 4. AdapterService (External Integration)
For services that adapt external APIs/resources:
```typescript
export abstract class AdapterService<TConfig, TClient> extends BaseService {
  protected client?: TClient;
  protected config: TConfig;
  
  constructor(serviceName: string, config: TConfig, logger?: Logger) {
    super(serviceName, logger);
    this.config = config;
  }
  
  protected abstract createClient(config: TConfig): TClient;
  protected abstract validateConfig(config: TConfig): void;
  
  // Retry logic
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    // Retry implementation
  }
}
```

### 5. HybridService (Combined Patterns)
For services that need multiple patterns:
```typescript
export abstract class HybridService extends BaseService {
  // Combines aspects of other service types
  // Used sparingly for complex services
}
```

## Pilot Implementation: Supabase Services

### Phase 1: Implement Base Classes
Create the base class hierarchy in `packages/shared/services/base-classes/`

### Phase 2: Migrate Supabase Services

#### 1. SupabaseClientService → SingletonService
```typescript
export class SupabaseClientService extends SingletonService {
  private client?: SupabaseClient;
  
  static getInstance(): SupabaseClientService {
    return this.getInstance('SupabaseClientService', () => 
      new SupabaseClientService()
    );
  }
  
  protected async initialize(): Promise<void> {
    // Load config and create client
  }
  
  getClient(): SupabaseClient {
    if (!this.client) throw new Error('Service not initialized');
    return this.client;
  }
}
```

#### 2. SupabaseService → BusinessService
```typescript
export class SupabaseService extends BusinessService {
  constructor(supabaseClient: SupabaseClient, logger?: Logger) {
    super('SupabaseService', { supabaseClient }, logger);
  }
  
  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('SupabaseClient is required');
    }
  }
}
```

#### 3. SupabaseAdapter → AdapterService
```typescript
export class SupabaseAdapter extends AdapterService<SupabaseConfig, SupabaseClient> {
  constructor(config: SupabaseConfig, logger?: Logger) {
    super('SupabaseAdapter', config, logger);
  }
  
  protected createClient(config: SupabaseConfig): SupabaseClient {
    return createClient(config.url, config.anonKey, config.options);
  }
}
```

## Implementation Plan

### Week 1: Foundation
1. **Day 1-2**: Create base classes with comprehensive tests
2. **Day 3-4**: Create migration utilities and codemods
3. **Day 5**: Document patterns and create examples

### Week 2: Pilot
1. **Day 1-2**: Migrate SupabaseClientService
2. **Day 3-4**: Migrate SupabaseService and Adapter
3. **Day 5**: Integration testing

### Week 3: Evaluation
1. **Day 1-2**: Performance testing
2. **Day 3-4**: Developer feedback
3. **Day 5**: Refinements

## Safety Measures

### 1. Parallel Implementation
- Keep existing services working
- New classes alongside old
- Feature flag for switching

### 2. Migration Strategy
```typescript
// Temporary wrapper for backward compatibility
export class SupabaseClientServiceCompat {
  private newService: SupabaseClientService;
  
  getInstance() {
    // Delegate to new implementation
    return this.newService.getClient();
  }
}
```

### 3. Rollback Plan
- Git tags at each migration point
- Database tracking of migrated services
- One-command rollback script

## Integration with Existing Systems

### 1. Service Registry Updates
```sql
-- Add to sys_shared_services
ALTER TABLE sys_shared_services 
ADD COLUMN base_class_type VARCHAR(50),
ADD COLUMN migration_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN migration_date TIMESTAMP;
```

### 2. Checklist Integration
Update existing checklists:
- [ ] Service extends appropriate base class
- [ ] Implements all abstract methods
- [ ] Has comprehensive tests
- [ ] Documentation updated
- [ ] Performance benchmarked

### 3. Tracking Dashboard
Create migration dashboard showing:
- Services by base class type
- Migration progress
- Performance comparisons
- Test coverage

## Success Metrics
1. **Code Consistency**: 90%+ services following patterns
2. **Test Coverage**: Maintain or improve existing coverage
3. **Performance**: No degradation (±5%)
4. **Developer Satisfaction**: Survey feedback

## Decision Points
1. **After Pilot**: Continue with full migration?
2. **Base Class Refinements**: What changes needed?
3. **Pattern Exceptions**: Which services need custom handling?

## Next Steps
1. Review and approve base class design
2. Create proof-of-concept branch
3. Implement base classes with tests
4. Begin SupabaseClientService migration
5. Schedule weekly reviews