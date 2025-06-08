# Supabase Singleton Pattern Enforcement - Work Summary

**Date**: January 6, 2025
**Issue**: Multiple Supabase client instances causing data inconsistencies in dhg-audio app

## Problem Description
The dhg-audio app had three different Supabase client files, each creating their own instance. This caused the filter profiles combobox to show zero records despite the database tables containing data. This was a recurring issue across the codebase despite clear documentation in CLAUDE.md.

## Solution Implemented

### 1. Established Clear Patterns
Updated CLAUDE.md with crystal clear Supabase connection patterns:

**For Browser Apps (React/Vite)**:
```typescript
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
export const supabase = createSupabaseAdapter({
  env: import.meta.env as any  // REQUIRED for browser apps!
});
```

**For CLI Scripts & Server Code**:
```typescript
import { SupabaseClientService } from '@shared/services/supabase-client';
const supabase = SupabaseClientService.getInstance().getClient();
```

### 2. Fixed All App Violations

#### dhg-audio (Primary Issue)
- Consolidated 3 Supabase files into one central `src/lib/supabase.ts`
- Fixed `src/services/supabase-browser-adapter.ts` and `src/services/supabase-browser.ts` to re-export from central location
- Fixed all components to import from the central file

#### dhg-admin-code
- Fixed `src/pages/PromptService.tsx` to import from `../lib/supabase` instead of creating its own client

#### dhg-admin-suite
- Fixed `src/lib/supabase.ts` by adding missing `env: import.meta.env as any` parameter

#### dhg-hub
- Fixed `src/utils/supabase-adapter.ts` by adding missing env parameter
- Note: Uses non-standard location but still centralized

#### dhg-hub-lovable
- Fixed `src/integrations/supabase/client.ts` by adding missing env parameter
- Note: Uses non-standard location but still centralized

#### dhg-admin-google
- Moved `src/utils/supabase-adapter.ts` to standard location `src/lib/supabase.ts`
- Updated all imports to reflect new location

### 3. Fixed CLI Script Violations

#### Fixed Scripts
- `/scripts/cli-pipeline/database/check-table-descriptions.ts` - Now uses SupabaseClientService
- `/scripts/cli-pipeline/auth/check-auth-audit-log.ts` - Fixed createClient usage
- `/scripts/cli-pipeline/gmail/import-urls-fixed.js` - Now uses SupabaseClientService
- `/scripts/cli-pipeline/gmail/import-sqlite-data-simple.js` - Now uses SupabaseClientService
- `/scripts/fix/fix-metadata-fields.js` - Now uses SupabaseClientService

#### Scripts Left As-Is (Justified)
- `/scripts/fix/supabase-connect.js` - Connection tester needs direct access for debugging
- `/scripts/cli-pipeline/core/verify-supabase-deps.js` - Dependency checker with fallback logic

### 4. Current Status

#### ✅ All Apps Compliant
- dhg-admin-code ✅
- dhg-admin-google ✅
- dhg-admin-suite ✅
- dhg-audio ✅ (original issue fixed)
- dhg-hub ✅
- dhg-hub-lovable ✅

#### Apps Without Supabase (No Action Needed)
- dhg-a (basic React app)
- dhg-b (minimal app)
- dhg-research (no Supabase integration yet)

## Key Learnings
1. The universal Supabase adapter requires explicit env parameter for browser apps
2. Each app should have ONE central Supabase file in `src/lib/supabase.ts`
3. CLI scripts use SupabaseClientService singleton without env parameter
4. Regular audits are needed to prevent proliferation of duplicate instances

## Prevention Measures
1. Updated CLAUDE.md with explicit patterns and common violations
2. Added clear examples of correct usage for both environments
3. Documented the singleton pattern enforcement in multiple places
4. Created this work summary for future reference

## Result
The dhg-audio filter profiles now properly load data, and all apps follow a consistent Supabase connection pattern. The issue of multiple Supabase instances has been systematically eliminated across the codebase.