-- Element Success Criteria & Gates System - Missing Tables
-- Creates only the missing tables (element_success_criteria already exists)

-- Quality gates tied to elements
CREATE TABLE IF NOT EXISTS element_quality_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_type TEXT NOT NULL CHECK (element_type IN ('app_feature', 'cli_command', 'shared_service', 'app', 'pipeline')),
  element_id UUID NOT NULL,
  gate_name TEXT NOT NULL,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('pre-commit', 'pre-merge', 'post-deploy', 'continuous', 'manual')),
  description TEXT,
  check_script TEXT,
  auto_check BOOLEAN DEFAULT false,
  is_blocking BOOLEAN DEFAULT true,
  order_sequence INTEGER DEFAULT 0,
  suggested_by TEXT DEFAULT 'user', -- 'system', 'user', 'ai'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(element_type, element_id, gate_name)
);

-- Templates for common criteria patterns
CREATE TABLE IF NOT EXISTS element_criteria_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  element_type TEXT NOT NULL CHECK (element_type IN ('app_feature', 'cli_command', 'shared_service', 'app', 'pipeline')),
  feature_type TEXT, -- 'page', 'component', 'hook', 'service', 'utility'
  criteria_set JSONB NOT NULL DEFAULT '[]', -- Array of criteria definitions
  gates_set JSONB NOT NULL DEFAULT '[]', -- Array of gate definitions
  description TEXT,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track which criteria/gates are inherited vs customized
CREATE TABLE IF NOT EXISTS task_criteria_inheritance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES dev_tasks(id) ON DELETE CASCADE,
  element_criteria_id UUID REFERENCES element_success_criteria(id) ON DELETE SET NULL,
  element_gate_id UUID REFERENCES element_quality_gates(id) ON DELETE SET NULL,
  is_inherited BOOLEAN DEFAULT true,
  is_modified BOOLEAN DEFAULT false,
  modifications JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_has_reference CHECK (element_criteria_id IS NOT NULL OR element_gate_id IS NOT NULL)
);

