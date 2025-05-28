-- Create google_sources_experts table for managing expert associations

-- First create an ENUM type for expert roles
CREATE TYPE expert_role_type AS ENUM (
  'presenter',           -- Main speaker/presenter
  'discussant',          -- Part of a discussion or Q&A
  'moderator',           -- Facilitating the session
  'panelist',            -- Member of a panel discussion
  'collaborator',        -- Co-author or research collaborator
  'consultant',          -- Subject matter expert/advisor
  'contributor',         -- Contributed materials/research
  'interviewee',         -- Being interviewed
  'interviewer',         -- Conducting an interview
  'guest',               -- Guest appearance
  'host',                -- Hosting the event/session
  'other'                -- For any roles not covered above
);

-- Create the table with the role field
CREATE TABLE IF NOT EXISTS google_sources_experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources_google(id),
  expert_id UUID NOT NULL REFERENCES experts(id),
  role expert_role_type,                    -- Optional role using the enum
  role_description TEXT,                    -- For additional context when role is 'other'
  is_primary BOOLEAN DEFAULT false,         -- Whether this expert is the primary for this source
  contribution_percentage INTEGER,          -- Optional field to indicate level of contribution (0-100)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  
  -- Ensures each expert has at most one role per source
  UNIQUE (source_id, expert_id, role),
  
  -- Validate percentage is between 0-100
  CONSTRAINT contribution_percentage_range CHECK (contribution_percentage IS NULL OR 
    (contribution_percentage >= 0 AND contribution_percentage <= 100))
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_sources_experts_source_id ON google_sources_experts(source_id);
CREATE INDEX IF NOT EXISTS idx_google_sources_experts_expert_id ON google_sources_experts(expert_id);

-- Create a function to copy existing expert_id relationships
CREATE OR REPLACE FUNCTION migrate_expert_ids() RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- Get all sources_google entries with expert_id
  FOR r IN 
    SELECT id, expert_id 
    FROM sources_google_deprecated
    WHERE expert_id IS NOT NULL
  LOOP
    -- Insert into google_sources_experts
    INSERT INTO google_sources_experts (
      source_id, 
      expert_id, 
      is_primary, 
      created_at, 
      updated_at
    )
    VALUES (
      r.id, 
      r.expert_id, 
      true, 
      now(), 
      now()
    )
    ON CONFLICT (source_id, expert_id, role) DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Expert ID migration completed';
END;
$$ LANGUAGE plpgsql;

-- Help text explaining the migration
COMMENT ON FUNCTION migrate_expert_ids() IS 
'This function migrates expert associations from the sources_google.expert_id field 
to the new google_sources_experts table. Run this function after setting up both tables 
and ensuring sources_google_deprecated still exists.';