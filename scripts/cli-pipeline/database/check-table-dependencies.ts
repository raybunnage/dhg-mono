#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkTableDependencies() {
    console.log('🔍 Checking table dependencies for prompt and user profile tables...\n');

    const supabase = SupabaseClientService.getInstance().getClient();
    const tablesToCheck = ['prompt_output_templates', 'prompt_template_associations', 'user_profiles_v2'];

    for (const tableName of tablesToCheck) {
        console.log(`\n📋 Checking table: ${tableName}`);
        console.log('='.repeat(50));

        // 1. Check if table exists in backup schema
        const { data: tableExists } = await supabase
            .from('information_schema.tables')
            .select('table_name, table_schema')
            .eq('table_name', tableName)
            .eq('table_schema', 'backup');

        if (!tableExists || tableExists.length === 0) {
            console.log(`❌ Table ${tableName} not found in backup schema`);
            continue;
        }

        console.log(`✅ Table ${tableName} exists in backup schema`);

        // 2. Get table structure using direct SQL
        try {
            const { data: columns, error: columnsError } = await supabase.rpc('execute_sql', {
                sql_query: `
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default,
                        character_maximum_length
                    FROM information_schema.columns 
                    WHERE table_schema = 'backup' 
                    AND table_name = '${tableName}'
                    ORDER BY ordinal_position;
                `
            });

            if (columnsError) {
                console.log(`⚠️  Could not get column info: ${columnsError.message}`);
            } else if (columns && columns.length > 0) {
                console.log('\n📊 Table Structure:');
                columns.forEach((col: any) => {
                    console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
                });
            }
        } catch (error) {
            console.log(`⚠️  Could not get table structure: ${error}`);
        }

        // 3. Get row count
        try {
            const { data: rowCountData, error: countError } = await supabase.rpc('execute_sql', {
                sql_query: `SELECT COUNT(*) as row_count FROM backup.${tableName};`
            });

            if (countError) {
                console.log(`⚠️  Could not get row count: ${countError.message}`);
            } else if (rowCountData && rowCountData.length > 0) {
                console.log(`\n📈 Row count: ${rowCountData[0].row_count}`);
            }
        } catch (error) {
            console.log(`⚠️  Could not get row count: ${error}`);
        }

        // 4. Check for foreign key constraints
        try {
            const { data: fkData, error: fkError } = await supabase.rpc('execute_sql', {
                sql_query: `
                    SELECT 
                        tc.constraint_name,
                        tc.table_name,
                        kcu.column_name,
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name
                    FROM information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage AS ccu
                        ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND (tc.table_name = '${tableName}' OR ccu.table_name = '${tableName}')
                    AND tc.table_schema = 'backup';
                `
            });

            if (fkError) {
                console.log(`⚠️  Could not check foreign keys: ${fkError.message}`);
            } else if (fkData && fkData.length > 0) {
                console.log('\n🔗 Foreign Key Dependencies:');
                fkData.forEach((fk: any) => {
                    console.log(`  - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
                });
            } else {
                console.log('\n✅ No foreign key dependencies found');
            }
        } catch (error) {
            console.log(`⚠️  Could not check foreign keys: ${error}`);
        }

        // 5. Check for indexes
        try {
            const { data: indexData, error: indexError } = await supabase.rpc('execute_sql', {
                sql_query: `
                    SELECT 
                        indexname,
                        indexdef
                    FROM pg_indexes 
                    WHERE schemaname = 'backup' 
                    AND tablename = '${tableName}';
                `
            });

            if (indexError) {
                console.log(`⚠️  Could not check indexes: ${indexError.message}`);
            } else if (indexData && indexData.length > 0) {
                console.log('\n🗂️  Indexes:');
                indexData.forEach((idx: any) => {
                    console.log(`  - ${idx.indexname}`);
                });
            } else {
                console.log('\n✅ No custom indexes found');
            }
        } catch (error) {
            console.log(`⚠️  Could not check indexes: ${error}`);
        }

        // 6. Check if table exists in public schema (conflict check)
        const { data: publicTableExists } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', tableName)
            .eq('table_schema', 'public');

        if (publicTableExists && publicTableExists.length > 0) {
            console.log(`⚠️  WARNING: Table ${tableName} already exists in public schema!`);
        } else {
            console.log(`✅ No conflict: Table ${tableName} does not exist in public schema`);
        }
    }

    console.log('\n🎯 Summary:');
    console.log('These tables need to be moved back to public schema.');
    console.log('Check for any dependent objects before moving.');
}

// Run the check
checkTableDependencies().catch(console.error);