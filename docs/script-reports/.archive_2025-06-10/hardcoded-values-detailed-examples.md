# Hardcoded Values - Detailed Examples
Generated: 2025-06-10

## Specific Examples by Service/Pipeline

### 1. Claude Service (`packages/shared/services/claude-service/claude-service.ts`)

**Current Hardcoded Values:**
```typescript
private apiUrl = 'https://api.anthropic.com/v1/messages';
private model = 'claude-3-5-sonnet-20241022';
private maxRetries = 3;
private retryDelay = 1000; // ms
private defaultMaxTokens = 4096;
private defaultTemperature = 0;
```

**Proposed Changes:**
```typescript
private apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
private model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
private maxRetries = parseInt(process.env.CLAUDE_MAX_RETRIES || '3');
private retryDelay = parseInt(process.env.CLAUDE_RETRY_DELAY_MS || '1000');
private defaultMaxTokens = parseInt(process.env.CLAUDE_DEFAULT_MAX_TOKENS || '4096');
private defaultTemperature = parseFloat(process.env.CLAUDE_DEFAULT_TEMPERATURE || '0');
```

### 2. Document Classification (`scripts/cli-pipeline/document/classify-document.ts`)

**Current Hardcoded Values:**
```typescript
const MAX_PDF_SIZE_MB = 10;
const BATCH_SIZE = 5;
const promptName = 'document-classification-prompt-new';
const DEFAULT_TIMEOUT_MS = 60000;
```

**Proposed Changes:**
```typescript
const MAX_PDF_SIZE_MB = parseInt(process.env.CLASSIFY_MAX_PDF_SIZE_MB || '10');
const BATCH_SIZE = parseInt(process.env.CLASSIFY_BATCH_SIZE || '5');
const promptName = process.env.CLASSIFY_PROMPT_NAME || 'document-classification-prompt-new';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.CLASSIFY_TIMEOUT_MS || '60000');
```

### 3. Google Sync (`scripts/cli-pipeline/google_sync/sync-google-files.ts`)

**Current Hardcoded Values:**
```typescript
const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const SYNC_INTERVAL_MS = 300000; // 5 minutes
const serviceAccountPath = '.service-account.json';
```

**Proposed Changes:**
```typescript
const BATCH_SIZE = parseInt(process.env.GOOGLE_SYNC_BATCH_SIZE || '20');
const MAX_RETRIES = parseInt(process.env.GOOGLE_SYNC_MAX_RETRIES || '3');
const RETRY_DELAY = parseInt(process.env.GOOGLE_SYNC_RETRY_DELAY_MS || '1000');
const SYNC_INTERVAL_MS = parseInt(process.env.GOOGLE_SYNC_INTERVAL_MS || '300000');
const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '.service-account.json';
```

### 4. Media Processing (`scripts/cli-pipeline/media-processing/process-audio-files.ts`)

**Current Hardcoded Values:**
```typescript
const WHISPER_MODEL = 'base';
const AUDIO_BATCH_SIZE = 10;
const MAX_AUDIO_DURATION_MINUTES = 30;
const OUTPUT_FORMAT = 'm4a';
const SAMPLE_RATE = 16000;
```

**Proposed Changes:**
```typescript
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const AUDIO_BATCH_SIZE = parseInt(process.env.AUDIO_BATCH_SIZE || '10');
const MAX_AUDIO_DURATION_MINUTES = parseInt(process.env.MAX_AUDIO_DURATION_MINUTES || '30');
const OUTPUT_FORMAT = process.env.AUDIO_OUTPUT_FORMAT || 'm4a';
const SAMPLE_RATE = parseInt(process.env.AUDIO_SAMPLE_RATE || '16000');
```

### 5. Batch Processing Service (`packages/shared/services/batch-processing-service.ts`)

**Current Hardcoded Values:**
```typescript
private readonly DEFAULT_BATCH_SIZE = 10;
private readonly MAX_CONCURRENT_BATCHES = 3;
private readonly BATCH_DELAY_MS = 100;
private readonly MAX_ITEMS_PER_BATCH = 1000;
```

**Proposed Changes:**
```typescript
private readonly DEFAULT_BATCH_SIZE = parseInt(process.env.BATCH_DEFAULT_SIZE || '10');
private readonly MAX_CONCURRENT_BATCHES = parseInt(process.env.BATCH_MAX_CONCURRENT || '3');
private readonly BATCH_DELAY_MS = parseInt(process.env.BATCH_DELAY_MS || '100');
private readonly MAX_ITEMS_PER_BATCH = parseInt(process.env.BATCH_MAX_ITEMS || '1000');
```

### 6. Server Scripts

**Simple MD Server (`scripts/cli-pipeline/viewers/simple-md-server.js`):**
```javascript
// Current
const PORT = 3001;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Proposed
const PORT = process.env.MD_SERVER_PORT || 3001;
const CACHE_DURATION = parseInt(process.env.MD_SERVER_CACHE_MS || (60 * 60 * 1000));
```

