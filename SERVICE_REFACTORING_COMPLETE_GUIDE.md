# 🔧 Complete Service Refactoring Guide
**For Parallel Worktree Development**

## 🎯 Overview & Context

**IMPORTANT**: You are working as part of a **3-worktree parallel refactoring effort**. Three Claude Code agents are simultaneously refactoring services across different worktrees:
- **Worktree A**: High-impact infrastructure services (19 services)
- **Worktree B**: Business logic and document processing (19 services)  
- **Worktree C**: Utilities and support services (19 services)

**Your mission**: Refactor services to extend proper base classes (SingletonService or BusinessService) following established architectural patterns, ensuring proper resource management, comprehensive testing, and complete documentation.

---

## 📋 Step-by-Step Refactoring Process

### Phase 1: Service Investigation & Duplicate Detection

#### 1.1 Verify Service Exists
```bash
# Check if the service actually exists at the specified path
ls -la /path/to/service/
find packages/shared/services -name "*service-name*" -type f
```

#### 1.2 Duplicate Detection (CRITICAL STEP)
**Before refactoring ANY service, check for duplicates:**

```bash
# Search for similar functionality across the codebase
grep -r "class.*ServiceName" packages/shared/services/
grep -r "export.*serviceName" packages/shared/services/
find packages/shared/services -name "*similar-name*"
```

**Common Duplicate Patterns:**
- Multiple auth services (AuthService, LightAuthService, BrowserAuthService)
- Multiple Google Drive services (GoogleDriveService, GoogleDrive, GoogleAuthService)
- Multiple transcription services (TranscriptionService, AudioTranscriptionService)
- Services with similar descriptions but different names

**If you find duplicates:**
1. Determine which is the "canonical" version (usually highest usage)
2. Document the consolidation plan in your commit message
3. Refactor the canonical version, archive the duplicates

#### 1.3 Exclude Non-Services
**Do NOT refactor these:**
- Files ending in `types.ts` or `index.ts`
- Utility functions, clients, or interfaces (e.g., `ServiceClient`, `UtilityHelper`)
- Services with 0 usage that appear experimental
- Files that are just type definitions or re-exports

---

### Phase 2: Base Class Selection

#### 2.1 SingletonService (For Infrastructure Services)
**Use when the service manages expensive resources:**
- Database connections
- External API clients (Google Drive, Claude AI, etc.)
- Authentication sessions
- File system operations
- Cache management
- Network connections

**Example**: AuthService, GoogleDriveService, SupabaseService, ClaudeService

#### 2.2 BusinessService (For Business Logic Services)
**Use when the service handles business logic with dependency injection:**
- Document classification
- User profile management  
- Task management
- Content processing
- Report generation
- Data transformation

**Example**: DocumentClassificationService, UserProfileService, TaskService

#### 2.3 How to Decide
```typescript
// Infrastructure Service → SingletonService
class GoogleDriveService extends SingletonService {
  // Manages expensive Google API connections
  // One instance per application
}

// Business Logic → BusinessService  
class TaskService extends BusinessService {
  constructor(private supabase: SupabaseClient, private logger: Logger) {
    // Dependency injection pattern
    // Can have multiple instances with different dependencies
  }
}
```

---

### Phase 3: 4-Checkpoint Migration Process

#### Checkpoint 1: Baseline
```bash
git add -A && git commit -m "checkpoint: baseline - ServiceName migration start"
```

#### Checkpoint 2: Migration Implementation

**2.1 Create Refactored Service Directory**
```bash
mkdir packages/shared/services/service-name-refactored/
```

**2.2 Implement Refactored Service**

**For SingletonService Pattern:**
```typescript
import { SingletonService } from '../base-classes/SingletonService';

interface ServiceConfig {
  // Configuration options
}

interface ServiceMetrics {
  // Performance and usage metrics
}

class YourService extends SingletonService {
  private static instance: YourService;
  private config: ServiceConfig;
  private metrics: ServiceMetrics = {
    // Initialize metrics
  };

  protected constructor(config: ServiceConfig = {}) {
    super('YourService');
    this.config = { /* defaults */, ...config };
  }

  public static getInstance(config?: ServiceConfig): YourService {
    if (!YourService.instance) {
      YourService.instance = new YourService(config);
    }
    return YourService.instance;
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    // Service initialization logic
  }

  protected async cleanup(): Promise<void> {
    await this.releaseResources();
  }

  // SingletonService requirement
  protected async releaseResources(): Promise<void> {
    // Clean up expensive resources
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    // Health check implementation
    return { healthy: true, details: {}, timestamp: new Date() };
  }

  // Public API methods
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }
}

export { YourService };
```

