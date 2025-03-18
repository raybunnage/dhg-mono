# Creating Shared Packages in the DHG Monorepo

## Package Structure
Create a new directory structure in your monorepo:

```
dhg-mono/
├── apps/
│   ├── dhg-improve-experts/
│   └── other-apps/
├── packages/
│   ├── ui/                    # Shared UI components
│   │   ├── package.json
│   │   └── src/
│   │       ├── PDFViewer/
│   │       └── DocViewer/
│   ├── supabase/             # Shared database operations
│   │   ├── package.json
│   │   └── src/
│   │       ├── client.ts
│   │       ├── sources/
│   │       └── auth/
│   └── utils/                # Shared utilities
│       ├── package.json
│       └── src/
└── package.json
```

## 1. Creating a Shared Package

### Example: Supabase Package
```json
// packages/supabase/package.json
{
  "name": "@dhg/supabase",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0"
  }
}
```

```typescript
// packages/supabase/src/client.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

```typescript
// packages/supabase/src/sources/google.ts
import { supabase } from '../client'

export async function getGoogleSources() {
  const { data, error } = await supabase
    .from('sources_google')
    .select('*')
    .eq('deleted', false)
  
  return { data, error }
}

export async function syncGoogleSources(files: any[]) {
  // Your existing sync logic
}
```

## 2. Creating a UI Package

```json
// packages/ui/package.json
{
  "name": "@dhg/ui",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.0.0",
    "react-pdf": "^6.0.0"
  }
}
```

```typescript
// packages/ui/src/PDFViewer/index.tsx
export function PDFViewer({ url }: { url: string }) {
  // Your existing PDF viewer component
}
```

## 3. Using Shared Packages

### In Your Apps
```typescript
// apps/dhg-improve-experts/src/components/SourceButtons.tsx
import { syncGoogleSources } from '@dhg/supabase/sources/google'
import { PDFViewer } from '@dhg/ui/PDFViewer'

export function SourceButtons() {
  const handleSync = async () => {
    await syncGoogleSources(files)
  }
  
  return (
    <div>
      <button onClick={handleSync}>Sync</button>
      <PDFViewer url={documentUrl} />
    </div>
  )
}
```

## 4. Configuring the Monorepo

```json
// package.json in root
{
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

## 5. Adding Package Dependencies

```bash
# Add a workspace package to an app
pnpm add @dhg/supabase @dhg/ui --filter dhg-improve-experts
```

## Migration Steps

1. **Identify Shared Code**
   - Document viewers
   - Supabase operations
   - Authentication
   - Common utilities

2. **Create Package Structure**
   ```bash
   mkdir -p packages/ui/src
   mkdir -p packages/supabase/src
   mkdir -p packages/utils/src
   ```

3. **Move Code**
   ```typescript
   // Before: apps/dhg-improve-experts/src/components/PDFViewer.tsx
   // After: packages/ui/src/PDFViewer/index.tsx
   ```

4. **Update Imports**
   ```typescript
   // Before
   import { PDFViewer } from '../components/PDFViewer'
   
   // After
   import { PDFViewer } from '@dhg/ui/PDFViewer'
   ```

## Best Practices

1. **Package Organization**
   ```typescript
   // packages/supabase/src/index.ts
   export * from './sources/google'
   export * from './auth'
   export * from './client'
   ```

2. **Type Sharing**
   ```typescript
   // packages/supabase/src/types.ts
   export interface GoogleSource {
     id: string
     name: string
     // ...
   }
   ```

3. **Configuration Sharing**
   ```typescript
   // packages/utils/src/config.ts
   export const CONFIG = {
     apiUrl: process.env.API_URL,
     // ...
   }
   ```

## Example: Moving Supabase Functions

```typescript
// packages/supabase/src/sources/index.ts
export async function getSourceById(id: string) {
  const { data, error } = await supabase
    .from('sources_google')
    .select('*')
    .eq('id', id)
    .single()
    
  return { data, error }
}

export async function updateSource(id: string, updates: Partial<GoogleSource>) {
  const { data, error } = await supabase
    .from('sources_google')
    .update(updates)
    .eq('id', id)
    
  return { data, error }
}
```

Would you like me to:
1. Show how to handle package versioning?
2. Explain how to share types across packages?
3. Show how to set up package testing? 