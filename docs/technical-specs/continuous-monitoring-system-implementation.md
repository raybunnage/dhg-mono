# Continuous Monitoring System Implementation Guide

## Executive Summary

This document provides a comprehensive implementation plan for a continuous monitoring system in the DHG monorepo. The system acts as an automated code quality guardian, continuously watching critical folders for improvement opportunities, code quality issues, and architectural violations. It's designed to be implemented incrementally, with each phase adding more intelligence and automation.

## System Overview

### Purpose
The continuous monitoring system provides automated, intelligent oversight of code quality across the monorepo by:
- Detecting new files and ensuring they follow project conventions
- Identifying refactoring opportunities before technical debt accumulates
- Monitoring test coverage and suggesting missing tests
- Finding duplicate functionality that could be extracted to shared services
- Running periodic health checks on critical systems
- Tracking code quality metrics over time

### Architecture Principles
1. **Non-invasive**: Monitoring runs separately from main application code
2. **Incremental**: Can be adopted folder by folder, feature by feature
3. **Actionable**: Provides specific, implementable suggestions
4. **Historical**: Tracks metrics over time to show trends
5. **Extensible**: Easy to add new checks and rules

## Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETED
**Status**: Proof of concept implemented and tested

#### Completed Components:
1. **CLI Pipeline Structure**
   ```
   scripts/cli-pipeline/monitoring/
   ├── monitoring-cli.sh          # Shell wrapper with command tracking
   ├── folder-monitor.ts          # Core monitoring engine
   └── package.json              # Dependencies (commander, glob, chalk)
   ```

2. **Basic Detection Capabilities**
   - New file detection with time-based filtering
   - Large file detection (>300 lines)
   - Console.log overuse detection
   - Direct Supabase client creation violations
   - Missing test file detection
   - Multiple export detection for service extraction

3. **Command Interface**
   ```bash
   # Quick scan (last 24 hours)
   ./monitoring-cli.sh quick <folder>
   
   # Full scan
   ./monitoring-cli.sh scan <folder> [--since <time>]
   
   # Continuous watch
   ./monitoring-cli.sh watch <folder> [--interval <minutes>]
   
   # Generate report with DB save
   ./monitoring-cli.sh report <folder>
   ```

### Phase 2: Database Integration (Week 2)

#### Database Schema
```sql
-- Main monitoring runs table
CREATE TABLE sys_monitoring_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'scheduled', 'watch')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  findings JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT -- CLI user or 'system' for automated runs
);

-- Individual findings for detailed tracking
CREATE TABLE sys_monitoring_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES sys_monitoring_runs(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'error')),
  file_path TEXT NOT NULL,
  line_number INTEGER,
  description TEXT NOT NULL,
  suggestion TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Metrics tracking over time
CREATE TABLE sys_monitoring_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_path TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Monitoring configurations
CREATE TABLE sys_monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  folder_path TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_monitoring_runs_folder ON sys_monitoring_runs(folder_path);
CREATE INDEX idx_monitoring_runs_status ON sys_monitoring_runs(status);
CREATE INDEX idx_monitoring_findings_type ON sys_monitoring_findings(finding_type);
CREATE INDEX idx_monitoring_metrics_folder ON sys_monitoring_metrics(folder_path);
CREATE INDEX idx_monitoring_metrics_type ON sys_monitoring_metrics(metric_type);
```

#### Implementation Tasks:
1. Create migration file in `supabase/migrations/`
2. Update `folder-monitor.ts` to use SupabaseClientService
3. Add database persistence to all scan operations
4. Create reporting queries for historical analysis

### Phase 3: Intelligent Analysis (Week 3)

#### Pattern Detection Service
Create `packages/shared/services/monitoring-service/`:

```typescript
export interface MonitoringPattern {
  id: string;
  name: string;
  description: string;
  detector: (content: string, filePath: string) => DetectionResult[];
  severity: 'info' | 'warning' | 'error';
  category: string;
}

export interface DetectionResult {
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  confidence: number; // 0-1
}
```

