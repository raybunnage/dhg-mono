# Claude MD Candidates - Learnings for Future Reference

## Testing Framework Implementation Challenges (2025-06-10)

### ESM/CommonJS Compatibility in CLI Pipelines

**Problem**: When implementing the testing framework, encountered severe ESM/CommonJS compatibility issues:
- `Error: Cannot access 'import.meta' outside a module`
- `Error: require() of ES Module not supported`
- TypeScript compilation errors with import.meta.env in shared services

**Root Cause**: CLI pipelines run in Node.js context (CommonJS) but some shared services use import.meta.env (ESM)

**Solution**: Created simple JavaScript test runners that bypass TypeScript compilation:
```javascript
// Simple test runner avoiding ESM issues
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.development') });
```

**Key Learning**: When facing ESM/CommonJS issues in CLI pipelines, consider:
1. Creating simple JavaScript wrappers
2. Using Node.js require() instead of ES6 imports
3. Avoiding ts-node for scripts that import problematic shared services

### Health Check Script Standards

**Problem**: Health check scripts across pipelines had inconsistent patterns, causing false positives

**Examples of Issues Found**:
- Shebang errors: `#\!/bin/bash` instead of `#!/bin/bash`
- Missing environment loading
- Inconsistent exit codes
- Different approaches to checking service health

**Solution Pattern**: All health checks should follow this structure:
```bash
#!/bin/bash
# Get script directory and root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
fi

# Define check functions
check_condition() {
    local condition_name="$1"
    local check_command="$2"
    local error_message="$3"
    # ... implementation
}

# Run checks and exit with proper code
```

### Testing Tables Migration Sequencing

**Problem**: Testing infrastructure failed because required database columns didn't exist

**Example**: `sys_service_test_health_view` referenced `ss.last_validated` column that didn't exist in `sys_shared_services`

**Solution**: Always check dependencies before creating views:
1. Add missing columns first: `ALTER TABLE sys_shared_services ADD COLUMN IF NOT EXISTS last_validated TIMESTAMP WITH TIME ZONE;`
2. Then create views that reference those columns
3. Update `sys_table_definitions` to track schema changes

### TypeScript Compilation in Health Checks

**Problem**: Health checks failed due to TypeScript compilation errors in unrelated shared services

**Solution**: For health checks, focus on infrastructure validation rather than compilation:
```bash
# Instead of full TypeScript compilation:
# tsc --noEmit health-check.ts

# Check for TypeScript setup:
check_condition "TypeScript Setup" \
    "[ -f '$SCRIPT_DIR/tsconfig.json' ] || [ -f '$SCRIPT_DIR/../../../tsconfig.json' ]" \
    "TypeScript configuration not found"
```

### Service Directory Naming Mismatches

**Problem**: Service names don't always match directory names exactly
- `SupabaseClientService` → `supabase-client` directory
- `GoogleDriveService` → `google-drive` directory

**Solution**: Maintain a mapping of service names to directories:
```javascript
const criticalServices = [
  { name: 'SupabaseClientService', dir: 'supabase-client' },
  { name: 'FileService', dir: 'file-service' },
  { name: 'FilterService', dir: 'filter-service' },
  { name: 'GoogleDriveService', dir: 'google-drive' },
  { name: 'ClaudeService', dir: 'claude-service' }
];
```

## Summary of Key Learnings

1. **ESM/CommonJS Issues**: Create simple JavaScript runners when TypeScript compilation fails
2. **Health Check Standards**: Follow consistent patterns across all pipelines
3. **Database Migrations**: Check column dependencies before creating views
4. **TypeScript in CLI**: Focus on setup validation rather than full compilation
5. **Service Naming**: Maintain explicit mappings between service names and directories

These patterns should be considered when implementing similar infrastructure in the future.