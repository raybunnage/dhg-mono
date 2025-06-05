-- Up Migration
DO $$ 
BEGIN
    -- Create ENUMs first
    CREATE TYPE batch_type AS ENUM (
        'google_extraction',    
        'audio_extraction',     
        'transcription',        
        'diarization',         
        'summarization'        
    );

    CREATE TYPE processing_stage AS ENUM (
        'queued',              
        'downloading',         
        'extracting',          
        'processing',          
        'saving',             
        'completed',
        'failed',
        'retrying'
    );

    -- Create tables
    CREATE TABLE IF NOT EXISTS presentations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title text,
        summary text,
        event_date timestamp with time zone,
        primary_video_id uuid REFERENCES sources_google(id),
        metadata JSONB DEFAULT '{}'::jsonb,
        processing_status text DEFAULT 'pending' CHECK (processing_status in ('pending', 'processing', 'completed', 'failed')),
        processing_error text,
        processed_at timestamp with time zone,
        created_by uuid REFERENCES auth.users(id),
        updated_by uuid REFERENCES auth.users(id),
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes for presentations
    CREATE INDEX IF NOT EXISTS idx_presentations_primary_video ON presentations(primary_video_id);

    CREATE TABLE IF NOT EXISTS presentation_assets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        presentation_id uuid REFERENCES presentations(id) ON DELETE CASCADE,
        source_id uuid REFERENCES sources_google(id),
        expert_document_id uuid REFERENCES expert_documents(id),
        asset_type text NOT NULL CHECK (asset_type in ('audio', 'transcript', 'chat', 'slides', 'summary', 'notes')),
        asset_role text NOT NULL CHECK (asset_role in ('primary', 'supplementary', 'generated', 'reference')),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by uuid REFERENCES auth.users(id),
        updated_by uuid REFERENCES auth.users(id),
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes for presentation_assets
    CREATE INDEX IF NOT EXISTS idx_presentation_assets_presentation_id ON presentation_assets(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_presentation_assets_type ON presentation_assets(asset_type);
    CREATE INDEX IF NOT EXISTS idx_presentation_assets_source ON presentation_assets(source_id);

    CREATE TABLE IF NOT EXISTS processing_batches (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        description text,
        batch_type batch_type NOT NULL,
        status processing_stage DEFAULT 'queued',
        priority integer DEFAULT 0,
        max_retries integer DEFAULT 3,
        processed_count integer DEFAULT 0,
        total_count integer DEFAULT 0,
        item_ids JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        started_at timestamp with time zone,
        completed_at timestamp with time zone,
        created_by uuid REFERENCES auth.users(id),
        updated_by uuid REFERENCES auth.users(id),
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );

    -- Create indexes for processing_batches
    CREATE INDEX IF NOT EXISTS idx_processing_batches_status ON processing_batches(status);
    CREATE INDEX IF NOT EXISTS idx_processing_batches_type ON processing_batches(batch_type);

    -- Add updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Add triggers
    CREATE TRIGGER update_presentations_updated_at
        BEFORE UPDATE ON presentations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_presentation_assets_updated_at
        BEFORE UPDATE ON presentation_assets
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_processing_batches_updated_at
        BEFORE UPDATE ON processing_batches
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

END $$;

-- Down Migration
BEGIN;
    -- Drop triggers
    DROP TRIGGER IF EXISTS update_processing_batches_updated_at ON processing_batches;
    DROP TRIGGER IF EXISTS update_presentation_assets_updated_at ON presentation_assets;
    DROP TRIGGER IF EXISTS update_presentations_updated_at ON presentations;
    
    DROP FUNCTION IF EXISTS update_updated_at_column();
    
    -- Drop tables
    DROP TABLE IF EXISTS processing_batches;
    DROP TABLE IF EXISTS presentation_assets;
    DROP TABLE IF EXISTS presentations;
    
    -- Drop types
    DROP TYPE IF EXISTS processing_stage;
    DROP TYPE IF EXISTS batch_type;
COMMIT; 