# Continuous Monitoring System

This is the implementation of Phase 1 and Phase 2 of the Continuous Monitoring System for the DHG monorepo.

## What's Implemented

### Phase 1: Foundation ✅
- **CLI Pipeline Structure**: Created monitoring pipeline in `scripts/cli-pipeline/monitoring/`
- **Basic Detection Capabilities**:
  - New file detection with time-based filtering
  - Large file detection (>300 lines)
  - Console.log overuse detection
  - Direct Supabase client creation violations
  - Missing test file detection
  - Multiple export detection for service extraction

### Phase 2: Database Integration ✅
- **Database Schema**: Created migration for monitoring tables
  - `sys_monitoring_runs` - Tracking monitoring runs
  - `sys_monitoring_findings` - Individual findings
  - `sys_monitoring_metrics` - Metrics over time
  - `sys_monitoring_configs` - Configuration storage
- **Database Persistence**: All scan results are saved to database
- **Historical Analysis**: Commands for viewing trends and history

## Usage

### Quick Scan (last 24 hours)
```bash
./monitoring-cli.sh quick /apps/dhg-hub
```

### Full Scan
```bash
./monitoring-cli.sh scan /packages/shared --since 7d
```

### Continuous Watch
```bash
./monitoring-cli.sh watch /apps/dhg-improve-experts --interval 15
```

### Generate Report with DB Save
```bash
./monitoring-cli.sh report /packages/shared/services
```

### View Historical Data
```bash
./monitoring-cli.sh history /apps/dhg-hub --days 30
```

### View Trends
```bash
./monitoring-cli.sh trends /packages/shared/services
```

## Detection Patterns

1. **New Files**: Files created or modified within the specified time period
2. **Large Files**: Files exceeding 300 lines
3. **Console Overuse**: More than 5 console statements
4. **Architecture Violations**: Direct Supabase client creation
5. **Missing Tests**: Source files without corresponding test files
6. **Service Extraction**: Files with >5 exports (potential shared services)

## Database Schema

The system uses four main tables:
- `sys_monitoring_runs`: Main tracking table for monitoring runs
- `sys_monitoring_findings`: Individual findings for detailed analysis
- `sys_monitoring_metrics`: Numeric metrics tracked over time
- `sys_monitoring_configs`: Configuration storage (for future use)

## Next Steps

Phase 3-5 features to be implemented:
- Intelligent pattern detection with AST parsing
- AI integration for code review and suggestions
- Automated scheduling and CI/CD integration
- Web dashboard for visualization
- Custom rule definitions