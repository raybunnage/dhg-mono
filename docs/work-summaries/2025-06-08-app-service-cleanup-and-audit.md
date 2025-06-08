# App and Service Cleanup Audit

Date: 2025-06-08

## Summary

Conducted a comprehensive audit of all apps for Supabase compliance and identified opportunities for using new shared services. Also archived unused services and duplicate implementations.

## Supabase Compliance Audit

### ✅ Compliant Apps (Following CLAUDE.md Pattern)
1. **dhg-admin-code** - Single instance at `src/lib/supabase.ts`
2. **dhg-admin-google** - Single instance at `src/lib/supabase.ts`
3. **dhg-hub-lovable** - Single instance at `src/integrations/supabase/client.ts`
4. **dhg-hub** - Single instance at `src/utils/supabase-adapter.ts`

### ⚠️ Apps with Multiple Instances
1. **dhg-admin-suite** - Has both regular and admin clients (may be intentional for admin operations)
2. **dhg-audio** - Had duplicate `supabase-init.ts` file (now archived)

### 🚫 Apps Without Supabase
1. **dhg-a** - No database integration
2. **dhg-b** - No database integration  
3. **dhg-research** - New app without database integration yet

## Files Archived

### 1. Duplicate Supabase Implementations
- **Archived**: `apps/dhg-audio/src/services/supabase-init.ts` → `.archived/supabase-init.20250608.ts`
  - Reason: Redundant initialization file; main `lib/supabase.ts` is sufficient

### 2. Unused Shared Services
- **Archived**: `packages/shared/services/supabase-client-fixed.ts` → `.archived_services/supabase-client-fixed.20250608.ts`
  - Reason: Duplicate implementation not used anywhere
- **Archived**: `packages/shared/services/theme-service/` → `.archived_services/theme-service.20250608/`
  - Reason: Theme service not used by any app or pipeline

## Opportunities for New Shared Services

### FileSystemService Opportunities

1. **dhg-audio/server.js**
   - File reading: `fs.readFileSync()` for service account
   - File existence: Multiple `fs.existsSync()` calls
   - **Recommendation**: Use `FileSystemService.fileExists()` and `readFileContent()`

2. **dhg-admin-code/continuous-docs-server.cjs**
   - File I/O: `fs.readFile()` and `fs.writeFile()` for tracking data
   - Directory creation: `fs.mkdir()` with recursive
   - **Recommendation**: Use `FileSystemService` methods for all file operations

### BatchDatabaseService Opportunities

1. **dhg-admin-code/src/pages/ClipboardManager.tsx**
   - Creates multiple default clipboard items in a loop
   - **Recommendation**: Use `BatchDatabaseService.batchInsert()` for bulk creation

2. **dhg-admin-google/src/pages/ClassifyDocument.tsx**
   - Executes multiple count queries sequentially
   - Processes document arrays for type distribution
   - **Recommendation**: Use `BatchDatabaseService` for parallel queries

3. **dhg-admin-code/src/pages/CLICommandsRegistry.tsx**
   - Processes command usage data with multiple queries
   - **Recommendation**: Use batch operations for statistics queries

## Key Findings

### 1. Service Duplication
- Found `file-service` in shared services that provides Google Drive integration
- This is different from our new `FileSystemService` and is actively used by 6 pipelines
- The CLI pipeline has its own `file-service.ts` which is also different

### 2. Unused Services Identified
- `theme-service` - Not used anywhere, now archived
- `supabase-client-fixed.ts` - Duplicate implementation, now archived

### 3. Active Shared Services
- Most shared services are actively used by pipelines and apps
- `formatter-service` - Used by database schema-health command
- `file-service` (Google Drive) - Used by media-processing and ai pipelines

## Recommendations

### Immediate Actions
1. ✅ Archived duplicate Supabase implementations
2. ✅ Archived unused theme-service
3. ✅ Archived supabase-client-fixed.ts

### Future Improvements
1. **Consolidate File Services**: We now have 3 different file services:
   - `packages/shared/services/file-service/` - Google Drive integration
   - `packages/shared/services/file-system-service.ts` - New general file operations
   - `scripts/cli-pipeline/shared/file-service.ts` - CLI pipeline specific
   
   Consider merging these into a unified service with different modules.

2. **Migrate Apps to Use Shared Services**:
   - Update `dhg-audio/server.js` to use FileSystemService
   - Update `dhg-admin-code/continuous-docs-server.cjs` to use FileSystemService
   - Update database-heavy components to use BatchDatabaseService

3. **dhg-admin-suite Dual Clients**: 
   - Investigate if both regular and admin Supabase clients are necessary
   - If needed, document the use case in the code

## Impact

- **Code Quality**: Removed duplicate and unused code
- **Consistency**: All apps now follow the approved Supabase pattern
- **Maintainability**: Identified clear opportunities for shared service adoption
- **Future Work**: Clear roadmap for consolidating file services and batch operations