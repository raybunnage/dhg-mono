-- Script tracking database schema

-- Enums for script status
CREATE TYPE script_status AS ENUM (
  'ACTIVE',           -- Currently in use and up-to-date
  'UPDATE_NEEDED',    -- Still useful but requires updates
  'OBSOLETE',         -- No longer needed or outdated
  'DUPLICATE',        -- Duplicates functionality found elsewhere
  'UNUSED'            -- Not referenced or used in the project
);

-- Enums for script type
CREATE TYPE script_type AS ENUM (
  'UTILITY',          -- General utility script
  'DEPLOYMENT',       -- Deployment-related script
  'DATABASE',         -- Database-related script
  'BUILD',            -- Build-related script
  'SETUP',            -- Setup or environment script
  'OTHER'             -- Other types of scripts
);

-- Enums for script usage status
CREATE TYPE script_usage_status AS ENUM (
  'DIRECTLY_REFERENCED',    -- Referenced directly in package.json or other config
  'INDIRECTLY_REFERENCED',  -- Referenced by other scripts or indirectly
  'NOT_REFERENCED'          -- Not referenced anywhere
);

-- Document type categories
CREATE TYPE document_type_category AS ENUM (
  'AI',               -- AI/ML models, prompts, and configurations
  'Integration',      -- External system integrations
  'Operations',       -- Operational tasks and infrastructure
  'Development'       -- Development tools and processes
);

-- Scripts table
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path TEXT NOT NULL UNIQUE,
  title TEXT,
  language TEXT,
  document_type document_type_category,
  summary TEXT,
  tags TEXT[],
  code_quality INTEGER CHECK (code_quality BETWEEN 1 AND 10),
  maintainability INTEGER CHECK (maintainability BETWEEN 1 AND 10),
  utility INTEGER CHECK (utility BETWEEN 1 AND 10),
  documentation INTEGER CHECK (documentation BETWEEN 1 AND 10),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  relevance_reasoning TEXT,
  referenced BOOLEAN DEFAULT FALSE,
  status script_status DEFAULT 'ACTIVE',
  status_confidence INTEGER CHECK (status_confidence BETWEEN 1 AND 10),
  status_reasoning TEXT,
  script_type script_type DEFAULT 'UTILITY',
  usage_status script_usage_status DEFAULT 'NOT_REFERENCED',
  last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Script relationships table
CREATE TABLE script_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  target_script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'duplicate', 'dependency', 'similar'
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_relationship UNIQUE (source_script_id, target_script_id, relationship_type)
);

-- View for active scripts
CREATE VIEW active_scripts_view AS
SELECT
  id,
  file_path,
  title,
  language,
  document_type,
  summary,
  tags,
  code_quality,
  maintainability,
  utility,
  documentation,
  relevance_score,
  status,
  script_type,
  usage_status,
  last_analyzed
FROM scripts
WHERE status = 'ACTIVE';

-- View for duplicate script relationships
CREATE VIEW script_duplicates_view AS
SELECT
  sr.id,
  s1.file_path AS source_path,
  s2.file_path AS target_path,
  s1.document_type AS source_type,
  s2.document_type AS target_type,
  sr.confidence,
  sr.notes
FROM script_relationships sr
JOIN scripts s1 ON sr.source_script_id = s1.id
JOIN scripts s2 ON sr.target_script_id = s2.id
WHERE sr.relationship_type = 'duplicate';

-- Updated-at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER set_scripts_updated_at
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_script_relationships_updated_at
BEFORE UPDATE ON script_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_scripts_file_path ON scripts(file_path);
CREATE INDEX idx_scripts_document_type ON scripts(document_type);
CREATE INDEX idx_scripts_status ON scripts(status);
CREATE INDEX idx_scripts_script_type ON scripts(script_type);
CREATE INDEX idx_script_relationships_source ON script_relationships(source_script_id);
CREATE INDEX idx_script_relationships_target ON script_relationships(target_script_id);
CREATE INDEX idx_script_relationships_type ON script_relationships(relationship_type);