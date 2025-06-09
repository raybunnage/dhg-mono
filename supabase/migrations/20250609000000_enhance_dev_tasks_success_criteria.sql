-- Enhanced Dev Tasks Success Criteria Framework
-- Migration: 20250609000000_enhance_dev_tasks_success_criteria.sql

-- Add enhanced columns to existing dev_tasks table
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS success_criteria_defined BOOLEAN DEFAULT false;
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS quality_gates_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS completion_confidence INTEGER CHECK (completion_confidence BETWEEN 1 AND 10);
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS risk_assessment VARCHAR(20) DEFAULT 'low';
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS current_lifecycle_stage VARCHAR(50) DEFAULT 'planning';
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS success_criteria_count INTEGER DEFAULT 0;
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS success_criteria_met INTEGER DEFAULT 0;

-- Create success criteria table
CREATE TABLE IF NOT EXISTS dev_task_success_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
    criteria_type VARCHAR(50) NOT NULL, -- 'functional', 'technical', 'quality', 'testing'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    validation_method VARCHAR(50), -- 'manual', 'automated', 'code_review', 'testing'
    validation_script TEXT, -- Command or script to run for validation
    success_condition TEXT, -- Expected outcome or result
    priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create validations tracking table
CREATE TABLE IF NOT EXISTS dev_task_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
    criteria_id UUID REFERENCES dev_task_success_criteria(id) ON DELETE CASCADE,
    validation_status VARCHAR(20) NOT NULL, -- 'pending', 'passed', 'failed', 'skipped'
    validated_by VARCHAR(100), -- 'system', 'claude', 'user', 'automated'
    validation_result TEXT,
    validation_evidence TEXT, -- Screenshots, logs, test results
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 10),
    validated_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- Create quality gates table
CREATE TABLE IF NOT EXISTS dev_task_quality_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
    gate_type VARCHAR(50) NOT NULL, -- 'typescript', 'lint', 'tests', 'code_review'
    gate_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'passed', 'failed', 'bypassed'
    result_data JSONB,
    checked_at TIMESTAMP,
    error_details TEXT,
    bypass_reason TEXT
);

