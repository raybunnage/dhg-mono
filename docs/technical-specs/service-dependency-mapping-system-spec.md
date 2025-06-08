# Service Dependency Mapping System - Technical Specification

**Version**: 1.0  
**Date**: June 7, 2025  
**Author**: Development Team  
**Status**: Implementation Ready

## Executive Summary

The Service Dependency Mapping System provides comprehensive visibility into the relationships between applications, CLI pipelines, and shared services within the DHG monorepo. This system will enable informed decisions about code archiving, identify opportunities for new CLI pipelines, and maintain architectural clarity as the project grows.

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Implementation Plan](#implementation-plan)
5. [Phase 1: Core Registry](#phase-1-core-registry)
6. [Phase 2: Analysis & Reporting](#phase-2-analysis--reporting)
7. [Phase 3: Archiving & Pruning](#phase-3-archiving--pruning)
8. [Integration Points](#integration-points)
9. [Success Metrics](#success-metrics)

## Vision & Goals

### Primary Vision
Create a living, self-updating map of all service dependencies across the monorepo that provides actionable insights for code maintenance, optimization, and architectural decisions.

### Key Goals

1. **Dependency Visibility**
   - Map every app's usage of shared services
   - Track which CLI pipelines use which services
   - Identify service usage patterns and frequency

2. **Code Health Management**
   - Identify unused or underutilized services
   - Find redundant implementations
   - Support informed archiving decisions

3. **Architecture Insights**
   - Visualize service dependency graphs
   - Identify critical path dependencies
   - Spot architectural anti-patterns

4. **Development Efficiency**
   - Discover opportunities for new CLI pipelines
   - Identify services that could be consolidated
   - Guide refactoring efforts with usage data

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Registry CLI Pipeline                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Scanner   │  │   Analyzer   │  │   Reporter    │  │
│  │  Commands   │  │   Commands   │  │   Commands    │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Database Tables                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Registry   │  │ Dependencies │  │   Analysis    │  │
│  │   Tables    │  │    Table     │  │     Runs      │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Analysis Views                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Unused    │  │  Critical    │  │   Service     │  │
│  │  Services   │  │Dependencies  │  │   Heatmap     │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Scanning Phase**: File system analysis to discover services, apps, and pipelines
2. **Analysis Phase**: Parse import statements and package.json files
3. **Storage Phase**: Populate registry and dependency tables
4. **Reporting Phase**: Generate insights and recommendations
5. **Action Phase**: Archive unused code, create new pipelines, refactor

## Database Schema

### Simplified Schema Design

Following the simplification recommendations, we'll use a consolidated approach:

#### Core Registry Tables

1. **registry_services**
   - Catalog of all shared services
   - Tracks service type, location, and status
   - Links to package paths and export types

2. **registry_apps**
   - Registry of all applications
   - Includes app type, framework, and status
   - Maps to file system locations

3. **registry_cli_pipelines**
   - Registry of all CLI pipelines
   - Tracks domain, main script, and status
   - Essential for understanding CLI coverage

#### Unified Dependency Table

4. **service_dependencies**
   - Single table for all dependency relationships
   - Uses polymorphic design with dependent_type field
   - Tracks usage frequency and criticality

#### Analysis Tracking

5. **service_dependency_analysis_runs**
   - Audit log of scanning operations
   - Tracks performance and completeness
   - Enables incremental updates

### Key Design Decisions

1. **Polymorphic Dependencies**: Using a single table with type field reduces complexity
2. **No Command-Level Tracking Initially**: Start with app/pipeline level granularity
3. **Deferred Service Exports**: Add detailed export tracking in future phase
4. **Usage Frequency**: Simple enum (high/medium/low) instead of numeric metrics

## Implementation Plan

### Timeline Overview

- **Week 1**: Phase 1 - Core Registry Implementation
- **Week 2**: Phase 2 - Analysis & Reporting
- **Week 3**: Phase 3 - Archiving & Pruning Preparation
- **Ongoing**: Continuous updates and maintenance

### Development Principles

1. **Incremental Value**: Each phase delivers usable functionality
2. **Data-Driven Decisions**: Let actual usage patterns guide development
3. **Integration First**: Connect with existing systems early
4. **Automation Focus**: Minimize manual maintenance burden

## Phase 1: Core Registry

### Objectives
- Create foundational database schema
- Build scanning infrastructure
- Populate initial registry data

### Database Migration

```sql
-- Simplified schema focusing on essential tables
-- See detailed migration file: 20250607000000_create_service_dependency_mapping_simplified.sql
```

### CLI Pipeline Structure

```
scripts/cli-pipeline/registry/
├── registry-cli.sh              # Main entry point
├── package.json                 # Dependencies for TypeScript commands
├── tsconfig.json               # TypeScript configuration
├── scan-services.ts            # Scan packages/shared/services
├── scan-apps.ts                # Scan apps directory
├── scan-pipelines.ts           # Scan CLI pipelines
├── populate-registry.ts        # Batch populate all registries
└── utils/
    ├── file-scanner.ts         # Common file scanning utilities
    ├── import-parser.ts        # Parse import statements
    └── supabase-helper.ts      # Database operations
```

### Core Commands

#### 1. scan-services
```bash
./registry-cli.sh scan-services [--update-existing]
```
- Scans `packages/shared/services/` directory
- Identifies service files by naming patterns
- Extracts service metadata from file structure
- Determines singleton vs utility patterns

#### 2. scan-apps
```bash
./registry-cli.sh scan-apps [--include-inactive]
```
- Scans `apps/` directory
- Reads package.json for metadata
- Identifies framework and app type
- Detects Vite, Node, or CLI applications

#### 3. scan-pipelines
```bash
./registry-cli.sh scan-pipelines [--verify-commands]
```
- Scans `scripts/cli-pipeline/` directory
- Identifies pipeline domains
- Extracts command structure
- Links to command tracking data

#### 4. populate-registry
```bash
./registry-cli.sh populate-registry [--clean-first]
```
- Runs all scanners in sequence
- Populates registry tables
- Creates initial analysis run record
- Reports summary statistics

### Implementation Details

#### Service Detection Logic
```typescript
// Identify service patterns
const SERVICE_PATTERNS = {
  singleton: /-service\.(ts|js)$/,
  adapter: /-adapter\.(ts|js)$/,
  utility: /-utils?\.(ts|js)$/,
  helper: /-helper\.(ts|js)$/
};

// Detect singleton pattern
const isSingleton = (content: string): boolean => {
  return content.includes('getInstance()') || 
         content.includes('static instance');
};
```

#### Import Analysis
```typescript
// Parse import statements
const IMPORT_REGEX = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;

// Classify import types
const classifyImport = (importPath: string): ImportType => {
  if (importPath.startsWith('@shared/services')) return 'shared-service';
  if (importPath.startsWith('@/')) return 'local';
  if (!importPath.startsWith('.')) return 'external';
  return 'relative';
};
```

## Phase 2: Analysis & Reporting

### Objectives
- Analyze collected dependency data
- Generate actionable insights
- Create visual reports

### Analysis Commands

#### 1. analyze-dependencies
```bash
./registry-cli.sh analyze-dependencies [--app <name>] [--service <name>]
```
- Parses import statements in apps/pipelines
- Maps imports to registered services
- Populates service_dependencies table
- Calculates usage frequency

#### 2. find-unused
```bash
./registry-cli.sh find-unused [--include-low-usage]
```
- Identifies services with no dependencies
- Cross-references with command_tracking data
- Suggests archiving candidates
- Generates unused services report

#### 3. generate-report
```bash
./registry-cli.sh generate-report [--format <json|markdown|html>]
```
- Creates comprehensive dependency report
- Includes usage statistics
- Highlights critical paths
- Suggests optimization opportunities

### Key Reports

#### 1. Service Usage Heatmap
Shows which services are most/least utilized across the monorepo

#### 2. Critical Dependency Chains
Identifies services that many apps depend on (high-impact if changed)

#### 3. Pipeline Coverage Gaps
Shows services used in apps but not available via CLI

#### 4. Archiving Candidates
Lists services and scripts safe to archive based on:
- No active dependencies
- No recent command tracking usage
- Status marked as deprecated

### Analysis Views

```sql
-- View: Unused Services
CREATE VIEW registry_unused_services_view AS
SELECT 
    rs.*,
    COALESCE(dep_count.count, 0) as dependency_count
FROM registry_services rs
LEFT JOIN (
    SELECT service_id, COUNT(*) as count
    FROM service_dependencies
    GROUP BY service_id
) dep_count ON rs.id = dep_count.service_id
WHERE COALESCE(dep_count.count, 0) = 0
AND rs.status = 'active';

-- View: Service Usage Summary
CREATE VIEW registry_service_usage_summary_view AS
SELECT 
    rs.service_name,
    rs.display_name,
    rs.service_type,
    COUNT(DISTINCT CASE WHEN sd.dependent_type = 'app' THEN sd.dependent_id END) as app_count,
    COUNT(DISTINCT CASE WHEN sd.dependent_type = 'pipeline' THEN sd.dependent_id END) as pipeline_count,
    COUNT(DISTINCT sd.dependent_id) as total_dependents,
    COUNT(CASE WHEN sd.is_critical THEN 1 END) as critical_dependencies
FROM registry_services rs
LEFT JOIN service_dependencies sd ON rs.id = sd.service_id
GROUP BY rs.id, rs.service_name, rs.display_name, rs.service_type;
```

## Phase 3: Archiving & Pruning

### Objectives
- Safely archive unused code
- Maintain archive for future reference
- Update documentation

### Archiving Workflow

#### 1. Pre-Archive Validation
```bash
./registry-cli.sh validate-archivable [--service <name>]
```
- Double-check no dependencies
- Verify no recent usage (last 90 days)
- Check for any git branches using the service
- Generate safety report

#### 2. Archive Execution
```bash
./registry-cli.sh archive-service [--service <name>] [--dry-run]
```
- Move service to `.archived_services/` directory
- Append date to filename
- Update registry status to 'archived'
- Create archive documentation

#### 3. Post-Archive Cleanup
```bash
./registry-cli.sh cleanup-imports [--verify-only]
```
- Find and remove unused import statements
- Update package.json dependencies
- Run tests to ensure nothing broken

### Archive Structure

```
packages/shared/services/
├── .archived_services/
│   ├── old-service.20250115.ts
│   ├── unused-adapter.20250120.ts
│   └── archive-log.md
```

### Archiving Criteria

Services eligible for archiving must meet ALL criteria:
1. **No Active Dependencies**: Zero entries in service_dependencies
2. **No Recent Usage**: No command_tracking in last 90 days
3. **Not Critical**: Not marked as critical in any historical dependency
4. **Status Check**: Not marked as 'active' in registry
5. **Git Check**: Not actively used in any non-merged branches

## Integration Points

### Existing System Connections

#### 1. command_tracking Integration
```typescript
// Enhance registry commands with usage data
const enrichWithUsageData = async (commands: RegistryCommand[]) => {
  const usageData = await supabase
    .from('command_tracking')
    .select('command_name, COUNT(*) as usage_count')
    .gte('executed_at', '90 days ago')
    .group('command_name');
    
  return commands.map(cmd => ({
    ...cmd,
    recent_usage_count: usageData[cmd.command_name] || 0
  }));
};
```

#### 2. dev_tasks Integration
Link service modifications to development tasks for traceability

#### 3. ai_work_summaries Integration
Track which services were worked on in each session

### Future Integrations

1. **Automated Dependency Updates**: Git hooks to update dependencies on file changes
2. **CI/CD Integration**: Validate dependencies before deployment
3. **Architecture Visualization**: D3.js dependency graphs
4. **Impact Analysis**: "What breaks if I change this service?"

## Success Metrics

### Phase 1 Success Criteria
- [ ] All services cataloged in registry_services
- [ ] All apps cataloged in registry_apps  
- [ ] All CLI pipelines cataloged in registry_cli_pipelines
- [ ] Initial scan completes in < 5 minutes

### Phase 2 Success Criteria
- [ ] All dependencies mapped accurately
- [ ] Unused services report generated
- [ ] Critical paths identified
- [ ] Reports accessible via CLI

### Phase 3 Success Criteria
- [ ] At least 10% of services safely archived
- [ ] No production issues from archiving
- [ ] Archive documentation complete
- [ ] Cleanup process automated

### Long-term Success Metrics
- **Maintenance Burden**: 50% reduction in unused code
- **Discovery Time**: Find service usage in < 30 seconds
- **Architecture Clarity**: All critical paths documented
- **Development Speed**: New features leverage existing services

## Risk Mitigation

### Technical Risks
1. **False Positives**: Service marked unused but actually needed
   - Mitigation: Multiple validation checks, dry-run mode
   
2. **Performance Impact**: Scanning takes too long
   - Mitigation: Incremental updates, caching strategies

3. **Import Parser Limitations**: Complex imports not detected
   - Mitigation: Manual verification for edge cases

### Process Risks
1. **Adoption Resistance**: Developers don't trust the system
   - Mitigation: Transparency, dry-run modes, gradual rollout

2. **Maintenance Burden**: System itself becomes technical debt
   - Mitigation: Automation focus, simple architecture

## Next Steps

1. **Review & Approve**: Team review of this specification
2. **Create Migration**: Implement simplified database schema
3. **Build CLI Pipeline**: Create registry-cli.sh structure
4. **Phase 1 Implementation**: Begin with core scanning
5. **Iterate Based on Feedback**: Adjust approach based on findings

## Appendix: Example Usage Scenarios

### Scenario 1: Finding Unused Services
```bash
# Developer wants to clean up unused code
$ ./registry-cli.sh find-unused
Found 12 unused services:
- old-auth-service (last used: 180 days ago)
- legacy-data-adapter (no dependencies found)
- temp-migration-helper (marked as temporary)

$ ./registry-cli.sh validate-archivable --service old-auth-service
✓ No active dependencies
✓ No usage in last 90 days
✓ Not used in any active branches
✓ Safe to archive

$ ./registry-cli.sh archive-service --service old-auth-service
✓ Moved to .archived_services/old-auth-service.20250115.ts
✓ Updated registry status to 'archived'
✓ Archive log updated
```

### Scenario 2: Impact Analysis
```bash
# Developer wants to refactor a service
$ ./registry-cli.sh analyze-dependencies --service supabase-client
supabase-client-service dependencies:
- Used by 15 apps (10 critical)
- Used by 8 CLI pipelines
- Total 45 import locations
- Critical for: authentication, data access

$ ./registry-cli.sh generate-report --service supabase-client --format markdown
Report generated: reports/supabase-client-impact-analysis.md
```

### Scenario 3: New CLI Pipeline Opportunity
```bash
# Developer looking for CLI pipeline opportunities
$ ./registry-cli.sh find-pipeline-gaps
Services used in apps but not in CLI:
1. google-calendar-service (used in 3 apps)
2. email-template-service (used in 2 apps)
3. pdf-generation-service (used in 4 apps)

Recommendation: Create 'scripts/cli-pipeline/calendar/' pipeline
```

---

This specification provides a clear roadmap for implementing the Service Dependency Mapping System with practical simplifications and a focus on delivering immediate value while preparing for future code archiving and optimization efforts.