#### Advanced Patterns to Implement:

1. **Duplicate Code Detection**
   - Use AST parsing to find similar code structures
   - Identify copy-paste violations
   - Suggest shared service extraction

2. **Architecture Violations**
   - Direct database access outside services
   - Business logic in UI components
   - Missing error handling patterns
   - Improper async/await usage

3. **Performance Issues**
   - Large bundle imports
   - Missing React.memo or useMemo
   - Inefficient database queries
   - Multiple sequential API calls

4. **Security Concerns**
   - Hardcoded secrets or API keys
   - SQL injection vulnerabilities
   - XSS vulnerabilities
   - Improper authentication checks

### Phase 4: AI Integration (Week 4)

#### Claude Service Integration
Enhance monitoring with AI-powered analysis:

```typescript
interface AIAnalysisRequest {
  filePath: string;
  fileContent: string;
  focusAreas: string[];
  contextFiles?: string[]; // Related files for context
}

interface AIAnalysisResult {
  suggestions: AISuggestion[];
  refactoringOpportunities: RefactoringPlan[];
  codeQualityScore: number;
  explanation: string;
}
```

#### AI-Powered Features:

1. **Code Review Assistant**
   - Analyze new files for best practices
   - Suggest improvements based on project patterns
   - Generate PR-ready summaries

2. **Refactoring Planner**
   - Identify complex methods needing simplification
   - Suggest service extraction opportunities
   - Create step-by-step refactoring plans

3. **Documentation Generator**
   - Generate missing JSDoc comments
   - Create README sections for new features
   - Update technical specs automatically

4. **Test Generator**
   - Analyze code to suggest test cases
   - Generate test file templates
   - Identify edge cases to test

### Phase 5: Automation & Integration (Week 5)

#### Scheduled Monitoring
1. **Cron Integration**
   ```bash
   # Add to crontab for hourly monitoring
   0 * * * * /path/to/monitoring-cli.sh report /critical/folder --save
   ```

2. **CI/CD Integration**
   - Pre-commit hooks for changed files
   - PR comments with monitoring results
   - Block merges for critical violations

3. **Notification System**
   - Email alerts for critical findings
   - Slack/Discord integration
   - Dashboard for team visibility

#### Monitoring Dashboard
Create web interface at `apps/dhg-monitoring/`:
- Real-time monitoring status
- Historical trend charts
- Finding management (acknowledge, ignore, fix)
- Configuration management UI

## Configuration Management

### Monitoring Configuration Schema
```typescript
interface MonitoringConfig {
  version: '1.0';
  folders: {
    [key: string]: FolderConfig;
  };
  globalRules?: GlobalRules;
  notifications?: NotificationConfig;
}

interface FolderConfig {
  path: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  schedule?: string; // cron expression
  checks: {
    newFiles: CheckConfig;
    refactoring: CheckConfig;
    tests: CheckConfig & { minCoverage?: number };
    performance: CheckConfig;
    security: CheckConfig;
    documentation: CheckConfig;
  };
  exclusions?: string[]; // glob patterns to ignore
  customRules?: CustomRule[];
}

interface CheckConfig {
  enabled: boolean;
  severity?: 'info' | 'warning' | 'error';
  threshold?: number;
  patterns?: string[];
}
```

### Example Configuration
```json
{
  "version": "1.0",
  "folders": {
    "critical-services": {
      "path": "/packages/shared/services",
      "priority": "critical",
      "enabled": true,
      "schedule": "*/15 * * * *",
      "checks": {
        "newFiles": {
          "enabled": true,
          "severity": "warning"
        },
        "refactoring": {
          "enabled": true,
          "threshold": 300
        },
        "tests": {
          "enabled": true,
          "minCoverage": 80,
          "severity": "error"
        },
        "security": {
          "enabled": true,
          "severity": "error"
        }
      }
    },
    "apps": {
      "path": "/apps",
      "priority": "high",
      "enabled": true,
      "schedule": "0 * * * *",
      "checks": {
        "newFiles": { "enabled": true },
        "refactoring": { "enabled": true },
        "tests": { "enabled": true, "minCoverage": 60 }
      },
      "exclusions": ["**/node_modules/**", "**/*.test.*"]
    }
  }
}
```

