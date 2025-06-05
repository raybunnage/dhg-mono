-- Down Migration: Remove the export_all_functions_to_json function
DROP FUNCTION IF EXISTS public.export_all_functions_to_json(); 