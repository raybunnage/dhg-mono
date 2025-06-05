-- Script to safely drop access_requests table and all dependencies
-- Run this in Supabase SQL Editor

-- First, check what's preventing the drop
DO $$
DECLARE
    dep RECORD;
BEGIN
    RAISE NOTICE 'Checking dependencies on access_requests table...';
    
    FOR dep IN 
        SELECT 
            deptype,
            pg_describe_object(classid, objid, objsubid) as dependent_object
        FROM pg_depend
        WHERE refobjid = 'public.access_requests'::regclass::oid
        AND deptype IN ('n', 'a')
    LOOP
        RAISE NOTICE 'Found dependency: % (%)', dep.dependent_object, dep.deptype;
    END LOOP;
END $$;

-- Drop any remaining views that might reference access_requests
DROP VIEW IF EXISTS public.pending_access_requests CASCADE;

-- Drop any functions that might use access_requests
DROP FUNCTION IF EXISTS public.submit_access_request(text, text, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.approve_access_request(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.deny_access_request(uuid, uuid, text) CASCADE;

-- Drop RLS policies (even if they don't show up in our check)
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT polname 
        FROM pg_policy pol
        JOIN pg_class pc ON pol.polrelid = pc.oid
        WHERE pc.relname = 'access_requests'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON access_requests', policy_rec.polname);
    END LOOP;
END $$;

-- Drop any triggers
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'public.access_requests'::regclass::oid
        AND NOT tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON access_requests', trigger_rec.tgname);
    END LOOP;
END $$;

-- Revoke all permissions
REVOKE ALL ON access_requests FROM anon, authenticated, service_role CASCADE;

-- Finally, drop the table with CASCADE to handle any remaining dependencies
DROP TABLE IF EXISTS public.access_requests CASCADE;

-- Verify it's gone
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_requests') THEN
        RAISE NOTICE 'WARNING: access_requests table still exists!';
    ELSE
        RAISE NOTICE 'SUCCESS: access_requests table has been dropped';
    END IF;
END $$;