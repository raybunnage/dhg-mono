-- Create the sys_mime_types table to track all MIME types in the system
CREATE TABLE IF NOT EXISTS sys_mime_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  mime_type TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  is_supported BOOLEAN DEFAULT TRUE,
  extension TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sys_mime_types_mime_type ON sys_mime_types(mime_type);
CREATE INDEX IF NOT EXISTS idx_sys_mime_types_category ON sys_mime_types(category);

-- Add comment to the table
COMMENT ON TABLE sys_mime_types IS 'A reference table of all MIME types found in the google_sources table';

-- Comment on columns
COMMENT ON COLUMN sys_mime_types.mime_type IS 'The MIME type string (e.g., application/pdf)';
COMMENT ON COLUMN sys_mime_types.description IS 'Human-readable description of the MIME type';
COMMENT ON COLUMN sys_mime_types.category IS 'Category grouping for the MIME type (e.g., document, image, video)';
COMMENT ON COLUMN sys_mime_types.is_supported IS 'Whether this MIME type is supported for processing';
COMMENT ON COLUMN sys_mime_types.extension IS 'Common file extension for this MIME type';
COMMENT ON COLUMN sys_mime_types.icon IS 'Icon identifier or class for UI representation';