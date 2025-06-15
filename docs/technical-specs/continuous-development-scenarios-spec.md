# Technical Specification: Continuous Development Scenarios System

**Version**: 1.0  
**Date**: 2025-06-15  
**Status**: Draft

## Executive Summary

This specification defines a scenario-based continuous development system that automates common development tasks across all object types in the monorepo. The system builds on existing infrastructure while eliminating redundancy and false starts, providing a unified approach to development automation that respects our multi-agent worktree workflow.

## Vision

Enable developers to invoke high-level scenarios (e.g., "add new admin dashboard") and have the system automatically handle all dependencies, configurations, tests, documentation, and deployment steps - while maintaining quality standards and tracking everything in a queryable database.

## Core Principles

1. **Scenario-Driven**: All development tasks are scenarios with clear steps
2. **Dependency-Aware**: Scenarios understand and invoke dependent scenarios
3. **Worktree-Compatible**: Respects multi-agent development patterns
4. **Checkpoint-Based**: Every significant change is a recoverable checkpoint
5. **Observable**: All actions are tracked and queryable
6. **Progressive**: Start simple, enhance incrementally

## Object Types & Their Scenarios

### 1. Services (Shared & App-Specific)

**Primary Scenarios:**
- `create-service` - New shared service with pattern selection
- `refactor-service` - Extract/consolidate with test preservation  
- `deprecate-service` - Staged deprecation with usage tracking
- `test-service` - Comprehensive test generation

**Dependencies:**
- May require database tables
- Often needs proxy server endpoints
- Usually requires app integration
- Always needs tests and documentation

### 2. CLI Pipelines

**Primary Scenarios:**
- `create-cli-pipeline` - New domain-specific pipeline
- `add-cli-command` - Add command to existing pipeline
- `migrate-cli-script` - Move standalone script to pipeline
- `consolidate-pipelines` - Merge related pipelines

**Dependencies:**
- May need shared services
- Requires command registry updates
- Needs shell wrapper integration
- May require database tables

### 3. Database Objects

**Primary Scenarios:**
- `create-table` - New table with standards compliance
- `modify-schema` - Safe schema evolution
- `create-view` - View with naming conventions
- `add-rls-policy` - Row-level security implementation

**Dependencies:**
- Requires TypeScript type generation
- May need service updates
- Often needs UI components
- Always needs migration testing

### 4. UI Components (Apps & Pages)

**Primary Scenarios:**
- `create-app` - New Vite/React application
- `add-page` - New page with routing
- `add-shared-component` - Reusable UI component
- `integrate-service` - Connect UI to services

**Dependencies:**
- Requires service integration
- May need proxy server
- Needs routing updates
- Requires responsive design

### 5. Proxy Servers

**Primary Scenarios:**
- `create-proxy-server` - New proxy with port allocation
- `add-proxy-endpoint` - New endpoint to existing proxy
- `consolidate-proxies` - Merge related proxies

**Dependencies:**
- Port registry updates
- Health check integration
- Often needs services
- May require UI updates

### 6. Infrastructure

**Primary Scenarios:**
- `add-pnpm-script` - New monorepo-wide script
- `update-dependencies` - Safe dependency updates
- `configure-environment` - Environment setup
- `setup-monitoring` - Add monitoring/logging

**Dependencies:**
- May affect all object types
- Requires testing across apps
- Needs documentation updates

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goals:**
- Consolidate existing continuous systems
- Archive redundant components
- Create unified scenario registry

**Actions:**
1. **Database Cleanup**
   ```sql
   -- Archive redundant registry tables
   CREATE SCHEMA IF NOT EXISTS archived;
   ALTER TABLE registry_services SET SCHEMA archived;
   -- Repeat for other registry_* tables
   
   -- Consolidate archival tables into unified system
   CREATE TABLE sys_archived_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     item_type TEXT NOT NULL, -- 'code', 'table', 'document', etc.
     item_path TEXT NOT NULL,
     archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     archived_by TEXT,
     reason TEXT,
     metadata JSONB
   );
   ```

2. **Scenario Registry Enhancement**
   ```typescript
   interface Scenario {
     id: string;
     objectType: 'service' | 'cli' | 'database' | 'ui' | 'proxy' | 'infra';
     name: string;
     description: string;
     dependencies: string[]; // Other scenario IDs
     preConditions: Check[];
     steps: Step[];
     postValidation: Validation[];
     rollbackSteps?: Step[];
   }
   ```

3. **Create Base Scenarios** (10-15 most common)
   - Focus on single object types first
   - Document manual steps thoroughly
   - Identify automation opportunities

### Phase 2: Integration (Weeks 3-4)

**Goals:**
- Connect scenarios to existing systems
- Build execution engine
- Add worktree awareness

**Actions:**
1. **Execution Engine**
   ```typescript
   class ScenarioExecutor {
     async execute(scenarioId: string, params: any): Promise<ExecutionResult> {
       // Check preconditions
       // Execute dependencies first
       // Run steps with checkpointing
       // Validate results
       // Update all tracking systems
     }
   }
   ```

2. **Worktree Integration**
   - Detect current worktree
   - Ensure scenario compatibility
   - Create appropriate git checkpoints
   - Handle multi-worktree scenarios

3. **System Connections**
   - Link to deployment tracking
   - Update living documentation
   - Create dev_tasks automatically
   - Trigger health checks

### Phase 3: Intelligence (Weeks 5-6)

**Goals:**
- Add scenario suggestions
- Implement dependency resolution
- Create impact analysis

**Actions:**
1. **Natural Language Processing**
   ```typescript
   class ScenarioSuggester {
     suggest(description: string): SuggestedScenario[] {
       // Parse intent
       // Match to scenarios
       // Resolve dependencies
       // Return ordered list
     }
   }
   ```

