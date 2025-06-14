#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkServiceViews() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('=== CHECKING SERVICE ANALYSIS VIEWS ===\n');
  
  // Check if views exist by querying information_schema
  const { data: viewsData, error: viewsError } = await supabase
    .rpc('get_view_columns', {
      view_name_pattern: 'sys_service%'
    });
    
  if (viewsError) {
    console.log('Could not query view columns, trying direct query...');
    
    // Try querying the views directly
    console.log('\n1. Trying sys_service_health_analysis_view:');
    const { data: healthData, error: healthError } = await supabase
      .from('sys_service_health_analysis_view')
      .select('*')
      .limit(1);
      
    if (healthError) {
      console.log('Error:', healthError.message);
    } else {
      console.log('View exists! Columns:', healthData ? Object.keys(healthData[0] || {}) : 'No data');
    }
    
    console.log('\n2. Trying sys_services_needing_attention_view:');
    const { data: attentionData, error: attentionError } = await supabase
      .from('sys_services_needing_attention_view')
      .select('*')
      .limit(1);
      
    if (attentionError) {
      console.log('Error:', attentionError.message);
    } else {
      console.log('View exists! Columns:', attentionData ? Object.keys(attentionData[0] || {}) : 'No data');
    }
    
    // Let's check sys_service_registry directly
    console.log('\n3. Checking sys_service_registry table:');
    const { data: registryData, error: registryError } = await supabase
      .from('sys_service_registry')
      .select('*')
      .limit(1);
      
    if (registryError) {
      console.log('Error:', registryError.message);
    } else {
      console.log('Table exists! Columns:', registryData ? Object.keys(registryData[0] || {}) : 'No data');
      console.log('Sample data:', registryData?.[0]);
    }
    
    // Check what views we have with sys_ prefix
    console.log('\n4. Checking all sys_ views:');
    const { data: allViews, error: allViewsError } = await supabase
      .rpc('get_database_views');
      
    if (allViewsError) {
      console.log('Could not list views');
    } else if (allViews) {
      const sysViews = allViews.filter((v: any) => v.view_name?.startsWith('sys_'));
      console.log('Found sys_ views:', sysViews.map((v: any) => v.view_name));
    }
  } else {
    console.log('View columns:', viewsData);
  }
}

checkServiceViews().catch(console.error);