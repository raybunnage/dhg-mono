# Using Supabase Views

## What is a Supabase View?
A view is like a virtual table that shows data in a specific way. From your types file, you have the `batch_processing_status` view which gives you a processed summary of batch operations.

## Using Views in Your App

### 1. Basic Query
```typescript
// Query the view just like a regular table
const { data: batchStatus } = await supabase
  .from('batch_processing_status')
  .select('*');

// The data will include all the view columns:
{
  batch_id: string,
  batch_status: string,
  completed_count: number,
  error_rate_percentage: number,
  total_documents: number,
  // ... other fields from the view
}
```

### 2. With Specific Fields
```typescript
// Select only the fields you need
const { data: statusSummary } = await supabase
  .from('batch_processing_status')
  .select(`
    batch_id,
    batch_status,
    completed_count,
    error_rate_percentage
  `);
```

### 3. In a React Component
```typescript
function BatchStatusDisplay() {
  const [status, setStatus] = useState<BatchStatus | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase
        .from('batch_processing_status')
        .select('*')
        .single();
      
      setStatus(data);
    }
    
    fetchStatus();
  }, []);

  if (!status) return <div>Loading...</div>;

  return (
    <div>
      <h2>Batch Status</h2>
      <div>Completed: {status.completed_count}</div>
      <div>Error Rate: {status.error_rate_percentage}%</div>
      <div>Total Documents: {status.total_documents}</div>
    </div>
  );
}
```

### 4. With Real-time Updates
```typescript
function LiveBatchStatus() {
  const [status, setStatus] = useState<BatchStatus | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Subscribe to changes
    const subscription = supabase
      .from('batch_processing_status')
      .on('*', payload => {
        setStatus(payload.new);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ... render code
}
```

## Using Views in Supabase UI

### 1. Viewing Data
1. Open Supabase Dashboard
2. Go to Table Editor
3. Look for "Views" in the left sidebar
4. Click on "batch_processing_status"

### 2. Creating SQL Queries
```sql
-- In the SQL Editor, you can query the view
SELECT * 
FROM batch_processing_status 
WHERE error_rate_percentage > 5;

-- Or join with other tables
SELECT b.*, p.batch_name
FROM batch_processing_status b
JOIN processing_batches p ON b.batch_id = p.id;
```

## TypeScript Integration

### 1. Using Types from Generated File
```typescript
import type { Database } from '../../../../../supabase/types';

// Get the view's row type
type BatchStatus = Database['public']['Views']['batch_processing_status']['Row'];

// Use in component
function StatusDisplay({ status }: { status: BatchStatus }) {
  return (
    <div>
      <div>Status: {status.batch_status}</div>
      <div>Completed: {status.completed_count}</div>
    </div>
  );
}
```

### 2. Creating Custom Types
```typescript
// Create a more specific type if needed
interface BatchStatusSummary {
  batch_id: string;
  status: string;
  progress: {
    completed: number;
    total: number;
    errorRate: number;
  };
}

// Transform view data to custom type
function transformStatus(status: BatchStatus): BatchStatusSummary {
  return {
    batch_id: status.batch_id,
    status: status.batch_status,
    progress: {
      completed: status.completed_count,
      total: status.total_documents,
      errorRate: status.error_rate_percentage
    }
  };
}
```

## Best Practices

### 1. Error Handling
```typescript
async function fetchBatchStatus() {
  try {
    const { data, error } = await supabase
      .from('batch_processing_status')
      .select('*');
      
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error fetching batch status:', error);
    toast.error('Failed to load batch status');
    return null;
  }
}
```

### 2. Loading States
```typescript
function BatchView() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BatchStatus | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchBatchStatus();
        setStatus(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  if (!status) return <Error message="Failed to load status" />;

  return <StatusDisplay status={status} />;
}
``` 