-- Add missing columns to element_success_criteria if they don't exist
DO $$
BEGIN
  -- Check and add parent_criteria_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'element_success_criteria' 
    AND column_name = 'parent_criteria_id'
  ) THEN
    ALTER TABLE element_success_criteria 
    ADD COLUMN parent_criteria_id UUID REFERENCES element_success_criteria(id) ON DELETE CASCADE;
  END IF;
  
  -- Check and add suggested_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'element_success_criteria' 
    AND column_name = 'suggested_by'
  ) THEN
    ALTER TABLE element_success_criteria 
    ADD COLUMN suggested_by TEXT DEFAULT 'user';
  END IF;
  
  -- Check and add is_template column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'element_success_criteria' 
    AND column_name = 'is_template'
  ) THEN
    ALTER TABLE element_success_criteria 
    ADD COLUMN is_template BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Indexes for performance (only create if they don't exist)
CREATE INDEX IF NOT EXISTS idx_element_quality_gates_element ON element_quality_gates(element_type, element_id);
CREATE INDEX IF NOT EXISTS idx_element_quality_gates_type ON element_quality_gates(gate_type);
CREATE INDEX IF NOT EXISTS idx_task_criteria_inheritance_task ON task_criteria_inheritance(task_id);

-- Enhanced view for element hierarchy with criteria counts
CREATE OR REPLACE VIEW element_hierarchy_view AS
SELECT 
  CASE 
    WHEN af.parent_feature_id IS NULL THEN 'page'
    ELSE 'feature'
  END as level_type,
  af.app_name,
  af.id as element_id,
  'app_feature' as element_type,
  af.feature_name as element_name,
  af.file_path,
  af.feature_type,
  af.parent_feature_id,
  paf.feature_name as parent_name,
  (SELECT COUNT(*) FROM element_success_criteria WHERE element_type = 'app_feature' AND element_id = af.id) as criteria_count,
  (SELECT COUNT(*) FROM element_quality_gates WHERE element_type = 'app_feature' AND element_id = af.id) as gates_count,
  (SELECT COUNT(*) FROM app_features WHERE parent_feature_id = af.id) as child_count
FROM app_features af
LEFT JOIN app_features paf ON af.parent_feature_id = paf.id;

-- View for all elements with criteria/gates counts
CREATE OR REPLACE VIEW elements_with_criteria_view AS
-- App features
SELECT 
  'app_feature' as element_type,
  af.id as element_id,
  af.app_name as category,
  af.feature_type as subcategory,
  af.feature_name as name,
  af.file_path as path,
  af.description,
  COUNT(DISTINCT esc.id) as criteria_count,
  COUNT(DISTINCT eqg.id) as gates_count,
  af.created_at
FROM app_features af
LEFT JOIN element_success_criteria esc ON esc.element_type = 'app_feature' AND esc.element_id = af.id
LEFT JOIN element_quality_gates eqg ON eqg.element_type = 'app_feature' AND eqg.element_id = af.id
GROUP BY af.id, af.app_name, af.feature_type, af.feature_name, af.file_path, af.description, af.created_at
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
  COUNT(DISTINCT esc.id) as criteria_count,
  COUNT(DISTINCT eqg.id) as gates_count,
  cd.created_at
FROM command_definitions cd
JOIN command_pipelines cp ON cd.pipeline_id = cp.id
LEFT JOIN element_success_criteria esc ON esc.element_type = 'cli_command' AND esc.element_id = cd.id
LEFT JOIN element_quality_gates eqg ON eqg.element_type = 'cli_command' AND eqg.element_id = cd.id
WHERE cd.status = 'active'
GROUP BY cd.id, cp.name, cp.display_name, cd.command_name, cp.script_path, cd.description, cd.created_at
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
  COUNT(DISTINCT esc.id) as criteria_count,
  COUNT(DISTINCT eqg.id) as gates_count,
  ss.created_at
FROM shared_services ss
LEFT JOIN element_success_criteria esc ON esc.element_type = 'shared_service' AND esc.element_id = ss.id
LEFT JOIN element_quality_gates eqg ON eqg.element_type = 'shared_service' AND eqg.element_id = ss.id
GROUP BY ss.id, ss.category, ss.service_name, ss.service_path, ss.description, ss.created_at;

-- Function to suggest criteria based on element type and characteristics
CREATE OR REPLACE FUNCTION suggest_element_criteria(
  p_element_type TEXT,
  p_element_id UUID,
  p_feature_type TEXT DEFAULT NULL
) RETURNS TABLE (
  title TEXT,
  description TEXT,
  success_condition TEXT,
  criteria_type TEXT,
  priority TEXT,
  validation_method TEXT
) AS $$
BEGIN
  -- First, try to find specific templates
  IF EXISTS (
    SELECT 1 FROM element_criteria_templates 
    WHERE element_type = p_element_type 
    AND (feature_type = p_feature_type OR feature_type IS NULL)
    AND is_active = true
  ) THEN
    RETURN QUERY
    SELECT 
      (criteria->>'title')::TEXT,
      (criteria->>'description')::TEXT,
      (criteria->>'success_condition')::TEXT,
      (criteria->>'criteria_type')::TEXT,
      (criteria->>'priority')::TEXT,
      (criteria->>'validation_method')::TEXT
    FROM element_criteria_templates,
    LATERAL jsonb_array_elements(criteria_set) AS criteria
    WHERE element_type = p_element_type 
    AND (feature_type = p_feature_type OR feature_type IS NULL)
    AND is_active = true
    ORDER BY use_count DESC, created_at DESC
    LIMIT 5;
  ELSE
    -- Return generic suggestions based on element type
    CASE p_element_type
      WHEN 'app_feature' THEN
        RETURN QUERY
        SELECT 
          'Renders without errors'::TEXT,
          'Component/page should render without throwing errors'::TEXT,
          'No console errors when component mounts'::TEXT,
          'functional'::TEXT,
          'high'::TEXT,
          'automated'::TEXT;
      WHEN 'cli_command' THEN
        RETURN QUERY
        SELECT 
          'Command executes successfully'::TEXT,
          'Command should complete without errors for valid inputs'::TEXT,
          'Exit code 0 for successful execution'::TEXT,
          'functional'::TEXT,
          'high'::TEXT,
          'automated'::TEXT;
      WHEN 'shared_service' THEN
        RETURN QUERY
        SELECT 
          'Service initializes correctly'::TEXT,
          'Service singleton should initialize without errors'::TEXT,
          'getInstance() returns valid instance'::TEXT,
          'functional'::TEXT,
          'high'::TEXT,
          'automated'::TEXT;
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to inherit criteria when creating a task
CREATE OR REPLACE FUNCTION inherit_element_criteria(
  p_task_id UUID,
  p_element_type TEXT,
  p_element_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_criteria RECORD;
  v_task_criteria_id UUID;
BEGIN
  -- Copy element criteria to task criteria
  FOR v_criteria IN 
    SELECT * FROM element_success_criteria 
    WHERE element_type = p_element_type 
    AND element_id = p_element_id 
    AND is_required = true
  LOOP
    -- Insert into dev_task_success_criteria
    INSERT INTO dev_task_success_criteria (
      task_id, title, description, success_condition,
      criteria_type, is_required, priority, validation_method
    ) VALUES (
      p_task_id,
      v_criteria.title,
      v_criteria.description,
      v_criteria.success_condition,
      v_criteria.criteria_type,
      v_criteria.is_required,
      v_criteria.priority,
      v_criteria.validation_method
    ) RETURNING id INTO v_task_criteria_id;
    
    -- Track inheritance
    INSERT INTO task_criteria_inheritance (
      task_id, element_criteria_id, is_inherited
    ) VALUES (
      p_task_id,
      v_criteria.id,
      true
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Also copy quality gates
  INSERT INTO dev_task_quality_gates (
    task_id, gate_name, gate_type, status
  )
  SELECT 
    p_task_id,
    gate_name,
    gate_type,
    'pending'
  FROM element_quality_gates
  WHERE element_type = p_element_type
    AND element_id = p_element_id
    AND is_blocking = true;
  
  -- Track gate inheritance
  INSERT INTO task_criteria_inheritance (
    task_id, element_gate_id, is_inherited
  )
  SELECT 
    p_task_id,
    id,
    true
  FROM element_quality_gates
  WHERE element_type = p_element_type
    AND element_id = p_element_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to populate default templates
CREATE OR REPLACE FUNCTION populate_default_criteria_templates() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- React Component Template
  INSERT INTO element_criteria_templates (template_name, element_type, feature_type, description, criteria_set, gates_set)
  VALUES (
    'React Component Standard',
    'app_feature',
    'component',
    'Standard criteria for React components',
    '[
      {"title": "Renders without errors", "criteria_type": "functional", "priority": "high", "success_condition": "Component renders without throwing errors", "validation_method": "automated"},
      {"title": "Props validation", "criteria_type": "functional", "priority": "medium", "success_condition": "All props are properly typed and validated", "validation_method": "automated"},
      {"title": "Responsive design", "criteria_type": "ux", "priority": "medium", "success_condition": "Component displays correctly on mobile and desktop", "validation_method": "manual"}
    ]'::jsonb,
    '[
      {"gate_name": "TypeScript check", "gate_type": "pre-commit", "description": "No TypeScript errors", "is_blocking": true},
      {"gate_name": "Component tests", "gate_type": "pre-merge", "description": "Unit tests pass", "is_blocking": true}
    ]'::jsonb
  ) ON CONFLICT (template_name) DO NOTHING;
  v_count := v_count + 1;

  -- Page Template
  INSERT INTO element_criteria_templates (template_name, element_type, feature_type, description, criteria_set, gates_set)
  VALUES (
    'Application Page Standard',
    'app_feature',
    'page',
    'Standard criteria for application pages',
    '[
      {"title": "Page loads successfully", "criteria_type": "functional", "priority": "high", "success_condition": "Page loads without errors", "validation_method": "automated"},
      {"title": "Navigation works", "criteria_type": "functional", "priority": "high", "success_condition": "All links and navigation elements function", "validation_method": "manual"},
      {"title": "Data loads correctly", "criteria_type": "functional", "priority": "high", "success_condition": "All data fetching completes successfully", "validation_method": "automated"},
      {"title": "Accessibility compliant", "criteria_type": "ux", "priority": "medium", "success_condition": "Page meets WCAG 2.1 AA standards", "validation_method": "automated"}
    ]'::jsonb,
    '[
      {"gate_name": "Route testing", "gate_type": "pre-merge", "description": "Page routing works correctly", "is_blocking": true},
      {"gate_name": "Performance check", "gate_type": "pre-merge", "description": "Page loads within 3 seconds", "is_blocking": false}
    ]'::jsonb
  ) ON CONFLICT (template_name) DO NOTHING;
  v_count := v_count + 1;

  -- CLI Command Template
  INSERT INTO element_criteria_templates (template_name, element_type, feature_type, description, criteria_set, gates_set)
  VALUES (
    'CLI Command Standard',
    'cli_command',
    NULL,
    'Standard criteria for CLI commands',
    '[
      {"title": "Command executes", "criteria_type": "functional", "priority": "high", "success_condition": "Command runs without errors", "validation_method": "automated"},
      {"title": "Help text available", "criteria_type": "documentation", "priority": "medium", "success_condition": "Command has --help documentation", "validation_method": "automated"},
      {"title": "Error handling", "criteria_type": "functional", "priority": "high", "success_condition": "Graceful error messages for invalid inputs", "validation_method": "manual"},
      {"title": "Command tracking", "criteria_type": "integration", "priority": "low", "success_condition": "Command usage is tracked", "validation_method": "automated"}
    ]'::jsonb,
    '[
      {"gate_name": "Dry run test", "gate_type": "pre-commit", "description": "Command supports --dry-run", "is_blocking": false},
      {"gate_name": "Integration test", "gate_type": "pre-merge", "description": "Command works with real data", "is_blocking": true}
    ]'::jsonb
  ) ON CONFLICT (template_name) DO NOTHING;
  v_count := v_count + 1;

  -- Service Template
  INSERT INTO element_criteria_templates (template_name, element_type, feature_type, description, criteria_set, gates_set)
  VALUES (
    'Shared Service Standard',
    'shared_service',
    NULL,
    'Standard criteria for shared services',
    '[
      {"title": "Singleton pattern", "criteria_type": "functional", "priority": "high", "success_condition": "Service implements singleton pattern correctly", "validation_method": "automated"},
      {"title": "Error handling", "criteria_type": "functional", "priority": "high", "success_condition": "All methods handle errors gracefully", "validation_method": "automated"},
      {"title": "Type safety", "criteria_type": "functional", "priority": "high", "success_condition": "All methods have proper TypeScript types", "validation_method": "automated"},
      {"title": "Cross-environment", "criteria_type": "integration", "priority": "medium", "success_condition": "Works in both Node and browser environments", "validation_method": "manual"}
    ]'::jsonb,
    '[
      {"gate_name": "Unit tests", "gate_type": "pre-merge", "description": "Service has >80% test coverage", "is_blocking": true},
      {"gate_name": "API stability", "gate_type": "pre-merge", "description": "No breaking changes to public API", "is_blocking": true}
    ]'::jsonb
  ) ON CONFLICT (template_name) DO NOTHING;
  v_count := v_count + 1;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE element_quality_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE element_criteria_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_criteria_inheritance ENABLE ROW LEVEL SECURITY;

