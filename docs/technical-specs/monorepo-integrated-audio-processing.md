# DHG Monorepo Organization - Integrated Audio Processing Workflow

## Executive Summary

This technical specification outlines a practical approach to reorganizing the DHG monorepo to better support audio processing workflows while preserving the existing script-driven development approach. Instead of introducing BullMQ, this plan focuses on improving code organization, enhancing Modal integration, and clarifying database responsibilities to create a more maintainable architecture.

## Key Recommendations

1. **Reorganize Package Structure**: Create a cleaner, more modular package structure that separates shared utilities from domain-specific services
2. **Enhance Modal Integration**: Improve the existing Modal implementation for audio processing with better TypeScript integration
3. **Preserve Script-Driven Workflow**: Maintain the current CLI-focused approach that's working well
4. **Simplify Database Schema**: Clarify table roles and improve relationships between content and presentation assets
5. **Implement Gradual Migration**: Follow a phased approach to minimize disruption to existing workflows

## 1. Current State Analysis

### Whdocs/deployment-environment/google-drive-integration.mdat's Working Well
- **Script-driven development** provides flexibility and rapid iteration
- **Modal integration** successfully handles GPU-intensive audio processing
- **Supabase database** effectively manages content and relationships
- **TypeScript services** in the CLI package provide core functionality
- **Python processing** handles audio extraction and transcription

### Areas for Improvement
- **Package organization** lacks clear structure for shared code
- **Service boundaries** are blurred within the CLI package
- **Python-TypeScript integration** could be more seamless
- **Database schema** has some confusing overlaps between tables

## 2. Package Structure Recommendations

The proposed package structure creates clear separations while maintaining existing functionality:

```
packages/
├── shared/                    # Shared TypeScript utilities
│   ├── database/              # Database clients and models
│   │   ├── models/            # Data models
│   │   │   ├── document-type.ts
│   │   │   ├── presentation.ts
│   │   │   └── source.ts
│   │   ├── supabase-client.ts # Shared Supabase client
│   │   └── index.ts           # Exports
│   └── utils/                 # Common utilities 
│       ├── config.ts          # Configuration management
│       ├── logger.ts          # Logging utilities
│       ├── file-utils.ts      # File manipulation helpers
│       └── index.ts           # Exports
├── services/                  # Domain-specific services
│   ├── file-service/          # File operations
│   │   └── src/
│   │       ├── google-drive.ts # Google Drive integration
│   │       ├── local-fs.ts     # Local filesystem operations
│   │       └── index.ts        # Exports
│   ├── ai-service/            # AI operations
│   │   └── src/
│   │       ├── claude/        # Claude API integration
│   │       ├── operations/    # AI operations
│   │       └── index.ts       # Exports
│   └── audio-service/         # Audio processing integration
│       └── src/
│           ├── modal-bridge.ts # Integration with Modal
│           ├── operations/    # Audio operations
│           └── index.ts       # Exports
├── python-shared/             # Shared Python utilities
│   ├── database/              # Python database clients
│   │   ├── __init__.py
│   │   └── supabase_client.py # Python Supabase client
│   └── utils/                 # Common Python utilities
│       ├── __init__.py
│       └── logging.py         # Logging configuration
├── modal/                     # Modal Python implementations
│   ├── audio-processing/      # Audio processing functions
│   │   ├── __init__.py
│   │   ├── transcription.py   # Whisper transcription
│   │   └── diarization.py     # Speaker diarization
│   └── utils/                 # Modal-specific utilities
│       ├── __init__.py
│       └── supabase_utils.py  # Database integration
└── cli/                       # Existing CLI package (refactored)
    └── src/                   # References shared packages
```

## 3. Python-TypeScript Integration Strategy

### Modal Integration Enhancement

1. **TypeScript Bridge for Modal**:
```typescript
// packages/services/audio-service/src/modal-bridge.ts
import axios from 'axios';
import { logger } from '@shared/utils';

export interface ModalRequestOptions {
  functionName: string;
  params: Record<string, any>;
  timeout?: number;
}

export async function callModalFunction(options: ModalRequestOptions): Promise<any> {
  const { functionName, params, timeout = 60000 } = options;
  
  try {
    logger.info(`Calling Modal function: ${functionName}`, { params });
    
    const response = await axios.post(
      `${process.env.MODAL_API_URL}/api/v1/webhooks/${functionName}`,
      params,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MODAL_API_KEY}`
        },
        timeout
      }
    );
    
    logger.info(`Modal function ${functionName} completed successfully`);
    return response.data;
  } catch (error) {
    logger.error(`Error calling Modal function ${functionName}`, { 
      error: error.message, 
      params 
    });
    throw error;
  }
}
```

2. **Python Supabase Client**:
```python
# packages/python-shared/database/supabase_client.py
import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get a configured Supabase client"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    
    return create_client(url, key)

