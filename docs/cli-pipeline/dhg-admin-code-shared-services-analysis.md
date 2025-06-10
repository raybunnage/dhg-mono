# DHG Admin Code - Shared Services Analysis

## Overview
This document analyzes all pages in the dhg-admin-code app to identify functionality that could be extracted to shared services, promoting code reuse across the monorepo.

## Page-by-Page Analysis

### 1. AIPage.tsx
**Current Functionality:**
- Loads continuous documentation monitoring records
- Filters documents by area and priority
- Updates review dates after document review
- Displays markdown documents using MarkdownViewer component

**Extractable to Shared Services:**
- **ContinuousDocumentationService**: 
  - Load documents with filtering
  - Update review dates
  - Calculate review status (overdue, upcoming)
  - Priority and area management
- **DocumentReviewService**:
  - Track review history
  - Calculate next review dates based on frequency
  - Review status management

### 2. CLICommandsRegistry.tsx
**Current Functionality:**
- Displays CLI pipeline commands and registry
- Shows command usage statistics and history
- Pipeline usage charts and error analysis
- Command execution history modal

**Already Using Shared Service:**
- `CLIRegistryService` from `@shared/services/cli-registry-service`

**Additional Extractable:**
- **CommandUsageAnalyticsService**:
  - Aggregate command usage statistics
  - Calculate success/failure rates
  - Generate usage timeline data
  - Track execution patterns
- **CommandExecutionHistoryService**:
  - Store and retrieve command execution history
  - Track command performance metrics

### 3. ClipboardManager.tsx
**Current Functionality:**
- Manages frequently used text snippets
- CRUD operations for clipboard items
- Categories for organizing snippets
- Track last used timestamps

**Extractable to Shared Services:**
- **ClipboardService**:
  - Full CRUD operations for snippets
  - Category management
  - Usage tracking
  - Default snippet initialization
  - Search and filter functionality
  - Could be useful for other apps that need quick access to snippets

### 4. DatabasePage.tsx
**Current Functionality:**
- Displays all database tables with metadata
- Shows table statistics (row counts, sizes)
- Filters by prefix, status, date
- Views management
- Table details modal

**Extractable to Shared Services:**
- **DatabaseMetadataService**:
  - Get table information with metadata
  - Calculate table statistics
  - Get view information and dependencies
  - Prefix analysis and grouping
  - Schema inspection utilities
- **DatabaseMonitoringService**:
  - Track table growth over time
  - Monitor table health and performance
  - Generate database reports

### 5. TasksPage.tsx & TaskDetailPage.tsx
**Current Functionality:**
- Task CRUD operations
- Task filtering and search
- Worktree assignment tracking
- Task status management

**Already Has Service:**
- `TaskService` exists but could be moved to shared

**Extractable to Shared Services:**
- **DevTaskService** (enhance existing):
  - Move from app-specific to shared
  - Standardize task management across apps
  - Add task templates and workflows
- **WorktreeTaskService**:
  - Track tasks by worktree
  - Worktree utilization analytics
  - Task distribution management

### 6. GitManagement.tsx & GitBranchManagement.tsx
**Current Functionality:**
- Worktree management and status
- Branch cleanup suggestions
- Merge queue management
- Git operations via API

**Already Has Local Service:**
- `GitApiClient` - could be enhanced and moved to shared

**Extractable to Shared Services:**
- **GitManagementService**:
  - Worktree operations and status
  - Branch management (list, delete, cleanup)
  - Merge queue operations
  - Git statistics and analytics
- **MergeQueueService**:
  - Queue management
  - Merge checklist tracking
  - Conflict detection
  - Merge history

### 7. WorkSummaries.tsx & WorkSummariesEnhanced.tsx
**Current Functionality:**
- Creates and manages AI work summaries
- Links summaries to dev tasks
- Tracks worktree associations
- Summary search and filtering

**Extractable to Shared Services:**
- **WorkSummaryService**:
  - CRUD operations for work summaries
  - Link summaries to tasks and worktrees
  - Generate summary statistics
  - Search and filter capabilities
  - Could be used by other apps for tracking work

### 8. DocumentsPage.tsx
**Current Functionality:**
- Document listing and search
- Document type filtering
- Markdown document viewer
- Document metadata display

**Extractable to Shared Services:**
- **DocumentManagementService**:
  - Document search and filtering
  - Document metadata management
  - Document type operations
  - Integration with file system

### 9. ScriptsManagement.tsx
**Current Functionality:**
- Script registry management
- Script usage tracking
- Script categorization
- Execution history

