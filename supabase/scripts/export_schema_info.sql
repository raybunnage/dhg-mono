-- Get table information including columns, types, and constraints
WITH table_info AS (
    SELECT 
        t.table_schema,
        t.table_name,
        c.column_name,
        c.data_type,
        c.column_default,
        c.is_nullable,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.udt_name,
        -- Get primary key info
        (SELECT 
            string_agg(kcu.column_name, ', ') 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' 
            AND tc.table_name = t.table_name 
            AND tc.table_schema = t.table_schema
        ) as primary_key,
        -- Get foreign key info
        (SELECT 
            json_agg(json_build_object(
                'column', kcu.column_name,
                'references_table', ccu.table_name,
                'references_column', ccu.column_name
            ))
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = t.table_name
            AND tc.table_schema = t.table_schema
        ) as foreign_keys,
        -- Get check constraints
        (SELECT 
            json_agg(json_build_object(
                'name', tc.constraint_name,
                'definition', cc.check_clause
            ))
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
        WHERE tc.constraint_type = 'CHECK'
            AND tc.table_name = t.table_name
            AND tc.table_schema = t.table_schema
        ) as check_constraints
    FROM information_schema.tables t
    JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
),
-- Get indexes
index_info AS (
    SELECT 
        schemaname as schema_name,
        tablename as table_name,
        json_agg(json_build_object(
            'name', indexname,
            'definition', indexdef
        )) as indexes
    FROM pg_indexes
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
),
-- Get triggers
trigger_info AS (
    SELECT 
        event_object_schema as schema_name,
        event_object_table as table_name,
        json_agg(json_build_object(
            'name', trigger_name,
            'event', event_manipulation,
            'timing', action_timing
        )) as triggers
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
    GROUP BY event_object_schema, event_object_table
),
-- Get views
view_info AS (
    SELECT 
        schemaname as schema_name,
        viewname as view_name,
        definition as view_definition
    FROM pg_views
    WHERE schemaname = 'public'
),
-- Get ENUMs
enum_info AS (
    SELECT 
        t.typname as enum_name,
        json_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
),
-- Get Functions/Procedures
function_info AS (
    SELECT 
        p.proname as function_name,
        l.lanname as language,
        json_build_object(
            'args', pg_get_function_arguments(p.oid),
            'result', pg_get_function_result(p.oid),
            'definition', pg_get_functiondef(p.oid)
        ) as function_info
    FROM pg_proc p
    LEFT JOIN pg_language l ON p.prolang = l.oid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
),
-- Get RLS Policies
policy_info AS (
    SELECT 
        schemaname,
        tablename,
        json_agg(json_build_object(
            'name', policyname,
            'roles', roles,
            'cmd', cmd,
            'qual', qual,
            'with_check', with_check
        )) as policies
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
),
-- Get Materialized Views
materialized_view_info AS (
    SELECT 
        schemaname,
        matviewname,
        definition,
        hasindexes
    FROM pg_matviews
    WHERE schemaname = 'public'
),
-- Get Extensions
extension_info AS (
    SELECT 
        json_agg(json_build_object(
            'name', extname,
            'version', extversion,
            'schema', extnamespace::regnamespace::text
        )) as extensions
    FROM pg_extension
),
-- Get Sequences
sequence_info AS (
    SELECT 
        sequence_schema,
        sequence_name,
        json_build_object(
            'start_value', start_value,
            'minimum_value', minimum_value,
            'maximum_value', maximum_value,
            'increment', increment,
            'cycle_option', cycle_option
        ) as sequence_info
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
)

-- Final output combining all information
SELECT 
    json_build_object(
        'tables', json_object_agg(
            ti.table_name,
            json_build_object(
                'columns', json_agg(
                    json_build_object(
                        'name', ti.column_name,
                        'type', ti.data_type,
                        'nullable', ti.is_nullable,
                        'default', ti.column_default,
                        'max_length', ti.character_maximum_length,
                        'numeric_precision', ti.numeric_precision,
                        'numeric_scale', ti.numeric_scale
                    )
                ),
                'primary_key', ti.primary_key,
                'foreign_keys', ti.foreign_keys,
                'check_constraints', ti.check_constraints,
                'indexes', ii.indexes,
                'triggers', tr.triggers,
                'policies', pi.policies
            )
        ),
        'views', json_object_agg(
            v.view_name,
            json_build_object(
                'definition', v.view_definition
            )
        ),
        'materialized_views', (
            SELECT json_object_agg(
                matviewname,
                json_build_object(
                    'definition', definition,
                    'has_indexes', hasindexes
                )
            )
            FROM materialized_view_info
        ),
        'enums', (
            SELECT json_object_agg(
                enum_name,
                enum_values
            )
            FROM enum_info
        ),
        'functions', (
            SELECT json_object_agg(
                function_name,
                function_info
            )
            FROM function_info
        ),
        'sequences', (
            SELECT json_object_agg(
                sequence_name,
                sequence_info
            )
            FROM sequence_info
        ),
        'extensions', (
            SELECT extensions FROM extension_info
        )
    ) as schema_info
FROM table_info ti
LEFT JOIN index_info ii ON ti.table_name = ii.table_name
LEFT JOIN trigger_info tr ON ti.table_name = tr.table_name
LEFT JOIN policy_info pi ON ti.table_name = pi.tablename
CROSS JOIN view_info v
GROUP BY ti.table_schema; 