-- Add last_validated column to sys_shared_services for testing infrastructure
-- Migration: 20250610_add_last_validated_to_sys_shared_services.sql

-- Add the missing column
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS last_validated TIMESTAMP WITH TIME ZONE;