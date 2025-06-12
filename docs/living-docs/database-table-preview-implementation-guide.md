# Database Table Preview Implementation Guide

## Overview
This living document outlines the implementation strategy for adding table data preview functionality to the DatabasePage in dhg-admin-code. The feature would allow users to quickly preview sample records from any table directly within the existing TableDetailsModal.

## Current State Analysis
- **DatabasePage** (`apps/dhg-admin-code/src/pages/DatabasePage.tsx`) - Lists all database tables with metadata
- **TableDetailsModal** (`apps/dhg-admin-code/src/components/TableDetailsModal.tsx`) - Shows table metadata when clicked
- **Click Handler** - Already implemented; clicking a table row opens the modal
- **Database Service** - `DatabaseMetadataService` exists for table structure queries

## Implementation Difficulty: **EASY-MEDIUM** ⭐⭐☆☆☆

### Why It's Not Hard:
1. **Infrastructure exists** - Modal and click handlers already in place
2. **Simple queries** - Basic SELECT with LIMIT is straightforward
3. **Incremental feature** - Can be added without breaking existing functionality
4. **No complex state management** - Preview data is read-only

### Potential Challenges:
1. **Large tables** - Need proper LIMIT and possibly pagination
2. **Column selection** - Deciding which columns to show
3. **Data formatting** - Handling various data types (JSON, arrays, timestamps)
4. **Performance** - Avoiding slow queries on large tables

## Implementation Approaches

### Approach 1: Simple Preview Tab (RECOMMENDED) ⭐
Add a "Preview" tab to the existing TableDetailsModal alongside the metadata.

**Pros:**
- Minimal UI changes
- Reuses existing modal infrastructure
- Clean separation of concerns
- Easy to implement

**Cons:**
- Limited space in modal
- May need horizontal scrolling

**Implementation Steps:**
1. Add state for active tab in TableDetailsModal
2. Add tab navigation UI
3. Create TablePreview component
4. Fetch preview data when preview tab is selected
5. Display data in a responsive table

### Approach 2: Inline Preview in Table List
Show preview directly in the DatabasePage table list as an expandable row.

**Pros:**
- More space for preview
- Can see multiple previews at once
- No modal navigation needed

**Cons:**
- More complex UI changes
- Could make the page cluttered
- Performance concerns with multiple previews

### Approach 3: Dedicated Preview Modal
Create a separate, larger modal specifically for data preview.

**Pros:**
- Maximum space for data
- Can add more preview features
- Better for wide tables

**Cons:**
- More code duplication
- Additional UI component to maintain

## Technical Implementation Details

### 1. Query Generation
```typescript
// Simple approach - first 100 rows
const previewQuery = `
  SELECT * FROM ${tableName} 
  LIMIT 100
`;

// Smart approach - sample across table
const smartPreviewQuery = `
  SELECT * FROM ${tableName} 
  TABLESAMPLE SYSTEM (1) 
  LIMIT 100
`;
```

### 2. Column Selection Strategy
```typescript
interface ColumnSelectionStrategy {
  // Option 1: Show all columns (with horizontal scroll)
  showAll(): string[];
  
  // Option 2: Show first N columns
  showFirst(n: number): string[];
  
  // Option 3: Show key columns (id, name, title, created_at)
  showImportant(): string[];
  
  // Option 4: Custom per table (from config)
  showCustom(tableConfig: TablePreviewConfig): string[];
}
```

### 3. Data Formatting
```typescript
const formatCellValue = (value: any, dataType: string): string => {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  
  switch (dataType) {
    case 'json':
    case 'jsonb':
      return JSON.stringify(value, null, 2);
    case 'timestamp':
    case 'timestamptz':
      return new Date(value).toLocaleString();
    case 'boolean':
      return value ? '✓' : '✗';
    case 'uuid':
      return value.substring(0, 8) + '...';
    default:
      return String(value);
  }
};
```

### 4. Component Structure
```typescript
// New component: TablePreview.tsx
interface TablePreviewProps {
  tableName: string;
  schema?: string;
}

export function TablePreview({ tableName, schema = 'public' }: TablePreviewProps) {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch preview data
  useEffect(() => {
    fetchPreviewData();
  }, [tableName]);
  
  // Render table with data
  return (
    <div className="overflow-auto max-h-96">
      {/* Table implementation */}
    </div>
  );
}
```

## Configuration Options

### Simple Configuration (Phase 1)
- Fixed 100 row limit
- Show all columns with horizontal scroll
- Basic data formatting

### Advanced Configuration (Phase 2)
```typescript
// Optional table_preview_config table
interface TablePreviewConfig {
  table_name: string;
  preview_columns?: string[]; // Specific columns to show
  preview_limit?: number;     // Custom row limit
  order_by?: string;         // Sort preference
  where_clause?: string;     // Filter for preview
  custom_query?: string;     // Complete custom query
}
```

## Security Considerations
1. **RLS (Row Level Security)** - Preview queries must respect RLS policies
2. **Sensitive data** - Consider which tables should allow preview
3. **Query injection** - Use parameterized queries
4. **Performance limits** - Enforce reasonable LIMIT values

## Performance Optimization
1. **Lazy loading** - Only fetch preview when tab is selected
2. **Caching** - Cache preview data for session
3. **Index usage** - Ensure queries use indexes
4. **Timeout** - Set query timeout (e.g., 5 seconds)

## User Experience Enhancements
1. **Loading state** - Show skeleton while fetching
2. **Error handling** - Graceful errors for large/slow tables
3. **Empty state** - Clear message for empty tables
4. **Pagination** - Optional for large previews
5. **Export** - Optional CSV export of preview

## Implementation Phases

### Phase 1: Basic Preview (2-3 hours)
- Add preview tab to TableDetailsModal
- Simple SELECT * LIMIT 100 query
- Basic table display
- Loading and error states

### Phase 2: Smart Columns (1-2 hours)
- Implement column selection logic
- Add horizontal scrolling
- Improve data formatting

### Phase 3: Configuration (2-3 hours)
- Add preview configuration table
- Implement custom queries
- Add caching layer

### Phase 4: Polish (1-2 hours)
- Add pagination
- Implement export functionality
- Performance optimizations

## Monitoring and Maintenance
- Track preview query performance
- Monitor which tables are previewed most
- Collect user feedback on column selection
- Regular review of custom configurations

## Decision Points
1. **Modal vs Inline** - Recommend modal tab approach for simplicity
2. **Column Selection** - Start with all columns, add smart selection later
3. **Row Limit** - 100 rows is reasonable default
4. **Configuration** - Start without config table, add if needed

## Next Steps
1. Create TablePreview component
2. Add tab navigation to TableDetailsModal
3. Implement basic preview query
4. Test with various table types
5. Gather user feedback
6. Iterate based on usage patterns

## Living Document Updates
- **Last Updated**: December 11, 2024
- **Status**: Initial proposal
- **Next Review**: After Phase 1 implementation
- **Feedback**: Pending user testing

---

This document will be updated as implementation progresses and user feedback is collected.