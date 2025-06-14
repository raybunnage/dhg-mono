#!/usr/bin/env ts-node

/**
 * Continuous Database Monitor
 * Detects database changes and triggers automatic maintenance actions
 * Including RLS policy creation for new tables
 */

import * as path from 'path';
import { execSync } from 'child_process';

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface DatabaseChange {
  id: string;
  event_type: string;
  object_name: string;
  object_type: string;
  change_details: any;
  detected_at: string;
  processed: boolean;
}

interface MaintenanceAction {
  id: string;
  event_id: string;
  rule_id: string;
  action_type: string;
  action_details: any;
  status: string;
}

class ContinuousDatabaseMonitor {
  async run(): Promise<void> {
    console.log('🔄 Starting Continuous Database Monitor...\n');
    
    try {
      // Step 1: Detect new database changes
      await this.detectChanges();
      
      // Step 2: Process maintenance rules
      await this.processMaintenanceRules();
      
      // Step 3: Execute pending actions
      await this.executePendingActions();
      
      // Step 4: Update service definitions if needed
      await this.updateServiceDefinitions();
      
      console.log('\n✅ Continuous monitoring cycle complete!');
    } catch (error) {
      console.error('❌ Monitor error:', error);
      throw error;
    }
  }
  
  private async detectChanges(): Promise<void> {
    console.log('🔍 Detecting database changes...');
    
    // Call the detection function
    const { data, error } = await supabase.rpc('sys_detect_database_changes');
    
    if (error) {
      console.error('Error detecting changes:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No new database changes detected.');
      return;
    }
    
    console.log(`Found ${data.length} database changes:`);
    
    // Insert detected changes
    for (const change of data) {
      const { error: insertError } = await supabase
        .from('sys_database_change_events')
        .insert({
          event_type: change.change_type,
          object_name: change.object_name,
          object_type: change.details?.table_type === 'BASE TABLE' ? 'table' : 
                      change.details?.table_type === 'VIEW' ? 'view' : 'table',
          change_details: change.details
        });
      
      if (insertError) {
        console.error(`Failed to record change for ${change.object_name}:`, insertError);
      } else {
        console.log(`  - ${change.change_type}: ${change.object_name}`);
      }
    }
  }
  
  private async processMaintenanceRules(): Promise<void> {
    console.log('\n📋 Processing maintenance rules...');
    
    // Call the rule processing function
    const { error } = await supabase.rpc('sys_process_maintenance_rules');
    
    if (error) {
      console.error('Error processing rules:', error);
      return;
    }
    
    // Check for pending actions
    const { data: pending } = await supabase
      .from('sys_pending_maintenance_actions_view')
      .select('*');
    
    if (pending && pending.length > 0) {
      console.log(`Created ${pending.length} maintenance actions`);
    }
  }
  
  private async executePendingActions(): Promise<void> {
    console.log('\n⚡ Executing pending actions...');
    
    // Get pending actions
    const { data: actions, error } = await supabase
      .from('sys_maintenance_action_log')
      .select(`
        *,
        sys_database_change_events!inner(object_name, object_type),
        sys_database_maintenance_rules!inner(rule_name)
      `)
      .eq('status', 'pending')
      .order('created_at');
    
    if (error || !actions || actions.length === 0) {
      console.log('No pending actions to execute.');
      return;
    }
    
    for (const action of actions) {
      await this.executeAction(action);
    }
  }
  
  private async executeAction(action: any): Promise<void> {
    const objectName = action.sys_database_change_events.object_name;
    console.log(`\n🔧 Executing ${action.action_type} for ${objectName}...`);
    
    // Update status to running
    await supabase
      .from('sys_maintenance_action_log')
      .update({ status: 'running', started_at: new Date() })
      .eq('id', action.id);
    
    try {
      switch (action.action_type) {
        case 'create_rls_policy':
          await this.createRLSPolicy(objectName, action.action_details);
          break;
          
        case 'update_table_definitions':
          await this.updateTableDefinitions(objectName);
          break;
          
        case 'extract_table_prefix':
          await this.extractTablePrefix(objectName);
          break;
          
        case 'check_naming_convention':
          await this.checkNamingConvention(objectName, action.sys_database_change_events.object_type);
          break;
          
        case 'validate_view_suffix':
        case 'validate_view_prefix':
          await this.validateViewNaming(objectName);
          break;
          
        case 'check_service_pattern':
          await this.checkServicePattern(objectName);
          break;
          
        default:
          console.log(`Unknown action type: ${action.action_type}`);
      }
      
      // Mark as completed
      await supabase
        .from('sys_maintenance_action_log')
        .update({ 
          status: 'completed', 
          completed_at: new Date() 
        })
        .eq('id', action.id);
        
      console.log(`✅ ${action.action_type} completed`);
      
    } catch (error: any) {
      // Mark as failed
      await supabase
        .from('sys_maintenance_action_log')
        .update({ 
          status: 'failed', 
          completed_at: new Date(),
          error_message: error.message 
        })
        .eq('id', action.id);
        
      console.error(`❌ ${action.action_type} failed:`, error.message);
    }
  }
  
