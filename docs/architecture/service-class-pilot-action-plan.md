# Service Class Architecture - Pilot Action Plan

## Executive Summary
We're implementing a standardized base class architecture for ~120 services to ensure consistency and maintainability. Using the 3 Supabase services as our pilot, we'll validate the approach before rolling out to all services.

## Base Class Categories

### 1. **SingletonService** (Infrastructure)
- **Purpose**: Services that manage expensive resources (DB connections, API clients)
- **Examples**: SupabaseClientService, ClaudeService, Logger
- **Key Features**: 
  - Single instance per process
  - Resource cleanup
  - Thread-safe initialization

### 2. **BusinessService** (Business Logic)
- **Purpose**: Services implementing business logic with dependency injection
- **Examples**: UserProfileService, DocumentService, ExpertService
- **Key Features**:
  - Dependency injection
  - Transaction support
  - Easy to test with mocks

### 3. **AdapterService** (External Integration)
- **Purpose**: Services adapting external APIs for different environments
- **Examples**: SupabaseAdapter (browser), GoogleDriveAdapter
- **Key Features**:
  - Environment-specific config
  - Retry logic
  - Error normalization

### 4. **HybridService** (Special Cases)
- **Purpose**: Complex services needing multiple patterns
- **Use sparingly**: Only when other patterns don't fit

## Pilot Plan: Supabase Services

### Services to Migrate:
1. **SupabaseClientService** → SingletonService
2. **SupabaseService** → BusinessService  
3. **createSupabaseAdapter** → AdapterService

### Timeline: 3 Weeks

#### Week 1: Foundation (Days 1-5)
- [ ] Create base classes in `packages/shared/services/base-classes/`
- [ ] Add comprehensive tests for base classes
- [ ] Run migration SQL to add tracking tables
- [ ] Create migration utilities

#### Week 2: Pilot Implementation (Days 6-10)
- [ ] Day 6-7: Migrate SupabaseClientService
  ```bash
  ./scripts/cli-pipeline/service-migration/migrate-service.ts start SupabaseClientService SingletonService --pilot
  ```
- [ ] Day 8-9: Migrate SupabaseService & Adapter
- [ ] Day 10: Integration testing

#### Week 3: Evaluation (Days 11-15)
- [ ] Performance benchmarking
- [ ] Developer feedback sessions
- [ ] Refinements based on learnings
- [ ] Go/No-Go decision for full rollout

## Integration with Existing Systems

### 1. Database Tracking
- Migration status in `sys_shared_services` table
- Task tracking in `sys_service_migration_tasks`
- Progress view: `sys_service_migration_progress_view`

### 2. CLI Commands
```bash
# Start migration
./migrate-service.ts start SupabaseClientService SingletonService

# Check status
./migrate-service.ts status

# Complete tasks
./migrate-service.ts complete-task SupabaseClientService add_tests

# Record metrics
./migrate-service.ts record-metrics SupabaseClientService baseline --memory 50 --init-time 100
```

### 3. Existing Checklists Enhanced
- Service standards checklist updated
- New items for base class compliance
- Automated validation where possible

## Safety Measures

### 1. Feature Flags
```typescript
// Use environment variable to switch implementations
process.env.USE_REFACTORED_SUPABASE = 'true'
```

### 2. Parallel Running
- Old and new services coexist
- Gradual migration path
- Easy rollback

### 3. Compatibility Layer
```typescript
// Temporary wrapper maintains old API
export const SupabaseClientService = process.env.USE_REFACTORED 
  ? SupabaseClientServiceRefactored 
  : SupabaseClientServiceLegacy;
```

## Success Criteria

### Technical
- [ ] No performance degradation (±5%)
- [ ] All tests passing
- [ ] Zero breaking changes for pilot
- [ ] Clean separation of concerns

### Process
- [ ] Clear migration path documented
- [ ] All team members understand patterns
- [ ] Tooling supports the workflow
- [ ] Metrics prove the value

## Next Steps

1. **Review & Approve** this plan (by EOD today)
2. **Create base classes** (tomorrow)
3. **Run migration SQL** 
4. **Start SupabaseClientService pilot** 
5. **Daily standup** on progress

## Risk Mitigation

### Risk 1: Over-engineering
- **Mitigation**: Start simple, add complexity only when needed
- **Measure**: Weekly complexity review

### Risk 2: Migration fatigue
- **Mitigation**: Automate repetitive tasks
- **Measure**: Developer satisfaction surveys

### Risk 3: Performance impact
- **Mitigation**: Benchmark before/after each service
- **Measure**: Automated performance tests

## Questions to Answer During Pilot

1. Are the 4 base classes sufficient?
2. What patterns emerge that we didn't anticipate?
3. How much effort is the migration per service?
4. What tooling would make this easier?
5. Should we adjust the base classes?

## Commands to Get Started

```bash
# 1. Apply the migration
cd /path/to/project
./scripts/cli-pipeline/database/database-cli.sh migration run-staged 20250614_create_service_class_migration_tracking.sql

# 2. Make the CLI executable
chmod +x ./scripts/cli-pipeline/service-migration/migrate-service.ts

# 3. Start the first pilot
./scripts/cli-pipeline/service-migration/migrate-service.ts start SupabaseClientService SingletonService --pilot

# 4. Check initial status
./scripts/cli-pipeline/service-migration/migrate-service.ts status
```

---

**Decision Required**: Proceed with pilot? (Y/N)