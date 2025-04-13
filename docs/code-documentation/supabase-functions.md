# Supabase Database Interactions Guide

## Overview
This guide explains how the front-end React components interact with our Supabase database. We'll look at common patterns and explain what each database operation does in simple terms.

## Common Database Operations

### 1. Fetching Data (SELECT)
```typescript
// Example from ExpertFolderAnalysis.tsx
const { data: files, error: loadError } = await supabase
  .from('sources_google')
  .select('*')
  .eq('deleted', false)
  .order('name')
```
What's happening here:
- `from('sources_google')` - Tells Supabase which table to look in
- `select('*')` - Get all columns from the table
- `eq('deleted', false)` - Only get rows where deleted = false
- `order('name')` - Sort results by the name column
- The result is stored in `files` if successful, or `loadError` if there's an error

### 2. Inserting Data (INSERT)
```typescript
// Example from FileTree.tsx
const { data: batchData, error: batchError } = await supabase
  .from('processing_batches')
  .insert({
    created_at: new Date().toISOString(),
    status: 'queued',
    total_files: batch.length
  })
  .select()
  .single()
```
What's happening here:
- Creates a new row in the processing_batches table
- Sets the created_at time, status, and total_files
- `.select().single()` returns the newly created row
- Results stored in `batchData` or `batchError`

### 3. Updating Data (UPDATE)
```typescript
// Example from ExpertForm.tsx
const { error } = await supabase
  .from('experts')
  .update({ 
    name: expertName,
    updated_at: new Date().toISOString() 
  })
  .eq('id', expertId)
```
What's happening here:
- Updates the experts table
- Changes the name and updated_at time
- Only updates the row where id matches expertId
- Just checks for errors since we don't need the returned data

## Error Handling Pattern
```typescript
try {
  const { data, error } = await supabase.from('table_name')...
  if (error) throw error
  // Handle success
} catch (error) {
  console.error('Error:', error)
  // Show error to user (usually with toast)
  toast.error('Something went wrong')
}
```

## Common Database Operations by Component

### FileTree Component
Purpose: Manages file selection and batch creation
```typescript
// Creating a batch
const { data: batchData } = await supabase
  .from('processing_batches')
  .insert({
    status: 'queued',
    total_files: files.length
  })
  .select()
  .single()

// Creating document records
await supabase
  .from('expert_documents')
  .insert(
    files.map(file => ({
      source_id: file.id,
      batch_id: batchData.id,
      status: 'queued'
    }))
  )
```

### ExpertForm Component
Purpose: Manages expert profile data
```typescript
// Fetching an expert's details
const { data: expert } = await supabase
  .from('experts')
  .select('*')
  .eq('id', expertId)
  .single()

// Updating expert information
await supabase
  .from('experts')
  .update({
    name: name,
    bio: bio,
    updated_at: new Date()
  })
  .eq('id', expertId)
```

## Tips for Beginners
1. Always handle errors:
   ```typescript
   if (error) {
     toast.error('Something went wrong')
     console.error(error)
     return
   }
   ```

2. Use TypeScript types for database tables:
   ```typescript
   interface Expert {
     id: string
     name: string
     bio?: string
     created_at: string
   }

   const { data } = await supabase
     .from('experts')
     .select<Expert>('*')
   ```

3. Loading states:
   ```typescript
   const [loading, setLoading] = useState(true)
   
   try {
     setLoading(true)
     // do database operation
   } finally {
     setLoading(false)
   }
   ```

4. Realtime subscriptions:
   ```typescript
   supabase
     .channel('table_changes')
     .on('postgres_changes', 
       { event: '*', schema: 'public', table: 'experts' },
       (payload) => {
         // Update UI when data changes
       }
     )
     .subscribe()
   ```

## Common Gotchas
1. Remember to unsubscribe from realtime channels in useEffect cleanup
2. Always use try/catch with async database operations
3. Handle loading and error states for better UX
4. Use .single() when expecting one result
5. Check if data exists before using it

Would you like me to:
1. Add more specific examples from the codebase?
2. Explain the realtime subscription system in more detail?
3. Add TypeScript type definitions for the database tables?