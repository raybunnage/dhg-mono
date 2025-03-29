# Scripts Migration Plan

## Overview

The monorepo has been undergoing a significant restructuring, with core services being moved to the shared packages directory. This document outlines the strategy for migrating scripts that depend on these services.

## Current State

Recent commits show that several key services have been moved to the shared package:
- file-service
- supabase-service
- report-service

Many scripts in the codebase might still be referencing these services from their original locations, which could lead to broken functionality.

## When to Migrate Scripts

**We recommend addressing script migrations only after the following conditions are met:**

1. **Core app functionality is verified with shared services** (in progress)
2. **All shared services have stabilized** (no major interface changes expected)
3. **Testing infrastructure for scripts is in place**

## Migration Approach

### Phase 1: Script Inventory (Pre-migration)

1. Identify all scripts that reference the moved services
   ```bash
   # Example command to identify impacted scripts
   grep -r "supabase-service\|file-service\|report-service" --include="*.sh" --include="*.ts" --include="*.js" ./scripts/
   ```

2. Create a comprehensive list of affected scripts and their dependencies
3. Prioritize scripts based on importance and usage frequency

### Phase 2: Update Script References

For each script identified in Phase 1:

1. Update import/require statements to reference shared packages
2. Test the script functionality in isolation
3. Update any dependent configurations or environment variables

### Phase 3: Testing & Validation

For each migrated script:

1. Run the script in a development environment
2. Verify outputs match expected results
3. Check for proper error handling
4. Test with various input conditions

### Phase 4: Archiving Old Implementations

**ONLY after thorough testing and validation:**

1. Archive the old service implementations with date suffixes
   ```
   mv ./original-location/file-service.ts ./_archive/2025-03-xx/file-service.2025-03-xx.ts
   ```

2. Update documentation to reflect the new locations
3. Monitor for any regression issues

## Key Risks

- **Silent failures**: Services might seem to work initially but fail in edge cases
- **Environment differences**: Scripts might behave differently in various environments
- **Dependency chains**: Scripts may use other scripts that depend on the moved services

## Services Migration Timeline

| Service | Moved To | Status | Scripts Migration Ready |
|---------|----------|--------|-------------------------|
| file-service | packages/shared/services/file-service | Complete | Not yet |
| supabase-service | packages/shared/services/supabase-service | Complete | Not yet |
| report-service | packages/shared/services/report-service | Complete | Not yet |

## Validation Checklist Before Archiving

Before archiving the old implementations, ensure:

1. ✓ All apps using the services have been updated and tested
2. ✓ All scripts using the services have been updated and tested
3. ✓ CI/CD pipelines run successfully with the updated services
4. ✓ Documentation has been updated to reference new paths
5. ✓ All team members are aware of the changes
6. ✓ A rollback plan is in place if issues arise

Only when all these conditions are met should the original service implementations be archived.