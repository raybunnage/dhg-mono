# Continuous Monitoring Architecture for DHG Monorepo

## Overview
A practical approach to implementing continuous monitoring agents for critical folders in the monorepo.

## Architecture Components

### 1. Monitoring Pipeline Structure
```
scripts/cli-pipeline/monitoring/
├── monitoring-cli.sh          # Main CLI interface
├── folder-monitor.ts          # Core monitoring logic
├── refactoring-detector.ts    # Identifies refactoring opportunities
├── test-coverage-checker.ts   # Analyzes test coverage
├── health-check-runner.ts     # Runs folder-specific health checks
├── database-integrity.ts      # Checks related database tables
└── package.json              # Dependencies

packages/shared/services/monitoring/
├── monitoring-service.ts      # Shared monitoring service
├── report-generator.ts        # Generate monitoring reports
└── change-detector.ts         # Detect file changes
```

### 2. Configuration Schema
```typescript
interface MonitoringConfig {
  folders: {
    [key: string]: {
      path: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      checks: {
        newFiles: { enabled: boolean; patterns?: string[] };
        sharedServices: { enabled: boolean; threshold?: number };
        refactoring: { enabled: boolean; rules?: RefactoringRule[] };
        tests: { enabled: boolean; minCoverage?: number };
        health: { enabled: boolean; scripts?: string[] };
        database: { enabled: boolean; tables?: string[] };
      };
      schedule: string; // cron expression
      notifications: {
        console: boolean;
        database: boolean;
        file: boolean;
      };
    };
  };
}
```

### 3. Example Monitoring Commands

```bash
# Monitor a specific folder
./scripts/cli-pipeline/monitoring/monitoring-cli.sh monitor \
  --folder "/apps/dhg-improve-experts" \
  --checks "all"

# Run continuous monitoring
./scripts/cli-pipeline/monitoring/monitoring-cli.sh watch \
  --config "./monitoring-config.json" \
  --interval "5m"

# Generate monitoring report
./scripts/cli-pipeline/monitoring/monitoring-cli.sh report \
  --folder "/packages/shared/services" \
  --output "monitoring-report.md"

# Check for refactoring opportunities
./scripts/cli-pipeline/monitoring/monitoring-cli.sh refactor \
  --folder "/apps/dhg-hub" \
  --threshold "moderate"
```

### 4. Monitoring Database Schema

```sql
-- Create monitoring tables
CREATE TABLE monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  run_type TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status TEXT,
  findings JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE monitoring_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES monitoring_runs(id),
  finding_type TEXT NOT NULL,
  severity TEXT,
  file_path TEXT,
  description TEXT,
  suggestions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE monitoring_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC,
  metadata JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Monitoring Rules Examples

#### New File Detection
- Alert when new files don't follow naming conventions
- Check if new services could use existing shared services
- Ensure new files are in correct locations per CLAUDE.md

#### Refactoring Opportunities
- Duplicate code detection across files
- Similar functionality that could be extracted to shared services
- Components that could be simplified or consolidated
- Unused imports or dead code

#### Test Coverage
- Ensure critical functions have tests
- Monitor test success rates over time
- Alert when coverage drops below threshold
- Suggest missing test cases

#### Health Checks
- Run existing health check scripts
- Verify database connections
- Check for TypeScript errors
- Validate environment configurations

### 6. Implementation Phases

#### Phase 1: Basic Monitoring (Week 1)
- [ ] Create monitoring pipeline structure
- [ ] Implement basic file change detection
- [ ] Add simple reporting to console

#### Phase 2: Smart Detection (Week 2)
- [ ] Add refactoring opportunity detection
- [ ] Implement shared service suggestions
- [ ] Create database tracking

#### Phase 3: Advanced Features (Week 3)
- [ ] Add test coverage analysis
- [ ] Implement health check integration
- [ ] Create automated scheduling

#### Phase 4: AI Integration (Week 4)
- [ ] Use Claude API for code analysis
- [ ] Generate improvement suggestions
- [ ] Create automated PR descriptions

### 7. Example Configuration File

```json
{
  "folders": {
    "improve-experts": {
      "path": "/apps/dhg-improve-experts",
      "priority": "critical",
      "checks": {
        "newFiles": { "enabled": true, "patterns": ["*.tsx", "*.ts"] },
        "sharedServices": { "enabled": true, "threshold": 3 },
        "refactoring": { "enabled": true },
        "tests": { "enabled": true, "minCoverage": 80 },
        "health": { "enabled": true },
        "database": { 
          "enabled": true, 
          "tables": ["expert_profiles", "expert_documents"]
        }
      },
      "schedule": "*/30 * * * *",
      "notifications": {
        "console": true,
        "database": true,
        "file": false
      }
    },
    "shared-services": {
      "path": "/packages/shared/services",
      "priority": "high",
      "checks": {
        "newFiles": { "enabled": true },
        "refactoring": { "enabled": true },
        "tests": { "enabled": true, "minCoverage": 90 }
      },
      "schedule": "0 * * * *"
    }
  }
}
```

### 8. Benefits

1. **Proactive Maintenance**: Catch issues before they become problems
2. **Code Quality**: Maintain consistent standards across the monorepo
3. **Knowledge Capture**: Document patterns and improvements
4. **Team Efficiency**: Automated suggestions for refactoring
5. **Historical Tracking**: Monitor code health over time

### 9. Future Enhancements

- Integration with CI/CD pipelines
- Slack/Discord notifications
- AI-powered code review suggestions
- Automatic PR creation for simple fixes
- Performance monitoring integration
- Security vulnerability scanning

## Getting Started

1. Create the monitoring pipeline structure
2. Start with simple file monitoring for one critical folder
3. Add intelligence incrementally
4. Integrate with existing health checks
5. Expand to more folders as the system proves valuable

This architecture provides a foundation for continuous improvement without requiring constant manual oversight.