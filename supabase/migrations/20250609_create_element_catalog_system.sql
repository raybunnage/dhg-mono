-- Create tables for cataloging app features, pages, and components

-- App features catalog
CREATE TABLE IF NOT EXISTS app_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('page', 'component', 'hook', 'service', 'utility')),
  feature_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  description TEXT,
  parent_feature_id UUID REFERENCES app_features(id),
  metadata JSONB DEFAULT '{}',
  last_scanned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(app_name, file_path)
);

-- Indexes for performance
CREATE INDEX idx_app_features_app_name ON app_features(app_name);
CREATE INDEX idx_app_features_feature_type ON app_features(feature_type);
CREATE INDEX idx_app_features_parent ON app_features(parent_feature_id);

-- Track which features are used in tasks
CREATE TABLE IF NOT EXISTS dev_task_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES dev_tasks(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL CHECK (element_type IN ('app_feature', 'cli_command', 'shared_service')),
  element_id UUID NOT NULL,
  element_name TEXT NOT NULL, -- Denormalized for display
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, element_type, element_id)
);

-- Update dev_tasks to add element_target column
ALTER TABLE dev_tasks 
ADD COLUMN IF NOT EXISTS element_target JSONB DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN dev_tasks.element_target IS 'JSON object containing target element details: {type: "app_feature"|"cli_command"|"shared_service", id: "uuid", name: "display name"}';

-- Function to get app features
CREATE OR REPLACE FUNCTION get_app_features(p_app_name TEXT)
RETURNS TABLE (
  id UUID,
  feature_type TEXT,
  feature_name TEXT,
  file_path TEXT,
  description TEXT,
  parent_path TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    af.id,
    af.feature_type,
    af.feature_name,
    af.file_path,
    af.description,
    paf.file_path as parent_path,
    af.metadata
  FROM app_features af
  LEFT JOIN app_features paf ON af.parent_feature_id = paf.id
  WHERE af.app_name = p_app_name
  ORDER BY 
    af.feature_type,
    af.feature_name;
END;
$$ LANGUAGE plpgsql;

-- Function to catalog app features (to be called from CLI)
CREATE OR REPLACE FUNCTION catalog_app_feature(
  p_app_name TEXT,
  p_feature_type TEXT,
  p_feature_name TEXT,
  p_file_path TEXT,
  p_description TEXT DEFAULT NULL,
  p_parent_path TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_parent_id UUID;
  v_feature_id UUID;
BEGIN
  -- Find parent if provided
  IF p_parent_path IS NOT NULL THEN
    SELECT id INTO v_parent_id
    FROM app_features
    WHERE app_name = p_app_name AND file_path = p_parent_path;
  END IF;

  -- Insert or update feature
  INSERT INTO app_features (
    app_name, feature_type, feature_name, file_path, 
    description, parent_feature_id, metadata, last_scanned_at
  ) VALUES (
    p_app_name, p_feature_type, p_feature_name, p_file_path,
    p_description, v_parent_id, p_metadata, now()
  )
  ON CONFLICT (app_name, file_path) DO UPDATE
  SET 
    feature_type = EXCLUDED.feature_type,
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description,
    parent_feature_id = EXCLUDED.parent_feature_id,
    metadata = EXCLUDED.metadata,
    last_scanned_at = now(),
    updated_at = now()
  RETURNING id INTO v_feature_id;

  RETURN v_feature_id;
END;
$$ LANGUAGE plpgsql;

-- View for easy querying of available elements
CREATE OR REPLACE VIEW available_task_elements_view AS
-- App features
SELECT 
  'app_feature' as element_type,
  af.id as element_id,
  af.app_name as category,
  af.feature_type as subcategory,
  af.feature_name as name,
  af.file_path as path,
  af.description,
  af.last_scanned_at
FROM app_features af
UNION ALL
-- CLI commands
SELECT 
  'cli_command' as element_type,
  cd.id as element_id,
  cp.name as category,
  cp.display_name as subcategory,
  cd.command_name as name,
  cp.script_path as path,
  cd.description,
  cp.last_scanned_at
FROM command_definitions cd
JOIN command_pipelines cp ON cd.pipeline_id = cp.id
WHERE cd.status = 'active'
UNION ALL
-- Shared services
SELECT 
  'shared_service' as element_type,
  ss.id as element_id,
  COALESCE(ss.category, 'uncategorized') as category,
  'service' as subcategory,
  ss.service_name as name,
  ss.service_path as path,
  ss.description,
  ss.updated_at as last_scanned_at
FROM shared_services ss;

-- Grant permissions
GRANT ALL ON app_features TO authenticated;
GRANT ALL ON dev_task_elements TO authenticated;
GRANT ALL ON available_task_elements_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_app_features TO authenticated;
GRANT EXECUTE ON FUNCTION catalog_app_feature TO authenticated;

-- Add RLS policies
ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_features_read_all" ON app_features
  FOR SELECT USING (true);

CREATE POLICY "app_features_write_authenticated" ON app_features
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "dev_task_elements_read_all" ON dev_task_elements
  FOR SELECT USING (true);

CREATE POLICY "dev_task_elements_write_authenticated" ON dev_task_elements
  FOR ALL USING (auth.role() = 'authenticated');