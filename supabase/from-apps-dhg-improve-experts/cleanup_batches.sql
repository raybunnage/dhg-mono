-- SQL to clean up batch processing history

-- Delete all batch items
DELETE FROM public.batch_items;

-- Delete all processing batches
DELETE FROM public.processing_batches;

-- Reset sequence if needed
-- ALTER SEQUENCE public.processing_batches_id_seq RESTART WITH 1;

-- Output confirmation
DO $$
BEGIN
  RAISE NOTICE 'Batch processing history has been cleaned up.';
END $$;