-- Create lifecycle stages table
CREATE TABLE IF NOT EXISTS dev_task_lifecycle_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
    stage_name VARCHAR(50) NOT NULL,
    stage_status VARCHAR(20) NOT NULL, -- 'pending', 'active', 'completed', 'blocked'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 10),
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    notes TEXT,
    automated_checks JSONB
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dev_task_success_criteria_task_id ON dev_task_success_criteria(task_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_validations_task_id ON dev_task_validations(task_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_validations_criteria_id ON dev_task_validations(criteria_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_quality_gates_task_id ON dev_task_quality_gates(task_id);
CREATE INDEX IF NOT EXISTS idx_dev_task_lifecycle_stages_task_id ON dev_task_lifecycle_stages(task_id);

-- Create comprehensive view for enhanced task status
CREATE OR REPLACE VIEW dev_tasks_enhanced_view AS
SELECT 
    dt.*,
    -- Success criteria summary
    COALESCE(sc.criteria_count, 0) as criteria_count,
    COALESCE(sc.criteria_met, 0) as criteria_met,
    CASE 
        WHEN COALESCE(sc.criteria_count, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(sc.criteria_met, 0)::DECIMAL / sc.criteria_count) * 100, 1)
    END as criteria_completion_percentage,
    
    -- Quality gates summary
    COALESCE(qg.total_gates, 0) as total_quality_gates,
    COALESCE(qg.passed_gates, 0) as passed_quality_gates,
    COALESCE(qg.failed_gates, 0) as failed_quality_gates,
    
    -- Lifecycle stage info
    ls.current_stage_name,
    ls.current_stage_status,
    ls.current_stage_confidence,
    ls.current_stage_risk,
    
    -- Overall completion score
    CASE 
        WHEN dt.status = 'completed' THEN 100
        WHEN COALESCE(sc.criteria_count, 0) = 0 THEN 
            CASE dt.status 
                WHEN 'pending' THEN 0
                WHEN 'in_progress' THEN 25
                WHEN 'testing' THEN 50
                WHEN 'revision' THEN 40
                ELSE 10
            END
        ELSE 
            GREATEST(0, LEAST(95, 
                (COALESCE(sc.criteria_met, 0)::DECIMAL / sc.criteria_count) * 80 + 
                (COALESCE(qg.passed_gates, 0)::DECIMAL / GREATEST(1, COALESCE(qg.total_gates, 1))) * 15 +
                COALESCE(dt.completion_confidence, 5)
            ))
    END as overall_completion_score

FROM dev_tasks dt
LEFT JOIN (
    -- Success criteria aggregation
    SELECT 
        task_id,
        COUNT(*) as criteria_count,
        COUNT(CASE WHEN v.validation_status = 'passed' THEN 1 END) as criteria_met
    FROM dev_task_success_criteria sc
    LEFT JOIN dev_task_validations v ON sc.id = v.criteria_id 
    GROUP BY task_id
) sc ON dt.id = sc.task_id
LEFT JOIN (
    -- Quality gates aggregation
    SELECT 
        task_id,
        COUNT(*) as total_gates,
        COUNT(CASE WHEN status = 'passed' THEN 1 END) as passed_gates,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_gates
    FROM dev_task_quality_gates
    GROUP BY task_id
) qg ON dt.id = qg.task_id
LEFT JOIN (
    -- Current lifecycle stage
    SELECT DISTINCT ON (task_id)
        task_id,
        stage_name as current_stage_name,
        stage_status as current_stage_status,
        confidence_score as current_stage_confidence,
        risk_level as current_stage_risk
    FROM dev_task_lifecycle_stages
    WHERE stage_status = 'active' OR stage_status = 'completed'
    ORDER BY task_id, completed_at DESC NULLS FIRST, started_at DESC
) ls ON dt.id = ls.task_id;

-- Create function to update success criteria counts
CREATE OR REPLACE FUNCTION update_task_success_criteria_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the task's criteria counts
    UPDATE dev_tasks 
    SET 
        success_criteria_count = (
            SELECT COUNT(*) 
            FROM dev_task_success_criteria 
            WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
        ),
        success_criteria_met = (
            SELECT COUNT(DISTINCT sc.id)
            FROM dev_task_success_criteria sc
            JOIN dev_task_validations v ON sc.id = v.criteria_id
            WHERE sc.task_id = COALESCE(NEW.task_id, OLD.task_id)
            AND v.validation_status = 'passed'
        )
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to maintain counts
CREATE TRIGGER trigger_update_success_criteria_counts_on_criteria
    AFTER INSERT OR UPDATE OR DELETE ON dev_task_success_criteria
    FOR EACH ROW EXECUTE FUNCTION update_task_success_criteria_counts();

CREATE TRIGGER trigger_update_success_criteria_counts_on_validations
    AFTER INSERT OR UPDATE OR DELETE ON dev_task_validations
    FOR EACH ROW EXECUTE FUNCTION update_task_success_criteria_counts();

-- RLS Policies
ALTER TABLE dev_task_success_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_quality_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_task_lifecycle_stages ENABLE ROW LEVEL SECURITY;

-- Allow public access for development (can be restricted later)
CREATE POLICY "Enable read access for all users" ON dev_task_success_criteria FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON dev_task_success_criteria FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON dev_task_validations FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON dev_task_validations FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON dev_task_quality_gates FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON dev_task_quality_gates FOR ALL USING (true);

CREATE POLICY "Enable read access for all users" ON dev_task_lifecycle_stages FOR SELECT USING (true);
CREATE POLICY "Enable write access for all users" ON dev_task_lifecycle_stages FOR ALL USING (true);

-- Insert initial lifecycle stages for existing tasks
INSERT INTO dev_task_lifecycle_stages (task_id, stage_name, stage_status, started_at, confidence_score)
SELECT 
    id as task_id,
    CASE 
        WHEN status = 'pending' THEN 'planning'
        WHEN status = 'in_progress' THEN 'development'
        WHEN status = 'testing' THEN 'testing'
        WHEN status = 'revision' THEN 'review'
        WHEN status = 'completed' THEN 'completed'
        ELSE 'planning'
    END as stage_name,
    CASE 
        WHEN status = 'completed' THEN 'completed'
        ELSE 'active'
    END as stage_status,
    created_at as started_at,
    CASE 
        WHEN status = 'completed' THEN 9
        WHEN status = 'testing' THEN 7
        WHEN status = 'in_progress' THEN 5
        ELSE 3
    END as confidence_score
FROM dev_tasks
WHERE NOT EXISTS (
    SELECT 1 FROM dev_task_lifecycle_stages 
    WHERE dev_task_lifecycle_stages.task_id = dev_tasks.id
);

-- Update task lifecycle stage references
UPDATE dev_tasks 
SET current_lifecycle_stage = CASE 
    WHEN status = 'pending' THEN 'planning'
    WHEN status = 'in_progress' THEN 'development'
    WHEN status = 'testing' THEN 'testing'
    WHEN status = 'revision' THEN 'review'
    WHEN status = 'completed' THEN 'completed'
    ELSE 'planning'
END
WHERE current_lifecycle_stage = 'planning';