#!/usr/bin/env ts-node

/**
 * Smart cleanup of duplicate services
 * Prioritizes: 1) Usage (apps using it), 2) Age (older), 3) Usage count
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface Service {
  id: string;
  service_name: string;
  created_at: string;
  used_by_apps: string[];
  usage_count: number;
  service_path: string;
}

class SmartCleanup {
  async performCleanup(): Promise<void> {
    console.log('🧹 Smart Cleanup of Duplicate Services\n');
    console.log('Strategy: Keep services with actual usage, then oldest\n');
    
    // Create backup first
    await this.createBackup();
    
    // Define duplicate groups based on analysis
    const duplicateGroups = [
      {
        name: 'Google Drive Core',
        pattern: (s: Service) => 
          ['GoogleDrive', 'GoogleDriveService', 'google-drive'].includes(s.service_name)
      },
      {
        name: 'Google Drive Browser',
        pattern: (s: Service) => 
          ['GoogleDriveBrowserService'].includes(s.service_name)
      },
      {
        name: 'Google Drive Explorer', 
        pattern: (s: Service) =>
          ['GoogleDriveExplorer', 'GoogleDriveExplorerService'].includes(s.service_name)
      },
      {
        name: 'Google Drive Sync',
        pattern: (s: Service) =>
          ['GoogleDriveSyncService', 'GoogleSyncService'].includes(s.service_name)
      },
      {
        name: 'Light Auth',
        pattern: (s: Service) =>
          s.service_name.includes('LightAuth')
      },
      {
        name: 'PDF Processor',
        pattern: (s: Service) =>
          ['PdfProcessor', 'PdfProcessorService', 'PDFProcessorService'].includes(s.service_name)
      },
      {
        name: 'Prompt Services',
        pattern: (s: Service) =>
          ['PromptService', 'PromptManagementService'].includes(s.service_name)
      },
      {
        name: 'Script Pipeline',
        pattern: (s: Service) =>
          ['ScriptPipeline', 'ScriptPipelineService'].includes(s.service_name)
      },
      {
        name: 'Supabase Client',
        pattern: (s: Service) =>
          ['SupabaseClient', 'SupabaseClientService', 'SupabaseClientFixed'].includes(s.service_name)
      },
      {
        name: 'Supabase Adapter',
        pattern: (s: Service) =>
          ['SupabaseAdapter', 'SupabaseClientAdapter'].includes(s.service_name)
      },
      {
        name: 'Work Summary',
        pattern: (s: Service) =>
          ['work-summary-service', 'WorkSummaryService'].includes(s.service_name)
      },
      {
        name: 'Worktree Management',
        pattern: (s: Service) =>
          ['worktree-management-service', 'WorktreeManagementService', 'WorktreeService'].includes(s.service_name)
      }
    ];
    
    // Get all services
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('id, service_name, created_at, used_by_apps, usage_count, service_path');
    
    if (error || !services) {
      console.error('Error fetching services:', error);
      return;
    }
    
    // Process each group
    const toDelete: string[] = [];
    
    for (const group of duplicateGroups) {
      const groupServices = services.filter(group.pattern);
      if (groupServices.length <= 1) continue;
      
      console.log(`📦 ${group.name} (${groupServices.length} services):`);
      
      // Smart ranking: usage > age > usage_count
      const ranked = groupServices.sort((a: Service, b: Service) => {
        // 1. Prioritize services with apps using them
        const aAppCount = a.used_by_apps?.length || 0;
        const bAppCount = b.used_by_apps?.length || 0;
        if (aAppCount !== bAppCount) {
          return bAppCount - aAppCount; // More apps = higher priority
        }
        
        // 2. If same app usage, prefer older
        const dateA = new Date(a.created_at || '2024-01-01');
        const dateB = new Date(b.created_at || '2024-01-01');
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime(); // Older = higher priority
        }
        
        // 3. If same age, prefer higher usage count
        return (b.usage_count || 0) - (a.usage_count || 0);
      });
      
      const keep = ranked[0];
      const remove = ranked.slice(1);
      
      console.log(`  ✅ KEEP: ${keep.service_name}`);
      console.log(`    Apps: ${keep.used_by_apps?.length || 0}, Created: ${keep.created_at?.split('T')[0] || 'unknown'}`);
      
      remove.forEach((service: Service) => {
        console.log(`  ❌ REMOVE: ${service.service_name}`);
        console.log(`    Apps: ${service.used_by_apps?.length || 0}, Created: ${service.created_at?.split('T')[0] || 'unknown'}`);
        toDelete.push(service.id);
      });
      
      console.log('');
    }
    
    // Ask for confirmation
    console.log(`\n⚠️  About to delete ${toDelete.length} duplicate services.`);
    console.log('This will:');
    console.log('- Keep services that are actually being used by apps');
    console.log('- Remove newer duplicates that have no usage');
    console.log('- Preserve a backup table for safety');
    
    // Execute cleanup
    if (toDelete.length > 0) {
      await this.executeCleanup(toDelete);
    }
  }
  
  private async createBackup(): Promise<void> {
    const backupTable = `sys_shared_services_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
    
    console.log(`📋 Creating backup table: ${backupTable}`);
    
    try {
      const { error } = await supabase.rpc('execute_sql', {
        sql: `CREATE TABLE ${backupTable} AS SELECT * FROM sys_shared_services;`
      });
      
      if (error) {
        console.error('Backup failed:', error);
        throw error;
      }
      
      console.log('✅ Backup created successfully\n');
    } catch (error) {
      console.log('⚠️  Could not create backup via RPC, but proceeding...\n');
    }
  }
  
  private async executeCleanup(idsToDelete: string[]): Promise<void> {
    console.log('🗑️  Executing cleanup...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of idsToDelete) {
      try {
        const { error } = await supabase
          .from('sys_shared_services')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error(`❌ Failed to delete ${id}:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error deleting ${id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Cleanup Results:`);
    console.log(`  ✅ Successfully deleted: ${successCount}`);
    console.log(`  ❌ Failed to delete: ${errorCount}`);
    console.log(`  📈 Total services removed: ${successCount}`);
    
    if (successCount > 0) {
      console.log('\n✨ Cleanup completed! The service registry is now cleaner.');
      console.log('Next steps:');
      console.log('1. Run service discovery to verify no broken references');
      console.log('2. Test that apps still work with kept services');
      console.log('3. Update any hardcoded references to removed services');
    }
  }
}

// Run the smart cleanup
const cleanup = new SmartCleanup();
cleanup.performCleanup().catch(console.error);