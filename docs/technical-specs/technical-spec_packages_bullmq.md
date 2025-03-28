# Monorepo Architecture with BullMQ and Modal Integration

## Executive Summary

This technical specification outlines a comprehensive plan to restructure the DHG monorepo architecture, integrating BullMQ for job queuing and Modal for GPU-intensive processing. The architecture will support both TypeScript and Python services within a unified structure, enabling efficient audio processing pipelines while maintaining the current script-driven development approach.

## Key Recommendations

1. **Reorganize Package Structure**: Establish a clear, modular package structure with shared code, domain-specific services, and language-specific implementations
2. **Implement BullMQ**: Add a queue-service package to handle job orchestration across processing stages
3. **Integrate Modal Processing**: Keep the existing Modal implementation but improve its integration with the TypeScript services
4. **Preserve Script-Driven Workflow**: Enhance rather than replace the current command-line driven approach
5. **Keep Database Schema**: Maintain processing tables in Supabase alongside BullMQ for comprehensive tracking
6. **Clarify Table Roles**: Establish clear separation between content tables and relationship tables

## 1. Package Structure and Organization

### Current Structure Analysis

The current packages structure has three main sections:
- `cli`: Contains command-line tools and supporting services
- `python-audio-processor`: Contains Modal implementations and Python processing scripts
- `scripts`: Contains various operational scripts

This structure has several limitations:
- Lacks clear separation between shared code and service-specific implementations
- Does not facilitate code reuse across applications
- Makes cross-language integration challenging

### Proposed Package Structure

```
packages/
├── shared/                         # Shared utilities (TypeScript)
│   ├── database/                   # Database clients and models
│   │   ├── models/                 # Data models (TypeScript interfaces)
│   │   │   ├── document-type.ts    # Moved from cli/src/models
│   │   │   ├── prompt.ts           # Moved from cli/src/models
│   │   │   ├── job.ts              # NEW: Job tracking model
│   │   │   └── index.ts            # Type exports
│   │   ├── supabase-client.ts      # Moved from cli/src/services
│   │   └── index.ts                # Client exports
│   ├── utils/                      # Common utilities
│   │   ├── config.ts               # Configuration management
│   │   ├── logger.ts               # Logging utilities
│   │   ├── error-handler.ts        # Error handling utilities
│   │   └── index.ts                # Utility exports
│   └── types/                      # TypeScript type definitions
│       └── index.ts                # Type exports
├── services/                       # Domain services
│   ├── queue-service/              # BullMQ implementation
│   │   ├── src/
│   │   │   ├── queues/             # Queue definitions
│   │   │   │   ├── extraction-queue.ts
│   │   │   │   ├── transcription-queue.ts
│   │   │   │   ├── diarization-queue.ts
│   │   │   │   ├── summarization-queue.ts
│   │   │   │   └── index.ts
│   │   │   ├── workers/            # Worker implementations
│   │   │   │   ├── extraction-worker.ts
│   │   │   │   ├── transcription-worker.ts
│   │   │   │   ├── diarization-worker.ts
│   │   │   │   ├── summarization-worker.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/              # Queue-specific utilities
│   │   │   │   ├── job-tracker.ts
│   │   │   │   └── redis-connection.ts
│   │   │   └── index.ts            # Service exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── file-service/               # File operations
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── google-drive.ts  # Google Drive integration
│   │   │   │   └── local-fs.ts      # Local filesystem operations
│   │   │   ├── operations/
│   │   │   │   ├── extract-audio.ts # Audio extraction operations
│   │   │   │   └── upload.ts        # File upload operations
│   │   │   └── index.ts             # Service exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ai-service/                 # AI operations
│   │   ├── src/
│   │   │   ├── claude/              # Claude API integration
│   │   │   │   ├── client.ts
│   │   │   │   └── prompts.ts
│   │   │   ├── operations/
│   │   │   │   ├── summarize.ts
│   │   │   │   └── classify.ts
│   │   │   └── index.ts             # Service exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── audio-service/              # Audio processing
│       ├── src/
│       │   ├── operations/
│       │   │   ├── extract.ts       # Audio extraction logic
│       │   │   └── analyze.ts       # Audio analysis logic
│       │   ├── modal-bridge.ts      # Integration with Modal
│       │   └── index.ts             # Service exports
│       ├── package.json
│       └── tsconfig.json
├── shared-py/                      # Shared Python utilities
│   ├── database/                   # Python database client
│   │   ├── __init__.py
│   │   ├── models.py               # Pydantic models
│   │   └── client.py               # Supabase client
│   ├── utils/                      # Common Python utilities
│   │   ├── __init__.py
│   │   ├── config.py               # Configuration management
│   │   └── logging.py              # Logging setup
│   ├── setup.py
│   └── requirements.txt
├── modal/                          # Modal functions (Python)
│   ├── audio-processing/
│   │   ├── __init__.py
│   │   ├── transcription.py        # Audio transcription
│   │   ├── diarization.py          # Speaker diarization
│   │   └── summarization.py        # Content summarization
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── utils.py                # Shared utilities
│   │   └── db.py                   # Database integration
│   ├── requirements.txt
│   └── setup.py
└── cli/                            # Preserved CLI structure (refactored)
    └── ... (existing structure but referencing shared packages)
```

