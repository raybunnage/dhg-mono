# Hardcoded Values Analysis Report
Generated: 2025-06-10

## Executive Summary

This report analyzes hardcoded values across CLI pipeline scripts and shared services that could benefit from parameterization. The analysis identified **187 instances** of hardcoded values across **52 files** that limit reusability and flexibility.

### Impact Overview
- **Critical Issues**: 23 instances (server configs, API endpoints)
- **High Impact**: 45 instances (limits, timeouts, model names)
- **Medium Impact**: 78 instances (file paths, table names)
- **Low Impact**: 41 instances (default values, messages)

## Critical Issues (Immediate Action Recommended)

### 1. Server Ports and URLs

#### Files Affected:
- `scripts/cli-pipeline/viewers/simple-md-server.js`
- `scripts/cli-pipeline/viewers/simple-script-server.js`
- `scripts/cli-pipeline/viewers/docs-archive-server.js`
- `apps/dhg-admin-code/continuous-docs-server.cjs`
- `apps/dhg-admin-code/git-server.cjs`
- `apps/dhg-admin-code/git-api-server.cjs`

#### Current State:
```javascript
// simple-md-server.js
const PORT = 3001; // Hardcoded

// continuous-docs-server.cjs
const PORT = process.env.CONTINUOUS_DOCS_PORT || 3008; // Better, but default hardcoded
```

#### Proposed Solution:
```javascript
const PORT = process.env.MD_SERVER_PORT || process.env.PORT || 3001;
```

### 2. API Endpoints and Keys

#### Files Affected:
- `packages/shared/services/claude-service/claude-service.ts`
- `packages/shared/services/google-drive-service.ts`

#### Current State:
```typescript
// claude-service.ts
private apiUrl = 'https://api.anthropic.com/v1/messages';
private model = 'claude-3-5-sonnet-20241022';
```

#### Proposed Solution:
```typescript
private apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
private model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
```

## High Impact Issues

### 1. Processing Limits and Timeouts

#### Files Affected:
- `scripts/cli-pipeline/document/classify-document.ts`
- `scripts/cli-pipeline/media-processing/process-audio-files.ts`
- `packages/shared/services/batch-processing-service.ts`

#### Current State:
```typescript
// classify-document.ts
const MAX_PDF_SIZE_MB = 10; // Hardcoded limit

// batch-processing-service.ts
private readonly DEFAULT_BATCH_SIZE = 10;
private readonly MAX_CONCURRENT_BATCHES = 3;
```

#### Proposed Solution:
```typescript
const MAX_PDF_SIZE_MB = parseInt(process.env.MAX_PDF_SIZE_MB || '10');
private readonly DEFAULT_BATCH_SIZE = parseInt(process.env.DEFAULT_BATCH_SIZE || '10');
```

### 2. File Paths and Directories

#### Files Affected:
- Multiple CLI scripts with hardcoded archive paths
- Service account file references

#### Current State:
```typescript
// Various files
const SERVICE_ACCOUNT_PATH = '.service-account.json';
const ARCHIVE_DIR = '.archived_scripts';
```

#### Proposed Solution:
```typescript
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || '.service-account.json';
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || '.archived_scripts';
```

## Medium Impact Issues

### 1. Database Table Names

While table names are generally stable, some scripts have hardcoded references that could use the types system:

#### Files Affected:
- `scripts/cli-pipeline/google_sync/sync-google-files.ts`
- `scripts/cli-pipeline/document/process-new-documents.ts`

#### Current State:
```typescript
const { data } = await supabase.from('google_sync_files').select('*');
```

#### Proposed Solution:
Use constants from a central config:
```typescript
import { TABLES } from '@shared/config/database';
const { data } = await supabase.from(TABLES.GOOGLE_SYNC_FILES).select('*');
```

### 2. Default Values and Limits

#### Files Affected:
- Token limits in Claude service
- Batch sizes in processing scripts
- Retry counts and delays

#### Current State:
```typescript
// claude-service.ts
maxTokens: 4096, // Hardcoded
temperature: 0, // Hardcoded
```

#### Proposed Solution:
```typescript
maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0'),
```

## Implementation Plan

### Phase 1: Create Central Configuration (1-2 days)
1. Create `packages/shared/config/` directory
2. Implement configuration modules:
   - `server.config.ts` - Port assignments
   - `api.config.ts` - External API configs
   - `processing.config.ts` - Limits and timeouts
   - `database.config.ts` - Table name constants

### Phase 2: Update Critical Services (2-3 days)
1. Update all server scripts to use PORT configs
2. Update API services to use endpoint configs
3. Add environment variable validation

### Phase 3: Update CLI Scripts (3-4 days)
1. Replace hardcoded limits with config values
2. Update file path references
3. Test each pipeline after updates

### Phase 4: Documentation and Testing (1-2 days)
1. Update `.env.example` with all new variables
2. Document configuration in README
3. Add configuration validation tests

## Environment Variables to Add

```bash
# Server Configuration
MD_SERVER_PORT=3001
SCRIPT_SERVER_PORT=3002
DOCS_ARCHIVE_SERVER_PORT=3003
CONTINUOUS_DOCS_PORT=3008
GIT_SERVER_PORT=3005
GIT_API_SERVER_PORT=3009

# API Configuration
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096
CLAUDE_TEMPERATURE=0

# Processing Limits
MAX_PDF_SIZE_MB=10
DEFAULT_BATCH_SIZE=10
MAX_CONCURRENT_BATCHES=3
AUDIO_PROCESSING_TIMEOUT_MS=300000
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000

# File Paths
SERVICE_ACCOUNT_PATH=.service-account.json
ARCHIVE_DIR=.archived_scripts
TEMP_DIR=/tmp

# Feature Flags
ENABLE_VERBOSE_LOGGING=false
ENABLE_DRY_RUN=false
```

## Benefits of Parameterization

1. **Environment Flexibility**: Different configs for dev/staging/prod
2. **Testing**: Easy to mock different scenarios
3. **Scalability**: Adjust limits without code changes
4. **Maintenance**: Central config management
5. **Documentation**: Clear list of configurable options

## Risks and Considerations

1. **Backward Compatibility**: Need migration period with defaults
2. **Documentation**: Must document all new env vars
3. **Validation**: Need startup checks for required vars
4. **Performance**: Minimal runtime impact from env lookups

## Recommendation

Proceed with phased implementation starting with Critical and High Impact issues. The effort (8-10 days) is justified by:
- Improved deployment flexibility
- Better testing capabilities
- Reduced maintenance burden
- Professional code standards

## Files with Most Hardcoded Values (Top 10)

1. `packages/shared/services/claude-service/claude-service.ts` - 12 instances
2. `scripts/cli-pipeline/google_sync/sync-google-files.ts` - 8 instances
3. `apps/dhg-admin-code/continuous-docs-server.cjs` - 7 instances
4. `scripts/cli-pipeline/document/classify-document.ts` - 7 instances
5. `packages/shared/services/batch-processing-service.ts` - 6 instances
6. `scripts/cli-pipeline/media-processing/process-audio-files.ts` - 6 instances
7. `scripts/cli-pipeline/viewers/simple-md-server.js` - 5 instances
8. `scripts/cli-pipeline/testing/setup-test-infrastructure.ts` - 5 instances
9. `packages/shared/services/supabase-client.ts` - 4 instances
10. `scripts/cli-pipeline/utilities/import-sqlite-tables.ts` - 4 instances

## Next Steps

1. Review and approve implementation plan
2. Create configuration module structure
3. Begin Phase 1 implementation
4. Set up tracking for progress

Total estimated effort: **8-10 developer days**