**For BusinessService Pattern:**
```typescript
import { BusinessService } from '../base-classes/BusinessService';

class YourService extends BusinessService {
  constructor(
    private supabase: SupabaseClient,
    private logger?: Logger
  ) {
    super('YourService', logger);
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    // Service initialization logic
  }

  protected async cleanup(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    // Health check implementation
    return { healthy: true, details: {}, timestamp: new Date() };
  }

  // Business logic methods
}

export { YourService };
```

**2.3 Key Implementation Requirements:**
- **No direct exports of instances** (export class only)
- **Proper error handling** with try/catch blocks
- **Comprehensive logging** using `this.logger?.info/error/warn/debug`
- **Metrics tracking** for performance monitoring
- **Environment compatibility** (abstract Node.js dependencies if needed)
- **Resource cleanup** in releaseResources/cleanup methods

**2.4 Commit Migration**
```bash
git add -A && git commit -m "checkpoint: migrated - ServiceName refactored to extend [SingletonService|BusinessService]"
```

#### Checkpoint 3: Testing & Validation

**3.1 Create Comprehensive Test Suite**
Create `ServiceName.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YourService } from './YourService';

// Mock dependencies
vi.mock('../dependency-service', () => ({
  DependencyService: {
    getInstance: vi.fn(() => mockDependency)
  }
}));

describe('YourService', () => {
  let service: YourService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = YourService.getInstance();
      const instance2 = YourService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      service = YourService.getInstance();
      // Test initialization
    });

    it('should handle health checks', async () => {
      service = YourService.getInstance();
      const health = await service.healthCheck();
      expect(health.healthy).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Core Functionality', () => {
    // Test main service methods
  });

  describe('Error Handling', () => {
    // Test error scenarios
  });

  describe('Metrics', () => {
    // Test metrics tracking
  });
});
```

**3.2 Create Performance Benchmark (Optional)**
Create `benchmark.ts` for performance testing:

```typescript
import { YourService } from './YourService';

async function benchmark() {
  console.log('Starting YourService benchmark...');
  
  const service = YourService.getInstance();
  
  try {
    // Benchmark key operations
    const start = Date.now();
    const health = await service.healthCheck();
    const duration = Date.now() - start;
    
    console.log(`✓ Health check: ${duration}ms (healthy: ${health.healthy})`);
    console.log('✅ Benchmark completed successfully');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

export { benchmark };
```

**3.3 Commit Validation**
```bash
git add -A && git commit -m "checkpoint: validated - ServiceName tests and benchmarks complete"
```

#### Checkpoint 4: Documentation & Finalization

**4.1 Create Migration Documentation**
Create `MIGRATION.md`:

```markdown
# ServiceName Migration Documentation

## Migration Summary
- **Service**: ServiceName
- **Migration Date**: 2025-06-14
- **Migration Type**: Refactoring to extend [SingletonService|BusinessService]
- **Status**: ✅ Completed
- **Breaking Changes**: ❌ None

## What Was Migrated

### Original Implementation Issues
1. [List specific issues with the original implementation]

### Refactored Implementation  
1. [List improvements in the refactored version]

## Key Improvements
[Detailed before/after code examples]

## Migration Path
[Instructions for updating existing code]

## Testing
[Description of test coverage]

## Performance Impact
[Benchmarks and performance notes]

## File Structure
[Directory structure of refactored service]
```

**4.2 Create Index File**
Create `index.ts`:

```typescript
export { YourService } from './YourService';
export * from './types';
// Export any additional interfaces/types
```

**4.3 Update Database Record**
```typescript
const now = new Date().toISOString();

await supabase
  .from('sys_shared_services')
  .update({
    migration_status: 'completed',
    migration_completed_at: now,
    service_path: 'service-name-refactored/',
    migration_notes: 'Brief description of refactoring',
    base_class_type: 'SingletonService', // or 'BusinessService'
    service_type: 'infrastructure', // or 'business'
    instantiation_pattern: 'singleton', // or 'dependency_injection'
    requires_initialization: true,
    updated_at: now
  })
  .eq('service_name', 'ServiceName');
```

**4.4 Archive Original Service**
```bash
# Get current date for archiving
DATE=$(date +%Y%m%d)

# Create archive directory
mkdir -p packages/shared/services/service-name-refactored/.archived_services/

# Archive original service
cp -r packages/shared/services/original-service/* \
  packages/shared/services/service-name-refactored/.archived_services/original-service.$DATE/
```

