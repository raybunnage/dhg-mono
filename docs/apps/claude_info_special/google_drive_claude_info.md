

## Cross-Environment Shared Services

### Environment-Aware Service Design

When creating shared services that work across different environments (browser vs server/CLI), follow these patterns:

**❌ Problem**: Singleton services that auto-initialize clients in constructors
```typescript
export class MyService {
  private static instance: MyService;
  private supabase = SupabaseClientService.getInstance().getClient(); // Fails in browser!
  
  private constructor() {}
  static getInstance() { return this.instance ||= new MyService(); }
}
```

**✅ Solution**: Dependency injection pattern with environment-specific client configuration
```typescript
export class MyService {
  private supabase: SupabaseClient<any>;
  
  constructor(supabaseClient: SupabaseClient<any>) {
    this.supabase = supabaseClient;
  }
}

// Browser usage: new MyService(browserConfiguredSupabaseClient)
// CLI usage: new MyService(SupabaseClientService.getInstance().getClient())
```

**Key Lessons:**
- Browser apps use `VITE_` prefixed environment variables, CLI/server use standard names
- Shared services should accept configured clients rather than creating them
- Use adapter pattern in apps to maintain backward compatibility
- Each environment handles its own client configuration needs

### Vite Cache Issues - Not Seeing Latest Code Changes

**❌ Problem**: After making code changes, running `pnpm dev` doesn't show the latest changes - old code still runs
- Vite aggressively caches modules in `node_modules/.vite`
- Browser caches can also prevent seeing updates
- Hot Module Replacement (HMR) sometimes fails silently
- TypeScript build artifacts can get stale

**✅ Solution**: Use the cache clearing scripts to ensure fresh builds
1. **For all apps**: `./scripts/clear-all-caches.sh`
2. **For specific app**: `./scripts/clear-app-cache.sh dhg-audio`
3. **Best practice**: `./scripts/dev-fresh.sh dhg-audio` (clears cache AND starts dev server)

**Additional steps**:
- Always hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
- Or in DevTools: Right-click refresh → "Empty Cache and Hard Reload"
- If issues persist, restart your terminal session

**Root causes**:
- Vite stores compiled modules in `.vite` cache directory
- File watchers sometimes miss changes in monorepo setups
- Symlinked packages can confuse the module resolution
- Browser ServiceWorkers can serve stale content

### Universal Supabase Adapter

**✅ Solution**: The project includes a universal Supabase adapter that handles both browser and server environments.

**Location**: `packages/shared/adapters/supabase-adapter.ts`

**Usage Pattern for Browser Apps (Vite)**:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Browser apps MUST pass their environment variables to the adapter
const supabase = createSupabaseAdapter({
  env: import.meta.env as any
});
```

**Usage Pattern for CLI/Server**:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// CLI/Server can use without parameters (reads from process.env)
const supabase = createSupabaseAdapter();
```

**Important**: Due to CommonJS/ESM compatibility issues, browser apps must explicitly pass `import.meta.env` to the adapter. The shared package cannot access `import.meta.env` directly.

**Setting Up @shared Alias in Vite Apps**:
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
});
```

**Common Errors and Fixes**:

1. **Missing environment variable error**:
```
❌ Error: Missing required Vite environment variable: VITE_SUPABASE_ANON_KEY
```
Fix: Pass environment variables to adapter:
```typescript
// ❌ Wrong - doesn't work in browser
const supabase = createSupabaseAdapter();

// ✅ Correct - pass environment variables
const supabase = createSupabaseAdapter({ env: import.meta.env as any });
```

2. **Module resolution error (500 Internal Server Error)**:
```
❌ Error: Cannot find module '@shared/adapters/supabase-adapter'
```
Fix: Add @shared alias to vite.config.ts (see above)

3. **Obsolete adapter methods**:
```
❌ Error: Cannot find name 'supabaseAdapter'
```
The old `supabaseAdapter` object with methods like `getDiagnostics()` and `ensureAuth()` no longer exists. Use the Supabase client directly:
```typescript
// ❌ Old way
const { success } = await supabaseAdapter.ensureAuth();

