#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkAuthAuditLogStructure() {
  console.log('Checking auth_audit_log table structure...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // First, check if the table exists
    console.log('=== CHECKING IF TABLE EXISTS ===');
    const { data: tableCheck, error: tableCheckError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            table_schema,
            table_name
          FROM information_schema.tables
          WHERE table_name = 'auth_audit_log'
          ORDER BY table_schema;
        `
      });

    if (tableCheckError) {
      console.error('Error checking table existence:', tableCheckError);
      return;
    }

    console.log('Table search results:', tableCheck);

    // If table doesn't exist in public schema, check auth schema
    const schemas = ['public', 'auth'];
    let tableSchema = 'public';
    
    for (const schema of schemas) {
      console.log(`\n=== CHECKING IN ${schema} SCHEMA ===`);
      const { data: schemaCheck, error: schemaError } = await supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = '${schema}' 
              AND table_name = 'auth_audit_log';
          `
        });
      
      if (!schemaError && schemaCheck && schemaCheck[0]?.count > 0) {
        tableSchema = schema;
        console.log(`Found auth_audit_log table in ${schema} schema`);
        break;
      }
    }

    // 1. Get table columns information
    console.log(`\n=== TABLE COLUMNS (${tableSchema}.auth_audit_log) ===`);
    const { data: columns, error: columnsError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = '${tableSchema}' 
            AND table_name = 'auth_audit_log'
          ORDER BY ordinal_position;
        `
      });

    if (columnsError) {
      console.error('Error fetching columns:', columnsError);
    } else {
      console.table(columns);
    }

    // 2. Get table constraints
    console.log(`\n=== TABLE CONSTRAINTS (${tableSchema}.auth_audit_log) ===`);
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            constraint_name,
            constraint_type
          FROM information_schema.table_constraints
          WHERE table_schema = '${tableSchema}' 
            AND table_name = 'auth_audit_log';
        `
      });

    if (constraintsError) {
      console.error('Error fetching constraints:', constraintsError);
    } else {
      console.table(constraints);
    }

    // 3. Get indexes
    console.log(`\n=== TABLE INDEXES (${tableSchema}.auth_audit_log) ===`);
    const { data: indexes, error: indexesError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes
          WHERE schemaname = '${tableSchema}' 
            AND tablename = 'auth_audit_log';
        `
      });

    if (indexesError) {
      console.error('Error fetching indexes:', indexesError);
    } else {
      console.table(indexes);
    }

    // 4. Try to access the table directly (if in public schema)
    if (tableSchema === 'public') {
      console.log('\n=== SAMPLE DATA (5 most recent rows) ===');
      const { data: sampleData, error: sampleError } = await supabase
        .from('auth_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (sampleError) {
        console.error('Error fetching sample data:', sampleError);
      } else {
        console.log(JSON.stringify(sampleData, null, 2));
      }
    } else {
      // Use RPC to get sample data from auth schema
      console.log(`\n=== SAMPLE DATA FROM ${tableSchema}.auth_audit_log ===`);
      const { data: sampleData, error: sampleError } = await supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT * 
            FROM ${tableSchema}.auth_audit_log 
            ORDER BY created_at DESC 
            LIMIT 5;
          `
        });

      if (sampleError) {
        console.error('Error fetching sample data:', sampleError);
      } else {
        console.log(JSON.stringify(sampleData, null, 2));
      }
    }

    // 5. Get row count
    console.log(`\n=== TABLE STATISTICS (${tableSchema}.auth_audit_log) ===`);
    const { data: stats, error: statsError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            COUNT(*) as total_rows,
            MIN(created_at) as earliest_entry,
            MAX(created_at) as latest_entry
          FROM ${tableSchema}.auth_audit_log;
        `
      });

    if (statsError) {
      console.error('Error fetching statistics:', statsError);
    } else {
      console.table(stats);
    }

    // 6. List all tables with 'auth' or 'audit' in the name
    console.log('\n=== ALL AUTH/AUDIT RELATED TABLES ===');
    const { data: authTables, error: authTablesError } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            table_schema,
            table_name,
            table_type
          FROM information_schema.tables
          WHERE table_name LIKE '%auth%' 
             OR table_name LIKE '%audit%'
          ORDER BY table_schema, table_name;
        `
      });

    if (authTablesError) {
      console.error('Error fetching auth tables:', authTablesError);
    } else {
      console.table(authTables);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkAuthAuditLogStructure()
  .then(() => {
    console.log('\nAuth audit log structure check complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });