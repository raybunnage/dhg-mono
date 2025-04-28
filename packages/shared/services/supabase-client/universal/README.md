# Universal Supabase Adapter

This adapter provides a unified interface for both frontend and backend applications to interact with Supabase, using environment-specific implementations.

## Features

- Works in both browser and Node.js environments
- Uses the same import path and API for both environments
- Provides consistent error handling and connection diagnostics
- Handles authentication automatically in browser environments
- Uses environment-appropriate configuration values
- Implements the singleton pattern for resource efficiency

## Usage

### Basic Usage

```typescript
// Import the singleton adapter or client from the universal adapter
import { supabase, supabaseAdapter } from '../../../packages/shared/services/supabase-client/universal';

// Use the client directly for queries
const { data, error } = await supabase
  .from('document_types')
  .select('id')
  .limit(10);

// Or use the adapter for additional operations
const { success, diagnostics } = await supabaseAdapter.ensureAuth();
```

### Frontend Authentication

In frontend applications, the adapter provides enhanced authentication capabilities:

```typescript
// Try to authenticate
const { success, diagnostics } = await supabaseAdapter.ensureAuth();

if (success) {
  // Authenticated - proceed with queries
  const { data, error } = await supabase
    .from('document_types')
    .select('id')
    .limit(10);
} else {
  // Handle authentication failure
  console.error('Authentication failed:', diagnostics);
}
```

### Environment Variables

The adapter automatically selects the appropriate environment variables:

- **Browser Environment**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (preferred)
  - `VITE_SUPABASE_SERVICE_ROLE_KEY` (fallback)

- **Node.js Environment**:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (preferred)
  - `SUPABASE_ANON_KEY` (fallback)

### Additional Utilities

```typescript
// Diagnostics for troubleshooting
const diagnosticInfo = await supabaseAdapter.getDiagnostics();

// Add user references to records (created_by, updated_by)
import { addUserReferences } from '../../../packages/shared/services/supabase-client/universal';

const recordWithUser = await addUserReferences({
  title: 'Document title',
  content: 'Document content'
});
```

## Implementation Details

The adapter implements a singleton pattern and automatically detects whether it's running in a browser or Node.js environment, then configures itself accordingly.

- In browser environments, it uses Vite's `import.meta.env` variables and adds browser-specific authentication options
- In Node.js environments, it uses `process.env` variables and configures for server-side usage
- Authentication in browser environments is handled with Supabase Auth, with support for both anonymous access and user credentials
- Connection testing ensures the database is accessible and provides detailed diagnostics

## Testing the Adapter

This repository includes an `Easy` page component that demonstrates how to use the adapter in a React application. To view it, run the dhg-improve-experts app and navigate to `/easy`.

## Migrating Existing Code

To migrate existing code to use the universal adapter:

1. Replace imports from application-specific Supabase clients:
   ```typescript
   // Before
   import { supabase } from '@/lib/supabase';
   // or
   import { supabase } from '@/integrations/supabase/client';

   // After
   import { supabase } from '../../../packages/shared/services/supabase-client/universal';
   ```

2. For code that needs authentication or additional adapter features:
   ```typescript
   // Import both the client and the adapter
   import { 
     supabase, 
     supabaseAdapter 
   } from '../../../packages/shared/services/supabase-client/universal';
   ```

3. If your code handles user references, use the helper function:
   ```typescript
   import { 
     supabase, 
     addUserReferences 
   } from '../../../packages/shared/services/supabase-client/universal';

   // Then use it in your data operations
   const recordWithUser = await addUserReferences(yourData);
   await supabase.from('your_table').insert(recordWithUser);
   ```