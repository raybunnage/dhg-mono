#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function checkPipelineTables() {
  console.log('Checking command pipeline tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // Check command_pipelines table
    console.log('=== COMMAND_PIPELINES ===');
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('command_pipelines')
      .select('*')
      .order('name');
    
    if (pipelinesError) {
      console.error('Error querying command_pipelines:', pipelinesError);
    } else {
      console.log(`Found ${pipelines?.length || 0} pipelines:`);
      pipelines?.forEach(p => {
        console.log(`  - ${p.name}: ${p.description || '(no description)'}`);
      });
    }

    // Check command_pipeline_tables table
    console.log('\n=== COMMAND_PIPELINE_TABLES ===');
    const { data: pipelineTables, error: tablesError } = await supabase
      .from('command_pipeline_tables')
      .select('*')
      .order('pipeline_id, table_name');
    
    if (tablesError) {
      console.error('Error querying command_pipeline_tables:', tablesError);
    } else {
      console.log(`Found ${pipelineTables?.length || 0} pipeline-table mappings:`);
      pipelineTables?.forEach(t => {
        console.log(`  - Pipeline ${t.pipeline_id}: ${t.table_name}`);
      });
    }

    // Check command_categories table
    console.log('\n=== COMMAND_CATEGORIES ===');
    const { data: categories, error: categoriesError } = await supabase
      .from('command_categories')
      .select('*')
      .order('name');
    
    if (categoriesError) {
      console.error('Error querying command_categories:', categoriesError);
    } else {
      console.log(`Found ${categories?.length || 0} categories:`);
      categories?.forEach(c => {
        console.log(`  - ${c.name}: ${c.description || '(no description)'}`);
      });
    }

    // Check command_definitions table
    console.log('\n=== COMMAND_DEFINITIONS ===');
    const { data: definitions, error: definitionsError } = await supabase
      .from('command_definitions')
      .select('*')
      .order('pipeline_id, name');
    
    if (definitionsError) {
      console.error('Error querying command_definitions:', definitionsError);
    } else {
      console.log(`Found ${definitions?.length || 0} command definitions:`);
      definitions?.forEach(d => {
        console.log(`  - [${d.pipeline_id}] ${d.name}: ${d.description || '(no description)'}`);
      });
    }

    // Get joined data to see relationships
    console.log('\n=== PIPELINE-TABLE RELATIONSHIPS ===');
    const { data: joinedData, error: joinedError } = await supabase
      .from('command_pipeline_tables')
      .select(`
        table_name,
        pipeline:command_pipelines(name)
      `)
      .order('table_name');
    
    if (joinedError) {
      console.error('Error querying joined data:', joinedError);
    } else {
      console.log('Tables and their associated pipelines:');
      const tableMap = new Map<string, string[]>();
      
      joinedData?.forEach(item => {
        const tableName = item.table_name;
        const pipelineName = (item.pipeline as any)?.name;
        
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, []);
        }
        if (pipelineName) {
          tableMap.get(tableName)!.push(pipelineName);
        }
      });
      
      tableMap.forEach((pipelines, table) => {
        console.log(`  - ${table}: ${pipelines.join(', ')}`);
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkPipelineTables().catch(console.error);