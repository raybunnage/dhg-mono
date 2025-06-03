-- Phase 1: Add execution tracking to ai_prompts table
-- This migration adds performance tracking columns to the ai_prompts table

BEGIN;

-- Add execution tracking columns to ai_prompts
ALTER TABLE ai_prompts 
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_tokens INTEGER,
ADD COLUMN IF NOT EXISTS avg_execution_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- Create simple execution log table
CREATE TABLE IF NOT EXISTS ai_prompt_executions_simple (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
    document_id TEXT, -- Flexible reference (can be drive_id, doc_id, etc.)
    tokens_used INTEGER,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}', -- For additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prompt_executions_prompt_id ON ai_prompt_executions_simple(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_created_at ON ai_prompt_executions_simple(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_executions_success ON ai_prompt_executions_simple(success);

-- Add document type and mime type columns for Phase 2 preparation
ALTER TABLE ai_prompts
ADD COLUMN IF NOT EXISTS supported_document_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS supported_mime_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Create index for document type queries
CREATE INDEX IF NOT EXISTS idx_prompts_document_types ON ai_prompts USING GIN(supported_document_types);
CREATE INDEX IF NOT EXISTS idx_prompts_mime_types ON ai_prompts USING GIN(supported_mime_types);

-- Add comment to explain the new columns
COMMENT ON COLUMN ai_prompts.execution_count IS 'Total number of times this prompt has been executed';
COMMENT ON COLUMN ai_prompts.avg_tokens IS 'Average number of tokens used per execution';
COMMENT ON COLUMN ai_prompts.avg_execution_time_ms IS 'Average execution time in milliseconds';
COMMENT ON COLUMN ai_prompts.last_executed_at IS 'Timestamp of the last execution';
COMMENT ON COLUMN ai_prompts.supported_document_types IS 'Array of document type names this prompt supports';
COMMENT ON COLUMN ai_prompts.supported_mime_types IS 'Array of MIME types this prompt supports';
COMMENT ON COLUMN ai_prompts.priority IS 'Priority for prompt selection (higher = preferred)';

-- Function to update prompt execution stats
CREATE OR REPLACE FUNCTION update_prompt_execution_stats(
    p_prompt_id UUID,
    p_tokens_used INTEGER,
    p_execution_time_ms INTEGER
) RETURNS VOID AS $$
DECLARE
    v_count INTEGER;
    v_avg_tokens INTEGER;
    v_avg_time INTEGER;
BEGIN
    -- Get current stats
    SELECT execution_count, avg_tokens, avg_execution_time_ms
    INTO v_count, v_avg_tokens, v_avg_time
    FROM ai_prompts
    WHERE id = p_prompt_id;
    
    -- Calculate new averages
    v_count := COALESCE(v_count, 0) + 1;
    v_avg_tokens := CASE 
        WHEN v_avg_tokens IS NULL THEN p_tokens_used
        ELSE ((COALESCE(v_avg_tokens, 0) * (v_count - 1)) + p_tokens_used) / v_count
    END;
    v_avg_time := CASE 
        WHEN v_avg_time IS NULL THEN p_execution_time_ms
        ELSE ((COALESCE(v_avg_time, 0) * (v_count - 1)) + p_execution_time_ms) / v_count
    END;
    
    -- Update the prompt record
    UPDATE ai_prompts
    SET execution_count = v_count,
        avg_tokens = v_avg_tokens,
        avg_execution_time_ms = v_avg_time,
        last_executed_at = NOW()
    WHERE id = p_prompt_id;
END;
$$ LANGUAGE plpgsql;

-- Record migration
INSERT INTO sys_table_migrations (migration_name, applied_at)
VALUES ('add_prompt_execution_tracking', NOW());

COMMIT;