**Extractable to Shared Services:**
- **ScriptManagementService**:
  - Script CRUD operations
  - Usage analytics
  - Category management
  - Execution tracking
  - Could benefit CLI pipeline tools

### 10. ServiceDependencies.tsx
**Current Functionality:**
- Service dependency visualization
- Dependency mapping CRUD
- Service health monitoring
- Import/export statistics

**Extractable to Shared Services:**
- **ServiceDependencyService**:
  - Map service dependencies
  - Analyze import/export relationships
  - Generate dependency graphs
  - Monitor service health
  - Useful for architecture documentation

### 11. LivingDocsPage.tsx
**Current Functionality:**
- Continuous documentation monitoring
- Document status tracking
- Review scheduling
- Integration with continuous docs server

**Extractable to Shared Services:**
- **LivingDocumentationService**:
  - Monitor document changes
  - Track document health
  - Schedule reviews
  - Generate documentation reports
  - Integrate with git for change tracking

## Reusable UI Components to Extract

### 1. Data Display Components
- **TableWithFilters**: Reusable table with search, sort, and filter
- **StatisticsCards**: Display metric cards with icons
- **StatusBadge**: Consistent status indicators
- **PriorityIndicator**: Priority display component

### 2. Form Components
- **SearchWithDebounce**: Search input with debounce
- **MultiSelectFilter**: Filter with multiple selections
- **DateRangeFilter**: Date filtering component

### 3. Modal Components
- **DetailsModal**: Generic detail view modal
- **ConfirmationModal**: Reusable confirmation dialog
- **ExecutionModal**: Command/action execution modal

### 4. Chart Components
- **UsageChart**: Generic usage visualization
- **TimelineChart**: Timeline visualization
- **SparklineChart**: Small inline charts

## Common Patterns Identified

### 1. Data Fetching Pattern
```typescript
// Common pattern across all pages
const loadData = async (filters?: FilterOptions) => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .applyFilters(filters);
    
    if (error) throw error;
    setData(data);
  } catch (err) {
    setError(err);
  } finally {
    setLoading(false);
  }
};
```

**Extract to**: `useSupabaseQuery` hook in shared

### 2. Filter Management Pattern
```typescript
// Common filter state management
const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('');
const [dateFilter, setDateFilter] = useState('all');
```

**Extract to**: `useFilterState` hook with persistence

### 3. Command Execution Pattern
```typescript
// Common CLI command execution
const executeCommand = async (command: string) => {
  const response = await fetch('/api/execute', {
    method: 'POST',
    body: JSON.stringify({ command })
  });
  return response.json();
};
```

**Extract to**: `CommandExecutionService`

## Priority Recommendations

### High Priority (Immediate Benefit)
1. **DatabaseMetadataService** - Used by multiple apps already
2. **ClipboardService** - Universal utility
3. **DevTaskService** - Core functionality
4. **GitManagementService** - Critical for development workflow

### Medium Priority (Good Reuse Potential)
1. **WorkSummaryService** - Growing use case
2. **DocumentManagementService** - Common need
3. **ServiceDependencyService** - Architecture tool
4. **CommandUsageAnalyticsService** - CLI improvements

### Low Priority (App-Specific for Now)
1. **ContinuousDocumentationService** - Specialized use
2. **LivingDocumentationService** - Still evolving
3. **MergeQueueService** - Complex, needs refinement

## Implementation Strategy

### Phase 1: Core Services
1. Extract DatabaseMetadataService
2. Extract ClipboardService
3. Move TaskService to shared
4. Create shared UI component library

### Phase 2: Development Tools
1. Extract GitManagementService
2. Create WorkSummaryService
3. Implement CommandExecutionService

### Phase 3: Specialized Services
1. Build DocumentManagementService
2. Create ServiceDependencyService
3. Implement analytics services

## Benefits of Extraction

1. **Code Reuse**: Other apps can use these services
2. **Consistency**: Standardized patterns across apps
3. **Maintenance**: Single source of truth for business logic
4. **Testing**: Centralized testing for core functionality
5. **Performance**: Optimized and cached services
6. **Documentation**: Better API documentation

## Migration Considerations

1. **Backward Compatibility**: Maintain existing APIs during migration
2. **Gradual Migration**: Move one service at a time
3. **Testing**: Comprehensive tests before and after
4. **Documentation**: Update all usage documentation
5. **Type Safety**: Ensure TypeScript types are preserved