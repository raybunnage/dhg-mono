# CLI Environment Variable Fix

## Issue
When running the script analysis command, the following error occurred:

```
AppError: Required environment variable VITE_SUPABASE_SERVICE_ROLE_KEY is not set
```

This happened because the CLI was looking for the environment variable with the `VITE_` prefix, but in the script context, only the version without the prefix (`SUPABASE_SERVICE_ROLE_KEY`) was available.

## Fix Applied
Modified the `config.ts` file to detect and use `SUPABASE_SERVICE_ROLE_KEY` as a fallback when `VITE_SUPABASE_SERVICE_ROLE_KEY` is not set:

```typescript
// Check for SUPABASE_SERVICE_ROLE_KEY and use it if VITE_SUPABASE_SERVICE_ROLE_KEY is not set
if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  Logger.debug('Using SUPABASE_SERVICE_ROLE_KEY as VITE_SUPABASE_SERVICE_ROLE_KEY');
}
```

This change was added to the `Config` class constructor in `/packages/cli/src/utils/config.ts` before attempting to retrieve the required environment variables.

## Validation
A test script was created to verify the fix works as expected. The test:
1. Unsets `VITE_SUPABASE_SERVICE_ROLE_KEY`
2. Sets `SUPABASE_SERVICE_ROLE_KEY`
3. Confirms the fallback mechanism correctly copies the value

The test passed successfully, confirming our fix will work when the CLI is properly built.

## Next Steps
1. Build the CLI package with the fix
2. Run the script analysis command again to verify it works in the actual application

## Notes
The fix allows the CLI to work in both environments:
- In Vite/frontend context where environment variables have the `VITE_` prefix
- In CLI/script context where environment variables might not have the prefix