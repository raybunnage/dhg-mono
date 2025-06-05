-- Down migration for fixing RLS and removing audit columns from document_types
-- Created at: 2025-02-27 18:41:05

BEGIN;

-- 1. Drop the RLS policies
DROP POLICY IF EXISTS "Allow authenticated users to select document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document_types" ON document_types;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_types" ON document_types;

-- 2. Add back the created_by and updated_by columns
ALTER TABLE document_types 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 3. Recreate the trigger functions if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_created_by') THEN
    CREATE FUNCTION set_created_by()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.created_by = auth.uid();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_by') THEN
    CREATE FUNCTION set_updated_by() 
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_by = auth.uid();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- 4. Recreate the triggers
CREATE TRIGGER set_created_by_trigger
  BEFORE INSERT ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_updated_by_trigger
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

COMMIT;