2. **Dependency Graph**
   - Build scenario dependency graph
   - Calculate execution order
   - Identify circular dependencies
   - Optimize execution paths

3. **Impact Analysis**
   - What files will change
   - What systems affected
   - Estimated time
   - Risk assessment

### Phase 4: Automation (Weeks 7-8)

**Goals:**
- Automate common scenario steps
- Add self-healing capabilities
- Enable background execution

**Actions:**
1. **Step Automation**
   - Template-based file generation
   - Automated testing
   - Documentation updates
   - Deployment triggers

2. **Self-Healing**
   - Monitor system health
   - Detect standard violations
   - Auto-fix simple issues
   - Create tasks for complex ones

3. **Background Processing**
   - Scheduled scenario runs
   - Continuous standard checking
   - Proactive maintenance
   - Trend analysis

## Database Schema

### Core Tables

```sql
-- Unified scenario definition
CREATE TABLE sys_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT UNIQUE NOT NULL,
    object_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    dependencies TEXT[], -- Array of scenario IDs
    preconditions JSONB,
    steps JSONB,
    validations JSONB,
    automation_level INTEGER DEFAULT 0, -- 0-100% automated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scenario execution tracking
CREATE TABLE sys_scenario_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id TEXT REFERENCES sys_scenarios(scenario_id),
    worktree_path TEXT,
    executed_by TEXT,
    parameters JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL, -- 'running', 'success', 'failed', 'rolled_back'
    checkpoints JSONB[], -- Git commits at each step
    artifacts JSONB, -- Files created/modified
    error_details TEXT
);

-- Scenario step execution
CREATE TABLE sys_scenario_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES sys_scenario_executions(id),
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL,
    output TEXT,
    checkpoint_commit TEXT
);
```

### Integration Views

```sql
-- Scenario impact analysis
CREATE VIEW sys_scenario_impact_view AS
SELECT 
    s.scenario_id,
    s.name,
    s.object_type,
    array_length(s.dependencies, 1) as direct_dependencies,
    COUNT(DISTINCT e.id) as total_executions,
    AVG(EXTRACT(EPOCH FROM (e.completed_at - e.started_at))) as avg_duration_seconds,
    COUNT(DISTINCT e.artifacts->>'files') as avg_files_changed
FROM sys_scenarios s
LEFT JOIN sys_scenario_executions e ON s.scenario_id = e.scenario_id
GROUP BY s.scenario_id, s.name, s.object_type, s.dependencies;

-- Scenario health dashboard
CREATE VIEW sys_scenario_health_view AS
SELECT 
    object_type,
    COUNT(*) as total_scenarios,
    AVG(automation_level) as avg_automation,
    COUNT(*) FILTER (WHERE automation_level >= 80) as highly_automated,
    COUNT(*) FILTER (WHERE automation_level = 0) as manual_only
FROM sys_scenarios
GROUP BY object_type;
```

## Usage Examples

### Developer Workflow

```bash
# Simple scenario
./continuous-cli.sh run-scenario create-service user-preferences business

# Complex scenario with dependencies
./continuous-cli.sh suggest "I need an admin dashboard for managing user preferences"
# Suggests: create-app → create-service → create-table → add-page → add-tests

# Execute suggested scenarios
./continuous-cli.sh run-scenario create-app dhg-admin-preferences
# Automatically runs all dependencies in correct order

# Check scenario status
./continuous-cli.sh scenario-status <execution-id>
```

### Automation Examples

```typescript
// In TypeScript automation
const executor = new ScenarioExecutor();

// Create a complete feature
await executor.executeChain([
  { scenario: 'create-table', params: { name: 'user_preferences' } },
  { scenario: 'create-service', params: { name: 'preferences', type: 'business' } },
  { scenario: 'create-proxy-endpoint', params: { path: '/api/preferences' } },
  { scenario: 'add-page', params: { app: 'dhg-hub', name: 'UserPreferences' } },
  { scenario: 'add-tests', params: { coverage: 80 } }
]);
```

## Success Metrics

1. **Efficiency Metrics**
   - Time saved per scenario execution
   - Reduction in manual steps
   - Decrease in configuration errors

2. **Quality Metrics**
   - Standards compliance rate
   - Test coverage maintenance
   - Documentation completeness

3. **Adoption Metrics**
   - Scenarios executed per week
   - Developer satisfaction scores
   - Automation percentage growth

## Migration Strategy

1. **Preserve Working Systems**
   - Keep deployment tracking
   - Maintain health monitoring
   - Continue living docs

2. **Archive Redundant Systems**
   - Move registry_* tables
   - Consolidate archival tables
   - Remove unused pipelines

3. **Gradual Adoption**
   - Start with volunteers
   - Document successes
   - Expand organically

## Risk Mitigation

1. **Over-Automation**: Keep manual overrides
2. **Complexity**: Start simple, enhance gradually
3. **Breaking Changes**: Comprehensive rollback capability
4. **Learning Curve**: Excellent documentation and examples

## Future Enhancements

1. **AI Integration**: Natural language scenario creation
2. **Visual Builder**: Drag-and-drop scenario composition
3. **Predictive Maintenance**: ML-based issue prevention
4. **Cross-Project**: Share scenarios between projects

## Conclusion

This continuous development scenarios system will transform how we build and maintain the monorepo. By capturing common patterns as executable scenarios, we reduce errors, improve consistency, and free developers to focus on creative problem-solving rather than repetitive configuration tasks.

The phased approach ensures we build on success while avoiding the over-engineering that plagued previous attempts. Most importantly, the system respects our multi-agent worktree workflow and provides the observability needed for continuous improvement.