  private async createRLSPolicy(tableName: string, details: any): Promise<void> {
    const policy = details.policy || 'public_read';
    
    console.log(`Creating ${policy} RLS policy for ${tableName}...`);
    
    // Use the database CLI to create RLS policies
    const projectRoot = path.join(__dirname, '../../..');
    const databaseCli = path.join(projectRoot, 'scripts/cli-pipeline/database/database-cli.sh');
    
    try {
      // Use the check-rls-policies command which handles everything
      execSync(`cd "${projectRoot}" && ${databaseCli} check-rls-policies`, {
        stdio: 'inherit'
      });
      
      console.log(`✅ RLS policies checked/created for ${tableName}`);
    } catch (error) {
      console.error(`Failed to create RLS policies for ${tableName}:`, error);
      // Don't throw - we'll log but continue
    }
  }
  
  private async updateTableDefinitions(tableName: string): Promise<void> {
    console.log(`Updating table definitions for ${tableName}...`);
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('sys_table_definitions')
      .select('id')
      .eq('table_name', tableName)
      .single();
    
    if (existing) {
      console.log(`Table definition already exists for ${tableName}`);
      return;
    }
    
    // Insert new definition
    const { error } = await supabase
      .from('sys_table_definitions')
      .insert({
        table_schema: 'public',
        table_name: tableName,
        description: `Auto-discovered table ${tableName}`,
        purpose: 'To be documented',
        created_date: new Date()
      });
    
    if (error) {
      console.error(`Failed to create table definition:`, error);
    } else {
      console.log(`✅ Table definition created for ${tableName}`);
    }
  }
  
  private async extractTablePrefix(tableName: string): Promise<void> {
    const prefix = tableName.split('_')[0];
    console.log(`Checking prefix '${prefix}' for ${tableName}...`);
    
    // Check if prefix exists
    const { data: existing } = await supabase
      .from('sys_table_prefixes')
      .select('id')
      .eq('prefix', prefix)
      .single();
    
    if (!existing) {
      console.log(`New prefix '${prefix}' needs to be registered in sys_table_prefixes`);
      // Log this for manual review
      await supabase
        .from('sys_database_change_events')
        .insert({
          event_type: 'prefix_needed',
          object_name: prefix,
          object_type: 'prefix',
          change_details: { table_name: tableName },
          processing_notes: `New prefix '${prefix}' discovered from table ${tableName}`
        });
    }
  }
  
  private async checkNamingConvention(objectName: string, objectType: string): Promise<void> {
    console.log(`Checking naming convention for ${objectType} ${objectName}...`);
    
    if (objectType === 'view' && !objectName.endsWith('_view')) {
      console.warn(`⚠️  View ${objectName} doesn't follow naming convention (should end with _view)`);
    }
    
    // Check prefix
    const prefix = objectName.split('_')[0];
    const { data: validPrefix } = await supabase
      .from('sys_table_prefixes')
      .select('id')
      .eq('prefix', prefix)
      .eq('active', true)
      .single();
    
    if (!validPrefix) {
      console.warn(`⚠️  ${objectType} ${objectName} uses unregistered prefix '${prefix}'`);
    }
  }
  
  private async validateViewNaming(viewName: string): Promise<void> {
    const issues: string[] = [];
    
    if (!viewName.endsWith('_view')) {
      issues.push('Missing _view suffix');
    }
    
    const prefix = viewName.split('_')[0];
    const { data: validPrefix } = await supabase
      .from('sys_table_prefixes')
      .select('id')
      .eq('prefix', prefix)
      .eq('active', true)
      .single();
    
    if (!validPrefix) {
      issues.push(`Invalid prefix '${prefix}'`);
    }
    
    if (issues.length > 0) {
      console.warn(`⚠️  View ${viewName} has naming issues: ${issues.join(', ')}`);
    } else {
      console.log(`✅ View ${viewName} follows naming conventions`);
    }
  }
  
  private async checkServicePattern(tableName: string): Promise<void> {
    // Check if this table might need a service
    const servicePatterns = [
      { pattern: /_settings$/, suggestion: 'SettingsService' },
      { pattern: /_config$/, suggestion: 'ConfigService' },
      { pattern: /_logs?$/, suggestion: 'LoggingService' },
      { pattern: /_queue$/, suggestion: 'QueueService' },
      { pattern: /_cache$/, suggestion: 'CacheService' }
    ];
    
    for (const { pattern, suggestion } of servicePatterns) {
      if (pattern.test(tableName)) {
        console.log(`💡 Table ${tableName} might benefit from a ${suggestion}`);
        
        // Check if service exists
        const { data: service } = await supabase
          .from('sys_shared_services')
          .select('id')
          .eq('service_name', suggestion)
          .single();
        
        if (!service) {
          console.log(`   Consider creating ${suggestion} for ${tableName}`);
        }
      }
    }
  }
  
  private async updateServiceDefinitions(): Promise<void> {
    console.log('\n🔄 Checking for service-related updates...');
    
    // Check if any new tables might need services
    const { data: recentTables } = await supabase
      .from('sys_database_change_events')
      .select('object_name')
      .eq('event_type', 'table_created')
      .eq('processed', true)
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (recentTables && recentTables.length > 0) {
      console.log(`Checking ${recentTables.length} recently created tables for service needs...`);
      // This could trigger service discovery or suggestions
    }
  }
}

// Run the monitor
const monitor = new ContinuousDatabaseMonitor();
monitor.run().catch(console.error);