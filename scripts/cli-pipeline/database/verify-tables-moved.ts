#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyTablesMoved() {
    console.log('🔍 Verifying tables have been moved back to public schema...\n');

    const supabase = SupabaseClientService.getInstance().getClient();
    const tablesToCheck = ['prompt_output_templates', 'prompt_template_associations', 'auth_user_profiles'];

    for (const tableName of tablesToCheck) {
        console.log(`\n📋 Checking table: ${tableName}`);
        console.log('='.repeat(50));

        // Check if table exists in public schema
        const { data: publicTable } = await supabase
            .from('information_schema.tables')
            .select('table_name, table_schema')
            .eq('table_name', tableName)
            .eq('table_schema', 'public');

        if (publicTable && publicTable.length > 0) {
            console.log(`✅ Table ${tableName} exists in public schema`);
            
            // Try to get row count
            try {
                const { count, error } = await supabase
                    .from(tableName)
                    .select('*', { count: 'exact', head: true });
                
                if (!error) {
                    console.log(`   Row count: ${count || 0}`);
                } else {
                    console.log(`   Could not get row count: ${error.message}`);
                }
            } catch (e) {
                console.log(`   Could not get row count: ${e}`);
            }
        } else {
            console.log(`❌ Table ${tableName} NOT found in public schema`);
        }

        // Check if table still exists in backup schema
        const { data: backupTable } = await supabase
            .from('information_schema.tables')
            .select('table_name, table_schema')
            .eq('table_name', tableName)
            .eq('table_schema', 'backup');

        if (backupTable && backupTable.length > 0) {
            console.log(`⚠️  Table ${tableName} still exists in backup schema (duplicate?)`);
        } else {
            console.log(`✅ Table ${tableName} no longer in backup schema`);
        }
    }

    // Check backup inventory
    console.log('\n\n📊 Checking backup inventory for these tables...');
    const { data: backupInventory, error: invError } = await supabase
        .from('backup_inventory_view')
        .select('*')
        .in('backup_table_name', tablesToCheck);

    if (!invError && backupInventory) {
        if (backupInventory.length === 0) {
            console.log('✅ These tables are no longer listed in backup inventory');
        } else {
            console.log(`⚠️  Found ${backupInventory.length} entries in backup inventory:`);
            backupInventory.forEach((entry: any) => {
                console.log(`   - ${entry.backup_table_name}`);
            });
        }
    }

    console.log('\n✅ Verification complete!');
}

verifyTablesMoved().catch(console.error);