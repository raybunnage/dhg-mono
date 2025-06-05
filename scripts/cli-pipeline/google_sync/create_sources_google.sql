-- Create the google_sources table with improved schema
CREATE TABLE IF NOT EXISTS public.google_sources (
    -- Core identity fields
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    mime_type text,
    drive_id text NOT NULL UNIQUE,
    
    -- Enhanced hierarchy fields (improvements)
    root_drive_id text NOT NULL,              -- NEW! Always required, identifies the top-level folder
    parent_folder_id uuid REFERENCES public.google_sources(id), -- References parent in the same table
    path text,                                -- Full path including filename
    is_root boolean DEFAULT false,            -- Identifies top-level folders
    
    -- NEW! Path as array and depth for easy querying
    path_array text[] GENERATED ALWAYS AS (string_to_array(path, '/')) STORED,
    path_depth int GENERATED ALWAYS AS (array_length(string_to_array(path, '/'), 1)) STORED,
    
    -- Soft delete (renamed from 'deleted' for clarity)
    is_deleted boolean DEFAULT false,
    
    -- Metadata and file attributes
    metadata jsonb,
    size bigint,                              -- File size in bytes
    modified_time timestamptz,
    web_view_link text,
    thumbnail_link text,
    
    -- NEW! Main video association for related files
    main_video_id uuid REFERENCES public.google_sources(id),
    
    -- Processing fields
    content_extracted boolean DEFAULT false,
    extracted_content text,
    
    -- Foreign keys
    document_type_id uuid REFERENCES public.document_types(id),
    
    -- Timestamps
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    last_indexed timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS google_sources_root_drive_id_idx ON public.google_sources(root_drive_id);
CREATE INDEX IF NOT EXISTS google_sources_parent_folder_id_idx ON public.google_sources(parent_folder_id);
CREATE INDEX IF NOT EXISTS google_sources_path_idx ON public.google_sources(path);
CREATE INDEX IF NOT EXISTS google_sources_is_root_idx ON public.google_sources(is_root) WHERE is_root = true;
CREATE INDEX IF NOT EXISTS google_sources_mime_type_idx ON public.google_sources(mime_type);
CREATE INDEX IF NOT EXISTS google_sources_main_video_id_idx ON public.google_sources(main_video_id);
CREATE INDEX IF NOT EXISTS google_sources_path_array_idx ON public.google_sources USING gin(path_array);