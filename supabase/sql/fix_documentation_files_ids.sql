// Fix for missing IDs
-- Create a migration SQL file to ensure IDs are always set in documentation_files table

-- First, ensure the id column is set as the primary key
ALTER TABLE documentation_files ALTER COLUMN id SET NOT NULL;
ALTER TABLE documentation_files ADD PRIMARY KEY (id);

-- Add a default UUID generation for any inserts without an ID
ALTER TABLE documentation_files ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add a trigger to ensure IDs are always set before insert
CREATE OR REPLACE FUNCTION ensure_documentation_files_id()
RETURNS TRIGGER AS 40445
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
40445 LANGUAGE plpgsql;

CREATE TRIGGER set_documentation_files_id
BEFORE INSERT ON documentation_files
FOR EACH ROW
EXECUTE FUNCTION ensure_documentation_files_id();

