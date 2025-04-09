-- Phase 1: Initial data migration with metadata cleanup
-- Copy and clean basic data from original table with complete data cleanup

-- First, make sure the sources_google2 table exists
CREATE TABLE IF NOT EXISTS public.sources_google2 (
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
    expert_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_indexed timestamp with time zone,
    main_video_id uuid
);

-- Create any necessary indexes
CREATE INDEX IF NOT EXISTS sources_google2_drive_id_idx ON public.sources_google2 (drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_root_drive_id_idx ON public.sources_google2 (root_drive_id);
CREATE INDEX IF NOT EXISTS sources_google2_parent_folder_id_idx ON public.sources_google2 (parent_folder_id);
CREATE INDEX IF NOT EXISTS sources_google2_mime_type_idx ON public.sources_google2 (mime_type);
CREATE INDEX IF NOT EXISTS sources_google2_path_idx ON public.sources_google2 (path);
CREATE INDEX IF NOT EXISTS sources_google2_name_idx ON public.sources_google2 (name);
CREATE INDEX IF NOT EXISTS sources_google2_document_type_id_idx ON public.sources_google2 (document_type_id);
CREATE INDEX IF NOT EXISTS sources_google2_expert_id_idx ON public.sources_google2 (expert_id);

-- Clear any existing data (in case of rerun)
TRUNCATE TABLE public.sources_google2;

-- Now copy data from the original table
INSERT INTO public.sources_google2 (
    id, name, mime_type, drive_id, root_drive_id, parent_folder_id, path, is_root,
    path_array, path_depth, is_deleted, metadata, size, modified_time, 
    web_view_link, thumbnail_link, content_extracted, extracted_content,
    document_type_id, expert_id, created_at, updated_at, last_indexed
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
    expert_id,
    created_at, 
    updated_at, 
    last_indexed
FROM 
    public.sources_google;