# Phase 1 Implementation Plan: Continuous Development Scenarios

**Start Date**: 2025-06-16  
**Duration**: 2 weeks  
**Goal**: Consolidate existing systems and create scenario foundation

## Week 1: Cleanup & Consolidation

### Day 1-2: Archive Redundant Systems

**SQL Migration to Execute:**
```sql
-- Create archived schema
CREATE SCHEMA IF NOT EXISTS archived;

-- Move registry tables (appears unused based on analysis)
ALTER TABLE registry_services SET SCHEMA archived;
ALTER TABLE registry_service_imports SET SCHEMA archived;
ALTER TABLE registry_service_exports SET SCHEMA archived;
ALTER TABLE registry_service_dependencies SET SCHEMA archived;
ALTER TABLE registry_dependency_graph SET SCHEMA archived;
ALTER TABLE registry_circular_dependencies SET SCHEMA archived;
ALTER TABLE registry_missing_services SET SCHEMA archived;
ALTER TABLE registry_duplicate_exports SET SCHEMA archived;
ALTER TABLE registry_scan_history SET SCHEMA archived;

-- Consolidate archival tables
CREATE TABLE sys_unified_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN ('code', 'table', 'document', 'script', 'package')),
    original_path TEXT NOT NULL,
    archive_path TEXT,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_by TEXT DEFAULT CURRENT_USER,
    reason TEXT,
    size_bytes BIGINT,
    metadata JSONB,
    restoration_notes TEXT
);

-- Migrate existing archival data
INSERT INTO sys_unified_archive (item_type, original_path, archive_path, archived_at, reason, metadata)
SELECT 'script', script_path, archive_location, archived_at, reason, 
       jsonb_build_object('original_table', 'sys_archived_scripts')
FROM sys_archived_scripts;

INSERT INTO sys_unified_archive (item_type, original_path, archived_at, reason, metadata)
SELECT 'package', package_name, archived_at, reason,
       jsonb_build_object('version', version, 'original_table', 'sys_archived_packages')
FROM sys_archived_packages;

-- Create unified view
CREATE VIEW sys_archive_summary_view AS
SELECT 
    item_type,
    COUNT(*) as total_items,
    MIN(archived_at) as earliest_archive,
    MAX(archived_at) as latest_archive,
    COUNT(DISTINCT archived_by) as unique_archivers
FROM sys_unified_archive
GROUP BY item_type;
```

### Day 3-4: Enhance Scenario Registry

**Create Core Scenario Tables:**
```sql
-- Enhanced scenario registry
CREATE TABLE sys_scenario_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT UNIQUE NOT NULL,
    object_type TEXT NOT NULL CHECK (object_type IN ('service', 'cli', 'database', 'ui', 'proxy', 'infra')),
    name TEXT NOT NULL,
    description TEXT,
    complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),
    automation_readiness INTEGER DEFAULT 0 CHECK (automation_readiness BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scenario dependencies
CREATE TABLE sys_scenario_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT REFERENCES sys_scenario_definitions(scenario_id),
    depends_on_scenario_id TEXT REFERENCES sys_scenario_definitions(scenario_id),
    dependency_type TEXT CHECK (dependency_type IN ('required', 'recommended', 'optional')),
    execution_order INTEGER NOT NULL,
    UNIQUE(scenario_id, depends_on_scenario_id)
);

-- Scenario steps
CREATE TABLE sys_scenario_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT REFERENCES sys_scenario_definitions(scenario_id),
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT CHECK (step_type IN ('manual', 'automated', 'validation', 'checkpoint')),
    description TEXT,
    automation_script TEXT, -- Path to automation script if automated
    estimated_duration_minutes INTEGER,
    UNIQUE(scenario_id, step_number)
);

-- Scenario parameters
CREATE TABLE sys_scenario_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT REFERENCES sys_scenario_definitions(scenario_id),
    parameter_name TEXT NOT NULL,
    parameter_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'enum'
    required BOOLEAN DEFAULT true,
    default_value TEXT,
    description TEXT,
    validation_rules JSONB,
    UNIQUE(scenario_id, parameter_name)
);
```

### Day 5: Document Core Scenarios

**Initial 15 Scenarios to Document:**

1. **Services**
   - `create-shared-service` - Create new shared service
   - `refactor-to-shared-service` - Extract app code to shared
   - `add-service-tests` - Add comprehensive tests

2. **CLI Pipelines**
   - `create-cli-pipeline` - New domain pipeline
   - `add-cli-command` - Add command to pipeline
   - `migrate-script-to-pipeline` - Move standalone script

3. **Database**
   - `create-database-table` - New table with standards
   - `modify-table-schema` - Safe schema changes
   - `add-rls-policies` - Row-level security

4. **UI/Apps**
   - `create-new-app` - New Vite/React app
   - `add-app-page` - New page with routing
   - `create-shared-component` - Reusable component

5. **Infrastructure**
   - `add-proxy-server` - New proxy with endpoints
   - `add-pnpm-script` - Monorepo-wide script
   - `setup-environment` - Environment configuration

## Week 2: Build Foundation

### Day 6-7: Create Scenario Templates

