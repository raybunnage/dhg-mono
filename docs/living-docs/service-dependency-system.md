# Service Dependency Mapping System - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 23, 2025 (14 days)  
**Status**: Active  
**Priority**: High  
**Related Archives**: 4 documents  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Original Vision](#original-vision)
7. [Important Callouts](#important-callouts)
8. [Full Documentation](#full-documentation)

---

## Current Status & Lessons Learned

### 🎯 Current Status

The Service Dependency Mapping System is **FULLY OPERATIONAL** with core functionality implemented. The system has successfully cataloged all services and applications in the monorepo.

**What's Working Well**:
- ✅ Automatic service discovery (84 services cataloged)
- ✅ Application registry (10 apps registered)
- ✅ Service type classification (singleton, adapter, utility, helper)
- ✅ Framework detection for applications
- ✅ CLI pipeline integration with quick `pnpm service-deps` access

**Current Priority**:
- **Immediate Focus**: Implement dependency analysis to map actual usage
- **Blocking Issues**: None - ready for next phase
- **Next Milestone**: Complete dependency mapping by June 30, 2025

### 📚 Lessons Learned

1. **Automatic discovery works** - Scanning beats manual registration
2. **Type classification helps** - Understanding service patterns guides decisions
3. **Metadata is valuable** - JSDoc and package.json provide rich context
4. **CLI integration essential** - Quick access encourages regular use
5. **Monorepo complexity revealed** - 84 services shows need for this system

### ✅ Recent Actions Taken
- Implemented complete service and app scanners
- Created 9-table database schema
- Built CLI pipeline with health checks
- Discovered and cataloged all existing services

---

## Recent Updates

- **June 9, 2025**: Created this living documentation from 4 technical specs
- **June 2025**: System went fully operational with scanner implementations
- **May 2025**: Initial database schema and CLI pipeline created

---

## Next Phase

### 🚀 Phase: Dependency Analysis
**Target Date**: June 30, 2025  
**Status**: Planning  

- [ ] Implement TypeScript import parser
- [ ] Map service-to-service dependencies
- [ ] Map app-to-service dependencies
- [ ] Create dependency visualization
- [ ] Generate first impact analysis report

---

## Upcoming Phases

### Phase 2: Pipeline Integration (July 2025)
- Register all CLI pipelines
- Map pipeline-to-service dependencies
- Create pipeline health dashboard
- Identify pipeline consolidation opportunities

### Phase 3: Archiving Workflow (August 2025)
- Build safe archiving validation
- Create unused code reports
- Implement archiving automation
- Generate migration guides

---

## Priorities & Trade-offs

### Current Priorities
1. **Map actual usage** - Discovery without usage is incomplete
2. **Enable safe archiving** - Reduce codebase complexity safely
3. **Find CLI opportunities** - Identify services needing pipelines

### Pros & Cons Analysis
**Pros:**
- ✅ Complete visibility into service landscape
- ✅ Automated discovery reduces manual work
- ✅ Foundation for safe code cleanup
- ✅ Architectural insights at your fingertips

**Cons:**
- ❌ Dependency parsing adds complexity
- ❌ Requires regular rescanning
- ❌ Initial setup was significant effort

---

## Original Vision

Create a comprehensive system to understand and manage the complex web of dependencies in the DHG monorepo. Enable confident architectural decisions, safe code archiving, and identification of opportunities for new CLI pipelines. The system should provide immediate insights while supporting long-term codebase health.

---

## ⚠️ Important Callouts

⚠️ **Run health check regularly** - `pnpm service-deps health-check`

⚠️ **Rescan after major changes** - New services need registration

⚠️ **Dependencies aren't mapped yet** - Currently only discovery is complete

---

## Full Documentation

### System Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Service Scanner   │────▶│  Database Tables │◀────│   App Scanner   │
│ (84 services found) │     │   (9 tables)     │     │ (10 apps found) │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
           │                         │                          │
           └─────────────┬───────────┘──────────────────────────┘
                         ▼
              ┌─────────────────────┐
              │  Analysis Engine    │
              │ (Dependency Mapper) │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Reports & Actions  │
              └─────────────────────┘
```

### Database Schema

**Core Tables**:
- `sys_service_registry` - All shared services with metadata
- `sys_application_registry` - All apps with framework info
- `sys_cli_pipeline_registry` - CLI pipeline definitions
- `sys_command_registry` - Individual CLI commands
- `sys_service_dependencies` - Service-to-service mappings
- `sys_app_dependencies` - App-to-service mappings
- `sys_pipeline_dependencies` - Pipeline-to-service mappings
- `sys_dependency_analysis_runs` - Audit trail
- `sys_archived_code_registry` - Archived code tracking

### CLI Commands

```bash
# Quick access
pnpm service-deps [command]

# Full path
./scripts/cli-pipeline/service_dependencies/service-deps-cli.sh [command]

# Available commands:
init-system      # Initialize and verify system
scan-services    # Discover and register all services
scan-apps        # Discover and register all applications
health-check     # Verify system health
scan-all         # Run all scanners
```

### Service Classification

**Types Discovered**:
| Type | Count | Examples |
|------|-------|----------|
| Singleton | 15 | SupabaseClientService, ClaudeService |
| Adapter | 8 | supabase-adapter, auth-adapter |
| Utility | 45 | formatters, validators, helpers |
| Helper | 16 | date-helper, string-helper |

### Key Insights from Current Data

1. **84 shared services** - Significant shared functionality
2. **10 applications** - Mix of Vite, React, and Node apps
3. **Framework diversity** - React (7), Vite (9), Node servers (3)
4. **Service patterns** - Clear separation of concerns emerging

### Dependency Analysis (Next Phase)

**What We'll Track**:
```typescript
interface ServiceDependency {
  service_id: string;
  depends_on_service_id: string;
  import_path: string;
  usage_count: number;
  is_direct: boolean;
}
```

**Analysis Goals**:
- Find unused services
- Identify circular dependencies
- Map impact of changes
- Suggest consolidation opportunities

### Usage Patterns

**Finding Service Information**:
```sql
-- List all singleton services
SELECT * FROM sys_service_registry 
WHERE service_type = 'singleton';

-- Find apps using a specific service
SELECT a.name, ad.import_count
FROM sys_app_dependencies ad
JOIN sys_application_registry a ON a.id = ad.app_id
WHERE ad.service_id = 'service-uuid';

-- Services with no dependencies (candidates for archiving)
SELECT * FROM sys_service_registry s
WHERE NOT EXISTS (
  SELECT 1 FROM sys_service_dependencies 
  WHERE depends_on_service_id = s.id
);
```

### Best Practices

1. **Regular Scanning**
   - After adding new services
   - Before major refactoring
   - Monthly maintenance scan

2. **Dependency Hygiene**
   - Avoid circular dependencies
   - Prefer singleton patterns
   - Document service purpose

3. **Archiving Process**
   - Run dependency check first
   - Move to `.archived/` folder
   - Update dependency mappings

### Troubleshooting

**Problem**: Service not found in registry  
**Solution**: Run `scan-services` to update

**Problem**: Dependency count seems wrong  
**Solution**: Dependency analysis not yet implemented

**Problem**: Health check failing  
**Solution**: Check database connection and tables

### Next Steps Implementation

```bash
# Coming soon: Dependency analysis
pnpm service-deps analyze-deps

# Coming soon: Generate reports
pnpm service-deps report unused-services
pnpm service-deps report impact --service [name]

# Coming soon: Archive workflow
pnpm service-deps archive validate [service]
pnpm service-deps archive execute [service]
```

### Related Documentation

**Archived Specs**:
- `service-dependency-mapping-system.md` - Original design
- `service-dependency-mapping-system-spec.md` - Technical specification
- `service-dependency-system-implementation-summary.md` - Implementation details
- `service-dependency-system-status.md` - Status updates

**Active References**:
- `/scripts/cli-pipeline/service_dependencies/` - CLI implementation
- `/packages/shared/services/` - All shared services
- `database-architecture-guide.md` - Database design patterns

**Code References**:
- `scripts/cli-pipeline/service_dependencies/scan-services.ts` - Service scanner
- `scripts/cli-pipeline/service_dependencies/scan-apps.ts` - App scanner
- `supabase/migrations/*service_dependency*.sql` - Database schema

---

*This is part of the continuously updated documentation system. It is reviewed every 14 days to ensure accuracy and relevance.*