### Migration Strategy for Package Structure

1. **Phase 1: Create Shared Packages**
   - Create `packages/shared` directory
   - Move common TypeScript utilities, models, and database clients from `cli/src`
   - Update imports in existing code

2. **Phase 2: Add Queue Service**
   - Create `packages/services/queue-service`
   - Implement basic BullMQ integration for one queue (extraction)
   - Create worker implementation for extraction

3. **Phase 3: Domain Services**
   - Create remaining domain service packages
   - Move specific functionality from CLI to appropriate services
   - Update imports in existing code

4. **Phase 4: Python Shared Code**
   - Create `packages/shared-py`
   - Extract common Python utilities from `python-audio-processor`
   - Create Python database client that mirrors TypeScript implementation

5. **Phase 5: Modal Integration**
   - Reorganize `python-audio-processor` into `packages/modal`
   - Improve integration with TypeScript services via database and HTTP

## 2. BullMQ Integration

### Core Components

1. **Queues** - Define separate queues for each processing stage:
   - `extraction-queue`: Audio extraction from videos
   - `transcription-queue`: Whisper transcription (via Modal)
   - `diarization-queue`: Speaker identification
   - `summarization-queue`: Content summarization

2. **Workers** - Implement workers for each queue:
   - Update job status in Supabase
   - Execute processing logic
   - Handle errors and retries
   - Trigger downstream jobs on completion

3. **Job Tracking** - Store comprehensive job information:
   - Status updates in Supabase
   - Detailed metrics and logs
   - Error information for debugging

### Implementation Details

#### Redis Connection Setup

```typescript
// packages/services/queue-service/src/utils/redis-connection.ts
import { ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // Add authentication if needed
  // password: process.env.REDIS_PASSWORD
};

export const getRedisConnection = (): ConnectionOptions => {
  return {
    ...redisConnection,
    // Add any dynamic configuration here
  };
};
```

#### Queue Definition

```typescript
// packages/services/queue-service/src/queues/extraction-queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis-connection';

// Define job data interface
export interface ExtractionJobData {
  sourceId: string;
  filePath: string;
  options?: {
    outputFormat?: string;
    quality?: string;
  };
}

// Create and export the queue
export const extractionQueue = new Queue<ExtractionJobData>('audio-extraction', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// Helper methods for adding jobs
export const addExtractionJob = async (
  data: ExtractionJobData,
  jobId?: string,
  priority?: number
) => {
  return extractionQueue.add('extract-audio', data, {
    jobId,
    priority,
  });
};
```

#### Worker Implementation

