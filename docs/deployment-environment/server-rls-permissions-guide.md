# Server RLS Permissions Guide

## Problem
When servers start up without authenticated users, RLS (Row Level Security) policies can block database access, causing servers to fail on startup.

## Solution: Service Role Key

The project is configured to use Supabase's service role key for backend servers, which bypasses RLS entirely.

### How It Works

1. **SupabaseClientService** automatically detects the environment:
   - **Browser/React apps**: Uses anon key with RLS policies
   - **Node.js/Servers**: Uses service role key, bypassing RLS

2. **Environment Detection**:
   ```typescript
   // In SupabaseClientService:
   - Checks for Node.js environment
   - Loads SUPABASE_SERVICE_ROLE_KEY from .env.development
   - Creates client with elevated permissions
   ```

### Implementation

#### 1. Server Environment Validation

Before starting servers, validate the environment:

```bash
node scripts/cli-pipeline/servers/helpers/validate-environment.js
```

This ensures:
- `.env.development` exists
- `SUPABASE_SERVICE_ROLE_KEY` is present
- The key is a valid service role key (contains "service_role" in JWT)

#### 2. Testing Database Connection

Test that servers can connect without authentication:

```bash
ts-node scripts/cli-pipeline/servers/test-db-connection.ts
```

This verifies:
- Service role key is properly configured
- Database connection works
- RLS is bypassed

#### 3. Server Implementation

All servers should use the singleton pattern:

```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';

// Get the singleton instance - automatically uses service role key
const supabase = SupabaseClientService.getInstance().getClient();

// Optional: Verify connection on startup
import { verifyDatabaseConnection } from '@shared/utils/verify-db-connection';
await verifyDatabaseConnection('MyServer');
```

### Troubleshooting

1. **"Permission denied" errors**:
   - Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.development`
   - Verify it's not the anon key (should contain "service_role" in JWT)

2. **Environment not loading**:
   - The start script now validates environment before starting servers
   - Check that `.env.development` exists in project root

3. **Still getting RLS errors**:
   - Ensure servers use `SupabaseClientService.getInstance().getClient()`
   - Don't create direct Supabase clients with `createClient()`
   - Check that the server isn't accidentally using browser environment variables

### Security Notes

- Service role key bypasses ALL security - use only for trusted backend services
- Never expose service role key to frontend/browser code
- Always validate and sanitize data when using service role key
- Consider implementing application-level permissions when needed

### Quick Commands

```bash
# Test database connection
ts-node scripts/cli-pipeline/servers/test-db-connection.ts

# Validate environment
node scripts/cli-pipeline/servers/helpers/validate-environment.js

# Start servers (now includes validation)
pnpm servers
```