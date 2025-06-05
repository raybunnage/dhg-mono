-- Create script status enum type
CREATE TYPE script_status AS ENUM (
  'ACTIVE',
  'UPDATE_NEEDED',
  'OBSOLETE',
  'DUPLICATE',
  'UNUSED'
);

-- Create script type enum
CREATE TYPE script_type AS ENUM (
  'UTILITY',
  'DEPLOYMENT',
  'DATABASE',
  'BUILD',
  'SETUP',
  'OTHER'
);

-- Create script usage status enum
CREATE TYPE script_usage_status AS ENUM (
  'DIRECTLY_REFERENCED',
  'INDIRECTLY_REFERENCED',
  'NOT_REFERENCED'
);

-- Create scripts table
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary JSONB,
  language TEXT NOT NULL,
  ai_generated_tags TEXT[] DEFAULT '{}',
  manual_tags TEXT[] DEFAULT NULL,
  last_modified_at TIMESTAMPTZ,
  last_indexed_at TIMESTAMPTZ DEFAULT now(),
  file_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  script_type_id UUID,
  package_json_references JSONB DEFAULT '[]'::jsonb,
  ai_assessment JSONB,
  assessment_quality_score INTEGER,
  assessment_created_at TIMESTAMPTZ,
  assessment_updated_at TIMESTAMPTZ,
  assessment_model TEXT,
  assessment_version INTEGER DEFAULT 1,
  assessment_date DATE
);

COMMENT ON TABLE scripts IS 'Stores metadata and assessments for script files (.sh, .js) in the repository';
COMMENT ON COLUMN scripts.id IS 'Unique identifier for the script record';
COMMENT ON COLUMN scripts.file_path IS 'Relative path to the script file from the repository root';
COMMENT ON COLUMN scripts.title IS 'Human-readable title/name of the script';
COMMENT ON COLUMN scripts.summary IS 'AI-generated summary of the script purpose and functionality';
COMMENT ON COLUMN scripts.language IS 'Programming language of the script (sh, js, bash, node)';
COMMENT ON COLUMN scripts.ai_generated_tags IS 'AI-generated tags describing the script functionality';
COMMENT ON COLUMN scripts.manual_tags IS 'Manually added tags by developers';
COMMENT ON COLUMN scripts.last_modified_at IS 'When the script file was last modified';
COMMENT ON COLUMN scripts.last_indexed_at IS 'When the script was last indexed and analyzed';
COMMENT ON COLUMN scripts.file_hash IS 'Hash of the file content for tracking changes';
COMMENT ON COLUMN scripts.metadata IS 'Additional metadata like size, shebang, executable status';
COMMENT ON COLUMN scripts.created_at IS 'When this record was created in the database';
COMMENT ON COLUMN scripts.updated_at IS 'When this record was last updated in the database';
COMMENT ON COLUMN scripts.is_deleted IS 'Whether the script file has been deleted';
COMMENT ON COLUMN scripts.script_type_id IS 'Reference to a script type if categorization exists';
COMMENT ON COLUMN scripts.package_json_references IS 'JSON array of references to this script in package.json files';
COMMENT ON COLUMN scripts.ai_assessment IS 'AI-generated assessment of the script quality and relevance';
COMMENT ON COLUMN scripts.assessment_quality_score IS 'Overall quality score (1-10) of the assessment';
COMMENT ON COLUMN scripts.assessment_created_at IS 'When the assessment was first created';
COMMENT ON COLUMN scripts.assessment_updated_at IS 'When the assessment was last updated';
COMMENT ON COLUMN scripts.assessment_model IS 'AI model used for the assessment';
COMMENT ON COLUMN scripts.assessment_version IS 'Version number of the assessment';
COMMENT ON COLUMN scripts.assessment_date IS 'Date when the assessment was performed';

-- Create indexes for efficient querying
CREATE INDEX idx_scripts_file_path ON scripts(file_path);
CREATE INDEX idx_scripts_is_deleted ON scripts(is_deleted);
CREATE INDEX idx_scripts_language ON scripts(language);
CREATE INDEX idx_scripts_script_type_id ON scripts(script_type_id);
CREATE INDEX idx_scripts_last_modified_at ON scripts(last_modified_at);
CREATE INDEX idx_scripts_created_at ON scripts(created_at);
CREATE INDEX idx_scripts_ai_generated_tags ON scripts USING GIN(ai_generated_tags);

-- Create index on the status recommendation within the JSONB
CREATE INDEX idx_scripts_status_recommendation ON scripts((ai_assessment->>'status_recommendation'));

-- Create index on the assessment quality score
CREATE INDEX idx_scripts_assessment_quality ON scripts(assessment_quality_score);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER trigger_update_scripts_updated_at
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION update_scripts_updated_at();

-- Enable RLS (Row Level Security) if needed
-- ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- Create a view for active scripts with their assessment data
CREATE OR REPLACE VIEW active_scripts_view AS
SELECT 
  s.id,
  s.file_path,
  s.title,
  s.language,
  s.last_modified_at,
  s.ai_generated_tags,
  s.manual_tags,
  s.ai_assessment->>'script_type' as script_type,
  s.ai_assessment->>'status_recommendation' as status_recommendation,
  s.ai_assessment->'script_quality'->>'code_quality' as code_quality,
  s.ai_assessment->'script_quality'->>'utility' as utility,
  s.ai_assessment->'current_relevance'->>'score' as relevance_score,
  s.ai_assessment->>'usage_status' as usage_status,
  s.assessment_quality_score,
  s.metadata->>'size' as file_size,
  s.package_json_references
FROM scripts s
WHERE s.is_deleted = false
ORDER BY s.last_modified_at DESC;

-- Create a table to track script relationships (like duplicates)
CREATE TABLE script_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_script_id UUID NOT NULL REFERENCES scripts(id),
  target_script_id UUID NOT NULL REFERENCES scripts(id),
  relationship_type TEXT NOT NULL, -- 'DUPLICATE', 'CALLS', 'DEPENDS_ON', etc.
  confidence NUMERIC(3,1), -- 0.0 to 10.0 confidence score
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_script_relationship UNIQUE (source_script_id, target_script_id, relationship_type)
);

-- Add trigger for updating the updated_at timestamp
CREATE TRIGGER trigger_update_script_relationships_updated_at
BEFORE UPDATE ON script_relationships
FOR EACH ROW
EXECUTE FUNCTION update_scripts_updated_at();

-- Create a view for script duplicates
CREATE OR REPLACE VIEW script_duplicates_view AS
SELECT 
  s1.id as script_id,
  s1.file_path as script_path,
  s1.title as script_title,
  s2.id as duplicate_id,
  s2.file_path as duplicate_path,
  s2.title as duplicate_title,
  sr.confidence as duplicate_confidence,
  sr.notes as duplicate_notes
FROM script_relationships sr
JOIN scripts s1 ON sr.source_script_id = s1.id
JOIN scripts s2 ON sr.target_script_id = s2.id
WHERE sr.relationship_type = 'DUPLICATE'
ORDER BY s1.file_path, sr.confidence DESC;
