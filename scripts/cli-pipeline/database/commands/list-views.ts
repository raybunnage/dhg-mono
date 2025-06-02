#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface ViewInfo {
  view_name: string;
  view_schema: string;
  view_definition: string | null;
  is_insertable: boolean;
  is_updatable: boolean;
  is_deletable: boolean;
  has_rls: boolean;
  table_dependencies: string[];
}

async function listViews() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Fetching database views...\n');
  
  try {
    // Use the new function to get view information
    const { data: viewsData, error: viewsError } = await supabase
      .rpc('get_database_views_info');

    if (viewsError) {
      console.error('❌ Error fetching views:', viewsError.message);
      return;
    }

    const views = viewsData as ViewInfo[];
    
    console.log(`📊 Found ${views.length} views\n`);
    
    // Group views by their likely prefix association
    const viewsByPrefix = groupViewsByPrefix(views);
    
    // Display views grouped by prefix
    Object.entries(viewsByPrefix).forEach(([prefix, prefixViews]) => {
      console.log(`\n🏷️  ${prefix} (${prefixViews.length} views)`);
      console.log('─'.repeat(50));
      
      prefixViews.forEach(view => {
        console.log(`\n📋 ${view.view_schema}.${view.view_name}`);
        console.log(`   Features: ${getViewFeatures(view)}`);
        
        // Show table dependencies
        if (view.table_dependencies && view.table_dependencies.length > 0) {
          console.log(`   Dependencies: ${view.table_dependencies.join(', ')}`);
        }
        
        if (!view.has_rls && view.table_dependencies.length > 0) {
          console.log(`   ⚠️  No RLS policy (dependent tables may have RLS)`);
        }
      });
    });
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Total views: ${views.length}`);
    console.log(`   Views without RLS: ${views.filter(v => !v.has_rls).length}`);
    console.log(`   Updateable views: ${views.filter(v => v.is_updatable).length}`);
    console.log(`   Insertable views: ${views.filter(v => v.is_insertable).length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function groupViewsByPrefix(views: ViewInfo[]): Record<string, ViewInfo[]> {
  const prefixes = [
    'ai_', 'auth_', 'batch_', 'command_', 'dev_', 'doc_', 
    'email_', 'expert_', 'filter_', 'google_', 'learn_', 
    'media_', 'scripts_', 'sys_'
  ];
  
  const grouped: Record<string, ViewInfo[]> = {};
  
  views.forEach(view => {
    // First check if view name has a matching prefix
    let assignedPrefix = prefixes.find(prefix => view.view_name.startsWith(prefix));
    
    // If not, check table dependencies
    if (!assignedPrefix && view.table_dependencies.length > 0) {
      const dependencyPrefixes = view.table_dependencies
        .map(dep => {
          const tableName = dep.includes('.') ? dep.split('.')[1] : dep;
          return prefixes.find(prefix => tableName?.startsWith(prefix));
        })
        .filter(Boolean);
      
      // Use most common prefix from dependencies
      if (dependencyPrefixes.length > 0) {
        assignedPrefix = mode(dependencyPrefixes as string[]);
      }
    }
    
    const prefix = assignedPrefix || 'other';
    if (!grouped[prefix]) {
      grouped[prefix] = [];
    }
    grouped[prefix].push(view);
  });
  
  return grouped;
}


function mode(arr: string[]): string {
  const freq: Record<string, number> = {};
  arr.forEach(item => {
    freq[item] = (freq[item] || 0) + 1;
  });
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])[0][0];
}

function getViewFeatures(view: ViewInfo): string {
  const features = [];
  if (view.is_insertable) features.push('Insertable');
  if (view.is_updatable) features.push('Updatable');
  if (view.is_deletable) features.push('Deletable');
  if (view.has_rls) features.push('RLS');
  return features.length > 0 ? features.join(', ') : 'Read-only';
}

// Run the command
listViews().catch(console.error);