**Continuous Docs Server (`apps/dhg-admin-code/continuous-docs-server.cjs`):**
```javascript
// Current
const PORT = process.env.CONTINUOUS_DOCS_PORT || 3008;
const UPDATE_INTERVAL = 60000; // 1 minute
const MAX_CONCURRENT_UPDATES = 5;

// Proposed
const PORT = process.env.CONTINUOUS_DOCS_PORT || 3008;
const UPDATE_INTERVAL = parseInt(process.env.CONTINUOUS_DOCS_UPDATE_INTERVAL_MS || '60000');
const MAX_CONCURRENT_UPDATES = parseInt(process.env.CONTINUOUS_DOCS_MAX_CONCURRENT || '5');
```

### 7. Testing Infrastructure (`scripts/cli-pipeline/testing/setup-test-infrastructure.ts`)

**Current Hardcoded Values:**
```typescript
const TEST_TIMEOUT_MS = 30000;
const MAX_TEST_RETRIES = 2;
const COVERAGE_THRESHOLD = 80;
const TEST_BATCH_SIZE = 5;
```

**Proposed Changes:**
```typescript
const TEST_TIMEOUT_MS = parseInt(process.env.TEST_TIMEOUT_MS || '30000');
const MAX_TEST_RETRIES = parseInt(process.env.TEST_MAX_RETRIES || '2');
const COVERAGE_THRESHOLD = parseInt(process.env.TEST_COVERAGE_THRESHOLD || '80');
const TEST_BATCH_SIZE = parseInt(process.env.TEST_BATCH_SIZE || '5');
```

## Central Configuration Module Proposal

Create `packages/shared/config/index.ts`:

```typescript
export const config = {
  // Server Ports
  servers: {
    mdServer: parseInt(process.env.MD_SERVER_PORT || '3001'),
    scriptServer: parseInt(process.env.SCRIPT_SERVER_PORT || '3002'),
    docsArchiveServer: parseInt(process.env.DOCS_ARCHIVE_SERVER_PORT || '3003'),
    continuousDocs: parseInt(process.env.CONTINUOUS_DOCS_PORT || '3008'),
    gitServer: parseInt(process.env.GIT_SERVER_PORT || '3005'),
    gitApiServer: parseInt(process.env.GIT_API_SERVER_PORT || '3009'),
  },
  
  // Claude API
  claude: {
    apiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0'),
    maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.CLAUDE_RETRY_DELAY_MS || '1000'),
  },
  
  // Processing Limits
  processing: {
    defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '10'),
    maxConcurrentBatches: parseInt(process.env.MAX_CONCURRENT_BATCHES || '3'),
    maxPdfSizeMb: parseInt(process.env.MAX_PDF_SIZE_MB || '10'),
    defaultTimeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '60000'),
  },
  
  // File Paths
  paths: {
    serviceAccount: process.env.SERVICE_ACCOUNT_PATH || '.service-account.json',
    archiveDir: process.env.ARCHIVE_DIR || '.archived_scripts',
    tempDir: process.env.TEMP_DIR || '/tmp',
  },
  
  // Feature Flags
  features: {
    verboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true',
    dryRun: process.env.ENABLE_DRY_RUN === 'true',
  },
};

// Validation function
export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'CLAUDE_API_KEY',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

## Migration Strategy

### Step 1: Add Defaults (No Breaking Changes)
- Add environment variable checks with current hardcoded values as defaults
- No functionality changes, just preparation

### Step 2: Create .env.example
```bash
# Copy this to .env.development and fill in your values

# Required
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLAUDE_API_KEY=

# Optional - Server Ports
MD_SERVER_PORT=3001
SCRIPT_SERVER_PORT=3002
# ... etc
```

### Step 3: Gradual Migration
- Update one service/pipeline at a time
- Test thoroughly after each update
- Document changes in CHANGELOG

### Step 4: Monitoring
- Add startup logs showing which config values are being used
- Track any issues during rollout

## Cost-Benefit Analysis

### Costs:
- 8-10 developer days
- Testing overhead
- Documentation updates
- Risk of introducing bugs

### Benefits:
- **Flexibility**: Easy environment-specific configs
- **Testing**: Can mock different scenarios
- **Scaling**: Adjust limits without code changes
- **Maintenance**: Central config management
- **Professional**: Follows best practices

### ROI Calculation:
- Current time spent on config changes: ~2 hours/month
- After parameterization: ~15 minutes/month
- Break-even: ~6 months
- Long-term benefit: Significant

## Recommendation

Given the analysis, I recommend proceeding with the parameterization effort, but in a phased approach:

1. **Phase 1 (Week 1)**: Critical issues only (server ports, API endpoints)
2. **Phase 2 (Week 2)**: High impact issues (limits, timeouts)
3. **Phase 3 (Week 3)**: Medium impact issues (optional)
4. **Phase 4 (Week 4)**: Documentation and testing

This approach minimizes risk while delivering immediate value from the most critical improvements.