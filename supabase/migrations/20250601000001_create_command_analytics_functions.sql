-- Function to sanitize commands
CREATE OR REPLACE FUNCTION sanitize_command(command_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  sanitized TEXT := command_text;
  pattern RECORD;
BEGIN
  FOR pattern IN SELECT * FROM command_patterns WHERE is_active = TRUE
  LOOP
    sanitized := regexp_replace(sanitized, pattern.pattern, pattern.replacement, 'g');
  END LOOP;
  
  RETURN sanitized;
END;
$$;

-- Function to get most used commands
CREATE OR REPLACE FUNCTION get_most_used_commands(
  time_period INTERVAL DEFAULT INTERVAL '30 days',
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  command_text TEXT,
  category_name TEXT,
  usage_count BIGINT,
  success_rate NUMERIC
)
LANGUAGE SQL
AS $$
  SELECT 
    ch.sanitized_command,
    cc.name AS category_name,
    COUNT(*) AS usage_count,
    ROUND(SUM(CASE WHEN ch.success THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 2) AS success_rate
  FROM command_history ch
  JOIN command_categories cc ON ch.category_id = cc.id
  WHERE ch.executed_at > NOW() - time_period
  GROUP BY ch.sanitized_command, cc.name
  ORDER BY usage_count DESC
  LIMIT limit_count;
$$;

-- Function to get command usage by category
CREATE OR REPLACE FUNCTION get_command_usage_by_category(
  time_period INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (
  category_name TEXT,
  usage_count BIGINT,
  success_rate NUMERIC
)
LANGUAGE SQL
AS $$
  SELECT 
    cc.name AS category_name,
    COUNT(*) AS usage_count,
    ROUND(SUM(CASE WHEN ch.success THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 2) AS success_rate
  FROM command_history ch
  JOIN command_categories cc ON ch.category_id = cc.id
  WHERE ch.executed_at > NOW() - time_period
  GROUP BY cc.name
  ORDER BY usage_count DESC;
$$;

-- Function to get command history with pagination
CREATE OR REPLACE FUNCTION get_command_history(
  category_filter TEXT DEFAULT NULL,
  success_filter BOOLEAN DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  page_size INTEGER DEFAULT 20,
  page_number INTEGER DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  command_text TEXT,
  sanitized_command TEXT,
  category_name TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  exit_code INTEGER,
  success BOOLEAN,
  notes TEXT,
  tags TEXT[]
)
LANGUAGE SQL
AS $$
  SELECT 
    ch.id,
    ch.command_text,
    ch.sanitized_command,
    cc.name AS category_name,
    ch.executed_at,
    ch.duration_ms,
    ch.exit_code,
    ch.success,
    ch.notes,
    ch.tags
  FROM command_history ch
  JOIN command_categories cc ON ch.category_id = cc.id
  WHERE 
    (category_filter IS NULL OR cc.name = category_filter) AND
    (success_filter IS NULL OR ch.success = success_filter) AND
    (search_term IS NULL OR 
     ch.sanitized_command ILIKE '%' || search_term || '%' OR
     ch.notes ILIKE '%' || search_term || '%')
  ORDER BY ch.executed_at DESC
  LIMIT page_size
  OFFSET (page_number - 1) * page_size;
$$;

-- Function to increment usage count for favorite commands
CREATE OR REPLACE FUNCTION increment_favorite_command_usage(favorite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE favorite_commands
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = favorite_id;
END;
$$;

-- Create a view for command suggestions
CREATE VIEW command_suggestions AS
WITH recent_commands AS (
  SELECT 
    sanitized_command,
    category_id,
    COUNT(*) AS usage_count,
    MAX(executed_at) AS last_used,
    ROUND(SUM(CASE WHEN success THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 2) AS success_rate
  FROM command_history
  WHERE executed_at > NOW() - INTERVAL '90 days'
  GROUP BY sanitized_command, category_id
)
SELECT 
  rc.sanitized_command,
  cc.name AS category_name,
  rc.usage_count,
  rc.last_used,
  rc.success_rate,
  CASE 
    WHEN rc.usage_count > 10 AND rc.success_rate > 90 THEN 'high'
    WHEN rc.usage_count > 5 AND rc.success_rate > 70 THEN 'medium'
    ELSE 'low'
  END AS recommendation_strength
FROM recent_commands rc
JOIN command_categories cc ON rc.category_id = cc.id
ORDER BY rc.usage_count DESC, rc.last_used DESC; 