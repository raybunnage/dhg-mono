#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkUserProfilesStructure() {
    console.log('🔍 Checking user_profiles_v2 table structure...\n');

    const supabase = SupabaseClientService.getInstance().getClient();

    // Check in backup schema first
    try {
        const { data: columns, error } = await supabase.rpc('execute_sql', {
            sql_query: `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles_v2'
                AND table_schema = 'backup'
                ORDER BY ordinal_position;
            `
        });

        if (error) {
            console.log(`❌ Error checking backup schema: ${error.message}`);
        } else if (columns && columns.length > 0) {
            console.log('✅ Found user_profiles_v2 in backup schema');
            console.log('\n📊 Table Structure:');
            columns.forEach((col: any) => {
                console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
            });

            // Get sample data
            const { data: sampleData, error: sampleError } = await supabase.rpc('execute_sql', {
                sql_query: `SELECT * FROM backup.user_profiles_v2 LIMIT 3;`
            });

            if (!sampleError && sampleData) {
                console.log(`\n📋 Sample data (${sampleData.length} rows):`);
                console.log(JSON.stringify(sampleData, null, 2));
            }
        } else {
            console.log('❌ user_profiles_v2 not found in backup schema');
        }
    } catch (error) {
        console.log(`❌ Error: ${error}`);
    }

    // Also check public schema
    try {
        const { data: publicColumns, error: publicError } = await supabase.rpc('execute_sql', {
            sql_query: `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles_v2'
                AND table_schema = 'public'
                ORDER BY ordinal_position;
            `
        });

        if (!publicError && publicColumns && publicColumns.length > 0) {
            console.log('\n✅ Found user_profiles_v2 in public schema too');
            console.log('\n📊 Public Table Structure:');
            publicColumns.forEach((col: any) => {
                console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
            });
        } else {
            console.log('\n❌ user_profiles_v2 not found in public schema');
        }
    } catch (error) {
        console.log(`❌ Error checking public schema: ${error}`);
    }
}

checkUserProfilesStructure().catch(console.error);