-- Read access for all
CREATE POLICY "element_quality_gates_read_all" ON element_quality_gates
  FOR SELECT USING (true);
CREATE POLICY "element_criteria_templates_read_all" ON element_criteria_templates
  FOR SELECT USING (true);
CREATE POLICY "task_criteria_inheritance_read_all" ON task_criteria_inheritance
  FOR SELECT USING (true);

-- Write access for authenticated users
CREATE POLICY "element_quality_gates_write_authenticated" ON element_quality_gates
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "element_criteria_templates_write_authenticated" ON element_criteria_templates
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "task_criteria_inheritance_write_authenticated" ON task_criteria_inheritance
  FOR ALL USING (auth.role() = 'authenticated');

-- Populate default templates
SELECT populate_default_criteria_templates();

-- Add comments for clarity
COMMENT ON TABLE element_quality_gates IS 'Quality gates that must be passed for elements';
COMMENT ON TABLE element_criteria_templates IS 'Templates for common criteria patterns';
COMMENT ON TABLE task_criteria_inheritance IS 'Tracks which task criteria are inherited from elements vs custom';
COMMENT ON VIEW element_hierarchy_view IS 'Hierarchical view of app features with criteria/gates counts';
COMMENT ON VIEW elements_with_criteria_view IS 'All elements with their criteria and gates counts';