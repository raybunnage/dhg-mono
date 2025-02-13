- Migration: Rename document_types
-- Created at: 2025-02-13 01:11:32
-- Status: planned
-- Dependencies: None

BEGIN;

-- Verify preconditions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'document_types'
  ) THEN
    RAISE EXCEPTION 'Table document_types does not exist';
  END IF;
END $$;


-- Add triggers for created_by and updated_by
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_updated_by() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_created_by_trigger
  BEFORE INSERT ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_updated_by_trigger
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

COMMIT;

