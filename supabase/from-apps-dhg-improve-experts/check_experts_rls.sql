-- SQL script to check RLS policies for the experts table

-- Check if RLS is enabled for the experts table
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM 
    pg_class
WHERE 
    relname = 'experts' AND
    relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Get all RLS policies for the experts table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'experts';

-- Get all permissions for the experts table
SELECT 
    grantee, 
    privilege_type
FROM 
    information_schema.role_table_grants
WHERE 
    table_name = 'experts' AND
    table_schema = 'public'
ORDER BY 
    grantee, 
    privilege_type;

-- Check how other tables are being accessed successfully
-- Look at a table that works (e.g., document_types)
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM 
    pg_class
WHERE 
    relname = 'document_types' AND
    relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Get RLS policies for document_types
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'document_types';

-- Compare with google_expert_documents table
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM 
    pg_class
WHERE 
    relname = 'google_expert_documents' AND
    relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Get RLS policies for google_expert_documents
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'google_expert_documents'; 