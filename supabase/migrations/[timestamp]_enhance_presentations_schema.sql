-- Up Migration
DO $$ 
BEGIN
    -- Enhance presentations table to be the central organizing entity
    ALTER TABLE presentations
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS summary text,
    ADD COLUMN IF NOT EXISTS event_date timestamp with time zone,
    ADD COLUMN IF NOT EXISTS primary_video_id text REFERENCES sources_google(id),
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending'
    CHECK (processing_status in ('pending', 'processing', 'completed', 'failed')),
    ADD COLUMN IF NOT EXISTS processing_error text,
    ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;

    -- Create presentation_assets to link related files
    CREATE TABLE IF NOT EXISTS presentation_assets (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        presentation_id text REFERENCES presentations(id),
        source_id text REFERENCES sources_google(id),
        expert_document_id text REFERENCES expert_documents(id),
        asset_type text NOT NULL
        CHECK (asset_type in ('audio', 'transcript', 'chat', 'slides', 'summary', 'notes')),
        asset_role text NOT NULL
        CHECK (asset_role in ('primary', 'supplementary', 'generated', 'reference')),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
    );

    -- Add indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_presentation_assets_presentation_id 
    ON presentation_assets(presentation_id);
    
    CREATE INDEX IF NOT EXISTS idx_presentation_assets_type 
    ON presentation_assets(asset_type);

    -- Drop video_summaries table if it exists
    DROP TABLE IF EXISTS video_summaries;
END $$;

-- Down Migration
BEGIN;
    DROP TABLE IF EXISTS presentation_assets;
    ALTER TABLE presentations 
    DROP COLUMN IF EXISTS title,
    DROP COLUMN IF EXISTS summary,
    DROP COLUMN IF EXISTS event_date,
    DROP COLUMN IF EXISTS primary_video_id,
    DROP COLUMN IF EXISTS metadata,
    DROP COLUMN IF EXISTS processing_status,
    DROP COLUMN IF EXISTS processing_error,
    DROP COLUMN IF EXISTS processed_at;
COMMIT; 