def update_processing_status(source_id: str, status: str, job_type: str, error: str = None):
    """Update processing status in the database"""
    import datetime
    
    supabase = get_supabase_client()
    
    data = {
        "status": status,
        "updated_at": datetime.datetime.now().isoformat()
    }
    
    if status == "processing":
        data["started_at"] = datetime.datetime.now().isoformat()
    
    if status == "completed" or status == "failed":
        data["completed_at"] = datetime.datetime.now().isoformat()
    
    if error:
        data["error"] = error
    
    supabase.table("processing_jobs").update(data).eq("source_id", source_id).eq("job_type", job_type).execute()
```

3. **Enhanced Modal Function**:
```python
# packages/modal/audio-processing/transcription.py
import modal
from python_shared.database.supabase_client import get_supabase_client, update_processing_status
import os
from typing import Dict, Any

# Define Modal image with FFmpeg and Whisper
image = modal.Image.debian_slim().pip_install(
    "openai-whisper", 
    "ffmpeg-python", 
    "supabase"
).apt_install("ffmpeg")

# Create Modal app
app = modal.App("audio-processing")

@app.function(image=image, gpu="A10G")
def transcribe_audio(file_path: str, source_id: str, options: Dict[str, Any] = {}) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper model
    """
    import whisper
    import datetime
    
    # Update job status
    update_processing_status(source_id, "processing", "transcription")
    
    try:
        # Load Whisper model
        model_name = options.get("model", "base")
        model = whisper.load_model(model_name)
        
        # Transcribe
        result = model.transcribe(file_path)
        
        # Store results in database
        supabase = get_supabase_client()
        
        # Update source with transcript status
        supabase.table("sources_google").update({
            "transcript_status": "completed",
            "transcript": result["text"],
            "updated_at": datetime.datetime.now().isoformat()
        }).eq("id", source_id).execute()
        
        # Create expert document for transcript
        doc_data = {
            "source_id": source_id,
            "content": result["text"],
            "content_type": "transcript",
            "metadata": {
                "segments": result["segments"],
                "language": result["language"],
                "model": model_name
            },
            "word_count": len(result["text"].split())
        }
        
        doc_response = supabase.table("expert_documents").insert(doc_data).execute()
        doc_id = doc_response.data[0]["id"] if doc_response.data else None
        
        # Update job status
        update_processing_status(source_id, "completed", "transcription")
        
        return {
            "success": True,
            "text": result["text"],
            "document_id": doc_id,
            "segments": len(result["segments"]),
            "language": result["language"]
        }
    except Exception as e:
        # Handle errors
        error_message = str(e)
        update_processing_status(source_id, "failed", "transcription", error_message)
        
        return {
            "success": False,
            "error": error_message
        }
```

## 4. Database Schema Improvements

### Processing Status Tracking

```sql
-- Simple table for tracking processing status
CREATE TABLE public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id uuid REFERENCES sources_google(id),
  job_type text NOT NULL CHECK (job_type IN ('extraction', 'transcription', 'diarization', 'summarization')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
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

### Content vs. Relationship Clarification

The key to resolving confusion between `expert_documents` and `presentation_assets` is to clearly define their roles:

1. **expert_documents**: Stores the actual content
   - Raw content (original transcript)
   - Processed content (AI-enhanced version)
   - Content metadata
   - Source reference

2. **presentation_assets**: Links content to presentations
   - References to expert_documents
   - Presentation-specific metadata
   - Timestamps and importance ranking
   - User notes and context

This maintains a clean separation where documents can exist independently and be linked to multiple presentations as needed.

## 5. Migration Strategy

### Phase 1: Shared Package Setup (Week 1)

1. **Create directory structure**
   ```bash
   mkdir -p packages/shared/{database,utils}
   mkdir -p packages/services/{file-service,ai-service,audio-service}/src
   mkdir -p packages/python-shared/{database,utils}
   mkdir -p packages/modal/{audio-processing,utils}
   ```

2. **Move common TypeScript utilities**
   - Identify shared code in CLI package
   - Move to appropriate locations
   - Update import paths
   - Test basic functionality

3. **Set up package references**
   ```json
   // package.json in root
   {
     "workspaces": [
       "packages/*",
       "packages/services/*"
     ]
   }
   ```

### Phase 2: Python Integration (Week 2)

1. **Create Python shared utilities**
   - Set up Supabase client
   - Create logging utilities
   - Configure environment handling

2. **Enhance Modal implementation**
   - Improve database integration
   - Add error handling
   - Update status tracking

3. **Create TypeScript bridge**
   - Implement Modal bridge
   - Add error handling
   - Test integration

### Phase 3: Service Migration (Week 3)

1. **Move domain services**
   - File service
   - Audio service
   - AI service

2. **Update scripts**
   - Update import paths
   - Test functionality
   - Fix any issues

3. **Document new structure**
   - Update README files
   - Create example usage
   - Document environment variables

### Phase 4: Testing and Refinement (Week 4)

1. **End-to-end testing**
   - Test complete workflows
   - Verify database updates
   - Check error handling

2. **Performance optimization**
   - Identify bottlenecks
   - Improve critical paths
   - Document best practices

3. **Knowledge sharing**
   - Team training
   - Documentation review
   - Process improvement

## 6. Script Integration Example

The following script demonstrates how to use the new structure while maintaining the existing script-driven approach:

```javascript
// scripts/process-video.js
import { callModalFunction } from '@services/audio-service/modal-bridge';
import { supabaseClient } from '@shared/database';
import { logger } from '@shared/utils';
import { extractAudio } from '@services/audio-service/operations';
import path from 'path';

async function processVideo(sourceId, filePath) {
  try {
    logger.info(`Processing video: ${filePath}`);

    // 1. Extract audio
    logger.info('Extracting audio...');
    const audioPath = await extractAudio(filePath);
    
    // 2. Update source record
    await supabaseClient
      .from('sources_google')
      .update({
        audio_extraction_path: audioPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceId);
    
    // 3. Create processing job record
    await supabaseClient
      .from('processing_jobs')
      .insert({
        source_id: sourceId,
        job_type: 'transcription',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    
    // 4. Call Modal function for transcription
    logger.info('Submitting to Modal for transcription...');
    const result = await callModalFunction({
      functionName: 'transcribe_audio',
      params: {
        file_path: audioPath,
        source_id: sourceId,
        options: {
          model: 'base',
          language: 'en'
        }
      }
    });
    
    if (result.success) {
      logger.info(`Transcription complete: ${result.segments} segments`);
      return result;
    } else {
      throw new Error(result.error || 'Unknown transcription error');
    }
  } catch (error) {
    logger.error(`Error processing video: ${error.message}`);
    
    // Update job status on error
    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'failed',
        error: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('source_id', sourceId)
      .eq('job_type', 'transcription');
    
    throw error;
  }
}

// Command line usage
async function main() {
  const sourceId = process.argv[2];
  const filePath = process.argv[3];
  
  if (!sourceId || !filePath) {
    console.error('Usage: node process-video.js <sourceId> <filePath>');
    process.exit(1);
  }
  
  try {
    const result = await processVideo(sourceId, filePath);
    console.log('Processing completed successfully:', result);
  } catch (error) {
    console.error('Processing failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
```

## 7. Additional Recommendations

### Environment Configuration

Create a centralized environment configuration system:

```typescript
// packages/shared/utils/config.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  supabase: {
    url: string;
    key: string;
  };
  modal: {
    apiUrl: string;
    apiKey: string;
  };
  processing: {
    tempDir: string;
    storageDir: string;
    defaultWhisperModel: string;
  };
  logging: {
    level: string;
    format: string;
  };
}

export const config: Config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  modal: {
    apiUrl: process.env.MODAL_API_URL || 'https://modal.com/api/v1',
    apiKey: process.env.MODAL_API_KEY || '',
  },
  processing: {
    tempDir: process.env.TEMP_DIR || path.join(process.cwd(), 'tmp'),
    storageDir: process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
    defaultWhisperModel: process.env.DEFAULT_WHISPER_MODEL || 'base',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
};

export default config;
```

### Error Handling Strategy

Implement consistent error handling across TypeScript and Python:

```typescript
// packages/shared/utils/error-handler.ts
import { logger } from './logger';

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, status = 500, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.context = context;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError(error: Error | AppError, operation: string): void {
  if (error instanceof AppError) {
    logger.error(`${operation} failed: ${error.message}`, {
      code: error.code,
      status: error.status,
      context: error.context,
    });
  } else {
    logger.error(`${operation} failed with unexpected error: ${error.message}`, {
      stack: error.stack,
    });
  }
}
```

### Documentation Guidelines

Create comprehensive documentation for the new structure:

1. **README files** for each package explaining purpose and usage
2. **Import examples** showing how to use shared services
3. **Environment variable** documentation
4. **Script usage** guidelines
5. **Architecture diagrams** showing package relationships

## 8. Conclusion

This technical specification provides a pragmatic approach to organizing the DHG monorepo while preserving the successful script-driven development model. By focusing on better code organization, improved Modal integration, and clarified database responsibilities, the architecture will be more maintainable without disrupting existing workflows.

The key benefits include:

1. **Improved code reusability** through shared packages
2. **Enhanced Modal integration** for GPU-intensive processing
3. **Clearer separation of concerns** with dedicated service packages
4. **Simplified database management** with clarified table roles
5. **Preserved script-driven development** approach that works well

By following the phased migration approach, the team can gradually improve the architecture while maintaining development velocity.

## Appendix: Required Environment Variables

```
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Modal Configuration
MODAL_API_URL=https://modal.com/api/v1
MODAL_API_KEY=your-modal-api-key

# File Storage Configuration
STORAGE_DIR=/path/to/storage
TEMP_DIR=/path/to/temp

# Processing Configuration
DEFAULT_WHISPER_MODEL=base
LOG_LEVEL=info
LOG_FORMAT=json
```