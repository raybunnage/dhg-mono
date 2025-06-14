# Service Usage Scan Results - June 13, 2025

## Key Findings

### Usage Statistics
- **Total Services**: 110
- **Used Services**: 49 (44.5%)
- **Unused Services**: 61 (55.5%)
- **High Usage (>10)**: 19 services

### Top 10 Most Used Services

| Service | Usage Count | Current Type | Pattern | Status |
|---------|-------------|--------------|---------|---------|
| SupabaseClientService | 1,285 | infrastructure | singleton | ✅ Correctly classified |
| SupabaseClient | 826 | business | DI | ⚠️ Should be removed (use SupabaseClientService) |
| AuthService | 95 | business | DI | ❓ Needs review (might be infrastructure) |
| TrackingService | 81 | business | DI | ✅ Likely correct |
| claudeService | 80 | infrastructure | singleton | ✅ Correctly classified |
| SupabaseAdapter | 62 | business | DI | ⚠️ Duplicate of SupabaseClientService |
| PromptService | 42 | business | DI | ✅ Likely correct |
| FilterService | 38 | business | DI | ✅ Likely correct |
| GoogleDriveService | 36 | business | DI | ❓ Needs review |
| GoogleDrive | 31 | business | DI | ⚠️ Generic name, needs investigation |

## Critical Duplicates to Address

### Supabase Services (URGENT)
- **SupabaseClientService** (1,285 uses) - Keep this (infrastructure)
- **SupabaseClient** (826 uses) - Remove, migrate to SupabaseClientService
- **SupabaseAdapter** (62 uses) - Remove, migrate to SupabaseClientService
- **SupabaseService** (13 uses) - Remove, migrate to SupabaseClientService
- **SupabaseClientAdapter** (1 use) - Remove
- **SupabaseCache** (0 uses) - Remove
- **SupabaseHelpers** (0 uses) - Remove

**Action**: This alone will consolidate 7 services into 1!

### Task Services
- **TaskService** (30 uses) - Keep this
- **DevTaskService** (16 uses) - Evaluate if can merge
- **FollowUpTaskService** (0 uses) - Remove

### Google Drive Services
- **GoogleDriveService** (36 uses) - Keep as main service
- **GoogleDrive** (31 uses) - Generic import, investigate
- **google-drive** (6 uses) - Case difference, consolidate
- **GoogleDriveBrowserService** (3 uses) - Keep if browser-specific
- **GoogleDriveSyncService** (2 uses) - Merge into main service
- **GoogleDriveExplorerService** (2 uses) - Merge into main service

## Services Needing Classification Review

Based on usage patterns, these might be misclassified:

1. **AuthService** (95 uses) - High usage suggests infrastructure
2. **TrackingService** (81 uses) - Might manage tracking state (infrastructure)
3. **logger** (0 uses shown) - Already classified as infrastructure but no usage found
4. **BrowserAuthService** (0 uses shown) - Already classified as infrastructure but no usage found

## Quick Wins

### 1. Remove Obviously Unused Duplicates (0 usage)
```sql
-- These have duplicates with usage, safe to remove
DELETE FROM sys_shared_services WHERE service_name IN (
  'SupabaseCache',
  'SupabaseHelpers',
  'supabase-helpers',
  'FollowUpTaskService',
  'GitOperationsService',  -- GitService is also unused
  'GitService',            -- Both Git services unused
  'AiProcessingService',   -- Has AIProcessingService
  'CliRegistryService'     -- Has CLIRegistryService
);
```

### 2. Fix Case-Sensitive Duplicates
```sql
-- ClaudeService vs claudeService (keep claudeService with 80 uses)
UPDATE sys_shared_services 
SET service_name = 'claudeService'
WHERE service_name = 'ClaudeService';

-- Then remove any remaining duplicates
DELETE FROM sys_shared_services 
WHERE service_name = 'ClaudeService';
```

### 3. Consolidate Supabase Services
This requires code changes but will have huge impact:
- 826 + 62 + 13 + 1 = 902 references to update
- But consolidates 7 services into 1

## Next Steps

1. **Immediate Actions**:
   - Remove unused duplicate services (SQL provided)
   - Fix case-sensitive duplicates
   - Review high-usage services for correct classification

2. **This Week**:
   - Consolidate Supabase services (biggest impact)
   - Review AuthService classification (95 uses)
   - Merge Google Drive services

3. **Ongoing**:
   - Test consolidated services in dhg-service-test
   - Update all imports gradually
   - Monitor for issues

## Success Metrics

- **Before**: 110 services, 68 duplicate pairs
- **After Quick Wins**: ~95 services (-15)
- **After Consolidation**: ~70 services (-40)
- **Target**: 60-70 well-organized services