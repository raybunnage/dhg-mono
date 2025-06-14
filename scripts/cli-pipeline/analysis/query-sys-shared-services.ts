#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Database } from '../../../supabase/types';

type SharedService = Database['public']['Tables']['sys_shared_services']['Row'];

async function querySharedServices() {
  try {
    console.log('=== Querying sys_shared_services table ===\n');
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, let's get the total count
    const { count, error: countError } = await supabase
      .from('sys_shared_services')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting services:', countError);
      return;
    }
    
    console.log(`Total services in sys_shared_services: ${count}\n`);
    
    // Now get all services
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .order('service_name');
    
    if (error) {
      console.error('Error querying sys_shared_services:', error);
      return;
    }
    
    if (!services || services.length === 0) {
      console.log('No services found in sys_shared_services table');
      return;
    }
    
    // Display table structure
    console.log('Table Structure:');
    console.log('----------------');
    const sampleService = services[0];
    Object.keys(sampleService).forEach(key => {
      const value = sampleService[key as keyof SharedService];
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      console.log(`- ${key}: ${type}`);
    });
    
    console.log('\n=== Service Categories ===');
    const categories = [...new Set(services.map(s => s.category).filter(Boolean))].sort();
    categories.forEach(cat => {
      const count = services.filter(s => s.category === cat).length;
      console.log(`- ${cat}: ${count} services`);
    });
    
    console.log('\n=== Service Status ===');
    const statuses = [...new Set(services.map(s => s.status).filter(Boolean))].sort();
    statuses.forEach(status => {
      const count = services.filter(s => s.status === status).length;
      console.log(`- ${status}: ${count} services`);
    });
    
    console.log('\n=== All Services (sorted by name) ===');
    console.log('-------------------------------------');
    
    services.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.service_name}`);
      console.log(`   Path: ${service.service_path}`);
      console.log(`   Category: ${service.category || 'N/A'}`);
      console.log(`   Status: ${service.status || 'N/A'}`);
      console.log(`   Is Singleton: ${service.is_singleton ? 'Yes' : 'No'}`);
      console.log(`   Has Browser Variant: ${service.has_browser_variant ? 'Yes' : 'No'}`);
      
      if (service.description) {
        console.log(`   Description: ${service.description}`);
      }
      
      if (service.used_by_apps && service.used_by_apps.length > 0) {
        console.log(`   Used by Apps: ${service.used_by_apps.join(', ')}`);
      }
      
      if (service.used_by_pipelines && service.used_by_pipelines.length > 0) {
        console.log(`   Used by Pipelines: ${service.used_by_pipelines.join(', ')}`);
      }
      
      if (service.dependencies) {
        console.log(`   Dependencies: ${JSON.stringify(service.dependencies)}`);
      }
      
      if (service.exports) {
        console.log(`   Exports: ${JSON.stringify(service.exports)}`);
      }
      
      if (service.last_validated) {
        console.log(`   Last Validated: ${new Date(service.last_validated).toLocaleDateString()}`);
      }
    });
    
    // Show services with issues
    console.log('\n=== Services Needing Attention ===');
    const needsAttention = services.filter(s => 
      !s.description || 
      !s.category || 
      s.status === 'needs_review' || 
      s.status === 'deprecated' ||
      !s.last_validated
    );
    
    if (needsAttention.length > 0) {
      console.log(`Found ${needsAttention.length} services needing attention:`);
      needsAttention.forEach(service => {
        console.log(`\n- ${service.service_name}`);
        const issues = [];
        if (!service.description) issues.push('Missing description');
        if (!service.category) issues.push('Missing category');
        if (service.status === 'needs_review') issues.push('Status: needs_review');
        if (service.status === 'deprecated') issues.push('Status: deprecated');
        if (!service.last_validated) issues.push('Never validated');
        console.log(`  Issues: ${issues.join(', ')}`);
      });
    } else {
      console.log('All services are properly documented and validated!');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the query
querySharedServices().catch(console.error);