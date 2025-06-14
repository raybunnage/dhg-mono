# Database Table Preview Implementation Guide

## Overview
This living document tracks the implementation and evolution of the database table preview feature in dhg-admin-code. The preview allows users to quickly view sample data from any table directly in the table details modal.

## Current Implementation Status (June 2025)

### ✅ Features Already Implemented
- **Automatic Preview Loading**: Tables with data automatically load preview when modal opens
- **100 Record Sample**: Shows first 100 records from the table (increased from 10)
- **Column Detection**: Automatically extracts and displays all columns from the data
- **Error Handling**: Graceful handling of RLS policies and access errors
- **Data Type Formatting**: Special formatting for nulls, booleans, and objects
- **Loading States**: Spinner while fetching data
- **Responsive Design**: Horizontal scrolling for wide tables
- **Smart Display Messages**: Shows "Showing first 100 of X" or "Showing all Y records"

### Technical Details

**Location**: `apps/dhg-admin-code/src/components/TableDetailsModal.tsx`

**Key Components**:
1. **State Management**:
   - `previewData`: Stores fetched records
   - `previewColumns`: Stores column names
   - `loadingPreview`: Loading state
   - `previewError`: Error messages
   - `showPreview`: Toggle preview visibility

2. **Data Fetching**:
   ```typescript
   const { data, error } = await supabase
     .from(table.table_name)
     .select('*')
     .limit(100);  // Increased from 10 to 100
   ```

3. **Error Handling**:
   - RLS policy violations (code 42501)
   - General query errors
   - Empty result sets

## Implementation Difficulty: **COMPLETED** ✅

## Key Implementation Features

### Data Display
- **Automatic Column Detection**: Dynamically extracts columns from the first record
- **Data Type Formatting**:
  - `null` values shown in gray italic text
  - Booleans shown in green (true) or red (false)
  - Objects/JSON truncated to 50 characters
  - Long strings truncated to 100 characters
- **Responsive Table**: Horizontal scrolling for wide tables
- **Row Hover**: Highlights rows on hover for better readability

### Performance Considerations
- **100 Record Limit**: Balances data sample size with performance
- **Lazy Loading**: Preview only loads when modal opens and table has data
- **Error Recovery**: Graceful handling of query failures

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
- **Last Updated**: June 11, 2025
- **Status**: Phase 1 Complete - Basic preview with 100 records implemented
- **Next Review**: July 2025 (for Phase 2 features)
- **Recent Changes**:
  - Increased preview limit from 10 to 100 records
  - Added smart display messages for record counts
  - Updated documentation to reflect current implementation

---

This document will continue to be updated as new features are added and user feedback is collected.