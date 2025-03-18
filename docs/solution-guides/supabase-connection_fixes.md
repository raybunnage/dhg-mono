# Supabase Connection Fix Documentation

## Issue Summary
The Supabase connection was failing with 401 Unauthorized errors in our monorepo apps. We fixed it by:
1. Identifying a working Supabase connection in another app
2. Using its configuration and credentials temporarily
3. Restoring proper paths and environment variables once connection was proven

## The Working Solution

### 1. Critical File Structure
```
apps/dhg-improve-experts/
├── src/
│   ├── integrations/
│   │   └── supabase/
│   │       └── client.ts    # Must be this exact path
│   └── types/
│       └── supabase.ts      # Types imported from root
```

### 2. Working Supabase Client Configuration
```typescript
// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'  // Critical: Import from types

// This configuration worked when env vars didn't
const supabase = createClient<Database>(
  'https://jdksnfkupzywjdfefkyj.supabase.co',  // Direct URL that worked
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'   // Direct key that worked
)

export { supabase }
```

### 3. Test Component to Verify Connection
```typescript
// src/App.tsx

import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'  // Critical: This exact path

function TestComponent() {
  const [authStatus, setAuthStatus] = useState<string>('Checking auth...')

  useEffect(() => {
    async function init() {
      try {
        // Critical: Auth must happen first
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: 'test@example.com',  // Used working credentials first
          password: 'testpassword123' // before trying env vars
        })

        if (authError) throw authError
        setAuthStatus(`Authenticated as: ${authData.user?.email}`)

        // Test query to verify full connection
        const { data, error } = await supabase
          .from('experts')
          .select('count')

        console.log('Query test:', { data, error })
      } catch (err) {
        console.error('Init error:', err)
        setAuthStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    }
    init()
  }, [])

  return (
    <div className="p-4">
      <div>Status: {authStatus}</div>
    </div>
  )
}

// Temporary App.tsx for testing
function App() {
  return (
    <div>
      <TestComponent />
      {/* Other components commented out until connection works */}
    </div>
  )
}
```

### 4. Example of Working Component
```typescript
// src/components/RegistryViewer.tsx

import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'  // Critical: This path
import type { Database } from '@/types/supabase'  // Critical: This path

type FunctionRegistry = Database['public']['Tables']['function_registry']['Row']

export function RegistryViewer() {
  const [functions, setFunctions] = useState<FunctionRegistry[]>([])
  
  useEffect(() => {
    async function loadFunctions() {
      const { data, error } = await supabase
        .from('function_registry')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setFunctions(data || [])
    }
    loadFunctions()
  }, [])

  return (
    <div>
      {/* Component render logic */}
    </div>
  )
}
```

## What Was Wrong & How We Fixed It

### 1. Path Structure Issues
```typescript
// ❌ Wrong paths that caused problems
import { supabase } from '@/utils/supabase'
import { supabase } from '../../utils/supabase'
import type { Database } from '../../../../../supabase/types'

// ✅ Correct paths that fixed it
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/types/supabase'
```

### 2. Authentication Flow
```typescript
// ❌ Wrong: Trying to query without auth
const { data } = await supabase.from('table').select('*')

// ✅ Correct: Auth first, then query
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'testpassword123'
})
const { data } = await supabase.from('table').select('*')
```

### 3. Client Configuration
```typescript
// ❌ Wrong: Missing types, using env vars that weren't working
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// ✅ Correct: With types and working credentials
const supabase = createClient<Database>(
  'https://jdksnfkupzywjdfefkyj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
)
```

## Step-by-Step Fix Process

1. Copy working client.ts from another app:
```bash
cp apps/working-app/src/integrations/supabase/client.ts apps/broken-app/src/integrations/supabase/client.ts
```

2. Create test component in App.tsx with hardcoded credentials

3. Verify connection works:
   - Auth succeeds
   - Test query works
   - No 401 errors

4. Once working, gradually restore:
   - Environment variables
   - Original App.tsx components
   - Proper auth credentials

## Required Files Checklist

- [ ] src/integrations/supabase/client.ts
  - Correct path
  - Type-safe client
  - Working credentials

- [ ] src/types/supabase.ts
  - Imported from root
  - Up-to-date types

- [ ] .env
  - SUPABASE_URL
  - SUPABASE_KEY
  - TEST_USER credentials

## Verification Steps

1. Test auth:
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'testpassword123'
})
console.log('Auth test:', { data, error })
```

2. Test query:
```typescript
const { data, error } = await supabase
  .from('experts')
  .select('count')
