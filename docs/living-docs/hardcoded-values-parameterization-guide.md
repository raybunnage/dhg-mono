# Hardcoded Values Parameterization Guide

**Last Updated**: 2025-06-10  
**Next Review**: 2025-06-11 (Daily Review)  
**Status**: Active - Analysis Complete  
**Priority**: High  
**Category**: Code Quality & Infrastructure  
**Owner**: CLI Pipeline Team  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Analysis Results](#analysis-results)
7. [Implementation Guide](#implementation-guide)
8. [Important Callouts](#important-callouts)
9. [Environment Variables Reference](#environment-variables-reference)
10. [Examples & Code Snippets](#examples--code-snippets)
11. [Progress Tracking](#progress-tracking)

---

## Current Status & Lessons Learned

### 🎯 Current Status
- **Analysis Phase**: ✅ COMPLETE (2025-06-10)
- **187 hardcoded values** identified across **52 files**
- **Critical issues found**: Server ports, API endpoints, processing limits
- **Implementation**: NOT STARTED
- **Estimated effort**: 8-10 developer days

### 📚 Lessons Learned
1. **Most problematic service**: Claude service with 12 hardcoded values
2. **Common pattern**: Processing limits and timeouts are universally hardcoded
3. **Quick wins**: Server ports can be parameterized with minimal risk
4. **Risk area**: Database table names should remain as constants, not env vars

### ✅ Recent Actions Taken
- Completed comprehensive scan of all CLI pipelines and shared services
- Created detailed analysis reports with code examples
- Developed phased implementation plan
- Identified 25-30 new environment variables needed

---

## Recent Updates

### 2025-06-10
- Initial analysis completed
- Identified 187 hardcoded values across 52 files
- Created implementation plan with 4 phases
- Estimated ROI: 6-month break-even

---

## Next Phase

### 🚀 Phase 1: Critical Infrastructure
**Target Date**: 2025-06-17 (1 week)  
**Status**: Planning  
**Effort**: 1-2 days  

#### Objectives
1. Create central configuration module structure
2. Parameterize all server ports (6 servers)
3. Update API endpoints (Claude, Google Drive)
4. Add environment variable validation

#### Success Criteria
- [ ] All servers use environment variables for ports
- [ ] No hardcoded API URLs in services
- [ ] Central config module created and tested
- [ ] Zero breaking changes

#### Files to Update (Phase 1)
- `scripts/cli-pipeline/viewers/simple-md-server.js`
- `scripts/cli-pipeline/viewers/simple-script-server.js`
- `scripts/cli-pipeline/viewers/docs-archive-server.js`
- `apps/dhg-admin-code/continuous-docs-server.cjs`
- `apps/dhg-admin-code/git-server.cjs`
- `apps/dhg-admin-code/git-api-server.cjs`
- `packages/shared/services/claude-service/claude-service.ts`
- `packages/shared/services/google-drive-service.ts`

---

## Upcoming Phases

### Phase 2: Processing Limits & Timeouts
**Target Date**: 2025-06-24 (Week 2)  
**Status**: Planned  
**Effort**: 2-3 days  

- Parameterize all processing limits (batch sizes, file sizes)
- Update timeout configurations
- Add retry logic parameters

### Phase 3: Paths & Configuration
**Target Date**: 2025-07-01 (Week 3)  
**Status**: Planned  
**Effort**: 3-4 days  

- Update file paths to use environment variables
- Parameterize model configurations
- Add feature flags

### Phase 4: Documentation & Testing
**Target Date**: 2025-07-08 (Week 4)  
**Status**: Planned  
**Effort**: 1-2 days  

- Create comprehensive .env.example
- Update all documentation
- Add configuration validation tests
- Deploy to staging for testing

---

## Priorities & Trade-offs

### High Priority (Must Have)
1. **Server port configuration** - Blocks multi-environment deployment
2. **API endpoint configuration** - Required for staging/prod
3. **Processing limits** - Needed for performance tuning

### Medium Priority (Should Have)
1. **Timeout configurations** - Improves reliability
2. **Batch size parameters** - Enables optimization
3. **File path configuration** - Supports different environments

### Low Priority (Nice to Have)
1. **Feature flags** - Can be added incrementally
2. **Verbose logging controls** - Developer convenience
3. **UI message customization** - Future enhancement

### Trade-offs
- **Complexity vs Flexibility**: Adding 30 env vars increases setup complexity
- **Performance**: Minimal impact from env lookups (< 1ms)
- **Testing**: More configurations = more test scenarios

---

## Analysis Results

### Impact Summary
| Severity | Count | Examples | Risk |
|----------|-------|----------|------|
| Critical | 23 | Server ports, API URLs | High - Blocks deployments |
| High | 45 | Limits, timeouts, models | Medium - Affects performance |
| Medium | 78 | File paths, table names | Low - Works but inflexible |
| Low | 41 | Default values, messages | Minimal - Cosmetic |

### Top 10 Files by Hardcoded Values
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

---

## Implementation Guide

### Central Configuration Module

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
};
```

### Migration Strategy
1. **No Breaking Changes**: All env vars have defaults matching current hardcoded values
2. **Gradual Rollout**: Update one service at a time
3. **Testing**: Each phase includes testing before moving to next
4. **Rollback Plan**: Can revert individual services if issues arise

---

## Important Callouts

### ⚠️ Critical Warnings
1. **Database table names**: Should NOT be parameterized - use types.ts
2. **Security**: Never put secrets in default values
3. **Type safety**: Always parse env vars to correct types

### 🔒 Security Considerations
- Service account paths should be configurable but secure
- API keys must never have defaults
- Validate all environment variables at startup

### 📊 Performance Impact
- Environment variable lookup: < 1ms per lookup
- One-time cost at startup
- No runtime performance impact

### 🧪 Testing Requirements
- Each parameterized value needs test coverage
- Add environment variable validation tests
- Test with missing/invalid env vars

---

## Environment Variables Reference

### Required Variables
```bash
# These must be set - no defaults
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLAUDE_API_KEY=
```

### Server Configuration
```bash
# Server Ports (all have defaults)
MD_SERVER_PORT=3001
SCRIPT_SERVER_PORT=3002
DOCS_ARCHIVE_SERVER_PORT=3003
CONTINUOUS_DOCS_PORT=3008
GIT_SERVER_PORT=3005
GIT_API_SERVER_PORT=3009
```

### API Configuration
```bash
# External APIs
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096
CLAUDE_TEMPERATURE=0
CLAUDE_MAX_RETRIES=3
CLAUDE_RETRY_DELAY_MS=1000
```

### Processing Limits
```bash
# Batch Processing
DEFAULT_BATCH_SIZE=10
MAX_CONCURRENT_BATCHES=3
BATCH_DELAY_MS=100
MAX_ITEMS_PER_BATCH=1000

# Document Processing
MAX_PDF_SIZE_MB=10
CLASSIFY_BATCH_SIZE=5
CLASSIFY_TIMEOUT_MS=60000

# Media Processing
AUDIO_BATCH_SIZE=10
MAX_AUDIO_DURATION_MINUTES=30
AUDIO_PROCESSING_TIMEOUT_MS=300000
WHISPER_MODEL=base
AUDIO_OUTPUT_FORMAT=m4a
AUDIO_SAMPLE_RATE=16000
```

### File Paths
```bash
# Configurable Paths
SERVICE_ACCOUNT_PATH=.service-account.json
ARCHIVE_DIR=.archived_scripts
TEMP_DIR=/tmp
```

### Feature Flags
```bash
# Enable/Disable Features
ENABLE_VERBOSE_LOGGING=false
ENABLE_DRY_RUN=false
ENABLE_DEBUG_MODE=false
```

---

## Examples & Code Snippets

### Before/After Examples

#### Example 1: Server Port Configuration
```javascript
// ❌ Before (hardcoded)
const PORT = 3001;

// ✅ After (parameterized)
const PORT = process.env.MD_SERVER_PORT || 3001;
```

#### Example 2: API Configuration
```typescript
// ❌ Before (hardcoded)
private apiUrl = 'https://api.anthropic.com/v1/messages';
private model = 'claude-3-5-sonnet-20241022';

// ✅ After (parameterized)
private apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
private model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
```

#### Example 3: Processing Limits
```typescript
// ❌ Before (hardcoded)
const MAX_PDF_SIZE_MB = 10;
const BATCH_SIZE = 5;

// ✅ After (parameterized)
const MAX_PDF_SIZE_MB = parseInt(process.env.MAX_PDF_SIZE_MB || '10');
const BATCH_SIZE = parseInt(process.env.CLASSIFY_BATCH_SIZE || '5');
```

### Using the Central Config
```typescript
import { config } from '@shared/config';

// Use configuration values
const server = app.listen(config.servers.mdServer, () => {
  console.log(`Server running on port ${config.servers.mdServer}`);
});

// Claude service example
const response = await fetch(config.claude.apiUrl, {
  headers: { 'x-api-key': process.env.CLAUDE_API_KEY },
  body: JSON.stringify({
    model: config.claude.model,
    max_tokens: config.claude.maxTokens,
    temperature: config.claude.temperature,
  }),
});
```

---

## Progress Tracking

### Phase 1 Progress (Critical Infrastructure)
- [ ] Create packages/shared/config directory
- [ ] Implement config/index.ts
- [ ] Update simple-md-server.js
- [ ] Update simple-script-server.js
- [ ] Update docs-archive-server.js
- [ ] Update continuous-docs-server.cjs
- [ ] Update git-server.cjs
- [ ] Update git-api-server.cjs
- [ ] Update claude-service.ts
- [ ] Update google-drive-service.ts
- [ ] Create .env.example
- [ ] Test all changes
- [ ] Update documentation

### Overall Progress
- Phase 1: 0% (Not Started)
- Phase 2: 0% (Planned)
- Phase 3: 0% (Planned)
- Phase 4: 0% (Planned)

**Total Progress**: 0% (0/52 files updated)

### Success Metrics
- [ ] All 52 files updated
- [ ] Zero breaking changes
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Deployed to staging
- [ ] Performance benchmarks met

---

## Review Schedule

This document follows the continuous documentation monitoring protocol:

- **Frequency**: Daily during implementation, then weekly
- **Next Review**: 2025-06-11
- **Review Focus**: Update progress tracking, capture lessons learned
- **Auto-update Command**: `./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh check-updates`

### Update Triggers
1. Completion of any phase
2. Discovery of new hardcoded values
3. Changes to implementation approach
4. Issues or blockers encountered

---

*This is a living document that will be continuously updated throughout the parameterization effort. Check back regularly for the latest status and guidance.*