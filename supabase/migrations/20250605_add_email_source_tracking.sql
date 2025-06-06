-- Migration: Add email source tracking system
-- Purpose: Track where email addresses come from (Ray's Gmail flow, DHG curated list, etc.)
-- Author: Claude
-- Date: 2025-06-05

-- Create email_sources table to define possible sources
CREATE TABLE IF NOT EXISTS email_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(50) UNIQUE NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(50), -- 'gmail_flow', 'curated_list', 'import', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE email_sources ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read sources
CREATE POLICY "email_sources_read_policy" ON email_sources
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow service role to modify sources
CREATE POLICY "email_sources_write_policy" ON email_sources
  FOR ALL
  TO service_role
  USING (true);

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS email_source_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES auth_allowed_emails(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES email_sources(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  import_metadata JSONB, -- Store import details like filename, row number, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_id, source_id) -- Prevent duplicate associations
);

-- Add indexes for performance
CREATE INDEX idx_email_source_email_id ON email_source_associations(email_id);
CREATE INDEX idx_email_source_source_id ON email_source_associations(source_id);

-- Add RLS policies
ALTER TABLE email_source_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_source_associations_read_policy" ON email_source_associations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "email_source_associations_write_policy" ON email_source_associations
  FOR ALL
  TO service_role
  USING (true);

-- Add columns to auth_allowed_emails for primary source tracking
ALTER TABLE auth_allowed_emails 
ADD COLUMN IF NOT EXISTS primary_source_id UUID REFERENCES email_sources(id),
ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- Create function to update source count
CREATE OR REPLACE FUNCTION update_email_source_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE auth_allowed_emails 
    SET source_count = (
      SELECT COUNT(*) 
      FROM email_source_associations 
      WHERE email_id = NEW.email_id
    ),
    updated_at = NOW()
    WHERE id = NEW.email_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE auth_allowed_emails 
    SET source_count = (
      SELECT COUNT(*) 
      FROM email_source_associations 
      WHERE email_id = OLD.email_id
    ),
    updated_at = NOW()
    WHERE id = OLD.email_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for source count updates
DROP TRIGGER IF EXISTS update_source_count_trigger ON email_source_associations;
CREATE TRIGGER update_source_count_trigger
AFTER INSERT OR DELETE ON email_source_associations
FOR EACH ROW
EXECUTE FUNCTION update_email_source_count();

-- Insert initial email sources
INSERT INTO email_sources (source_code, source_name, source_type, description) VALUES
('rays_gmail_flow', 'Ray''s Gmail Network (2020-2025)', 'gmail_flow', 'Email addresses collected from Ray''s Gmail interactions over the past 5 years'),
('dhg_curated_list', 'Dynamic Healing Group Members', 'curated_list', 'Manually curated email list from Dynamic Healing Group stakeholders')
ON CONFLICT (source_code) DO NOTHING;

-- Get the source ID for Ray's Gmail flow
DO $$
DECLARE
  rays_source_id UUID;
BEGIN
  -- Get Ray's Gmail source ID
  SELECT id INTO rays_source_id 
  FROM email_sources 
  WHERE source_code = 'rays_gmail_flow';

  -- Update all existing emails to have Ray's Gmail as their primary source
  UPDATE auth_allowed_emails 
  SET primary_source_id = rays_source_id,
      source_count = 1,
      updated_at = NOW()
  WHERE primary_source_id IS NULL;

  -- Create source associations for all existing emails
  INSERT INTO email_source_associations (email_id, source_id, import_metadata)
  SELECT 
    ae.id,
    rays_source_id,
    jsonb_build_object(
      'migration', '20250605_add_email_source_tracking',
      'original_added_at', ae.added_at,
      'note', 'Migrated from existing auth_allowed_emails data'
    )
  FROM auth_allowed_emails ae
  WHERE NOT EXISTS (
    SELECT 1 
    FROM email_source_associations esa 
    WHERE esa.email_id = ae.id 
    AND esa.source_id = rays_source_id
  );
END $$;

-- Create view for easy querying of emails with their sources
CREATE OR REPLACE VIEW email_with_sources AS
SELECT 
  ae.id,
  ae.email,
  ae.name,
  ae.organization,
  ae.is_active,
  ae.auth_user_id,
  ae.source_count,
  ps.source_name as primary_source_name,
  ps.source_code as primary_source_code,
  array_agg(
    DISTINCT jsonb_build_object(
      'source_id', es.id,
      'source_code', es.source_code,
      'source_name', es.source_name,
      'first_seen_at', esa.first_seen_at
    )
  ) as all_sources
FROM auth_allowed_emails ae
LEFT JOIN email_sources ps ON ae.primary_source_id = ps.id
LEFT JOIN email_source_associations esa ON ae.id = esa.email_id
LEFT JOIN email_sources es ON esa.source_id = es.id
GROUP BY 
  ae.id, ae.email, ae.name, ae.organization, 
  ae.is_active, ae.auth_user_id, ae.source_count,
  ps.source_name, ps.source_code;

-- Grant permissions on the view
GRANT SELECT ON email_with_sources TO authenticated;

-- Add helpful comments
COMMENT ON TABLE email_sources IS 'Defines the various sources where email addresses come from';
COMMENT ON TABLE email_source_associations IS 'Junction table tracking which emails came from which sources';
COMMENT ON COLUMN auth_allowed_emails.primary_source_id IS 'The primary/original source where this email was first discovered';
COMMENT ON COLUMN auth_allowed_emails.source_count IS 'Number of different sources this email appears in';
COMMENT ON VIEW email_with_sources IS 'Convenient view showing emails with all their associated sources';

-- Update table definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
  ('public', 'email_sources', 'Email source definitions', 'Track where email addresses originate from', CURRENT_DATE),
  ('public', 'email_source_associations', 'Email to source mappings', 'Many-to-many relationship between emails and their sources', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;