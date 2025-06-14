-- Add fields to sys_shared_services for tracking service usage metrics and consolidation potential
-- This supports both one-time analysis and continuous monitoring

-- Add usage metrics
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS last_usage_scan TIMESTAMPTZ;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS usage_locations JSONB DEFAULT '{"apps": [], "pipelines": [], "proxyServers": [], "services": []}'::jsonb;

-- Add service health/status fields
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS service_health TEXT CHECK (service_health IN ('essential', 'active', 'low-usage', 'deprecated', 'duplicate'));
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS consolidation_candidate BOOLEAN DEFAULT false;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS overlaps_with TEXT[]; -- Array of service names this might overlap with
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100);

-- Add maintenance recommendation
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS maintenance_recommendation TEXT CHECK (maintenance_recommendation IN (
  'keep-as-is', 
  'needs-refactoring', 
  'consider-consolidation', 
  'mark-deprecated', 
  'remove-unused'
));

-- Add continuous monitoring fields
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS scan_frequency TEXT DEFAULT 'weekly' CHECK (scan_frequency IN ('daily', 'weekly', 'monthly', 'manual'));
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS next_scan_date DATE DEFAULT CURRENT_DATE + INTERVAL '7 days';
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS usage_trend TEXT CHECK (usage_trend IN ('increasing', 'stable', 'decreasing', 'new'));
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS usage_history JSONB DEFAULT '[]'::jsonb; -- Array of {date, count, locations}

-- Update descriptions
COMMENT ON COLUMN sys_shared_services.usage_count IS 'Total number of references found across codebase';
COMMENT ON COLUMN sys_shared_services.last_usage_scan IS 'Timestamp of last usage analysis';
COMMENT ON COLUMN sys_shared_services.usage_locations IS 'Detailed breakdown of where service is used';
COMMENT ON COLUMN sys_shared_services.service_health IS 'Health status based on usage patterns';
COMMENT ON COLUMN sys_shared_services.consolidation_candidate IS 'Whether this service should be considered for consolidation';
COMMENT ON COLUMN sys_shared_services.overlaps_with IS 'Other services with similar functionality';
COMMENT ON COLUMN sys_shared_services.confidence_score IS 'Confidence in the service quality and necessity (0-100)';
COMMENT ON COLUMN sys_shared_services.maintenance_recommendation IS 'Recommended action for this service';
COMMENT ON COLUMN sys_shared_services.scan_frequency IS 'How often to scan this service for usage';
COMMENT ON COLUMN sys_shared_services.next_scan_date IS 'Next scheduled scan date';
COMMENT ON COLUMN sys_shared_services.usage_trend IS 'Trend in usage over time';
COMMENT ON COLUMN sys_shared_services.usage_history IS 'Historical usage data for trend analysis';

-- Create a view for service health analysis
CREATE OR REPLACE VIEW sys_service_health_analysis_view AS
SELECT 
  s.service_name,
  s.category,
  s.environment_type,
  s.usage_count,
  s.service_health,
  s.has_tests,
  s.checklist_compliant,
  s.consolidation_candidate,
  s.maintenance_recommendation,
  s.confidence_score,
  s.usage_trend,
  CASE 
    WHEN s.usage_count >= 50 THEN 'high'
    WHEN s.usage_count >= 10 THEN 'medium'
    WHEN s.usage_count >= 1 THEN 'low'
    ELSE 'unused'
  END as usage_level,
  CASE
    WHEN s.usage_count >= 50 AND s.has_tests AND s.checklist_compliant THEN 'essential-verified'
    WHEN s.usage_count >= 50 THEN 'essential-needs-work'
    WHEN s.usage_count >= 10 AND s.has_tests THEN 'active-healthy'
    WHEN s.usage_count >= 10 THEN 'active-needs-attention'
    WHEN s.usage_count >= 1 THEN 'low-usage-evaluate'
    ELSE 'unused-consider-removal'
  END as health_assessment,
  s.overlaps_with,
  s.last_validated,
  s.last_usage_scan,
  s.next_scan_date,
  CASE 
    WHEN s.next_scan_date <= CURRENT_DATE THEN true
    ELSE false
  END as needs_scan
FROM sys_shared_services s
ORDER BY s.usage_count DESC, s.service_name;

COMMENT ON VIEW sys_service_health_analysis_view IS 'Analysis view for service health and usage patterns';

-- Create a table to track continuous service monitoring runs
CREATE TABLE IF NOT EXISTS sys_service_monitoring_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date TIMESTAMPTZ DEFAULT NOW(),
  services_scanned INTEGER DEFAULT 0,
  new_services_found INTEGER DEFAULT 0,
  deprecated_services INTEGER DEFAULT 0,
  refactoring_needed INTEGER DEFAULT 0,
  run_type TEXT CHECK (run_type IN ('manual', 'scheduled', 'continuous')),
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a view for services needing attention
CREATE OR REPLACE VIEW sys_services_needing_attention_view AS
SELECT 
  service_name,
  category,
  usage_count,
  service_health,
  maintenance_recommendation,
  checklist_compliant,
  has_tests,
  JSONB_ARRAY_LENGTH(compliance_issues) as compliance_issue_count,
  last_usage_scan,
  next_scan_date
FROM sys_shared_services
WHERE 
  maintenance_recommendation IN ('needs-refactoring', 'consider-consolidation', 'mark-deprecated', 'remove-unused')
  OR checklist_compliant = false
  OR has_tests = false
  OR next_scan_date <= CURRENT_DATE
ORDER BY 
  CASE maintenance_recommendation
    WHEN 'remove-unused' THEN 1
    WHEN 'mark-deprecated' THEN 2
    WHEN 'consider-consolidation' THEN 3
    WHEN 'needs-refactoring' THEN 4
    ELSE 5
  END,
  usage_count DESC;

COMMENT ON VIEW sys_services_needing_attention_view IS 'Services requiring immediate attention or action';