```typescript
// packages/services/queue-service/src/workers/extraction-worker.ts
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis-connection';
import { ExtractionJobData } from '../queues/extraction-queue';
import { supabaseClient } from '@shared/database';
import { logger } from '@shared/utils';
import { extractAudio } from '@services/audio-service';

// Create the worker
export const createExtractionWorker = () => {
  const worker = new Worker<ExtractionJobData>(
    'audio-extraction',
    async (job: Job<ExtractionJobData>) => {
      const { sourceId, filePath, options } = job.data;
      
      try {
        // Update job status in database
        await supabaseClient
          .from('audio_processing_stages')
          .insert({
            source_id: sourceId,
            stage: 'extraction',
            status: 'processing',
            job_id: job.id,
            started_at: new Date().toISOString(),
          });
        
        // Log progress
        logger.info(`Starting audio extraction for ${filePath}`, { jobId: job.id });
        await job.updateProgress(10);
        
        // Perform extraction
        const result = await extractAudio(filePath, options);
        await job.updateProgress(90);
        
        // Update database with results
        await supabaseClient
          .from('sources_google')
          .update({
            audio_extracted: true,
            audio_extraction_path: result.outputPath,
            audio_duration_seconds: result.durationSeconds,
            audio_channels: result.channels,
            audio_bitrate: result.bitrate,
            audio_quality_metrics: result.qualityMetrics
          })
          .eq('id', sourceId);
        
        // Update processing stage
        await supabaseClient
          .from('audio_processing_stages')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: result
          })
          .eq('job_id', job.id);
        
        // Log completion
        logger.info(`Audio extraction completed for ${filePath}`, { 
          jobId: job.id,
          outputPath: result.outputPath 
        });
        
        return result;
      } catch (error) {
        // Log error
        logger.error(`Audio extraction failed for ${filePath}`, {
          jobId: job.id,
          error: error.message
        });
        
        // Update processing stage with error
        await supabaseClient
          .from('audio_processing_stages')
          .update({
            status: 'failed',
            error: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('job_id', job.id);
        
        // Rethrow to let BullMQ handle retries
        throw error;
      }
    },
    { connection: redisConnection }
  );
  
  // Set up event handlers
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed: ${error.message}`);
  });
  
  return worker;
};
```

#### Worker Manager Service

```typescript
// packages/services/queue-service/src/index.ts
import { extractionQueue } from './queues/extraction-queue';
import { transcriptionQueue } from './queues/transcription-queue';
import { diarizationQueue } from './queues/diarization-queue';
import { summarizationQueue } from './queues/summarization-queue';
import { createExtractionWorker } from './workers/extraction-worker';
import { createTranscriptionWorker } from './workers/transcription-worker';
import { createDiarizationWorker } from './workers/diarization-worker';
import { createSummarizationWorker } from './workers/summarization-worker';
import { logger } from '@shared/utils';

// Function to start all workers
export const startWorkers = (options = {}) => {
  logger.info('Starting audio processing workers');
  
  const workers = {
    extraction: createExtractionWorker(),
    transcription: createTranscriptionWorker(),
    diarization: createDiarizationWorker(),
    summarization: createSummarizationWorker()
  };
  
  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing workers');
    for (const [name, worker] of Object.entries(workers)) {
      logger.info(`Closing ${name} worker`);
      await worker.close();
    }
  });
  
  return workers;
};

// Process MP4 through entire pipeline
export const processMP4File = async (
  sourceId: string,
  filePath: string,
  options = {}
) => {
  logger.info(`Adding ${filePath} to processing pipeline`);
  
  // Add to extraction queue
  const extractionJob = await extractionQueue.add(
    'extract-audio',
    {
      sourceId,
      filePath,
      options
    },
    {
      jobId: `extract-${sourceId}`,
    }
  );
  
  logger.info(`Created extraction job ${extractionJob.id}`);
  
  return extractionJob;
};

// Export all queues and functions
export {
  extractionQueue,
  transcriptionQueue,
  diarizationQueue,
  summarizationQueue
};
```

### BullMQ Setup Requirements

1. **Redis Installation**:
   ```bash
   # Using Docker (recommended for development)
   docker run -d -p 6379:6379 --name redis-bull redis:alpine
   
   # For production, use a managed Redis service or proper Redis configuration
   ```

2. **BullMQ Package Installation**:
   ```bash
   npm install bullmq
   ```

3. **Environment Variables**:
   ```
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=optional_password
   ```

## 3. Database Schema Design

### Current Database Analysis

The current database has several key tables:
- `sources_google`: Tracks Google Drive files, including MP4 videos
- `expert_documents`: Stores processed documents (transcripts, summaries)
- `audio_segments`: Stores audio segments with transcription data
- `processing_batches`: Manages processing job groups
- `audio_processing_stages`: Tracks individual processing stages
- `presentation_assets`: Links assets to presentations

The design has some redundancy and confusion about table responsibilities.

### Schema Refinements

#### 1. Job Processing Tables

Maintain the processing tables alongside BullMQ for:
- Historical records
- UI status display
- Analytics and reporting
- Recovery mechanisms

```sql
-- Updated audio_processing_stages table
CREATE TABLE public.audio_processing_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id uuid NOT NULL REFERENCES public.sources_google(id),
  stage text NOT NULL CHECK (stage IN ('extraction', 'transcription', 'diarization', 'summarization')),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_id text, -- BullMQ job ID
  queue_name text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  result jsonb,
  error text,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX idx_processing_stages_source_id ON public.audio_processing_stages(source_id);
