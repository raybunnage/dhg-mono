# DHG Service Test

A debugging app to test and isolate service initialization issues in the DHG monorepo.

## Purpose

This app helps identify which shared services are causing startup issues by:
1. Testing services individually or in groups
2. Showing initialization timing and errors
3. Allowing incremental testing to isolate problematic services

## Setup

1. Install dependencies:
```bash
cd apps/dhg-service-test
pnpm install
```

2. Copy environment variables:
```bash
cp .env.development.example .env.development
# Edit .env.development with your actual values
```

3. Run the app:
```bash
pnpm dev
```

The app will run on http://localhost:5180

## Features

### Service Monitor
- Shows real-time initialization status of core services
- Displays initialization timing
- Shows errors with detailed messages

### Service Tester
- Test services by groups (Core, Feature, Document, Element, Other)
- Sequential or parallel testing modes
- Shows import and initialization times
- Helps isolate problematic services

## Testing Strategy

1. **Start with Core Services** - These are required by most other services
2. **Test incrementally** - Uncheck service groups to isolate issues
3. **Use sequential mode** - Better for debugging specific errors
4. **Check console** - Detailed error messages appear in browser console

## Service Groups

- **Core Services**: Supabase, Auth, ServerRegistry
- **Feature Services**: Clipboard, CLI Registry, DevTask
- **Document Services**: DocumentType, DocumentClassification
- **Element Services**: ElementCatalog, ElementCriteria
- **Other Services**: MediaAnalytics, WorkSummary

## Debugging Tips

1. If all services fail, check your .env.development file
2. Look for console logs with initialization timing:
   - `[SupabaseAdapter]`
   - `[BrowserAuthService]`
   - `[ServerRegistryService]`
3. Services that fail to import likely have syntax or export issues
4. Services that fail to initialize may have missing dependencies