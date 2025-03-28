# Monorepo Architecture with BullMQ and Modal

This document outlines an architecture for a monorepo containing both TypeScript and Python services, using BullMQ for job queuing and Modal for GPU-intensive processing.

## Architecture Overview

```
monorepo/
├── packages/
│   ├── shared/                # Shared utilities and configs
│   │   └── database/          # Supabase client adapters for both TS and Python
│   ├── typescript/
│   │   ├── api/               # Express/Fastify/Next.js API
│   │   ├── ui/                # Frontend application
│   │   ├── queue-service/     # BullMQ implementation
│   │   └── workers/           # TypeScript workers processing jobs
│   └── python/
│       ├── modal-functions/   # Modal functions for GPU tasks
│       ├── audio-processing/  # FFmpeg and Whisper implementations
│       └── clients/           # Python clients for shared services
├── scripts/                   # Build/deployment scripts
└── docker/                    # Containerization for development
```

## Core Components

### 1. BullMQ Queue Manager (TypeScript)

```typescript
// packages/typescript/queue-service/src/queues/audioQueue.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
import { supabaseClient } from '@shared/database';
import { invokeModalFunction } from '../utils/modalBridge';

// Connection config
const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Create queue
export const audioQueue = new Queue('audio-processing', { connection });

// Create scheduler for delayed jobs
export const audioScheduler = new QueueScheduler('audio-processing', { connection });

// Worker that processes jobs
export const initializeAudioWorker = () => {
  const worker = new Worker('audio-processing', async job => {
    const { filePath, options, userId } = job.data;
    
    try {
      // Update job status in Supabase
      await supabaseClient
        .from('processing_jobs')
        .update({ status: 'processing' })
        .match({ job_id: job.id });
      
      // Invoke Modal function
      const result = await invokeModalFunction('audio_transcription', {
        file_path: filePath,
        options,
      });
      
      // Update with results
      await supabaseClient
        .from('processing_jobs')
        .update({ 
          status: 'completed',
          result: result,
          completed_at: new Date().toISOString()
        })
        .match({ job_id: job.id });
        
      return result;
    } catch (error) {
      // Handle error
      await supabaseClient
        .from('processing_jobs')
        .update({ 
          status: 'failed',
          error: error.message
        })
        .match({ job_id: job.id });
        
      throw error;
    }
  }, { connection });
  
  return worker;
};
```

### 2. Modal Functions (Python)

```python
# packages/python/modal-functions/audio_transcription.py
import modal
import os
from typing import Dict, Any
from pathlib import Path
from shared.database import get_supabase_client

# Define Modal image with FFmpeg and Whisper
image = modal.Image.debian_slim().pip_install(
    "openai-whisper", 
    "ffmpeg-python", 
    "supabase"
).apt_install("ffmpeg")

# Create Modal app
app = modal.App("audio-processing")

@app.function(image=image, gpu="A10G")
def transcribe_audio(file_path: str, options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transcribe audio using Whisper model
    """
    import whisper
    import ffmpeg
    import tempfile
    
    # Download file from storage if needed
    # This example assumes file_path is accessible
    
    # Process with FFmpeg if needed
    output_path = file_path
    if options.get("preprocessing", False):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            output_path = temp_file.name
            
        # Apply FFmpeg preprocessing
        (
            ffmpeg
            .input(file_path)
            .output(output_path, acodec='pcm_s16le', ar=16000, ac=1)
            .run(quiet=True, overwrite_output=True)
        )
    
    # Load Whisper model
    model_name = options.get("model", "base")
    model = whisper.load_model(model_name)
    
    # Transcribe
    result = model.transcribe(output_path)
    
    # Clean up temp files
    if output_path != file_path:
        os.unlink(output_path)
        
    return {
        "text": result["text"],
        "segments": result["segments"],
        "language": result["language"]
    }

@app.function()
def update_job_status(job_id: str, status: str, result: Dict[str, Any] = None):
    """
    Update job status in Supabase
    """
    supabase = get_supabase_client()
    
    update_data = {"status": status}
    if result:
        update_data["result"] = result
        update_data["completed_at"] = datetime.datetime.now().isoformat()
    
    supabase.table("processing_jobs").update(update_data).eq("job_id", job_id).execute()
```

