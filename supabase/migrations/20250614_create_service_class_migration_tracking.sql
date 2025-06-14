-- Migration tracking for service class architecture refactoring

-- Add columns to sys_shared_services for tracking migration
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS base_class_type VARCHAR(50) CHECK (base_class_type IN (
  'SingletonService',
  'BusinessService', 
  'AdapterService',
  'HybridService',
  'BaseService',
  'Legacy'
)),
ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'pending' CHECK (migration_status IN (
  'pending',
  'in_progress',
  'testing',
  'completed',
  'rolled_back'
)),
ADD COLUMN IF NOT EXISTS migration_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS migration_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS migration_notes TEXT,
ADD COLUMN IF NOT EXISTS performance_baseline JSONB,
ADD COLUMN IF NOT EXISTS performance_after JSONB,
ADD COLUMN IF NOT EXISTS breaking_changes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS backwards_compatible BOOLEAN DEFAULT true;

-- Create service migration tasks table
CREATE TABLE IF NOT EXISTS sys_service_migration_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES sys_shared_services(id),
  task_type VARCHAR(50) NOT NULL CHECK (task_type IN (
    'create_base_class',
    'implement_interfaces',
    'migrate_logic',
    'add_tests',
    'update_documentation',
    'performance_test',
    'integration_test',
    'deprecate_old',
    'remove_old'
  )),
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to VARCHAR(255),
  checklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT
);

-- Create migration checklist template
CREATE TABLE IF NOT EXISTS sys_service_migration_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_class_type VARCHAR(50) NOT NULL,
  checklist_items JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default checklists for each service type
INSERT INTO sys_service_migration_checklist (base_class_type, checklist_items) VALUES
('SingletonService', '[
  {"item": "Implement getInstance() pattern", "required": true},
  {"item": "Add resource cleanup in releaseResources()", "required": true},
  {"item": "Ensure thread-safe initialization", "required": true},
  {"item": "Add health check implementation", "required": true},
  {"item": "Test singleton behavior", "required": true},
  {"item": "Verify no memory leaks", "required": false}
]'::jsonb),
('BusinessService', '[
  {"item": "Define service dependencies interface", "required": true},
  {"item": "Implement validateDependencies()", "required": true},
  {"item": "Add transaction support where needed", "required": false},
  {"item": "Implement business methods", "required": true},
  {"item": "Add unit tests with mocked dependencies", "required": true},
  {"item": "Document dependency requirements", "required": true}
]'::jsonb),
('AdapterService', '[
  {"item": "Define config interface", "required": true},
  {"item": "Implement validateConfig()", "required": true},
  {"item": "Implement createClient()", "required": true},
  {"item": "Add retry logic for external calls", "required": false},
  {"item": "Handle environment-specific config", "required": true},
  {"item": "Test with different environments", "required": true}
]'::jsonb);

-- Create view for migration progress
CREATE OR REPLACE VIEW sys_service_migration_progress_view AS
SELECT 
  s.service_name,
  s.service_type,
  s.base_class_type,
  s.migration_status,
  s.migration_started_at,
  s.migration_completed_at,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  ROUND(
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END)::numeric / 
    NULLIF(COUNT(DISTINCT t.id), 0) * 100, 
    2
  ) as progress_percentage,
  s.breaking_changes,
  s.backwards_compatible
FROM sys_shared_services s
LEFT JOIN sys_service_migration_tasks t ON s.id = t.service_id
WHERE s.migration_status != 'pending'
GROUP BY s.id, s.service_name, s.service_type, s.base_class_type, 
         s.migration_status, s.migration_started_at, s.migration_completed_at,
         s.breaking_changes, s.backwards_compatible;

-- Create function to start service migration
CREATE OR REPLACE FUNCTION start_service_migration(
  p_service_name TEXT,
  p_base_class_type TEXT
) RETURNS UUID AS $$
DECLARE
  v_service_id UUID;
  v_checklist JSONB;
  v_task_id UUID;
BEGIN
  -- Get service ID
  SELECT id INTO v_service_id 
  FROM sys_shared_services 
  WHERE service_name = p_service_name;
  
  IF v_service_id IS NULL THEN
    RAISE EXCEPTION 'Service % not found', p_service_name;
  END IF;
  
  -- Update service record
  UPDATE sys_shared_services 
  SET 
    base_class_type = p_base_class_type,
    migration_status = 'in_progress',
    migration_started_at = CURRENT_TIMESTAMP
  WHERE id = v_service_id;
  
  -- Get checklist for this base class type
  SELECT checklist_items INTO v_checklist
  FROM sys_service_migration_checklist
  WHERE base_class_type = p_base_class_type;
  
  -- Create migration tasks based on service type
  -- Common tasks for all services
  INSERT INTO sys_service_migration_tasks (service_id, task_type, checklist)
  VALUES 
    (v_service_id, 'create_base_class', v_checklist),
    (v_service_id, 'implement_interfaces', '[]'::jsonb),
    (v_service_id, 'migrate_logic', '[]'::jsonb),
    (v_service_id, 'add_tests', '[]'::jsonb),
    (v_service_id, 'update_documentation', '[]'::jsonb),
    (v_service_id, 'performance_test', '[]'::jsonb),
    (v_service_id, 'integration_test', '[]'::jsonb);
  
  RETURN v_service_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to track migration metrics
CREATE OR REPLACE FUNCTION record_migration_metrics(
  p_service_name TEXT,
  p_metric_type TEXT, -- 'baseline' or 'after'
  p_metrics JSONB
) RETURNS VOID AS $$
DECLARE
  v_column_name TEXT;
BEGIN
  IF p_metric_type = 'baseline' THEN
    v_column_name := 'performance_baseline';
  ELSIF p_metric_type = 'after' THEN
    v_column_name := 'performance_after';
  ELSE
    RAISE EXCEPTION 'Invalid metric type: %', p_metric_type;
  END IF;
  
  EXECUTE format(
    'UPDATE sys_shared_services SET %I = $1 WHERE service_name = $2',
    v_column_name
  ) USING p_metrics, p_service_name;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE sys_service_migration_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_service_migration_checklist ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON sys_service_migration_tasks
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON sys_service_migration_checklist
  FOR SELECT USING (true);

-- Authenticated write access
CREATE POLICY "Authenticated write access" ON sys_service_migration_tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- Initial data for pilot services
UPDATE sys_shared_services 
SET base_class_type = 'Legacy', migration_status = 'pending'
WHERE service_name IN ('SupabaseClientService', 'SupabaseService', 'createSupabaseAdapter');

COMMENT ON TABLE sys_service_migration_tasks IS 'Tracks individual tasks for migrating services to new base class architecture';
COMMENT ON VIEW sys_service_migration_progress_view IS 'Shows progress of service migrations to new architecture';