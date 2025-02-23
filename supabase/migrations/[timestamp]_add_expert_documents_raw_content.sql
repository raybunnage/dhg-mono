-- Up Migration
DO $$ 
BEGIN
    -- Add raw_content if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expert_documents' AND column_name = 'raw_content'
    ) THEN
        ALTER TABLE expert_documents ADD COLUMN raw_content text;
    END IF;

    -- Add content_extraction_status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expert_documents' AND column_name = 'content_extraction_status'
    ) THEN
        ALTER TABLE expert_documents 
        ADD COLUMN content_extraction_status text default 'pending'
        CHECK (content_extraction_status in ('pending', 'extracting', 'extracted', 'failed'));
    END IF;

    -- Add transcription_status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expert_documents' AND column_name = 'transcription_status'
    ) THEN
        ALTER TABLE expert_documents 
        ADD COLUMN transcription_status text default 'pending'
        CHECK (transcription_status in ('pending', 'transcribing', 'transcribed', 'failed'));
    END IF;
END $$;

-- Down Migration
ALTER TABLE expert_documents 
DROP COLUMN IF EXISTS raw_content,
DROP COLUMN IF EXISTS content_extraction_status,
DROP COLUMN IF EXISTS transcription_status; 