### 3. Shared Service Interface (TypeScript)

```typescript
// packages/typescript/api/src/services/audioProcessingService.ts
import { audioQueue } from '../queues/audioQueue';
import { supabaseClient } from '@shared/database';

export interface AudioProcessingOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  preprocessing?: boolean;
  language?: string;
}

export class AudioProcessingService {
  /**
   * Submit an audio file for processing
   */
  async processAudio(
    filePath: string, 
    options: AudioProcessingOptions, 
    userId: string
  ): Promise<string> {
    // Create job record in Supabase
    const { data, error } = await supabaseClient
      .from('processing_jobs')
      .insert({
        user_id: userId,
        file_path: filePath,
        options,
        status: 'queued',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw new Error(`Failed to create job: ${error.message}`);
    
    // Add to BullMQ queue
    const job = await audioQueue.add('transcribe', {
      filePath,
      options,
      userId,
      jobRecordId: data.id
    });
    
    // Update job with queue ID
    await supabaseClient
      .from('processing_jobs')
      .update({ job_id: job.id })
      .match({ id: data.id });
    
    return job.id;
  }
  
  /**
   * Get status of a processing job
   */
  async getJobStatus(jobId: string): Promise<any> {
    const { data, error } = await supabaseClient
      .from('processing_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
      
    if (error) throw new Error(`Failed to get job: ${error.message}`);
    return data;
  }
  
  /**
   * List user's processing jobs
   */
  async listJobs(userId: string, status?: string): Promise<any[]> {
    let query = supabaseClient
      .from('processing_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list jobs: ${error.message}`);
    return data;
  }
}
```

### 4. Modal Bridge Utility (TypeScript)

```typescript
// packages/typescript/queue-service/src/utils/modalBridge.ts
import axios from 'axios';
import { getModalToken } from './auth';

interface ModalResponse {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Invokes a Modal function from TypeScript
 */
export async function invokeModalFunction(
  functionName: string, 
  params: Record<string, any>
): Promise<any> {
  try {
    const token = await getModalToken();
    
    const response = await axios.post<ModalResponse>(
      `${process.env.MODAL_API_URL}/api/functions/${functionName}`,
      params,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Unknown Modal error');
    }
    
    return response.data.result;
  } catch (error) {
    console.error(`Error invoking Modal function '${functionName}':`, error);
    throw error;
  }
}
```

### 5. Python Client for Shared Services

```python
# packages/python/clients/job_client.py
from typing import Dict, Any, List, Optional
from shared.database import get_supabase_client

class JobClient:
    """Client for interacting with processing jobs"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def get_job(self, job_id: str) -> Dict[str, Any]:
        """Get job by ID"""
        response = self.supabase.table("processing_jobs") \
            .select("*") \
            .eq("job_id", job_id) \
            .execute()
            
        if not response.data:
            raise ValueError(f"Job with ID {job_id} not found")
            
        return response.data[0]
    
    def update_job_status(
        self, 
        job_id: str, 
        status: str, 
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update job status"""
        import datetime
        
        update_data = {"status": status}
        
        if result is not None:
            update_data["result"] = result
            update_data["completed_at"] = datetime.datetime.now().isoformat()
            
        if error is not None:
            update_data["error"] = error
            
        response = self.supabase.table("processing_jobs") \
            .update(update_data) \
            .eq("job_id", job_id) \
            .execute()
            