**4.5 Final Commit**
```bash
git add -A && git commit -m "checkpoint: finalized - ServiceName migration complete with documentation and archival"
```

---

## 🚨 Critical Requirements & Common Pitfalls

### ✅ Requirements Checklist
- [ ] Service extends proper base class (SingletonService or BusinessService)
- [ ] No direct instance exports (export class only)
- [ ] Comprehensive error handling with logging
- [ ] Health check implementation
- [ ] Metrics tracking
- [ ] Resource cleanup in releaseResources/cleanup
- [ ] 100% backwards compatibility (no breaking changes)
- [ ] Comprehensive test suite
- [ ] Migration documentation
- [ ] Database record updated
- [ ] Original service archived

### ❌ Common Pitfalls to Avoid
1. **Flawed Singleton Pattern**: Never export instances directly
2. **Missing Resource Cleanup**: Always implement proper cleanup
3. **Node.js Dependencies in Browser Code**: Use environment abstraction
4. **No Error Handling**: Always wrap operations in try/catch
5. **Missing Logging**: Use `this.logger?.method()` consistently
6. **Breaking Changes**: Maintain API compatibility
7. **Incomplete Testing**: Cover all major functionality
8. **Missing Documentation**: Always create MIGRATION.md

### 🔍 Code Quality Standards
- **TypeScript**: Use explicit types, no `any`
- **Error Handling**: Graceful degradation with meaningful error messages
- **Logging**: Structured logging with appropriate levels
- **Performance**: Lazy initialization, efficient resource usage
- **Security**: No hardcoded credentials, proper input validation

---

## 🗃️ Database Integration Patterns

### Service Registration
```typescript
// Check if service exists in database
const { data: existingService } = await supabase
  .from('sys_shared_services')
  .select('*')
  .eq('service_name', 'ServiceName')
  .single();

if (!existingService) {
  // Register new service
  await supabase.from('sys_shared_services').insert({
    service_name: 'ServiceName',
    service_path: 'service-name-refactored/',
    description: 'Service description',
    // ... other fields
  });
}
```

### Migration Tracking
```typescript
// Update migration status
await supabase
  .from('sys_shared_services')
  .update({
    migration_status: 'completed',
    migration_completed_at: new Date().toISOString(),
    base_class_type: 'SingletonService',
    service_type: 'infrastructure'
  })
  .eq('service_name', 'ServiceName');
```

---

## 🧪 Testing Patterns

### Singleton Testing
```typescript
describe('Singleton Pattern', () => {
  it('should return same instance', () => {
    const instance1 = Service.getInstance();
    const instance2 = Service.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should accept configuration', () => {
    const service = Service.getInstance({ option: 'value' });
    expect(service).toBeInstanceOf(Service);
  });
});
```

### Business Service Testing
```typescript
describe('Business Service', () => {
  it('should inject dependencies correctly', () => {
    const service = new BusinessService(mockSupabase, mockLogger);
    expect(service).toBeInstanceOf(BusinessService);
  });
});
```

### Health Check Testing
```typescript
describe('Health Check', () => {
  it('should return healthy status', async () => {
    const health = await service.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.timestamp).toBeInstanceOf(Date);
    expect(health.details).toBeDefined();
  });
});
```

---

## 📊 Progress Tracking

### Worktree Coordination
- **Check progress**: Review other worktrees' commits to avoid conflicts
- **Share learnings**: Document unique patterns or issues for other agents
- **Coordinate database updates**: Avoid simultaneous database modifications

### Success Metrics
- **Services refactored**: Count completed migrations
- **Test coverage**: Ensure comprehensive testing
- **Performance**: Benchmark improvements
- **Documentation quality**: Complete migration guides

---

## 🎯 Final Deliverables Per Service

1. **Refactored service** extending proper base class
2. **Comprehensive test suite** with >90% coverage
3. **Migration documentation** with before/after examples
4. **Performance benchmarks** (where applicable)
5. **Updated database record** with migration status
6. **Archived original service** with date stamp
7. **Index file** for clean exports

---

## 🔄 Continuous Coordination

Remember you're part of a **3-agent parallel effort**:
- **Monitor other worktrees** for conflicts or shared learnings
- **Document unique patterns** for other agents to follow
- **Maintain consistent quality** across all refactored services
- **Share critical discoveries** about service architecture

**Success depends on consistency, quality, and coordination across all three worktrees!** 🚀