console.log('Query test:', { data, error })
```

3. Check console for:
   - No CORS errors
   - No 401 Unauthorized
   - No type errors

## Critical Context for Future Fixes

### Source of Working Code
The working configuration was copied from:
```
apps/dhg-improve-experts/src/integrations/supabase/client.ts
```
This app had a proven working Supabase connection and served as our reference implementation.

### Symptoms of Connection Problems
1. 401 Unauthorized errors in console
2. Queries return no data
3. Authentication appears to succeed but subsequent queries fail
4. Types show as "any" instead of proper Database types
5. CORS errors mentioning Supabase domains

### Environment Setup That Works
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',  // Critical: This alias must work
    }
  }
})
```

```env
# .env structure that works
VITE_SUPABASE_URL=https://jdksnfkupzywjdfefkyj.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_PASSWORD=testpassword123
```

### Connection Test Sequence
1. First test with hardcoded credentials:
```typescript
// Temporary test in client.ts
const testConnection = async () => {
  try {
    // 1. Test basic client
    const { data: versionData } = await supabase
      .from('pg_version')
      .select('version')
    console.log('Version check:', versionData)

    // 2. Test auth
    const { data: authData, error: authError } = 
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    console.log('Auth check:', { authData, authError })

    // 3. Test query with auth
    const { data: queryData, error: queryError } = 
      await supabase
        .from('experts')
        .select('count')
    console.log('Query check:', { queryData, queryError })

  } catch (err) {
    console.error('Connection test failed:', err)
  }
}
```

### Type Resolution
If types aren't working:
1. Check supabase/types.ts exists in root
2. Verify path mapping in tsconfig.json:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/types/*": ["../../supabase/types/*"]
    }
  }
}
```

### Recovery Steps if All Else Fails
1. Locate working app (dhg-improve-experts)
2. Copy entire supabase integration:
```bash
cp -r apps/dhg-improve-experts/src/integrations/supabase apps/broken-app/src/integrations/
```
3. Copy working types:
```bash
cp -r apps/dhg-improve-experts/src/types apps/broken-app/src/
```
4. Use working app's environment variables temporarily
5. Test with the TestComponent
6. Only after it works, gradually restore original env vars

### Common Gotchas
1. Path aliases must be exact - even a slight difference breaks it
2. Auth must happen on every page load
3. Types must be imported from root, not local copies
4. CORS issues mean the URL is wrong
5. 401 after successful auth means the key is wrong

### Required Environment Variables

#### Core Supabase Variables
```env
# Required: Base Supabase configuration
VITE_SUPABASE_URL=https://jdksnfkupzywjdfefkyj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required: Test user for connection verification
VITE_TEST_USER_EMAIL=test@example.com
VITE_TEST_USER_PASSWORD=testpassword123

# Optional: Database connection (if needed)
SUPABASE_DB_URL=postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
SUPABASE_DB_PASSWORD=your-db-password-here
SUPABASE_PROJECT_ID=jdksnfkupzywjdfefkyj

# Optional: Project references
SUPABASE_PROJECT_REF=jdksnfkupzywjdfefkyj
SUPABASE_ACCESS_TOKEN=sbp_918520a925d1a0887624af1dad400dd0ee532801
```

#### Environment Variable Sources
1. VITE_SUPABASE_URL: 
   - Found in Supabase Dashboard → Project Settings → API
   - Format: https://[project-id].supabase.co

2. VITE_SUPABASE_ANON_KEY:
   - Found in Project Settings → API → anon/public key
   - Starts with: eyJhbGciOiJIUzI1NiIs...

3. VITE_SUPABASE_SERVICE_KEY:
   - Found in Project Settings → API → service_role key
   - Used for admin operations
   - Starts with: eyJhbGciOiJIUzI1NiIs...

4. SUPABASE_PROJECT_ID:
   - Found in Project Settings → General
   - Example: jdksnfkupzywjdfefkyj

#### Working Values from dhg-improve-experts
If connection fails, you can temporarily use these known working values from dhg-improve-experts:
```env
VITE_SUPABASE_URL=https://jdksnfkupzywjdfefkyj.supabase.co
VITE_SUPABASE_ANON_KEY=[key from working app]
VITE_TEST_USER_EMAIL=[email from working app]
VITE_TEST_USER_PASSWORD=[password from working app]
```

#### Environment Variable Troubleshooting
1. Check variable naming:
   - Must start with VITE_ for client-side use
   - Case-sensitive
   - No spaces around = sign

2. Verify values:
   ```typescript
   // Add this to client.ts temporarily to debug
   console.log('Env check:', {
     url: import.meta.env.VITE_SUPABASE_URL,
     key: import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 10) + '...',
     email: import.meta.env.VITE_TEST_USER_EMAIL
   })
   ```

3. Common env problems:
   - Missing VITE_ prefix
   - Incorrect key type (using service key instead of anon)
   - Extra whitespace in values
   - Missing quotes around values with special characters