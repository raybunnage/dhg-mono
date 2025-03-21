# Supabase Environment Variable Debugging Tools

This directory contains tools to help debug and fix Supabase credential issues in the DHG monorepo.

## NEW COMPREHENSIVE SOLUTION

We've developed a new, more robust solution to the Supabase connectivity issues.

Run the following to fix ALL Supabase credential issues in one step:

```bash
# Make sure the script is executable
chmod +x ./scripts/debug/supabase-fix.sh

# Run the fix script
./scripts/debug/supabase-fix.sh
```

The new `supabase-fix.sh` script will:
1. Check for existing Supabase credentials in environment variables
2. Look for credentials in .env files
3. Prompt you to enter credentials if none are found
4. Create utility scripts that ensure credentials are available everywhere

After running the fix, you can use the new utilities:

1. **Run any command with Supabase credentials:**
   ```bash
   ./scripts/run-with-supabase.sh your-command-here
   ```

2. **Generate a script summary report with the fixed implementation:**
   ```bash
   ./scripts/debug/generate-summary-fixed.sh
   ```

3. **Set Supabase environment variables in your current shell:**
   ```bash
   source ./scripts/run-with-supabase.sh
   ```

## Previous Tools (Less Comprehensive)

1. **debug-supabase.sh**
   - Diagnoses the current state of Supabase environment variables
   - Shows which variables are set and attempts to connect to Supabase
   - Usage: `./debug-supabase.sh`

2. **fix-supabase-env.sh**
   - Adds compatibility layer to your shell config to normalize Supabase variables
   - Creates a helper script to run commands with proper Supabase environment
   - Usage: `./fix-supabase-env.sh`

3. **run-generate-summary.sh**
   - A fixed version of the summary generator with proper env var handling
   - Tries multiple sources for credentials, including interactive input
   - Usage: `./run-generate-summary.sh`

4. **set-supabase-env.sh** (created by fix-supabase-env.sh)
   - Runs any command with normalized Supabase environment variables
   - Usage: `./set-supabase-env.sh <command> [args]`
   - Example: `./set-supabase-env.sh ../cli-pipeline/script-pipeline-main.sh generate-summary`

## Root Causes

The Supabase credential issues stem from several sources:

1. **Inconsistent environment variable naming**:
   - Different scripts use different environment variable names:
     - `SUPABASE_URL` + `SUPABASE_KEY`
     - `CLI_SUPABASE_URL` + `CLI_SUPABASE_KEY`
     - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
     - `VITE_SUPABASE_URL` + `VITE_SUPABASE_SERVICE_ROLE_KEY`

2. **Environment variable scope**:
   - Variables set in one shell session aren't available in another
   - Variables in `.env` files aren't always properly loaded

3. **Direct Node.js execution**:
   - When a script creates a temporary Node.js file and executes it,
     environment variables aren't always properly passed to the child process

## Long-term Solutions

For a more permanent solution:

1. **Standardize environment variable names**:
   - Choose one naming convention across all scripts
   - Update all scripts to use the same naming convention

2. **Add environment variable normalization**:
   - At the start of scripts, normalize variable names to ensure all formats are available
   - Example:
     ```bash
     export CLI_SUPABASE_URL="${CLI_SUPABASE_URL:-$SUPABASE_URL}"
     export SUPABASE_URL="${SUPABASE_URL:-$CLI_SUPABASE_URL}"
     ```

3. **Implement a central configuration service**:
   - Create a service that loads config from multiple sources
   - Use it consistently across all scripts

4. **Environment Variable Documentation**:
   - Document all required environment variables in a central place
   - Add validation at the start of scripts to check for required variables

## Related Files

Key files that interact with Supabase credentials:

- `/scripts/cli-pipeline/script-pipeline-main.sh` - The main pipeline script
- `/scripts/cli-pipeline/script-manager.sh` - Contains the generate_summary function
- `/packages/cli/src/services/supabase-client.ts` - SupabaseClientService that manages connections