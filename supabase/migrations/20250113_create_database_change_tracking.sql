-- Create a system for tracking database changes and required actions
-- This enables continuous monitoring and automatic maintenance

-- Table to track database change events
CREATE TABLE IF NOT EXISTS sys_database_change_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'table_created',
    'table_modified',
    'view_created',
    'view_modified',
    'function_created',
    'migration_applied'
  )),
  object_schema TEXT NOT NULL DEFAULT 'public',
  object_name TEXT NOT NULL,
  object_type TEXT CHECK (object_type IN ('table', 'view', 'function', 'trigger')),
  change_details JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to define automated actions for database changes
CREATE TABLE IF NOT EXISTS sys_database_maintenance_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT,
  event_type TEXT NOT NULL,
  object_type TEXT,
  condition_sql TEXT, -- Optional SQL to check if rule applies
  actions JSONB NOT NULL DEFAULT '[]', -- Array of actions to take
  priority INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track action execution
CREATE TABLE IF NOT EXISTS sys_maintenance_action_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES sys_database_change_events(id),
  rule_id UUID REFERENCES sys_database_maintenance_rules(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default maintenance rules
INSERT INTO sys_database_maintenance_rules (rule_name, description, event_type, object_type, actions) VALUES
-- RLS Policy Creation
('apply_rls_policies', 
 'Apply standard RLS policies to new tables', 
 'table_created', 
 'table',
 '[
   {"type": "create_rls_policy", "policy": "public_read"},
   {"type": "create_rls_policy", "policy": "authenticated_write"}
 ]'::jsonb
),

-- Table Definition Updates
('update_table_definitions',
 'Update sys_table_definitions when tables are created',
 'table_created',
 'table',
 '[
   {"type": "update_table_definitions"},
   {"type": "extract_table_prefix"},
   {"type": "check_naming_convention"}
 ]'::jsonb
),

-- View Naming Validation
('validate_view_naming',
 'Ensure views follow naming conventions',
 'view_created',
 'view',
 '[
   {"type": "validate_view_suffix"},
   {"type": "validate_view_prefix"},
   {"type": "update_view_definitions"}
 ]'::jsonb
),

-- Service Registration Check
('check_service_tables',
 'Check if new tables need service registration',
 'table_created',
 'table',
 '[
   {"type": "check_service_pattern"},
   {"type": "suggest_service_creation"}
 ]'::jsonb
);

-- Function to detect database changes
CREATE OR REPLACE FUNCTION sys_detect_database_changes()
RETURNS TABLE (
  change_type TEXT,
  object_name TEXT,
  details JSONB
) AS $$
DECLARE
  v_last_check TIMESTAMPTZ;
BEGIN
  -- Get last check time
  SELECT MAX(detected_at) INTO v_last_check 
  FROM sys_database_change_events;
  
  -- Default to 24 hours ago if no previous checks
  v_last_check := COALESCE(v_last_check, NOW() - INTERVAL '24 hours');
  
  -- Check for new tables
  RETURN QUERY
  SELECT 
    'table_created'::TEXT,
    t.table_name::TEXT,
    jsonb_build_object(
      'schema', t.table_schema,
      'created_approximate', NOW()
    )
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
      SELECT 1 FROM sys_table_definitions std
      WHERE std.table_name = t.table_name
    );
    
  -- Check for new views
  RETURN QUERY
  SELECT 
    'view_created'::TEXT,
    v.table_name::TEXT,
    jsonb_build_object(
      'schema', v.table_schema,
      'created_approximate', NOW()
    )
  FROM information_schema.views v
  WHERE v.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM sys_table_definitions std
      WHERE std.table_name = v.table_name
      AND std.table_type = 'VIEW'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to process maintenance rules
CREATE OR REPLACE FUNCTION sys_process_maintenance_rules()
RETURNS VOID AS $$
DECLARE
  v_event RECORD;
  v_rule RECORD;
  v_action JSONB;
BEGIN
  -- Process unprocessed events
  FOR v_event IN 
    SELECT * FROM sys_database_change_events 
    WHERE NOT processed 
    ORDER BY detected_at
  LOOP
    -- Find applicable rules
    FOR v_rule IN
      SELECT * FROM sys_database_maintenance_rules
      WHERE active 
        AND event_type = v_event.event_type
        AND (object_type IS NULL OR object_type = v_event.object_type)
      ORDER BY priority DESC
    LOOP
      -- Log each action
      FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions)
      LOOP
        INSERT INTO sys_maintenance_action_log (
          event_id, rule_id, action_type, action_details, status
        ) VALUES (
          v_event.id, v_rule.id, v_action->>'type', v_action, 'pending'
        );
      END LOOP;
    END LOOP;
    
    -- Mark event as processed
    UPDATE sys_database_change_events 
    SET processed = true, processed_at = NOW()
    WHERE id = v_event.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- View to show pending maintenance actions
CREATE OR REPLACE VIEW sys_pending_maintenance_actions_view AS
SELECT 
  dce.object_name,
  dce.event_type,
  dmr.rule_name,
  mal.action_type,
  mal.action_details,
  mal.created_at
FROM sys_maintenance_action_log mal
JOIN sys_database_change_events dce ON dce.id = mal.event_id
JOIN sys_database_maintenance_rules dmr ON dmr.id = mal.rule_id
WHERE mal.status = 'pending'
ORDER BY mal.created_at;

-- View to show recent database changes
CREATE OR REPLACE VIEW sys_recent_database_changes_view AS
SELECT 
  event_type,
  object_name,
  object_type,
  change_details,
  detected_at,
  processed,
  CASE 
    WHEN NOT processed THEN 'needs-processing'
    ELSE 'processed'
  END as status
FROM sys_database_change_events
WHERE detected_at > NOW() - INTERVAL '7 days'
ORDER BY detected_at DESC;

-- Add RLS policies
ALTER TABLE sys_database_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_database_maintenance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_maintenance_action_log ENABLE ROW LEVEL SECURITY;

-- Public read for all tables
CREATE POLICY "Public read access" ON sys_database_change_events FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sys_database_maintenance_rules FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sys_maintenance_action_log FOR SELECT USING (true);

-- Authenticated users can insert events
CREATE POLICY "Authenticated insert" ON sys_database_change_events 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can manage rules (temporarily open, should be restricted to admins later)
CREATE POLICY "Authenticated manage rules" ON sys_database_maintenance_rules
  FOR ALL USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE sys_database_change_events IS 'Tracks all database schema changes for automated maintenance';
COMMENT ON TABLE sys_database_maintenance_rules IS 'Defines automated actions to take when database changes occur';
COMMENT ON TABLE sys_maintenance_action_log IS 'Log of all maintenance actions performed';