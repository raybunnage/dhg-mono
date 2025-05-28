-- Phase 1: Initial data migration with metadata cleanup
-- Copy and clean basic data from original table with complete data cleanup

-- First, make sure the google_sources table exists
CREATE TABLE IF NOT EXISTS public.google_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    mime_type text,
    drive_id text NOT NULL,
    root_drive_id text,
    parent_folder_id text,
    path text,
    is_root boolean DEFAULT false,
    path_array text[],
    path_depth integer,
    is_deleted boolean DEFAULT false,
    metadata jsonb,
    size bigint,
    modified_time timestamp with time zone,
    web_view_link text,
    thumbnail_link text,
    content_extracted boolean DEFAULT false,
    extracted_content text,
    document_type_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_indexed timestamp with time zone,
    main_video_id uuid
);

-- Create any necessary indexes
CREATE INDEX IF NOT EXISTS google_sources_drive_id_idx ON public.google_sources (drive_id);
CREATE INDEX IF NOT EXISTS google_sources_root_drive_id_idx ON public.google_sources (root_drive_id);
CREATE INDEX IF NOT EXISTS google_sources_parent_folder_id_idx ON public.google_sources (parent_folder_id);
CREATE INDEX IF NOT EXISTS google_sources_mime_type_idx ON public.google_sources (mime_type);
CREATE INDEX IF NOT EXISTS google_sources_path_idx ON public.google_sources (path);
CREATE INDEX IF NOT EXISTS google_sources_name_idx ON public.google_sources (name);
CREATE INDEX IF NOT EXISTS google_sources_document_type_id_idx ON public.google_sources (document_type_id);

-- Clear any existing data (in case of rerun)
TRUNCATE TABLE public.google_sources;

-- Now copy data from the original table
INSERT INTO public.google_sources (
    id, name, mime_type, drive_id, root_drive_id, parent_folder_id, path, is_root,
    path_array, path_depth, is_deleted, metadata, size, modified_time, 
    web_view_link, thumbnail_link, content_extracted, extracted_content,
    document_type_id, created_at, updated_at, last_indexed
)
SELECT 
    id, 
    name, 
    mime_type, 
    drive_id,
    COALESCE(root_drive_id, 
             CASE WHEN drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV' THEN drive_id
                  WHEN path LIKE '%Dynamic Healing Discussion Group%' THEN '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'
                  ELSE drive_id END),
    parent_id,
    COALESCE(path, '/' || name),
    is_root,
    string_to_array(COALESCE(path, '/' || name), '/'),
    array_length(string_to_array(COALESCE(path, '/' || name), '/'), 1),
    COALESCE(deleted, false),
    metadata,
    COALESCE(size, size_bytes, (metadata->>'size')::bigint),
    modified_time, 
    web_view_link, 
    thumbnail_link,
    content_extracted, 
    extracted_content,
    document_type_id,
    created_at, 
    updated_at, 
    last_indexed
FROM 
    public.google_sources;