-- Migration: Merge import_important_email_addresses data with email_addresses
-- Purpose: Add legacy_id field and update is_important flags based on import data

BEGIN;

-- Add legacy_id column to email_addresses table to store original important_email_address_id
ALTER TABLE email_addresses 
ADD COLUMN IF NOT EXISTS legacy_id INTEGER;

-- Create index for better performance on legacy_id lookups
CREATE INDEX IF NOT EXISTS idx_email_addresses_legacy_id 
ON email_addresses(legacy_id);

-- Add comment to document the new field
COMMENT ON COLUMN email_addresses.legacy_id IS 'Legacy ID from import_important_email_addresses.important_email_address_id for data traceability';

-- Create function to merge important email addresses data
CREATE OR REPLACE FUNCTION merge_important_email_addresses()
RETURNS TABLE(
    updated_count INTEGER,
    important_count INTEGER,
    legacy_id_count INTEGER
) AS $$
DECLARE
    updated_records INTEGER := 0;
    important_records INTEGER := 0;
    legacy_records INTEGER := 0;
BEGIN
    -- Update email_addresses with legacy_id and is_important flag
    -- for all matching records (regardless of is_important value in import table)
    UPDATE email_addresses 
    SET 
        legacy_id = iea.important_email_address_id,
        is_important = COALESCE(iea.is_important, false)
    FROM import_important_email_addresses iea 
    WHERE email_addresses.email_address = iea.email_address;
    
    GET DIAGNOSTICS updated_records = ROW_COUNT;
    
    -- Count records that were marked as important
    SELECT COUNT(*) INTO important_records
    FROM email_addresses 
    WHERE is_important = true AND legacy_id IS NOT NULL;
    
    -- Count total records with legacy_id populated
    SELECT COUNT(*) INTO legacy_records
    FROM email_addresses 
    WHERE legacy_id IS NOT NULL;
    
    RAISE NOTICE 'Updated % email addresses with import data', updated_records;
    RAISE NOTICE 'Set % email addresses as important', important_records;
    RAISE NOTICE 'Populated legacy_id for % email addresses', legacy_records;
    
    RETURN QUERY SELECT updated_records, important_records, legacy_records;
END;
$$ LANGUAGE plpgsql;

-- Execute the merge function
SELECT * FROM merge_important_email_addresses();

COMMIT;