# Scripts CLI Pipeline Evaluation & Streamlining Plan

## Current State Analysis

### Database: scripts_registry Table Structure
```sql
-- Key Columns:
id, file_path, title, summary, language, ai_generated_tags, manual_tags, 
last_modified_at, last_indexed_at, file_hash, metadata (JSON), 
created_at, updated_at, script_type_id, package_json_references, 
ai_assessment (JSON), assessment_quality_score, assessment_created_at, 
assessment_updated_at, assessment_model, assessment_version, 
assessment_date, document_type_id
```

### Current Statistics
- **Total Scripts**: 143 scripts registered
- **Classification**: 0% scripts classified (no document_type_id assigned)
- **Metadata**: Most scripts missing metadata (pipeline, file_size, etc.)
- **Pipeline Detection**: All scripts grouped under "root/" instead of actual pipelines

## Key Issues Identified

### 1. ❌ Filtering Logic Problems
- Default query excludes scripts without `metadata->>is_archived` field
- Results in "No scripts found" even when 143 scripts exist
- Overly strict filtering prevents users from seeing available scripts

### 2. ❌ TypeScript Compilation Errors
```
error TS7016: Could not find a declaration file for module 'glob'
```
- Missing `@types/glob` dependency
- Prevents sync and other core commands from running

### 3. ❌ Missing Metadata Population
- Scripts lack pipeline information (all show "root/")
- File sizes not populated ("Size: unknown")
- Archive status not properly tracked

### 4. ❌ Poor Pipeline Detection
- Scripts should be auto-categorized by their file path
- Example: `scripts/cli-pipeline/google_sync/sync.ts` → pipeline: "google_sync"

### 5. ❌ No Document Classification
- 0% of scripts have document_type_id assigned
- AI classification system not working properly

## Streamlining Plan

### Phase 1: Fix Core Issues (High Priority)

#### 1.1 Fix Filtering Logic
```typescript
// Current (broken):
query = query.not('metadata->>is_archived', 'eq', 'true');

// Fixed (inclusive):
query = query.or('metadata->>is_archived.is.null,metadata->>is_archived.neq.true');
```

#### 1.2 Add Missing Dependencies
```bash
cd scripts/cli-pipeline/scripts
npm install --save-dev @types/glob @types/node
```

#### 1.3 Improve Pipeline Detection
```typescript
function extractPipelineFromPath(filePath: string): string {
  const match = filePath.match(/scripts\/cli-pipeline\/([^/]+)\//);
  return match ? match[1] : 'root';
}
```

#### 1.4 Populate Missing Metadata
- Auto-detect pipeline from file path
- Calculate and store file sizes
- Set default archive status to false

### Phase 2: Enhanced Commands (Medium Priority)

#### 2.1 Improve List Command
- More inclusive default filtering
- Better display formatting
- Pipeline-based grouping
- Status indicators (✅ working, ❌ broken, ⚠️ needs work)

#### 2.2 Fix Sync Command
- Resolve TypeScript compilation issues
- Add progress indicators
- Better error handling
- Metadata population during sync

#### 2.3 Add Classification
- Integrate with document classification system
- Auto-classify scripts by purpose/function
- Add confidence scores

### Phase 3: New Features (Lower Priority)

#### 3.1 Script Status Tracking
- Track which scripts are working/broken
- Integration with command_tracking table
- Health check results

#### 3.2 Dependency Analysis
- Track package.json dependencies
- Identify shared services usage
- Find orphaned scripts

#### 3.3 Usage Analytics
- Track script execution frequency
- Identify popular vs unused scripts
- Performance metrics

### Phase 4: UI Page Development

#### 4.1 Scripts Management Page Features
- **Hierarchical View**: Scripts grouped by pipeline
- **Search & Filter**: By name, pipeline, type, status
- **Status Indicators**: Working, broken, archived, needs work
- **Quick Actions**: Run, edit, archive, classify
- **Metadata Management**: Edit descriptions, tags, classification
- **Dependency View**: Show package dependencies and relationships

#### 4.2 UI Design Pattern
Follow the same pattern as DocumentTypes and PromptService pages:
- Clean, responsive layout with Tailwind CSS
- Modal forms for editing
- Real-time search and filtering
- Expandable/collapsible sections by pipeline
- Admin-only access with ProtectedRoute

## Implementation Priority

### 🔥 Immediate Fixes (This Session)
1. Fix list command filtering logic
2. Add missing TypeScript dependencies
3. Improve metadata population
4. Test core functionality

### 📋 Next Steps
1. Fix sync command compilation
2. Enhance pipeline detection
3. Add script classification
4. Create UI page

## Success Metrics

- ✅ List command shows scripts instead of "No scripts found"
- ✅ All CLI commands compile and run without TypeScript errors
- ✅ Scripts properly categorized by pipeline
- ✅ Metadata fields populated (file_size, pipeline, etc.)
- ✅ UI page provides comprehensive script management

## Files to Modify

### Core CLI Files
- `scripts/cli-pipeline/scripts/list-scripts.ts` - Fix filtering
- `scripts/cli-pipeline/scripts/sync-all-scripts.ts` - Fix compilation
- `scripts/cli-pipeline/scripts/package.json` - Add dependencies

### New UI Page
- `apps/dhg-admin-code/src/pages/ScriptsManagement.tsx` - Main UI
- `apps/dhg-admin-code/src/App.tsx` - Add route

### Database Updates
- Consider adding indexes for better query performance
- Add migration for any schema changes needed