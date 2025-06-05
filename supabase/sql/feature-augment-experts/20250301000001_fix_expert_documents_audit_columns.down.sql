-- Down migration for fixing created_by and updated_by references in google_expert_documents
-- Created at: 2025-02-27 18:41:55

BEGIN;

-- 1. Add back the created_by and updated_by columns
ALTER TABLE google_expert_documents 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 2. Recreate the trigger functions if they don't exist
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

-- 3. Recreate the triggers
CREATE TRIGGER set_created_by_trigger
  BEFORE INSERT ON google_expert_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

CREATE TRIGGER set_updated_by_trigger
  BEFORE UPDATE ON google_expert_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by();

COMMIT;

