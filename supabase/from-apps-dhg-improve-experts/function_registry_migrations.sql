-- Function registry migrations
-- These SQL statements create the necessary tables and functions for the function registry system

-- Create function_registry table if it doesn't exist
CREATE TABLE IF NOT EXISTS function_registry (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  repository TEXT NOT NULL,
  location TEXT,
  implementation_notes TEXT,
  code_signature TEXT,
  git_commit TEXT,
  git_branch TEXT,
  status TEXT DEFAULT 'active',
  dependencies TEXT[],
  used_in TEXT[],
  is_react_component BOOLEAN DEFAULT FALSE,
  is_dashboard_specific BOOLEAN DEFAULT FALSE,
  is_utility_candidate BOOLEAN DEFAULT FALSE,
  complexity TEXT DEFAULT 'medium',
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add a unique constraint on name and repository
ALTER TABLE function_registry DROP CONSTRAINT IF EXISTS unique_function_per_repo;
ALTER TABLE function_registry ADD CONSTRAINT unique_function_per_repo UNIQUE (name, repository);

-- Create function to list source files by pattern
CREATE OR REPLACE FUNCTION list_source_files(path_pattern TEXT, exclude_pattern TEXT DEFAULT '')
RETURNS TABLE (
  path TEXT,
  size BIGINT,
  last_modified TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH source_files AS (
    SELECT 
      filename AS path,
      size,
      last_modified
    FROM 
      storage.objects
    WHERE 
      bucket_id = 'source-files'
      AND (filename LIKE path_pattern OR filename ~ path_pattern)
      AND (exclude_pattern = '' OR filename NOT LIKE exclude_pattern)
  )
  SELECT * FROM source_files
  ORDER BY last_modified DESC;
END;
$$;

-- Create function to read a source file
CREATE OR REPLACE FUNCTION read_source_file(file_path TEXT)
RETURNS TABLE (
  content TEXT,
  size BIGINT,
  last_modified TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  file_object RECORD;
  file_content BYTEA;
BEGIN
  -- Find the file in storage
  SELECT * INTO file_object
  FROM storage.objects
  WHERE 
    bucket_id = 'source-files'
    AND filename = file_path;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found: %', file_path;
  END IF;
  
  -- Get the file content
  SELECT content INTO file_content
  FROM storage.get_object('source-files', file_path);
  
  RETURN QUERY 
  SELECT 
    convert_from(file_content, 'UTF8') AS content,
    file_object.size,
    file_object.last_modified;
END;
$$;

-- Create GUTS tables if they don't exist
CREATE OR REPLACE FUNCTION create_guts_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create app_pages table if not exists
  CREATE TABLE IF NOT EXISTS app_pages (
    id SERIAL PRIMARY KEY,
    page_name TEXT NOT NULL,
    page_path TEXT NOT NULL,
    app_name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (page_path, app_name)
  );
  
  -- Create page_table_usage table if not exists
  CREATE TABLE IF NOT EXISTS page_table_usage (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES app_pages(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    operations TEXT[] NOT NULL,
    success BOOLEAN NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Create page_function_usage table if not exists
  CREATE TABLE IF NOT EXISTS page_function_usage (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES app_pages(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    call_type TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Create page_dependencies table if not exists
  CREATE TABLE IF NOT EXISTS page_dependencies (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES app_pages(id) ON DELETE CASCADE,
    dependency_name TEXT NOT NULL,
    dependency_type TEXT NOT NULL,
    version TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
  );
END;
$$;

-- Create function to get or create a page
CREATE OR REPLACE FUNCTION get_or_create_page(
  p_app_name TEXT,
  p_page_name TEXT,
  p_page_path TEXT
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_page_id INTEGER;
BEGIN
  -- Try to find existing page
  SELECT id INTO v_page_id
  FROM app_pages
  WHERE app_name = p_app_name AND page_path = p_page_path;
  
  -- If not found, create a new one
  IF v_page_id IS NULL THEN
    INSERT INTO app_pages (
      app_name,
      page_name,
      page_path,
      description
    ) VALUES (
      p_app_name,
      p_page_name,
      p_page_path,
      'Auto-created by GutsTracker'
    )
    RETURNING id INTO v_page_id;
  END IF;
  
  RETURN v_page_id;
END;
$$;