        return response.data[0] if response.data else None
```

## Database Schema

```sql
-- Supabase SQL schema

-- Table for processing jobs
create table public.processing_jobs (
  id uuid not null default uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  user_id uuid not null references auth.users(id),
  job_id text,
  file_path text not null,
  options jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  result jsonb,
  error text,
  
  primary key (id)
);

-- Index for faster queries
create index idx_processing_jobs_user_id on public.processing_jobs(user_id);
create index idx_processing_jobs_job_id on public.processing_jobs(job_id);
create index idx_processing_jobs_status on public.processing_jobs(status);

-- RLS policies
alter table public.processing_jobs enable row level security;

-- Allow users to view their own jobs
create policy "Users can view their own jobs"
  on public.processing_jobs
  for select
  using (auth.uid() = user_id);

-- Allow users to create their own jobs
create policy "Users can create their own jobs"
  on public.processing_jobs
  for insert
  with check (auth.uid() = user_id);

-- Allow the service role to update job statuses
create policy "Service can update jobs"
  on public.processing_jobs
  for update
  using (auth.role() = 'service_role');
```

## API Endpoints

```typescript
// packages/typescript/api/src/routes/audioRoutes.ts
import { Router } from 'express';
import { AudioProcessingService } from '../services/audioProcessingService';
import { authenticateUser } from '../middleware/auth';

const router = Router();
const audioService = new AudioProcessingService();

// Submit an audio file for processing
router.post('/process', authenticateUser, async (req, res) => {
  try {
    const { filePath, options } = req.body;
    const userId = req.user.id;
    
    const jobId = await audioService.processAudio(filePath, options, userId);
    
    res.status(202).json({
      jobId,
      status: 'queued',
      message: 'Audio processing job submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job status
router.get('/jobs/:jobId', authenticateUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await audioService.getJobStatus(jobId);
    
    res.json(job);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// List user's jobs
router.get('/jobs', authenticateUser, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.id;
    
    const jobs = await audioService.listJobs(userId, status as string);
    
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

## Development Environment

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    
  supabase:
    image: supabase/supabase-local
    ports:
      - "54321:8000"
    environment:
      POSTGRES_PASSWORD: postgres
    volumes:
      - supabase-data:/var/lib/postgresql/data
  
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "3001:3001"
    volumes:
      - ../:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - SUPABASE_URL=http://supabase:8000
      - SUPABASE_KEY=your-supabase-key
      - MODAL_API_URL=https://modal.com
    depends_on:
      - redis
      - supabase
  
  ui:
    build:
      context: ..
      dockerfile: docker/Dockerfile.ui
    ports:
      - "3000:3000"
    volumes:
      - ../:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    depends_on:
      - api

volumes:
  redis-data:
  supabase-data:
```

## Script Examples

### Build and Deploy Scripts

```bash
#!/bin/bash
# scripts/deploy-modal.sh

# Login to Modal
modal token set --token-id $MODAL_TOKEN_ID --token-secret $MODAL_TOKEN_SECRET

# Deploy all Modal functions
cd packages/python/modal-functions
for file in *.py; do
  echo "Deploying Modal function: $file"
  modal deploy $file
done
```

### Setup Script

```typescript
// scripts/setup.ts
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function setupProject() {
  console.log('Setting up project environment...');
  
  // Install dependencies
  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Setup Python environment
  console.log('Setting up Python environment...');
  execSync('cd packages/python && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt', 
    { stdio: 'inherit', shell: true });
  
  // Initialize Supabase schema
  console.log('Initializing Supabase schema...');
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read schema SQL
  const schemaSql = fs.readFileSync(
    path.join(__dirname, '../db/schema.sql'), 
    'utf8'
  );
  
  // Execute schema SQL
  const { error } = await supabase.rpc('exec_sql', { sql: schemaSql });
  
  if (error) {
    console.error('Error initializing schema:', error);
    process.exit(1);
  }
  
  console.log('Setup complete!');
}

setupProject().catch(console.error);
```

## Conclusion

This architecture allows for:

1. Separation of concerns between UI, API, and compute-intensive tasks
2. Efficient use of resources by offloading GPU tasks to Modal
3. Reliable job management through BullMQ
4. Cross-language interoperability via a shared database (Supabase)
5. Scalability for both TypeScript and Python components
6. Clear separation between frontend and backend services

Consider implementing additional features like:
- Webhooks for job completion notifications
- Custom authentication between services
- Storage integration for large files
- Monitoring and observability solutions
