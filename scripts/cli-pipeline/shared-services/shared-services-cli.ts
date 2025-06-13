#!/usr/bin/env ts-node

import { Command } from 'commander';
import * as path from 'path';

const program = new Command();

program
  .name('shared-services-cli')
  .description('CLI for managing shared services compliance, testing, and continuous monitoring')
  .version('1.0.0');

// Discover command
program
  .command('discover')
  .description('Discover new services not yet registered in sys_shared_services')
  .action(async () => {
    console.log('🔍 Discovering new services...');
    require('./discover-new-services');
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze all services for compliance, usage, and health')
  .option('--category <category>', 'Analyze only services in specific category')
  .option('--fix', 'Attempt to fix compliance issues automatically')
  .action(async (options) => {
    console.log('📊 Analyzing services...');
    require('./analyze-and-rate-services');
  });

// Monitor command
program
  .command('monitor')
  .description('Run continuous monitoring scan for services needing attention')
  .action(async () => {
    console.log('👁️ Running continuous monitoring...');
    const { execSync } = require('child_process');
    
    // First discover new services
    execSync('ts-node discover-new-services.ts', { stdio: 'inherit' });
    
    // Then analyze all services
    execSync('ts-node analyze-and-rate-services.ts', { stdio: 'inherit' });
    
    console.log('\n✅ Monitoring complete!');
  });

// Health check command
program
  .command('health-check')
  .description('Quick health check of all shared services')
  .action(async () => {
    const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Query the health analysis view
    const { data, error } = await supabase
      .from('sys_service_health_analysis_view')
      .select('*');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    // Summary statistics
    const stats = {
      total: data.length,
      essential: data.filter(s => s.service_health === 'essential').length,
      active: data.filter(s => s.service_health === 'active').length,
      lowUsage: data.filter(s => s.service_health === 'low-usage').length,
      deprecated: data.filter(s => s.service_health === 'deprecated').length,
      needsWork: data.filter(s => !s.checklist_compliant).length,
      missingTests: data.filter(s => !s.has_tests).length
    };
    
    console.log('\n📊 Service Health Summary:');
    console.log(`Total Services: ${stats.total}`);
    console.log(`Essential: ${stats.essential}`);
    console.log(`Active: ${stats.active}`);
    console.log(`Low Usage: ${stats.lowUsage}`);
    console.log(`Deprecated: ${stats.deprecated}`);
    console.log(`\nNeeds Attention:`);
    console.log(`Non-compliant: ${stats.needsWork}`);
    console.log(`Missing Tests: ${stats.missingTests}`);
  });

// List command
program
  .command('list')
  .description('List services with various filters')
  .option('--health <status>', 'Filter by health status (essential/active/low-usage/deprecated)')
  .option('--needs-work', 'Show only services needing refactoring')
  .option('--no-tests', 'Show services without tests')
  .option('--unused', 'Show unused services')
  .action(async (options) => {
    const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    let query = supabase.from('sys_service_health_analysis_view').select('*');
    
    if (options.health) {
      query = query.eq('service_health', options.health);
    }
    if (options.needsWork) {
      query = query.eq('checklist_compliant', false);
    }
    if (options.noTests) {
      query = query.eq('has_tests', false);
    }
    if (options.unused) {
      query = query.eq('usage_count', 0);
    }
    
    const { data, error } = await query.order('usage_count', { ascending: false });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`\nFound ${data.length} services:\n`);
    
    data.forEach(service => {
      console.log(`${service.service_name}`);
      console.log(`  Health: ${service.service_health}`);
      console.log(`  Usage: ${service.usage_count}`);
      console.log(`  Environment: ${service.environment_type || 'unknown'}`);
      console.log(`  Tests: ${service.has_tests ? '✅' : '❌'}`);
      console.log(`  Compliant: ${service.checklist_compliant ? '✅' : '❌'}`);
      if (service.maintenance_recommendation !== 'keep-as-is') {
        console.log(`  ⚠️ Recommendation: ${service.maintenance_recommendation}`);
      }
      console.log('');
    });
  });

// Show command
program
  .command('show <serviceName>')
  .description('Show detailed information about a specific service')
  .action(async (serviceName) => {
    const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .eq('service_name', serviceName)
      .single();
    
    if (error) {
      console.error('Service not found:', serviceName);
      return;
    }
    
    console.log(`\n📦 Service: ${data.service_name}`);
    console.log(`Path: ${data.service_path}`);
    console.log(`Category: ${data.category}`);
    console.log(`Description: ${data.description}`);
    console.log(`\nEnvironment:`);
    console.log(`  Type: ${data.environment_type || 'not analyzed'}`);
    console.log(`  Config: ${JSON.stringify(data.environment_config, null, 2)}`);
    console.log(`\nUsage:`);
    console.log(`  Count: ${data.usage_count || 0}`);
    console.log(`  Apps: ${data.used_by_apps?.join(', ') || 'none'}`);
    console.log(`  Pipelines: ${data.used_by_pipelines?.join(', ') || 'none'}`);
    console.log(`  Proxy Servers: ${data.used_by_proxy_servers?.join(', ') || 'none'}`);
    console.log(`\nHealth:`);
    console.log(`  Status: ${data.service_health || 'not analyzed'}`);
    console.log(`  Confidence: ${data.confidence_score || 0}%`);
    console.log(`  Tests: ${data.has_tests ? '✅' : '❌'}`);
    console.log(`  Compliant: ${data.checklist_compliant ? '✅' : '❌'}`);
    
    if (data.compliance_issues?.length > 0) {
      console.log(`\n⚠️ Compliance Issues:`);
      data.compliance_issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (data.overlaps_with?.length > 0) {
      console.log(`\n🔄 Overlaps with: ${data.overlaps_with.join(', ')}`);
    }
    
    if (data.maintenance_recommendation && data.maintenance_recommendation !== 'keep-as-is') {
      console.log(`\n📌 Recommendation: ${data.maintenance_recommendation}`);
    }
    
    if (data.refactoring_notes) {
      console.log(`\n📝 Notes: ${data.refactoring_notes}`);
    }
  });

// Refactor command
program
  .command('refactor <serviceName>')
  .description('Refactor a service to be compliant with standards')
  .option('--dry-run', 'Show what would be changed without making changes')
  .action(async (serviceName, options) => {
    console.log(`🔧 Refactoring ${serviceName}...`);
    // TODO: Implement refactoring logic
    console.log('Refactoring functionality coming soon!');
  });

// Report command
program
  .command('report')
  .description('Generate comprehensive service health report')
  .option('--format <format>', 'Output format (markdown/json)', 'markdown')
  .action(async (options) => {
    const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data: services } = await supabase
      .from('sys_service_health_analysis_view')
      .select('*')
      .order('usage_count', { ascending: false });
    
    const { data: needsAttention } = await supabase
      .from('sys_services_needing_attention_view')
      .select('*');
    
    if (options.format === 'json') {
      console.log(JSON.stringify({ services, needsAttention }, null, 2));
    } else {
      console.log('# Shared Services Health Report');
      console.log(`Generated: ${new Date().toISOString()}\n`);
      
      console.log('## Summary');
      console.log(`- Total Services: ${services.length}`);
      console.log(`- Needing Attention: ${needsAttention.length}`);
      
      console.log('\n## Services Needing Immediate Attention');
      needsAttention.forEach(service => {
        console.log(`\n### ${service.service_name}`);
        console.log(`- Health: ${service.service_health}`);
        console.log(`- Usage: ${service.usage_count}`);
        console.log(`- Recommendation: ${service.maintenance_recommendation}`);
        if (service.compliance_issue_count > 0) {
          console.log(`- Compliance Issues: ${service.compliance_issue_count}`);
        }
      });
    }
  });

program.parse(process.argv);