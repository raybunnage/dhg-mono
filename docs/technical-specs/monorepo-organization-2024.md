# DHG Monorepo Organization Technical Specification
**Status**: Draft  
**Author**: Claude  
**Date**: 2024-02-16  
**Focus**: Package Organization and Service Integration

## 1. Executive Summary

This specification outlines a pragmatic approach to organizing the DHG monorepo, focusing on maintaining the successful script-driven development while improving code organization and reusability. The plan emphasizes keeping what works (Modal integration, script-based workflows) while making targeted improvements to package structure and database organization.

## 2. Current State Analysis

### What's Working Well
- Script-driven development approach
- Modal integration for GPU processing
- Supabase for data management
- CLI-based workflow
- Python audio processing

### Areas for Improvement
- Package organization needs better structure
- Some code duplication across services
- Database table responsibilities need clarification
- Processing status tracking could be simplified

## 3. Package Structure

### Proposed Organization
```
packages/
├── shared/                    # Shared TypeScript utilities
│   ├── database/             # Database clients and models
│   │   ├── models/          
│   │   │   ├── document-type.ts
│   │   │   └── index.ts
│   │   └── supabase-client.ts
│   └── utils/               
│       ├── config.ts
│       ├── logger.ts
│       └── index.ts
├── services/                 # Domain-specific services
│   ├── file-service/        
│   ├── ai-service/          
│   └── audio-service/       
├── python/                   # Python processing code
│   ├── audio/              
│   │   └── transcription/   
│   └── shared/              
└── cli/                      # Existing CLI structure
```


### Migration Strategy

#### Phase 1: Create Shared Package
- Create basic directory structure
- Move common utilities from CLI
- Update import paths
- Test existing functionality

#### Phase 2: Organize Services
- Move service code to dedicated packages
- Update dependencies
- Maintain existing functionality

#### Phase 3: Python Reorganization
- Restructure Python code
- Create shared utilities
- Keep Modal integration intact

## 4. Database Organization

### Table Responsibilities

#### sources_google
- Primary source of truth for video files
- Tracks original file metadata
- Maintains processing status

#### expert_documents
- Stores processed content (transcripts, summaries)
- Contains:
  - Raw content (original transcripts)
  - Processed content (AI-enhanced versions)
  - Processing metadata
  - Content type information

#### presentation_assets
- Links content to presentations
- Stores presentation-specific metadata
- Does NOT store content directly
- Manages relationships between content pieces

### Processing Status Management

```sql
CREATE TABLE processing_jobs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id uuid REFERENCES sources_google(id),
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    job_type text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_processing_jobs_source_id ON processing_jobs(source_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_job_type ON processing_jobs(job_type);
```

## 5. Implementation Guidelines

### Package Development

#### Shared Utilities
- Keep utilities focused and simple
- Use TypeScript for type safety
- Export through index files
- Maintain backward compatibility

#### Service Organization
- Each service should have clear responsibility
- Maintain existing interfaces
- Document dependencies clearly
- Include service-specific tests

#### Python Integration
- Keep Modal code separate
- Share database access patterns
- Maintain consistent logging
- Use environment variables for configuration

### Script Management

#### CLI Scripts
- Keep existing script structure
- Update import paths
- Maintain command patterns
- Document dependencies

#### Processing Scripts
- Use shared utilities
- Maintain error handling
- Log operations consistently
- Track processing status

## 6. Migration Plan

### Week 1: Setup and Planning
- Create new directory structure
- Document existing code paths
- Create shared package scaffolding
- Update development documentation

### Week 2: Shared Package Migration
- Move common utilities
- Update import paths
- Test existing functionality
- Document new patterns

### Week 3: Service Organization
- Move service code
- Update dependencies
- Test service integration
- Update documentation

### Week 4: Python Integration
- Reorganize Python code
- Create shared utilities
- Test Modal integration
- Update processing scripts

## 7. Best Practices

### Code Organization
- Use index files for exports
- Maintain consistent naming
- Document public interfaces
- Keep services focused

### Database Operations
- Use typed Supabase clients
- Maintain consistent patterns
- Document table relationships
- Use transactions where needed

### Error Handling
- Use consistent error patterns
- Log errors appropriately
- Maintain error recovery
- Document error states

