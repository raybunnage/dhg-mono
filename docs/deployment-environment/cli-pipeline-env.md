# CLI Pipeline Environment Configuration

This document explains how environment variables are used within the CLI pipeline scripts.

## Environment Loading Mechanism

All CLI pipeline scripts now use a common environment loading mechanism that:

1. Loads environment files in order of precedence:
   - `.env` (base variables)
   - `.env.development` or `.env.production` (environment-specific)
   - `.env.local` (local overrides, highest precedence)
   - App-specific `.env.development` (fallback)

2. Ensures consistent variable mapping:
   - Script tools prefer `CLI_` prefixed variables
   - Falls back to standard variables if CLI versions aren't defined
   - Provides clear error messages if required values are missing

## Using the Environment Loader

The shared environment loader can be used in any bash script like this:

```bash
# At the top of your script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env.sh" --verbose  # --verbose is optional

# Check if critical variables are set
if [[ -z "$CLI_CLAUDE_API_KEY" || -z "$CLI_SUPABASE_URL" ]]; then
  echo "Error: Required environment variables not set"
  exit 1
fi
```

## Required Environment Variables

CLI pipeline scripts rely on these environment variables:

| Variable | Required | Source | Description |
|----------|----------|--------|-------------|
| `CLI_CLAUDE_API_KEY` | Yes | `.env.local` | Claude API key for AI functions |
| `CLI_SUPABASE_URL` | Yes | `.env` | Supabase project URL |
| `CLI_SUPABASE_KEY` | Yes | `.env.local` | Supabase service role key |
| `CLI_ENVIRONMENT` | No | `.env` | Environment name (development/production) |
| `CLI_LOG_LEVEL` | No | `.env` | Logging level (debug/info/warn/error) |

## Variable Inheritance

To avoid duplication, CLI variables will use these values (in order):

1. `CLI_CLAUDE_API_KEY`:
   - Uses explicitly set `CLI_CLAUDE_API_KEY` value
   - Falls back to `ANTHROPIC_API_KEY`
   - Falls back to `VITE_ANTHROPIC_API_KEY`

2. `CLI_SUPABASE_URL`:
   - Uses explicitly set `CLI_SUPABASE_URL` value
   - Falls back to `SUPABASE_URL`
   - Falls back to `VITE_SUPABASE_URL`

3. `CLI_SUPABASE_KEY`:
   - Uses explicitly set `CLI_SUPABASE_KEY` value
   - Falls back to `SUPABASE_SERVICE_ROLE_KEY`
   - Falls back to `VITE_SUPABASE_SERVICE_ROLE_KEY`

## Troubleshooting

If you encounter environment-related issues:

1. Ensure `.env.local` exists with your API keys
2. Run scripts with `--verbose` flag to see which files are loaded
3. Check file permissions (all `.env` files should be readable)
4. Verify variable values with `echo $CLI_VARIABLE_NAME`

## Security Notes

- Never commit `.env.local` to the repository
- Keep API keys and sensitive information in `.env.local` only
- Ensure proper file permissions for `.env` files