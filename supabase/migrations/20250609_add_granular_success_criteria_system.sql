-- Granular Success Criteria System
-- Migration: 20250609_add_granular_success_criteria_system.sql
-- Purpose: Track success criteria at element level (app pages, features, CLI commands, services)

-- ================================================================
-- SECTION 1: App UI Tracking
-- ================================================================

-- Track major UI pages in each app
CREATE TABLE IF NOT EXISTS app_ui_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name VARCHAR(100) NOT NULL,
    page_name VARCHAR(100) NOT NULL,
    page_path VARCHAR(200), -- e.g., '/tasks', '/worktree-mappings'
    description TEXT,
    primary_service VARCHAR(100), -- Main service this page uses
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(app_name, page_name)
);

-- Track distinctive features within pages
CREATE TABLE IF NOT EXISTS app_page_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES app_ui_pages(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    feature_type VARCHAR(50), -- 'component', 'action', 'display', 'integration'
    description TEXT,
    service_dependencies TEXT[], -- Array of services used
    is_critical BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- SECTION 2: CLI Pipeline Enhancements
-- ================================================================

-- Add ordering and usage tracking to command definitions
ALTER TABLE command_definitions 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_frequency INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS typical_sequence INTEGER; -- Order in typical workflow

-- ================================================================
-- SECTION 3: Element Success Criteria Mapping
-- ================================================================

-- Generic element success criteria
CREATE TABLE IF NOT EXISTS element_success_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type VARCHAR(50) NOT NULL, -- 'app_page', 'app_feature', 'cli_command', 'service'
    element_id UUID NOT NULL, -- References the specific element
    criteria_title VARCHAR(200) NOT NULL,
    criteria_description TEXT,
    validation_type VARCHAR(50), -- 'manual', 'automated', 'visual', 'functional'
    is_required BOOLEAN DEFAULT true,
    suggested_by VARCHAR(50) DEFAULT 'system', -- 'system', 'ai', 'user'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Template library for common criteria
CREATE TABLE IF NOT EXISTS success_criteria_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    criteria_set JSONB NOT NULL, -- Array of criteria objects
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link dev tasks to specific elements
CREATE TABLE IF NOT EXISTS dev_task_element_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL,
    element_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ================================================================
-- SECTION 4: Indexes for Performance
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_app_ui_pages_app_name ON app_ui_pages(app_name);
CREATE INDEX IF NOT EXISTS idx_app_page_features_page_id ON app_page_features(page_id);
CREATE INDEX IF NOT EXISTS idx_element_success_criteria_element ON element_success_criteria(element_type, element_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_element_links_task ON dev_task_element_links(task_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_element_links_element ON dev_task_element_links(element_type, element_id);

-- ================================================================
-- SECTION 5: Comprehensive Views
-- ================================================================

-- View for app hierarchy with criteria counts
CREATE OR REPLACE VIEW app_hierarchy_view AS
SELECT 
    p.id as page_id,
    p.app_name,
    p.page_name,
    p.page_path,
    p.description as page_description,
    p.primary_service,
    COUNT(DISTINCT f.id) as feature_count,
    COUNT(DISTINCT CASE WHEN f.is_critical THEN f.id END) as critical_feature_count,
    COUNT(DISTINCT esc_page.id) as page_criteria_count,
    COUNT(DISTINCT esc_feature.id) as feature_criteria_count
FROM app_ui_pages p
LEFT JOIN app_page_features f ON p.id = f.page_id
LEFT JOIN element_success_criteria esc_page 
    ON esc_page.element_type = 'app_page' AND esc_page.element_id = p.id
LEFT JOIN element_success_criteria esc_feature 
    ON esc_feature.element_type = 'app_feature' AND esc_feature.element_id = f.id
GROUP BY p.id, p.app_name, p.page_name, p.page_path, p.description, p.primary_service;

-- View for CLI commands with ordering
CREATE OR REPLACE VIEW cli_commands_ordered_view AS
SELECT 
    cd.id,
    cd.command_name,
    cd.description,
    cp.name as pipeline_name,
    cd.display_order,
    cd.typical_sequence,
    cd.usage_frequency,
    COUNT(esc.id) as criteria_count
FROM command_definitions cd
JOIN command_pipelines cp ON cd.pipeline_id = cp.id
LEFT JOIN element_success_criteria esc 
    ON esc.element_type = 'cli_command' AND esc.element_id = cd.id
WHERE cp.status = 'active'
GROUP BY cd.id, cd.command_name, cd.description, cp.name, 
         cd.display_order, cd.typical_sequence, cd.usage_frequency
ORDER BY cp.name, COALESCE(cd.typical_sequence, cd.display_order, 999);

-- View for task elements with criteria
CREATE OR REPLACE VIEW dev_task_elements_view AS
SELECT 
    dt.id as task_id,
    dt.title as task_title,
    dtel.element_type,
    dtel.element_id,
    CASE 
        WHEN dtel.element_type = 'app_page' THEN p.page_name
        WHEN dtel.element_type = 'app_feature' THEN f.feature_name
        WHEN dtel.element_type = 'cli_command' THEN cd.command_name
        WHEN dtel.element_type = 'service' THEN ss.service_name
    END as element_name,
    COUNT(esc.id) as element_criteria_count,
    COUNT(dtsc.id) as task_criteria_count
FROM dev_tasks dt
LEFT JOIN dev_task_element_links dtel ON dt.id = dtel.task_id
LEFT JOIN app_ui_pages p ON dtel.element_type = 'app_page' AND dtel.element_id = p.id
LEFT JOIN app_page_features f ON dtel.element_type = 'app_feature' AND dtel.element_id = f.id
LEFT JOIN command_definitions cd ON dtel.element_type = 'cli_command' AND dtel.element_id = cd.id
LEFT JOIN shared_services ss ON dtel.element_type = 'service' AND dtel.element_id = ss.id
LEFT JOIN element_success_criteria esc ON esc.element_type = dtel.element_type AND esc.element_id = dtel.element_id
LEFT JOIN dev_task_success_criteria dtsc ON dtsc.task_id = dt.id
GROUP BY dt.id, dt.title, dtel.element_type, dtel.element_id, p.page_name, f.feature_name, cd.command_name, ss.service_name;

-- ================================================================
-- SECTION 6: RLS Policies
-- ================================================================

ALTER TABLE app_ui_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_page_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE element_success_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_criteria_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_element_links ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Enable read access for all users" ON app_ui_pages FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON app_ui_pages FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON app_page_features FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON app_page_features FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON element_success_criteria FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON element_success_criteria FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON success_criteria_templates FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON success_criteria_templates FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON dev_task_element_links FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON dev_task_element_links FOR ALL USING (true);

-- ================================================================
-- SECTION 7: Initial Data Population
-- ================================================================

-- Sample app UI pages for dhg-admin-code
INSERT INTO app_ui_pages (app_name, page_name, page_path, description, primary_service) VALUES
('dhg-admin-code', 'Claude Tasks', '/tasks', 'Main task management interface', 'task-service'),
('dhg-admin-code', 'Work Summaries', '/work-summaries', 'AI work summary tracking', 'supabase-client'),
('dhg-admin-code', 'Worktree Mappings', '/worktree-mappings', 'Worktree assignment management', 'worktree-service'),
('dhg-admin-code', 'Continuously Updated', '/continuously-updated', 'Living documentation viewer', 'documentation-service')
ON CONFLICT (app_name, page_name) DO NOTHING;

-- Sample criteria template
INSERT INTO success_criteria_templates (template_name, element_type, criteria_set, description) VALUES
('Basic UI Page Criteria', 'app_page', '[
  {
    "title": "Page loads without errors",
    "description": "Page renders successfully with no console errors",
    "validation_type": "automated",
    "is_required": true
  },
  {
    "title": "Data displays correctly",
    "description": "All expected data is visible and formatted properly",
    "validation_type": "visual",
    "is_required": true
  },
  {
    "title": "User interactions work",
    "description": "Buttons, forms, and other interactive elements function",
    "validation_type": "functional",
    "is_required": true
  }
]'::jsonb, 'Standard criteria for UI pages');

-- Add tracking entry to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
('public', 'app_ui_pages', 'Tracks major UI pages within applications', 'Granular success criteria system', CURRENT_DATE),
('public', 'app_page_features', 'Tracks distinctive features within app pages', 'Granular success criteria system', CURRENT_DATE),
('public', 'element_success_criteria', 'Maps success criteria to specific elements', 'Granular success criteria system', CURRENT_DATE),
('public', 'success_criteria_templates', 'Library of reusable success criteria', 'Granular success criteria system', CURRENT_DATE),
('public', 'dev_task_element_links', 'Links dev tasks to specific elements', 'Granular success criteria system', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;