# Anatomy of a Button: Sync Sources Example

## Overview
The Sync Sources button in `SourceButtons.tsx` is a complex example that shows how a button can trigger database operations, handle loading states, and provide user feedback. Let's break it down piece by piece.

## 1. The Button Component

```tsx
// Basic button structure
<button
  onClick={handleSync}
  disabled={syncing}
  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
>
  {syncing ? 'Syncing...' : 'Sync Sources'}
</button>
```

### Styling Breakdown
```tsx
className="
  px-4           /* Padding left/right */
  py-2           /* Padding top/bottom */
  bg-blue-500    /* Background color */
  text-white     /* Text color */
  rounded        /* Rounded corners */
  hover:bg-blue-600      /* Darker blue on hover */
  disabled:opacity-50    /* Fade when disabled */
"
```

### Interactive States
1. **Normal**: Blue button with white text
2. **Hover**: Slightly darker blue
3. **Disabled**: 50% opacity when syncing
4. **Loading**: Shows "Syncing..." text

## 2. State Management

```tsx
// At the top of the component
const [syncing, setSyncing] = useState(false);
```

This state:
- Controls the loading state
- Prevents double-clicks
- Changes button text
- Disables the button while working

## 3. Click Handler Function

```tsx
const handleSync = async () => {
  if (syncing) return;  // Prevent double-clicks
  
  setSyncing(true);     // Start loading state
  try {
    // Database operations here...
    toast.success('Sync completed');
  } catch (error) {
    console.error('Sync failed:', error);
    toast.error('Sync failed');
  } finally {
    setSyncing(false);  // Always end loading state
  }
};
```

### Error Handling Pattern
1. Use try/catch for async operations
2. Log errors to console
3. Show user-friendly toast messages
4. Always reset loading state

## 4. Database Operations Flow

```tsx
// 1. First get existing files
const { data: existingFiles, error: existingError } = await supabase
  .from('sources_google')
  .select('drive_id')
  .eq('deleted', false);

// 2. Create lookup Set for efficiency
const existingDriveIds = new Set(
  existingFiles?.map(f => f.drive_id) || []
);

// 3. Process files in batches
for (const file of files) {
  if (!existingDriveIds.has(file.id)) {
    // Insert new file
    await supabase
      .from('sources_google')
      .insert({
        drive_id: file.id,
        name: file.name,
        // ... other fields
      });
  }
}
```

### Database Operations Explained
1. **Select**: Get existing records
2. **Insert**: Add new records
3. **Update**: Modify existing records
4. **Delete**: Remove old records

## 5. User Feedback Flow

1. **Before Click**
   ```tsx
   <button>Sync Sources</button>
   ```

2. **On Click**
   ```tsx
   setSyncing(true);
   <button disabled>Syncing...</button>
   ```

3. **Success**
   ```tsx
   toast.success('Sync completed');
   setSyncing(false);
   <button>Sync Sources</button>
   ```

4. **Error**
   ```tsx
   toast.error('Sync failed');
   setSyncing(false);
   <button>Sync Sources</button>
   ```

## 6. Complete Code Flow

1. **User Clicks Button**
   - Button becomes disabled
   - Text changes to "Syncing..."
   - Loading state prevents double-clicks

2. **Database Operations Start**
   ```tsx
   // Get existing records
   const { data: existingFiles } = await supabase...
   
   // Process new files
   for (const file of files) {
     // Insert or update records
   }
   
   // Clean up old records
   await supabase...
   ```

3. **Success Path**
   - Operations complete
   - Show success toast
   - Reset button state

4. **Error Path**
   - Catch error
   - Log to console
   - Show error toast
   - Reset button state

## 7. Best Practices Demonstrated

1. **User Experience**
   - Clear button state
   - Loading indication
   - Error feedback
   - Success confirmation

2. **Error Handling**
   - Try/catch blocks
   - Error logging
   - User notifications
   - State cleanup

3. **Performance**
   - Batch operations
   - Efficient lookups
   - Prevent double-clicks
   - Cleanup in finally block

4. **Code Organization**
   - Separate concerns
   - Clear state management
   - Consistent error handling
   - Clean async/await usage

## 8. Common Patterns to Remember

1. **State Management**
   ```tsx
   const [loading, setLoading] = useState(false);
   ```

2. **Async Handler**
   ```tsx
   const handleClick = async () => {
     if (loading) return;
     setLoading(true);
     try {
       // work
     } finally {
       setLoading(false);
     }
   };
   ```

3. **Conditional Rendering**
   ```tsx
   <button disabled={loading}>
     {loading ? 'Working...' : 'Click Me'}
   </button>
   ```

4. **Error Handling**
   ```tsx
   try {
     // work
     toast.success('Done!');
   } catch (error) {
     console.error(error);
     toast.error('Failed');
   }
   ```

Would you like me to:
1. Add more details about the database operations?
2. Explain more about state management?
3. Show more error handling patterns? 