// ✅ New way
const { data, error } = await supabase.from('table').select();
```

**When to Use**:
- All browser apps (dhg-hub, dhg-audio, dhg-admin-code, etc.)
- CLI scripts and server-side code
- Any situation where you need Supabase access across environments

### Browser Compatibility for Node.js Dependencies

**❌ Problem**: Browser apps importing shared services that use Node.js-specific modules
- Error: `Module "node:events" has been externalized for browser compatibility`
- Error: `Cannot read properties of undefined (reading 'isTTY')`
- Error: `Class extends value undefined is not a constructor`
- These occur when shared services import Node.js modules like `googleapis`, `google-auth-library`, or use Node.js globals

**✅ Solution**: Create browser-safe imports and provide Node.js polyfills

1. **Create Browser-Safe Export Files**:
   ```typescript
   // packages/shared/services/google-drive/browser-index.ts
   export { GoogleDriveBrowserService, googleDriveBrowser } from './google-drive-browser-service';
   // Only export browser-compatible services, exclude Node.js-specific ones
   ```

2. **Configure Vite Aliases**:
   ```typescript
   // vite.config.ts
   resolve: {
     alias: {
       '@shared/services/google-drive': path.resolve(__dirname, '../../packages/shared/services/google-drive/browser-index.ts'),
     }
   }
   ```

3. **Add Node.js Polyfills in HTML**:
   ```html
   <!-- index.html - Add before main script -->
   <script>
     if (typeof global === 'undefined') window.global = window;
     if (typeof process === 'undefined') {
       window.process = {
         env: {},
         stdout: { isTTY: false },
         stderr: { isTTY: false },
         stdin: { isTTY: false },
         platform: 'browser',
         version: 'v16.0.0',
         versions: { node: '16.0.0' }
       };
     }
   </script>
   ```

4. **Add Required Environment Variables**:
   ```env
   # .env.development for browser apps
   VITE_CLAUDE_API_KEY=your-api-key
   VITE_ANTHROPIC_API_KEY=your-api-key
   ```

**Key Principles**:
- Browser apps cannot use Node.js modules (`fs`, `path`, `crypto`, `events`, etc.)
- Create separate browser-safe exports that exclude Node.js dependencies
- Use Vite aliases to redirect imports to browser-safe versions
- Provide polyfills for Node.js globals that some libraries expect
- Always check if a shared service imports Node.js modules before using in browser

**When Issues Persist**:
- Run `./scripts/cli-pipeline/all_pipelines/app-reinstall.sh app-name` to clean dependencies
- Check for indirect Node.js dependencies in shared services
- Consider creating browser-specific service implementations

## Google Drive Service Account Integration

The project requires a valid Google Drive service account for accessing files in Google Drive.

### Setting Up Service Account Authentication

When working with scripts that access Google Drive, you need a valid service account configuration:

1. **Service Account Setup**:
   - The project expects a `.service-account.json` file in the project root directory
   - This is the standard approach used by all commands that access Google Drive
   - The `.service-account.json` file should contain your Google Cloud service account credentials

2. **Environment Variables**:
   - The service account credentials are automatically loaded from `.service-account.json`
   - Some commands may also use these environment variables:
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email address
     - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key

3. **Commands That Require Google Drive Access**:
   - `sync` - Syncs files from Google Drive to the database
   - `find-folder` - Searches for folders/files in Google Drive
   - `get-current-drive-id` - Gets the current drive_id for a file
   - `check-duplicates --check-current` - Verifies if drive_ids still exist
   - Any command that needs to read or verify files in Google Drive

4. **Troubleshooting**:
   - If you see "Could not initialize Google Drive API", check that `.service-account.json` exists
   - Ensure the service account has proper permissions to access the Google Drive folders
   - The service account needs at least read-only access to the drives/folders being accessed

### Displaying Google Drive Files in Browser (iframe previews)

When displaying Google Drive files in browser applications, use the `/preview` endpoint to avoid Content Security Policy restrictions:

**❌ Problem**: Embedding Google Drive directly causes CSP errors
```typescript
// This will fail with "frame-ancestors" CSP errors
<iframe src="https://drive.google.com/file/..." />
```

**✅ Solution**: Use the preview endpoint with extracted Drive ID
```typescript
// Extract Drive ID from web_view_link
const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/\/d\/([^/]+)/);
  return match ? match[1] : null;
};

// Use the preview endpoint
<iframe 
  src={`https://drive.google.com/file/d/${extractDriveId(file.web_view_link)}/preview`}
  className="w-full h-full"
  allow="autoplay"
  title="File preview"
/>
```

**Key Points**:
- Always use `/preview` endpoint for embedding Google Drive files
- Extract the Drive ID from the web_view_link URL
- Different file types need different iframe styling:
  - Documents/PDFs: Full height (`h-full`)
  - Videos: Aspect ratio preserved (`aspect-video`)
  - Audio: Small player height (`h-20`)
  - Images: Centered with max dimensions
- The preview endpoint works for all file types without CSP restrictions
