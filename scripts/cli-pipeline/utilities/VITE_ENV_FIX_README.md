# Vite Environment Variable Fix Tools

## The Problem
"Unable to find Supabase credentials" error in Vite apps despite .env.development file existing.

## Quick Solution

### 1. Use the Fix Page (EASIEST)
Open http://localhost:5180 and click the red "🚨 Fix Env Issues" button at the top.
This page will:
- Show you exactly what's wrong
- Give you copy-paste commands to fix it
- Let you test if the fix worked

### 2. Run the Fix Script
```bash
# From project root:
ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts dhg-service-test

# If that doesn't work, use nuclear option:
ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts dhg-service-test --nuclear
```

### 3. Manual Fix
```bash
# 1. Kill Vite
pkill -f vite

# 2. Clear cache
rm -rf apps/dhg-service-test/node_modules/.vite

# 3. Restart
cd apps/dhg-service-test && pnpm dev
```

## Why This Happens
1. Vite caches environment variables in `node_modules/.vite`
2. Cache can become stale after env changes
3. Running Vite processes prevent proper restart

## Prevention
- Always restart Vite after changing .env files
- Use the fix page to verify env is loaded before testing