## Usage Patterns

### 1. Daily Development Workflow
```bash
# Morning: Check what changed overnight
./monitoring-cli.sh quick /apps/dhg-improve-experts

# Before PR: Full scan with report
./monitoring-cli.sh report /packages/shared/services --save

# During development: Watch mode
./monitoring-cli.sh watch /apps/dhg-hub --interval 5
```

### 2. Weekly Maintenance
```bash
# Generate weekly report for team review
./monitoring-cli.sh report /packages/shared --since 7d --save

# Check test coverage trends
./monitoring-cli.sh test-coverage /apps --trend
```

### 3. Architecture Enforcement
```bash
# Verify no direct DB access outside services
./monitoring-cli.sh check-architecture /apps --rule no-direct-db

# Find service extraction opportunities
./monitoring-cli.sh analyze-duplicates /apps/dhg-hub
```

## Extension Points

### Adding New Checks
1. Create detector in `monitoring/detectors/`
2. Register in pattern registry
3. Add configuration options
4. Update documentation

### Custom Rules
Projects can define custom rules in `.monitoring/rules/`:
```typescript
export const customRule: MonitoringPattern = {
  id: 'no-magic-numbers',
  name: 'No Magic Numbers',
  detector: (content, path) => {
    // Custom detection logic
  },
  severity: 'warning',
  category: 'code-quality'
};
```

## Success Metrics

### Phase 1-2 (Foundation)
- ✓ Basic monitoring operational
- ✓ 5+ detection patterns working
- □ Database persistence functional
- □ Historical tracking enabled

### Phase 3-4 (Intelligence)
- □ 20+ detection patterns
- □ AI integration providing value
- □ Automated refactoring suggestions
- □ Test generation working

### Phase 5 (Automation)
- □ Scheduled monitoring active
- □ CI/CD integration complete
- □ Dashboard operational
- □ Team adoption >80%

## Troubleshooting Guide

### Common Issues

#### 1. Supabase Connection Errors
```bash
# Check environment variables
./monitoring-cli.sh health

# Test database connection
./monitoring-cli.sh test-db
```

#### 2. Performance Issues
- Limit folder depth with `--max-depth`
- Exclude large directories
- Use sampling for initial scans

#### 3. False Positives
- Adjust thresholds in config
- Add exclusion patterns
- Create custom rules for edge cases

## Future Enhancements

### Version 2.0
- Machine learning for pattern detection
- Auto-fix capability for simple issues
- Integration with IDEs
- Multi-language support
- Distributed monitoring for large codebases

### Version 3.0
- Predictive analysis (predict bugs before they happen)
- Automated code migration tools
- Team productivity analytics
- Cost estimation for technical debt

## Getting Started Today

1. **Install dependencies**:
   ```bash
   cd scripts/cli-pipeline/monitoring
   npm install
   ```

2. **Run first scan**:
   ```bash
   ./monitoring-cli.sh quick /apps/dhg-hub
   ```

3. **Review findings and create action plan**

4. **Set up regular monitoring**:
   ```bash
   ./monitoring-cli.sh watch /packages/shared/services
   ```

## Conclusion

The continuous monitoring system transforms code quality from a periodic concern to a continuous practice. By implementing this system incrementally, teams can improve code quality without disrupting current development workflows. Each phase builds on the previous, creating a comprehensive monitoring solution that scales with the codebase.

Remember: The goal isn't perfection, but continuous improvement. Start small, measure impact, and expand based on what provides the most value to your team.