**Directory Structure:**
```
docs/continuous-improvement/scenarios/
├── templates/
│   ├── service-scenario-template.md
│   ├── cli-scenario-template.md
│   ├── database-scenario-template.md
│   ├── ui-scenario-template.md
│   └── infra-scenario-template.md
├── service/
│   ├── create-shared-service.md
│   └── refactor-to-shared-service.md
├── cli/
│   ├── create-cli-pipeline.md
│   └── add-cli-command.md
└── [other categories...]
```

**Template Example (service-scenario-template.md):**
```markdown
# Scenario: [Scenario Name]

## Metadata
- **ID**: `scenario-id`
- **Object Type**: service
- **Complexity**: simple|medium|complex
- **Automation**: 0-100%
- **Dependencies**: [list of scenario IDs]

## Parameters
- `name` (required): Service name
- `type` (required): 'infrastructure' | 'business'
- `pattern` (optional): 'singleton' | 'di' (default: based on type)

## Pre-Conditions
1. [ ] No existing service with same name
2. [ ] Valid service type selected
3. [ ] Dependencies available

## Steps
1. **Validate Parameters** [automated]
   - Check naming conventions
   - Verify uniqueness
   
2. **Create Directory Structure** [automated]
   ```bash
   mkdir -p packages/shared/services/{name}
   mkdir -p packages/shared/services/{name}/__tests__
   ```

[Continue with all steps...]

## Post-Validation
1. [ ] Service compiles without errors
2. [ ] Tests pass
3. [ ] Exported from shared index

## Rollback
If any step fails:
1. Remove created directories
2. Revert any file changes
3. Log failure reason
```

### Day 8-9: Build Basic Execution Engine

**Create Execution Framework:**
```typescript
// scripts/cli-pipeline/continuous/scenario-executor.ts

interface ScenarioExecution {
  scenarioId: string;
  parameters: Record<string, any>;
  worktreePath: string;
  executedBy: string;
}

class ScenarioExecutor {
  private checkpointManager: CheckpointManager;
  private validator: ScenarioValidator;
  
  async execute(execution: ScenarioExecution): Promise<ExecutionResult> {
    // 1. Load scenario definition
    const scenario = await this.loadScenario(execution.scenarioId);
    
    // 2. Validate parameters
    await this.validator.validateParameters(scenario, execution.parameters);
    
    // 3. Check preconditions
    await this.validator.checkPreconditions(scenario, execution);
    
    // 4. Execute dependencies first
    for (const depId of scenario.dependencies) {
      await this.execute({ ...execution, scenarioId: depId });
    }
    
    // 5. Execute steps with checkpointing
    const executionId = await this.startExecution(execution);
    
    for (const step of scenario.steps) {
      try {
        await this.executeStep(executionId, step, execution);
        await this.checkpointManager.createCheckpoint(step.name);
      } catch (error) {
        await this.handleStepFailure(executionId, step, error);
        throw error;
      }
    }
    
    // 6. Run post-validation
    await this.validator.runPostValidation(scenario, execution);
    
    // 7. Complete execution
    return await this.completeExecution(executionId);
  }
}
```

### Day 10: Integration Points

**Connect to Existing Systems:**

1. **Living Documentation Updates**
   ```typescript
   // After scenario completion
   await updateLivingDoc({
     docPath: 'continuous-improvement/execution-log.md',
     content: executionSummary,
     phase: 'current'
   });
   ```

2. **Dev Task Creation**
   ```typescript
   // Create task for manual steps
   if (scenario.hasManualSteps) {
     await createDevTask({
       title: `Complete manual steps for ${scenario.name}`,
       description: manualStepsDescription,
       scenario_execution_id: executionId
     });
   }
   ```

3. **Health Check Triggers**
   ```typescript
   // After service/proxy creation
   if (scenario.objectType === 'service' || scenario.objectType === 'proxy') {
     await triggerHealthCheck(createdObjectName);
   }
   ```

## Deliverables

### Week 1 Deliverables:
1. ✅ Archived redundant registry tables
2. ✅ Consolidated archival system
3. ✅ Enhanced scenario registry schema
4. ✅ 15 core scenarios documented
5. ✅ Scenario templates created

### Week 2 Deliverables:
1. ✅ Basic execution engine
2. ✅ Checkpoint management
3. ✅ Integration with 3+ existing systems
4. ✅ CLI commands for scenario execution
5. ✅ Initial automation for 2-3 scenarios

## Success Criteria

1. **Technical Success**
   - All redundant tables archived
   - Scenario registry populated with 15+ scenarios
   - Basic execution working for 3+ scenarios
   - No regression in existing systems

2. **Process Success**
   - Clear documentation for adding scenarios
   - Developer can execute a scenario end-to-end
   - Execution tracking in database
   - Rollback capability demonstrated

3. **Quality Metrics**
   - 80%+ test coverage on new code
   - All scenarios have complete documentation
   - Integration points tested
   - No hardcoded values

## Next Steps (Phase 2 Preview)

After Phase 1 completion:
1. Add natural language scenario suggestions
2. Build dependency resolution engine
3. Create visual scenario builder
4. Implement background automation
5. Add self-healing capabilities

## Risk Mitigation

1. **Scope Creep**: Stick to 15 scenarios max in Phase 1
2. **Over-Engineering**: Keep execution engine simple
3. **Breaking Changes**: All changes behind feature flags
4. **Documentation Lag**: Document as we build

This focused two-week plan provides a solid foundation for the continuous development scenarios system while avoiding the pitfalls of previous attempts.