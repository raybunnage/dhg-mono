-- Up Migration
CREATE OR REPLACE VIEW batch_processing_status AS
WITH batch_items AS (
    -- Google Drive extractions
    SELECT 
        pb.id as batch_id,
        sg.id as item_id,
        pb.status,
        pb.error_message as error,
        pb.processed_files as processed_count,
        pb.total_files as total_count,
        sg.mime_type as source_type,
        'supabase_content' as target_type,
        pb.created_at,
        pb.updated_at,
        pb.completed_at
    FROM processing_batches pb
    JOIN sources_google sg ON sg.id = ANY(array(select jsonb_array_elements_text(pb.item_ids))::uuid[])
    WHERE pb.status LIKE 'google_extraction%'

    UNION ALL

    -- Audio extractions from MP4
    SELECT 
        pb.id as batch_id,
        sg.id as item_id,
        pb.status,
        pb.error_message as error,
        pb.processed_files as processed_count,
        pb.total_files as total_count,
        'video/mp4' as source_type,
        'audio/x-m4a' as target_type,
        pb.created_at,
        pb.updated_at,
        pb.completed_at
    FROM processing_batches pb
    JOIN sources_google sg ON sg.id = ANY(array(select jsonb_array_elements_text(pb.item_ids))::uuid[])
    WHERE pb.status LIKE 'audio_extraction%'

    UNION ALL

    -- Transcriptions
    SELECT 
        pb.id as batch_id,
        sg.id as item_id,
        pb.status,
        pb.error_message as error,
        pb.processed_files as processed_count,
        pb.total_files as total_count,
        'audio/x-m4a' as source_type,
        'transcript' as target_type,
        pb.created_at,
        pb.updated_at,
        pb.completed_at
    FROM processing_batches pb
    JOIN sources_google sg ON sg.id = ANY(array(select jsonb_array_elements_text(pb.item_ids))::uuid[])
    WHERE pb.status LIKE 'transcription%'

    UNION ALL

    -- Diarization
    SELECT 
        pb.id as batch_id,
        sg.id as item_id,
        pb.status,
        pb.error_message as error,
        pb.processed_files as processed_count,
        pb.total_files as total_count,
        'audio/x-m4a' as source_type,
        'diarized_transcript' as target_type,
        pb.created_at,
        pb.updated_at,
        pb.completed_at
    FROM processing_batches pb
    JOIN sources_google sg ON sg.id = ANY(array(select jsonb_array_elements_text(pb.item_ids))::uuid[])
    WHERE pb.status LIKE 'diarization%'
)
SELECT * FROM batch_items;

-- Down Migration
DROP VIEW IF EXISTS batch_processing_status CASCADE; 