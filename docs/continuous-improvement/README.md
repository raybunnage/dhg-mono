# Continuous Improvement System

## Overview

The Continuous Improvement System captures repeatable processes and provides automation for common development tasks. It helps standardize workflows, reduce errors, and save time by automating multi-step processes.

## Architecture

```
continuous-improvement/
├── cli/                              # CLI interface
│   └── continuous-cli.sh            # Main CLI with scenario commands
├── scenarios/                        # Scenario definitions
│   ├── index.md                     # Registry of all scenarios
│   └── {scenario-id}.md             # Documentation for each scenario
├── scripts/                          # Automation scripts
│   ├── run-scenario.ts              # Scenario runner
│   ├── track-scenario-execution.ts  # Database tracking
│   └── scenarios/                   # Individual automation scripts
│       └── {scenario-id}.ts         # Script for each automated scenario
└── database/                         # Database tables
    ├── sys_continuous_improvement_scenarios
    ├── sys_continuous_improvement_executions
    └── sys_continuous_improvement_steps
```

## How It Works

1. **Identify Repeatable Process**: When you find yourself doing the same multi-step process repeatedly
2. **Document the Process**: Create a markdown file in `docs/continuous-improvement/scenarios/`
3. **Automate When Ready**: Create a TypeScript script in `scripts/cli-pipeline/continuous/scenarios/`
4. **Track Execution**: All scenario runs are tracked in the database for analysis

## Using the System

### List Available Scenarios
```bash
./scripts/cli-pipeline/continuous/continuous-cli.sh scenarios
```

### Run a Scenario
```bash
./scripts/cli-pipeline/continuous/continuous-cli.sh run-scenario <scenario-id> [args...]

# Example:
./scripts/cli-pipeline/continuous/continuous-cli.sh run-scenario add-new-proxy-server my-proxy 9892 "My Proxy" "Does cool stuff" utility
```

### View Scenario Documentation
```bash
./scripts/cli-pipeline/continuous/run-scenario.ts help <scenario-id>
```

## Database Tracking

All scenario executions are tracked in the database:

### View Recent Executions
```sql
SELECT 
  s.name,
  e.executed_at,
  e.executed_by,
  e.success,
  e.duration_seconds,
  e.output_summary
FROM sys_continuous_improvement_executions e
JOIN sys_continuous_improvement_scenarios s ON e.scenario_id = s.scenario_id
ORDER BY e.executed_at DESC
LIMIT 10;
```

### View Scenario Success Rate
```sql
SELECT * FROM sys_continuous_improvement_overview_view
ORDER BY execution_count DESC;
```

## Pilot Scenario: Add New Proxy Server

Our first automated scenario handles the comprehensive process of adding a new proxy server:

### What It Does
1. Updates CLAUDE.md port registry
2. Creates proxy server TypeScript file
3. Updates package.json with new script
4. Adds to proxy startup list
5. Creates database migration
6. Updates health check tests
7. Runs the migration
8. Tracks all changes in the database

### Benefits
- **Time Saved**: 45 minutes → 2 minutes
- **Error Reduction**: No missed steps
- **Consistency**: Same pattern every time
- **Documentation**: Changes tracked in database

## Adding New Scenarios

1. **Create Documentation**:
   ```markdown
   # docs/continuous-improvement/scenarios/my-scenario.md
   
   ## Scenario ID: `my-scenario`
   **Category**: Development
   
   ## Overview
   Brief description of what this scenario does
   
   ## Manual Steps
   1. Step one with specific commands
   2. Step two with file paths
   ...
   ```

2. **Update Index**:
   Add your scenario to `docs/continuous-improvement/scenarios/index.md`

3. **Create Automation** (optional):
   ```typescript
   // scripts/cli-pipeline/continuous/scenarios/my-scenario.ts
   
   import { ScenarioExecutionTracker } from '../track-scenario-execution';
   
   class MyScenarioRunner {
     async execute(config: any): Promise<void> {
       const tracker = new ScenarioExecutionTracker();
       await tracker.startExecution('my-scenario', config);
       
       try {
         // Implementation
         await tracker.completeExecution(true, 'Success!');
       } catch (error) {
         await tracker.completeExecution(false, undefined, undefined, error.message);
         throw error;
       }
     }
   }
   ```

4. **Add to Database**:
   ```sql
   INSERT INTO sys_continuous_improvement_scenarios (
     scenario_id, name, description, category, status
   ) VALUES (
     'my-scenario', 'My Scenario', 'Description', 'Development', 'documented'
   );
   ```

## Future Scenarios

Planned scenarios for automation:
- `add-new-shared-service`: Create a new shared service with tests
- `add-new-ui-integration`: Integrate new UI features across apps
- `database-migration`: Safe database migration process
- `refactor-service`: Service refactoring with test preservation
- `add-new-app`: Create a new app in the monorepo
- `update-dependencies`: Safely update package dependencies

## Key Principles

1. **Start with Documentation**: Always document the manual process first
2. **Automate Incrementally**: Not everything needs to be automated immediately
3. **Track Everything**: Database tracking helps identify patterns
4. **Maintain Flexibility**: Scripts should handle variations gracefully
5. **Preserve Context**: Track what changed and why

## Viewing the Data

The continuous improvement data is accessible through:
- CLI commands for immediate use
- Database queries for analysis
- UI integration planned for visual tracking

This system is designed to grow organically as we identify more repeatable processes that can benefit from standardization and automation.