## 8. Future Considerations

### Potential Enhancements
- Job queue integration if needed
- Enhanced parallel processing
- Additional service integration
- Improved monitoring

### Scaling Considerations
- Monitor processing loads
- Track database performance
- Consider service separation
- Plan for increased volume

## 9. Success Metrics
- Maintained processing capability
- Reduced code duplication
- Clearer code organization
- Simplified maintenance
- Preserved script functionality

## 10. Appendix

### A. Common Import Patterns
```typescript
// Shared utilities
import { logger } from '@shared/utils/logger';
import { supabase } from '@shared/database/supabase-client';

// Service imports
import { processFile } from '@services/file-service';
import { transcribe } from '@services/audio-service';
```

### B. Environment Variables
```bash
# Database
SUPABASE_URL=your_url
SUPABASE_KEY=your_key

# Modal
MODAL_TOKEN_ID=your_token
MODAL_TOKEN_SECRET=your_secret

# Processing
PROCESSING_BATCH_SIZE=10
LOG_LEVEL=info
```

### C. Common Scripts
```bash
# Create package structure
mkdir -p packages/shared/{database,utils}
mkdir -p packages/services/{file-service,ai-service,audio-service}/src
mkdir -p packages/python/{audio,shared}

# Update dependencies
pnpm install

# Run tests
pnpm test
```
```


packages/
├── shared/                    # NEW: Shared TypeScript code
│   ├── database/             # Moved from cli/src/services
│   │   ├── supabase-client.ts
│   │   └── models/          # Moved from cli/src/models
│   │       ├── document-type.ts
│   │       ├── prompt.ts
│   │       └── relationship.ts
│   └── utils/               # Moved from cli/src/utils
│       ├── config.ts
│       ├── error-handler.ts
│       ├── logger.ts
│       └── rate-limiter.ts
│
├── services/                # NEW: Domain-specific services
│   ├── file-service/       # Moved from cli/src/services
│   │   └── src/
│   │       ├── file-discovery.ts
│   │       ├── path-normalizer.ts
│   │       └── status-checker.ts
│   │
│   ├── ai-service/         # Moved from cli/src/services
│   │   └── src/
│   │       ├── claude-service.ts
│   │       └── prompt-services.ts
│   │
│   └── document-service/   # Moved from cli/src/services
│       └── src/
│           ├── classification.ts
│           └── organization.ts
│
├── cli/                    # KEEP: Your existing CLI package
│   └── src/
│       ├── commands/      # Keep existing commands
│       └── scripts/       # Keep existing scripts
│
├── python/                # RENAMED: from python-audio-processor
│   ├── audio/            # Reorganized audio processing
│   │   ├── transcription/
│   │   │   ├── whisperx/
│   │   │   └── modal/
│   │   └── config/
│   │       └── audio_config.json
│   │
│   └── shared/          # NEW: Shared Python utilities
│       ├── database.py
│       └── utils.py
│
└── scripts/             # KEEP: Root level scripts unchanged


Key Changes and Rationale:
Create shared Package
Moves common TypeScript code out of CLI
Makes these utilities available to other packages
Reduces duplication
Organize Domain Services
Groups related functionality together
Each service is self-contained
Easier to maintain and test independently
Simplify Python Structure
More descriptive naming
Better organization of audio processing code
Shared utilities for Python code
Keep What Works
CLI structure remains largely unchanged
Scripts stay in their current location
Existing functionality preserved
Migration Steps:
First create the new directories:

mkdir -p packages/shared/{database,utils}
mkdir -p packages/services/{file-service,ai-service,document-service}/src
mkdir -p packages/python/{audio/{transcription,config},shared}

# Move shared utilities
mv packages/cli/src/utils/* packages/shared/utils/
mv packages/cli/src/models/* packages/shared/database/models/

# Move services
mv packages/cli/src/services/file-management/* packages/services/file-service/src/
# ... repeat for other services

// Before
import { logger } from '../utils/logger';

// After
import { logger } from '@shared/utils/logger';

This structure:
Maintains your working script-driven approach
Makes dependencies clearer
Reduces code duplication
Makes it easier to add new services
Keeps Python and TypeScript code well-organized but separate



