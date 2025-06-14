-- Add complementary service fields to sys_shared_services table
-- Migration: 20250614000000_add_complementary_service_fields

-- Add new columns for better service categorization and relationships
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS complementary_services TEXT,
ADD COLUMN IF NOT EXISTS service_purpose TEXT,
ADD COLUMN IF NOT EXISTS differentiator TEXT,
ADD COLUMN IF NOT EXISTS service_category TEXT,
ADD COLUMN IF NOT EXISTS category_description TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN sys_shared_services.complementary_services IS 'Comma-separated list of services that work together with this service';
COMMENT ON COLUMN sys_shared_services.service_purpose IS 'Clear description of what this service does and why it exists';
COMMENT ON COLUMN sys_shared_services.differentiator IS 'What makes this service different from similar services';
COMMENT ON COLUMN sys_shared_services.service_category IS 'High-level category this service belongs to (e.g., Google Drive Services, Audio Services)';
COMMENT ON COLUMN sys_shared_services.category_description IS 'Description of the service category and how services in it work together';

-- Update function to include new fields in service info queries
CREATE OR REPLACE FUNCTION get_service_relationships()
RETURNS TABLE (
  service_name TEXT,
  service_purpose TEXT,
  service_category TEXT,
  complementary_services TEXT,
  differentiator TEXT,
  base_class_type TEXT,
  service_type TEXT,
  migration_status TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.service_name,
    s.service_purpose,
    s.service_category,
    s.complementary_services,
    s.differentiator,
    s.base_class_type,
    s.service_type,
    s.migration_status
  FROM sys_shared_services s
  WHERE s.service_purpose IS NOT NULL
  ORDER BY s.service_category, s.service_name;
END;
$$;