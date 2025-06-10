-- Update element_success_criteria table structure to match new requirements

-- Add missing columns to element_success_criteria
ALTER TABLE element_success_criteria
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS success_condition TEXT,
ADD COLUMN IF NOT EXISTS criteria_type TEXT CHECK (criteria_type IN ('functional', 'performance', 'security', 'ux', 'integration', 'documentation', 'testing')),
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS validation_method TEXT,
ADD COLUMN IF NOT EXISTS validation_script TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Migrate data from old columns to new columns
UPDATE element_success_criteria
SET 
  title = criteria_title,
  description = criteria_description
WHERE title IS NULL AND criteria_title IS NOT NULL;

-- Set default values for required new columns
UPDATE element_success_criteria
SET 
  success_condition = COALESCE(criteria_description, 'To be defined'),
  criteria_type = CASE 
    WHEN validation_type = 'automated' THEN 'functional'
    WHEN validation_type = 'manual' THEN 'ux'
    ELSE 'functional'
  END
WHERE success_condition IS NULL;

-- Now we can safely make the new columns NOT NULL
ALTER TABLE element_success_criteria
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN success_condition SET NOT NULL,
ALTER COLUMN criteria_type SET NOT NULL;

-- Drop the old columns (after ensuring data is migrated)
ALTER TABLE element_success_criteria
DROP COLUMN IF EXISTS criteria_title,
DROP COLUMN IF EXISTS criteria_description,
DROP COLUMN IF EXISTS validation_type;

-- Update the unique constraint
ALTER TABLE element_success_criteria
DROP CONSTRAINT IF EXISTS element_success_criteria_element_type_element_id_criteria_ti_key;

ALTER TABLE element_success_criteria
ADD CONSTRAINT element_success_criteria_unique UNIQUE(element_type, element_id, title);

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_element_success_criteria_type ON element_success_criteria(criteria_type);