# Integrating the Supabase Manager

This guide explains how to integrate the Supabase Database Manager into your application.

## Basic Integration

### 1. Import the Component

```tsx
import SupabaseManager from '@/path/to/SupabaseManager';
```

### 2. Add to Your Routes

```tsx
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      {/* Your other routes */}
      <Route path="/supabase" element={<SupabaseManager />} />
      <Route path="/supabase/:activeTab" element={<SupabaseManager />} />
    </Routes>
  );
}
```

### 3. Link to Specific Tabs

You can link directly to specific tabs using URL parameters:

```tsx
<Link to="/supabase/tables">Database Tables</Link>
<Link to="/supabase/sql">SQL Editor</Link>
<Link to="/supabase/migrations">Migrations</Link>
```

## Advanced Integration

### Using with Header and Layout

```tsx
import { Outlet } from 'react-router-dom';
import NavSidebar from './NavSidebar';

function DatabaseLayout() {
  return (
    <div className="flex">
      <NavSidebar />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

// In your routes
<Route path="/database" element={<DatabaseLayout />}>
  <Route path="supabase" element={<SupabaseManager />} />
</Route>
```

### Passing Props

You can customize the behavior by passing props:

```tsx
<SupabaseManager 
  initialTab="sql"
  readOnly={!userHasAdminPermission}
  onSchemaChange={handleSchemaChange}
/>
```

## Advanced Features

### Custom Actions

You can extend the Manager with custom actions:

```tsx
import SupabaseManager from '@/path/to/SupabaseManager';

function ExtendedManager() {
  const customActions = [
    {
      name: 'Generate API Docs',
      action: async () => {
        // Custom logic here
        await generateApiDocs();
      },
      icon: 'document'
    }
  ];

  return <SupabaseManager customActions={customActions} />;
}
```

### Handling Migration Outcomes

```tsx
function ManagedDatabaseUI() {
  const handleMigrationComplete = async (result) => {
    if (result.success) {
      // Update application state or UI
      await refreshSchemaData();
      toast.success('Migration applied successfully');
    } else {
      // Handle errors
      console.error('Migration failed:', result.error);
      toast.error('Migration failed');
    }
  };

  return <SupabaseManager onMigrationComplete={handleMigrationComplete} />;
}
```

## Security Considerations

### Permission Levels

The Supabase Manager has different functionality based on user permissions:

1. **Admin**: Full access (run SQL, create migrations, execute functions)
2. **Developer**: Can view schema and run SELECT queries
3. **Viewer**: Can only view schema information, no SQL execution

To implement permissions:

```tsx
import { useUser } from '@/hooks/auth';

function ProtectedDatabaseManager() {
  const { user, roles } = useUser();
  
  // Check if user has database admin role
  const isAdmin = roles.includes('db_admin');
  
  return (
    <>
      {!user && <p>Please log in to access database tools</p>}
      {user && !isAdmin && <p>You don't have permission to access this page</p>}
      {user && isAdmin && <SupabaseManager />}
    </>
  );
}
```

### RLS Policies

The database functions used by the manager are marked as `SECURITY DEFINER`, which means they run with the permissions of the function creator rather than the calling user. This allows safer handling of database operations without exposing full database access to all users.

## Troubleshooting

### Common Issues

1. **Permissions Errors**
   
   If you see "permission denied" errors, check:
   - User has proper Supabase roles
   - RLS policies allow access to the tables
   - Functions have `SECURITY DEFINER` attribute

2. **UI Not Loading**

   Check:
   - Supabase client is correctly initialized
   - Database connection is working
   - Required database functions exist

3. **SQL Execution Failures**

   - Check SQL syntax
   - Verify table and column names
   - Look for constraint violations
   - Check Supabase logs for details

## Example: Complete Integration

Here's a complete example that integrates the Supabase Manager with navigation and permission checks:

```tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SupabaseManager from '@/components/SupabaseManager';
import AdminLayout from '@/layouts/AdminLayout';
import { useUser } from '@/hooks/auth';

const DatabaseRoutes = () => {
  const { user, hasPermission } = useUser();
  
  // Check if user can access database tools
  const canAccessDb = user && hasPermission('database:view');
  const canModifyDb = user && hasPermission('database:modify');
  
  if (!canAccessDb) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route 
          path="database/*" 
          element={
            <SupabaseManager 
              readOnly={!canModifyDb}
              onSchemaChange={() => console.log('Schema updated')}
            />
          } 
        />
      </Route>
    </Routes>
  );
};

export default DatabaseRoutes;
```

This setup:
1. Protects the database pages with authentication
2. Uses permission checks to determine read/write access
3. Integrates with your admin layout
4. Handles schema change events