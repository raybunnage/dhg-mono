-- Migration: Add email_address_id field to email_messages table
-- Purpose: Link email messages to email addresses for better data normalization

BEGIN;

-- Add email_address_id column to email_messages table
ALTER TABLE email_messages 
ADD COLUMN email_address_id UUID REFERENCES email_addresses(id);

-- Create index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_email_messages_email_address_id 
ON email_messages(email_address_id);

-- Create function to populate email_address_id based on sender field
CREATE OR REPLACE FUNCTION populate_email_address_ids()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Update email_messages with email_address_id where sender matches email in email_addresses
    UPDATE email_messages 
    SET email_address_id = ea.id
    FROM email_addresses ea 
    WHERE email_messages.sender = ea.email 
    AND email_messages.email_address_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % email messages with email_address_id', updated_count;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate existing records
SELECT populate_email_address_ids();

-- Add comment to document the new field
COMMENT ON COLUMN email_messages.email_address_id IS 'Foreign key reference to email_addresses table based on sender field lookup';

COMMIT;