CREATE INDEX idx_processing_stages_job_id ON public.audio_processing_stages(job_id);
CREATE INDEX idx_processing_stages_status ON public.audio_processing_stages(status);
```

#### 2. Content vs. Relationship Management

Clarify table responsibilities:

- `expert_documents`: Stores **content** (transcripts, summaries)
  - Focus on the content itself
  - Store processing metadata
  - Include content type and version information

- `presentation_assets`: Acts as a **linking table**
  - Associates documents with presentations
  - Stores relationship metadata (timestamps, importance)
  - Defines the context of how content is used

This separation creates a cleaner domain model where documents exist independently and can be linked to multiple presentations as needed.

#### 3. Field Consolidation Recommendations

For `expert_documents`:
- Keep `ai_processing_details` and remove `processing_metadata`
- This creates a single source of truth for processing information

For `processing_batches`:
- Keep `processor_config` and remove `processor_settings`
- Simplifies configuration management

## 4. Modal Integration

### Current Modal Implementation

The current Modal implementation in `python-audio-processor` includes:
- Audio transcription capabilities
- Python-based processing scripts
- Limited integration with TypeScript services

### Enhanced Modal Integration

1. **Standardized Database Interface**:
   - Create shared Python Supabase client in `packages/shared-py/database`
   - Ensure consistent database operations across languages

2. **Modal Function Improvements**:
   ```python
   # packages/modal/audio-processing/transcription.py
   import modal
   from shared.database import get_supabase_client
   
   # Define Modal image with required dependencies
   image = modal.Image.debian_slim().pip_install(
       "openai-whisper", 
       "ffmpeg-python", 
       "supabase-py"
   ).apt_install("ffmpeg")
   
   # Create Modal app
   app = modal.App("audio-processing")
   
   @app.function(image=image, gpu="A10G")
   def transcribe_audio(
       file_path: str,
       job_id: str,
       options: dict = {}
   ) -> dict:
       """Transcribe audio using Whisper model"""
       import whisper
       import datetime
       
       # Connect to database
       supabase = get_supabase_client()
       
       try:
           # Update job status
           supabase.table("audio_processing_stages").update({
               "status": "processing",
               "started_at": datetime.datetime.now().isoformat()
           }).eq("job_id", job_id).execute()
           
           # Load Whisper model
           model_name = options.get("model", "base")
           model = whisper.load_model(model_name)
           
           # Transcribe
           result = model.transcribe(file_path)
           
           # Update job with results
           supabase.table("audio_processing_stages").update({
               "status": "completed",
               "completed_at": datetime.datetime.now().isoformat(),
               "result": {
                   "text": result["text"],
                   "segments": result["segments"],
                   "language": result["language"]
               }
           }).eq("job_id", job_id).execute()
           
           return {
               "success": True,
               "text": result["text"],
               "segments": result["segments"],
               "language": result["language"]
           }
       except Exception as e:
           # Handle errors
           error_message = str(e)
           supabase.table("audio_processing_stages").update({
               "status": "failed",
               "error": error_message,
               "completed_at": datetime.datetime.now().isoformat()
           }).eq("job_id", job_id).execute()
           
           return {
               "success": False,
               "error": error_message
           }
   ```

3. **TypeScript Bridge for Modal**:
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

4. **Worker Integration with Modal**:
   ```typescript
   // packages/services/queue-service/src/workers/transcription-worker.ts
   import { Worker, Job } from 'bullmq';
   import { redisConnection } from '../utils/redis-connection';
   import { TranscriptionJobData } from '../queues/transcription-queue';
   import { supabaseClient } from '@shared/database';
   import { logger } from '@shared/utils';
   import { callModalFunction } from '@services/audio-service/modal-bridge';
   
   export const createTranscriptionWorker = () => {
     const worker = new Worker<TranscriptionJobData>(
       'audio-transcription',
       async (job: Job<TranscriptionJobData>) => {
         const { sourceId, audioPath, options } = job.data;
         
         try {
           // Call Modal function
           const result = await callModalFunction({
             functionName: 'transcribe_audio',
             params: {
               file_path: audioPath,
               job_id: job.id,
               options
             }
           });
           
           if (!result.success) {
             throw new Error(result.error || 'Transcription failed');
           }
           
           // Update expert_documents with transcript
           await supabaseClient
             .from('expert_documents')
             .insert({
               source_id: sourceId,
               raw_content: result.text,
               processed_content: {
                 segments: result.segments
               },
               content_type: 'transcript',
               processing_status: 'completed',
               word_count: result.text.split(/\s+/).length,
               language: result.language,
               whisper_model_used: options.model || 'base'
             });
           
           return result;
         } catch (error) {
           logger.error(`Transcription failed for ${audioPath}`, {
             jobId: job.id,
             error: error.message
           });
           
           throw error;
         }
       },
       { connection: redisConnection }
     );
     
     return worker;
   };
   ```

## 5. Script Integration

### Command-Line Script Enhancement

The existing command-line driven workflow can be preserved and enhanced:

1. **Job Submission Scripts**:
   ```javascript
   // scripts/js/process-video.js
   import { processMP4File } from '@packages/services/queue-service';
   import { supabaseClient } from '@packages/shared/database';
   
   async function main() {
     const sourceId = process.argv[2];
     const filePath = process.argv[3];
     
     if (!sourceId || !filePath) {
       console.error('Usage: process-video.js <sourceId> <filePath>');
       process.exit(1);
     }
     
     try {
       // Submit to processing pipeline
       const job = await processMP4File(sourceId, filePath);
       console.log(`Job created: ${job.id}`);
     } catch (error) {
       console.error('Error processing video:', error.message);
       process.exit(1);
     }
   }
   
   main().catch(console.error);
   ```

2. **Batch Processing Scripts**:
   ```bash
   #!/bin/bash
   # scripts/sh/process-directory.sh
   
   # Usage validation
   if [ -z "$1" ]; then
     echo "Usage: process-directory.sh <directory-path>"
     exit 1
   fi
   
   # Get all MP4 files in directory
   find "$1" -name "*.mp4" | while read file; do
     echo "Processing $file..."
     
     # Get the file's metadata from Google Drive (if available)
     metadata=$(node scripts/js/get-drive-metadata.js "$file")
     source_id=$(echo "$metadata" | jq -r '.id')
     
     if [ "$source_id" = "null" ]; then
       echo "File not found in sources_google, creating record..."
       source_id=$(node scripts/js/create-source-record.js "$file")
     fi
     
     # Submit to processing queue
     node scripts/js/process-video.js "$source_id" "$file"
   done
   
   echo "All files queued for processing"
   ```

3. **Job Monitoring Scripts**:
   ```javascript
   // scripts/js/monitor-processing.js
   import { supabaseClient } from '@packages/shared/database';
   import { extractionQueue, transcriptionQueue, diarizationQueue, summarizationQueue } from '@packages/services/queue-service';
   
   async function getJobCounts() {
     // Get BullMQ queue counts
     const [
       extractionCount,
       transcriptionCount,
       diarizationCount,
       summarizationCount
     ] = await Promise.all([
       extractionQueue.getJobCounts(),
       transcriptionQueue.getJobCounts(),
       diarizationQueue.getJobCounts(),
       summarizationQueue.getJobCounts()
     ]);
     
     return {
       extraction: extractionCount,
       transcription: transcriptionCount,
       diarization: diarizationCount,
       summarization: summarizationCount
     };
   }
   
   async function getProcessingStatus() {
     // Get database processing status
     const { data, error } = await supabaseClient
       .from('audio_processing_stages')
       .select('stage, status, count')
       .eq('status', 'processing')
       .group('stage, status');
     
     if (error) {
       console.error('Error fetching processing status:', error.message);
       return [];
     }
     
     return data;
   }
   
   async function main() {
     console.log('=== Audio Processing Pipeline Status ===');
     
     // Get queue counts
     const jobCounts = await getJobCounts();
     console.log('\nQueue Counts:');
     console.table(jobCounts);
     
     // Get processing status
     const processingStatus = await getProcessingStatus();
     console.log('\nActive Processing Jobs:');
     console.table(processingStatus);
   }
   
   main().catch(console.error);
   ```

### Package References in Scripts

```json
// package.json at root level
{
  "name": "dhg-mono",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages/services/*"
  ],
  "scripts": {
    "start:workers": "node scripts/js/start-workers.js",
    "process:video": "node scripts/js/process-video.js"
  }
}
```

## 6. Migration Plan

### Phase 1: Infrastructure Setup (Week 1)

1. **Set up Redis for BullMQ**
   - Install Redis locally or via Docker
   - Configure environment variables

2. **Create shared package structure**
   - Set up `packages/shared` directory
   - Create `database`, `utils`, and `types` subdirectories
   - Move shared code from `cli/src` to appropriate locations

3. **Set up monorepo package references**
   - Configure TypeScript path aliases
   - Set up workspace references in package.json

### Phase 2: BullMQ Implementation (Week 2)

1. **Create queue-service package**
   - Implement redis-connection utility
   - Create extraction-queue definition
   - Implement extraction-worker

2. **Create basic audio-service**
   - Move audio extraction logic from CLI
   - Implement bridge to Modal functions

3. **Create simple worker manager**
   - Script to start/stop workers
   - Basic job submission functionality

### Phase 3: Python Integration (Week 3)

1. **Create shared-py package**
   - Implement Supabase client
   - Add shared utilities

2. **Reorganize Modal functions**
   - Move from python-audio-processor to packages/modal
   - Enhance database integration

3. **Implement HTTP bridge for Modal**
   - Create webhook endpoints
   - Add authentication and error handling

### Phase 4: Pipeline Expansion (Week 4)

1. **Implement remaining queues**
   - transcription-queue
   - diarization-queue
   - summarization-queue

2. **Create worker implementations**
   - Complete remaining worker implementations
   - Add chained job support

3. **Enhance database integration**
   - Ensure consistent status updates
   - Add comprehensive error handling

### Phase 5: Script Migration (Week 5)

1. **Update existing scripts**
   - Refactor to use new services
   - Ensure backward compatibility

2. **Create monitoring tools**
   - Job status dashboard
   - Error reporting

3. **Documentation and testing**
   - Create comprehensive documentation
   - Add end-to-end tests

## 7. Additional Considerations

### Error Handling and Retry Strategies

BullMQ provides built-in retry capabilities, but these should be carefully configured to handle different types of failures:

1. **Retry Configuration**:
   ```typescript
   const defaultJobOptions = {
     attempts: 3,               // Number of retry attempts
     backoff: {
       type: 'exponential',     // Type of backoff (exponential, fixed)
       delay: 1000,             // Initial delay in ms
     },
     removeOnComplete: false,   // Keep completed jobs for analysis
     removeOnFail: false,       // Keep failed jobs for debugging
   };
   ```

2. **Error Classification**:
   - Transient errors (network issues): Should be retried
   - Resource errors (file not found): Should not be retried
   - Processing errors: May need manual intervention

3. **Dead-Letter Queue**:
   - Create a separate queue for failed jobs
   - Implement a process to review and potentially resubmit these jobs

### Observability

1. **Logging Strategy**:
   - Use structured logging (JSON format)
   - Include job IDs in all log messages
   - Log at appropriate levels (info, warn, error)

2. **Metrics Collection**:
   - Track job processing times
   - Monitor queue lengths
   - Record error rates

3. **Dashboard**:
   - Consider implementing a simple admin dashboard
   - Visualize job progress and status
   - Provide interface for job management

### Scaling Considerations

1. **Worker Scaling**:
   - Run multiple worker instances for high-volume queues
   - Consider different worker counts for different queues

2. **Modal Concurrency**:
   - Configure Modal concurrency limits based on available resources
   - Balance cost vs. performance

3. **Resource Allocation**:
   - Monitor Redis memory usage
   - Ensure sufficient disk space for audio files
   - Consider GPU availability for Modal processing

### Security Considerations

1. **API Authentication**:
   - Secure all API endpoints
   - Use proper authentication for Modal webhooks
   - Protect Redis with password and network isolation

2. **Environment Variables**:
   - Use proper environment variable management
   - Consider using a secrets manager for production

3. **File Access Control**:
   - Implement proper permissions for file operations
   - Clean up temporary files after processing

## 8. Development Tools and Workflow

### Monorepo Tools

1. **Package Management**:
   - Use Yarn workspaces or npm workspaces
   - Consider Lerna for versioning if needed

2. **Build Tooling**:
   - Use TypeScript project references
   - Consider Turborepo for build caching

3. **Testing Strategy**:
   - Unit tests for individual services
   - Integration tests for queue workflows
   - End-to-end tests for complete pipelines

### Development Workflow

1. **Local Development**:
   - Run Redis in Docker container
   - Use environment files for configuration
   - Create developer convenience scripts

2. **Debugging**:
   - Add detailed logging
   - Create job inspection tools
   - Implement transaction tracking across services

3. **Continuous Integration**:
   - Set up CI pipeline for testing
   - Add linting and code quality checks
   - Ensure cross-platform compatibility

## 9. Conclusion

This technical specification outlines a comprehensive plan to enhance the DHG monorepo by integrating BullMQ for job queueing and improving the Modal integration for GPU-intensive processing. The architecture preserves the script-driven development approach while adding robust job management, error handling, and scalability.

The key benefits of this approach include:

1. **Improved Reliability**: Robust job management with automatic retries
2. **Enhanced Scalability**: Ability to process multiple files in parallel
3. **Better Observability**: Comprehensive tracking of job status and performance
4. **Code Reusability**: Shared services across multiple applications
5. **Maintainability**: Clear separation of concerns with modular design

By following the migration plan outlined in this document, the team can gradually transition to this enhanced architecture while maintaining development velocity and supporting existing functionality.

## Appendix A: Environment Variables

```
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Modal Configuration
MODAL_API_URL=https://modal.com/api
MODAL_API_KEY=your-modal-api-key
MODAL_TOKEN_ID=your-token-id
MODAL_TOKEN_SECRET=your-token-secret

# File Storage Configuration
STORAGE_PATH=/path/to/storage
TEMP_PATH=/path/to/temp

# Processing Configuration
DEFAULT_WHISPER_MODEL=base
MAX_CONCURRENT_EXTRACTIONS=5
MAX_CONCURRENT_TRANSCRIPTIONS=2
```

## Appendix B: Database Schema SQL

```sql
-- Complete SQL schema for audio processing pipeline

-- Table for tracking processing stages
CREATE TABLE public.audio_processing_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id uuid NOT NULL REFERENCES public.sources_google(id),
  stage text NOT NULL CHECK (stage IN ('extraction', 'transcription', 'diarization', 'summarization')),
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_id text, -- BullMQ job ID
  queue_name text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  result jsonb,
  error text,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for audio_processing_stages
CREATE INDEX idx_processing_stages_source_id ON public.audio_processing_stages(source_id);
CREATE INDEX idx_processing_stages_job_id ON public.audio_processing_stages(job_id);
CREATE INDEX idx_processing_stages_status ON public.audio_processing_stages(status);

-- Table for audio segments (detailed transcription results)
CREATE TABLE public.audio_segments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_document_id uuid REFERENCES public.expert_documents(id),
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  text text NOT NULL,
  speaker_id uuid REFERENCES public.speaker_profiles(id),
  confidence numeric,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for audio_segments
CREATE INDEX idx_audio_segments_document_id ON public.audio_segments(expert_document_id);
CREATE INDEX idx_audio_segments_speaker_id ON public.audio_segments(speaker_id);
```

## Appendix C: Required Dependencies

### TypeScript/Node.js Dependencies

```json
{
  "dependencies": {
    "bullmq": "^3.10.2",
    "axios": "^1.3.4",
    "winston": "^3.8.2",
    "@supabase/supabase-js": "^2.10.0",
    "dotenv": "^16.0.3",
    "typescript": "^4.9.5"
  },
  "devDependencies": {
    "@types/node": "^18.14.6",
    "ts-node": "^10.9.1",
    "jest": "^29.5.0",
    "@types/jest": "^29.4.0"
  }
}
```

### Python Dependencies

```
# requirements.txt
modal-client==0.51.3090
openai-whisper==20230314
ffmpeg-python==0.2.0
supabase==1.0.3
python-dotenv==1.0.0
pydantic==1.10.7
```

## Appendix D: Common Issues and Troubleshooting

1. **Redis Connection Issues**:
   - Verify Redis is running: `docker ps | grep redis`
   - Check connection settings in environment variables
   - Ensure network access to Redis server

2. **Job Processing Failures**:
   - Check logs for specific error messages
   - Verify file paths and permissions
   - Check Supabase connection and table structure

3. **Modal Integration Problems**:
   - Verify Modal authentication
   - Check file accessibility from Modal functions
   - Ensure proper Python environment setup
