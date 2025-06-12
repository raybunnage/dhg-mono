# DHG-Admin-Code Shared Services Analysis

**Date**: June 10, 2025  
**Analyzed App**: dhg-admin-code  
**Purpose**: Identify functionality that can be extracted to shared services

## Executive Summary

After analyzing the dhg-admin-code app, I've identified significant opportunities for extracting functionality into shared services. The app contains several patterns and utilities that would benefit other applications in the monorepo.

## High-Priority Extraction Opportunities

### 1. **DevTaskService** ⭐ HIGH PRIORITY
**Current Location**: `src/services/task-service.ts`  
**Why Extract**: 
- Comprehensive task management system used across the monorepo
- Already well-structured as a service class
- Other apps could benefit from standardized task management
- Includes git integration, work sessions, and success criteria tracking

**Proposed Service**: `packages/shared/services/dev-task-service/`
```typescript
// Would include all task CRUD, git integration, work sessions, etc.
export class DevTaskService {
  // All existing TaskService functionality
  // Plus enhanced querying and filtering capabilities
}
```

### 2. **DatabaseMetadataService** ⭐ HIGH PRIORITY
**Current Functionality**: In `DatabasePage.tsx`
**Why Extract**:
- Table information retrieval is useful for many admin tools
- Schema inspection capabilities needed by multiple apps
- Database statistics and health checks

**Proposed Service**: `packages/shared/services/database-metadata-service/`
```typescript
export class DatabaseMetadataService {
  getTableInfo(): Promise<TableInfo[]>
  getTableStatistics(tableName: string): Promise<TableStats>
  getSchemaInfo(): Promise<SchemaInfo>
  getDatabaseHealth(): Promise<HealthStatus>
}
```

### 3. **ClipboardService** ⭐ HIGH PRIORITY
**Current Location**: `src/pages/ClipboardManager.tsx`
**Why Extract**:
- Snippet management is universally useful
- Could be used by all development tools
- Already has user-specific data isolation

**Proposed Service**: `packages/shared/services/clipboard-service/`
```typescript
export class ClipboardService {
  getSnippets(userId: string): Promise<ClipboardItem[]>
  createSnippet(snippet: ClipboardItem): Promise<ClipboardItem>
  updateLastUsed(snippetId: string): Promise<void>
  // etc.
}
```

### 4. **WorktreeManagementService** 🔧 MEDIUM PRIORITY
**Current Functionality**: In multiple pages (GitManagement, WorktreeMappings)
**Why Extract**:
- Worktree operations are complex and reusable
- Multiple apps need git/worktree integration
- Standardize worktree alias mapping

**Proposed Service**: `packages/shared/services/worktree-service/`

### 5. **WorkSummaryService** ⭐ HIGH PRIORITY
**Current Functionality**: In `WorkSummaries.tsx` and `WorkSummariesEnhanced.tsx`
**Why Extract**:
- AI work summaries are tracked across the monorepo
- Standardized work tracking and reporting
- Integration with dev tasks and git commits

**Proposed Service**: `packages/shared/services/work-summary-service/`
```typescript
export class WorkSummaryService {
  getWorkSummaries(filters?: WorkSummaryFilters): Promise<WorkSummary[]>
  createWorkSummary(summary: WorkSummaryInput): Promise<WorkSummary>
  linkToTask(summaryId: string, taskId: string): Promise<void>
  generateReport(dateRange: DateRange): Promise<WorkReport>
}
```

### 6. **CommandExecutionService** 🔧 MEDIUM PRIORITY
**Current Pattern**: Used in CommandExecutionModal component
**Why Extract**:
- Standardized CLI command execution
- Progress tracking and output capture
- Error handling patterns

**Proposed Service**: Enhancement to existing `cli-registry-service`

## Reusable UI Component Patterns

### 1. **Data Table Components**
- Sortable, filterable tables used throughout
- Could create `@shared/components/DataTable`
- Include pagination, search, and export functionality

### 2. **Modal Components**
- TableDetailsModal, EditTaskModal, CommandExecutionModal
- Could create `@shared/components/Modal` with variants

### 3. **Chart Components**
- CommandUsageSparkline, PipelineUsageChart
- Could create `@shared/components/Charts`

### 4. **Status Badges**
- Task status, priority badges
- Could create `@shared/components/StatusBadge`

## Common Patterns to Extract

### 1. **useSupabaseQuery Hook**
```typescript
// Common pattern for data fetching with loading/error states
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // ... implementation
}
```

### 2. **Filter State Management**
```typescript
// Common filter pattern used across pages
export function useFilterState<T>() {
  const [filters, setFilters] = useState<T>({});
  const [searchTerm, setSearchTerm] = useState('');
  // ... filter logic
}
```

### 3. **Export to CSV/JSON Utilities**
```typescript
// Data export functionality used in multiple pages
export class DataExportService {
  exportToCSV(data: any[], filename: string): void
  exportToJSON(data: any[], filename: string): void
}
```

## Already Using Shared Services ✅

The app already leverages these shared services well:
- `AuthService` - for authentication
- `SupabaseClient` - via adapters
- `CLIRegistryService` - for command registry

## Services That Need Enhancement

### 1. **GitService**
- Current GitService is basic
- dhg-admin-code has advanced git operations that could enhance it
- Branch management, commit tracking, worktree operations

### 2. **DocumentService**
- Living docs and continuous monitoring features
- Could be merged with existing document services

## Implementation Priority

### Phase 1: Core Services (High Value, Low Risk)
1. **DevTaskService** - Extract existing TaskService
2. **ClipboardService** - Extract clipboard functionality
3. **DatabaseMetadataService** - Extract database operations
4. **WorkSummaryService** - Extract work tracking functionality

### Phase 2: Development Tools
5. **WorktreeManagementService** - Consolidate git operations
6. **CommandExecutionService** - Enhance CLI service

### Phase 3: UI Components
7. Create shared component library
8. Extract common hooks and utilities

## Migration Strategy

### For DevTaskService (Example):
1. Copy `task-service.ts` to `packages/shared/services/dev-task-service/`
2. Update imports to use shared service patterns
3. Add browser compatibility if needed
4. Update dhg-admin-code to import from shared
5. Test thoroughly
6. Update other apps to use the shared service

## Code Patterns to Standardize

### 1. **Error Handling**
```typescript
// Standardize error handling across services
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### 2. **Pagination**
```typescript
// Standard pagination interface
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

### 3. **Filter Interfaces**
```typescript
// Standard filter patterns
export interface BaseFilter {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string[];
}
```

## Benefits of Extraction

1. **Code Reuse**: Other apps can leverage tested functionality
2. **Consistency**: Standardized patterns across the monorepo
3. **Maintenance**: Single source of truth for business logic
4. **Testing**: Shared tests reduce duplication
5. **Type Safety**: Shared TypeScript interfaces

## Risks and Mitigation

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Incremental migration with thorough testing

2. **Risk**: Over-abstraction
   - **Mitigation**: Extract only truly reusable patterns

3. **Risk**: Performance overhead
   - **Mitigation**: Lazy loading and tree-shaking

## Next Steps

1. **Immediate Action**: Extract DevTaskService as it's already well-structured
2. **Quick Win**: Extract ClipboardService for immediate reuse
3. **Plan**: Create RFC for shared component library
4. **Document**: Update shared services documentation

## Conclusion

The dhg-admin-code app contains valuable functionality that should be shared across the monorepo. The highest priority items are the DevTaskService, DatabaseMetadataService, and ClipboardService. These extractions would provide immediate value to other applications while improving code organization and maintainability.