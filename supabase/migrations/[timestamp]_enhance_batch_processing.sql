-- Up Migration
DO $$ 
BEGIN
    -- Add batch type enum
    CREATE TYPE batch_type AS ENUM (
        'google_extraction',    -- Extract files from Google Drive
        'audio_extraction',     -- Extract m4a from mp4
        'transcription',        -- Basic whisper transcription
        'diarization',         -- Speaker diarization
        'summarization'        -- Generate summaries
    );

    -- Add processing stage enum
    CREATE TYPE processing_stage AS ENUM (
        'queued',              -- Initial state
        'downloading',         -- Getting from Google Drive
        'extracting',          -- Extracting audio/content
        'processing',          -- Main processing (transcription/diarization)
        'saving',             -- Saving results
        'completed',
        'failed',
        'retrying'
    );

    -- Enhance processing_batches
    ALTER TABLE processing_batches
    ALTER COLUMN batch_type TYPE batch_type USING batch_type::batch_type,
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3,
    ADD COLUMN IF NOT EXISTS processed_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

    -- Enhance batch_processing_status
    ALTER TABLE batch_processing_status
    ALTER COLUMN status TYPE processing_stage USING status::processing_stage,
    ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processing_time interval,
    ADD COLUMN IF NOT EXISTS source_type text,  -- 'mp4', 'm4a', 'transcript', etc.
    ADD COLUMN IF NOT EXISTS target_type text;  -- What it's being converted to
END $$; 