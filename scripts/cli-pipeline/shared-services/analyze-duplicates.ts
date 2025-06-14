#!/usr/bin/env ts-node

/**
 * Analyze and fix duplicate services in sys_shared_services
 * Favor older services and remove newer duplicates
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

class DuplicateAnalyzer {
  async analyze(): Promise<void> {
    console.log('🔍 Analyzing duplicate services...\n');
    
    // Get all services
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('id, service_name, created_at, used_by_apps, usage_count, service_path')
      .order('service_name');
    
    if (error || !services) {
      console.error('Error fetching services:', error);
      return;
    }
    
    console.log(`Total services: ${services.length}\n`);
    
    // Analyze each category
    this.analyzeGoogleDriveServices(services);
    this.analyzeGoogleServices(services);
    this.analyzeLightAuthServices(services);
    this.analyzePdfProcessors(services);
    this.analyzePromptServices(services);
    this.analyzeScriptServices(services);
    this.analyzeSupabaseServices(services);
    this.analyzeWorkSummaryServices(services);
    this.analyzeWorktreeServices(services);
    this.analyzeMockDataServices(services);
    
    // Generate cleanup recommendations
    await this.generateCleanupPlan(services);
  }
  
  private analyzeGoogleDriveServices(services: Service[]): void {
    const googleDriveServices = services.filter(s => 
      s.service_name.toLowerCase().includes('googledrive') || 
      s.service_name.toLowerCase().includes('google-drive')
    );
    
    this.printServiceGroup('GOOGLE DRIVE SERVICES', googleDriveServices);
  }
  
  private analyzeGoogleServices(services: Service[]): void {
    const googleServices = services.filter(s => 
      s.service_name.toLowerCase().includes('google') && 
      (s.service_name.toLowerCase().includes('explorer') || 
       s.service_name.toLowerCase().includes('sync') ||
       s.service_name.toLowerCase().includes('service'))
    );
    
    this.printServiceGroup('GOOGLE RELATED SERVICES', googleServices);
  }
  
  private analyzeLightAuthServices(services: Service[]): void {
    const lightAuthServices = services.filter(s => 
      s.service_name.toLowerCase().includes('lightauth')
    );
    
    this.printServiceGroup('LIGHT AUTH SERVICES', lightAuthServices);
  }
  
  private analyzePdfProcessors(services: Service[]): void {
    const pdfServices = services.filter(s => 
      s.service_name.toLowerCase().includes('pdf')
    );
    
    this.printServiceGroup('PDF PROCESSOR SERVICES', pdfServices);
  }
  
  private analyzePromptServices(services: Service[]): void {
    const promptServices = services.filter(s => 
      s.service_name.toLowerCase().includes('prompt') && 
      (s.service_name.toLowerCase().includes('service') || 
       s.service_name.toLowerCase().includes('management'))
    );
    
    this.printServiceGroup('PROMPT SERVICES', promptServices);
  }
  
  private analyzeScriptServices(services: Service[]): void {
    const scriptServices = services.filter(s => 
      s.service_name.toLowerCase().includes('script') && 
      s.service_name.toLowerCase().includes('pipeline')
    );
    
    this.printServiceGroup('SCRIPT PIPELINE SERVICES', scriptServices);
  }
  
  private analyzeSupabaseServices(services: Service[]): void {
    const supabaseServices = services.filter(s => 
      s.service_name.toLowerCase().includes('supabase')
    );
    
    this.printServiceGroup('SUPABASE SERVICES', supabaseServices);
  }
  
  private analyzeWorkSummaryServices(services: Service[]): void {
    const workSummaryServices = services.filter(s => 
      s.service_name.toLowerCase().includes('work') && 
      s.service_name.toLowerCase().includes('summary')
    );
    
    this.printServiceGroup('WORK SUMMARY SERVICES', workSummaryServices);
  }
  
  private analyzeWorktreeServices(services: Service[]): void {
    const worktreeServices = services.filter(s => 
      s.service_name.toLowerCase().includes('worktree')
    );
    
    this.printServiceGroup('WORKTREE SERVICES', worktreeServices);
  }
  
  private analyzeMockDataServices(services: Service[]): void {
    const mockDataServices = services.filter(s => 
      s.service_name.toLowerCase().includes('mockdata') ||
      s.service_name.toLowerCase().includes('mock') && s.service_name.toLowerCase().includes('data')
    );
    
    this.printServiceGroup('MOCK DATA SERVICES', mockDataServices);
  }
  
  private printServiceGroup(title: string, services: Service[]): void {
    if (services.length === 0) return;
    
    console.log(`📦 ${title} (${services.length}):`);
    services.forEach(s => {
      const createdDate = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : 'unknown';
      const usage = s.usage_count || 0;
      const apps = s.used_by_apps?.length || 0;
      
      console.log(`  • ${s.service_name}`);
      console.log(`    Created: ${createdDate}, Usage: ${usage}, Apps: ${apps}`);
      console.log(`    Path: ${s.service_path || 'unknown'}`);
    });
    console.log('');
  }
  
  private async generateCleanupPlan(services: Service[]): Promise<void> {
    console.log('🧹 CLEANUP RECOMMENDATIONS\n');
    
    const duplicateGroups = this.identifyDuplicateGroups(services);
    
    for (const [groupName, duplicates] of Object.entries(duplicateGroups)) {
      if (duplicates.length <= 1) continue;
      
      console.log(`📋 ${groupName.toUpperCase()} DUPLICATES:`);
      
      // Sort by creation date (oldest first), then by usage
      const sorted = duplicates.sort((a, b) => {
        const dateA = new Date(a.created_at || '2024-01-01');
        const dateB = new Date(b.created_at || '2024-01-01');
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime(); // Oldest first
        }
        return (b.usage_count || 0) - (a.usage_count || 0); // Higher usage first
      });
      
      const keep = sorted[0];
      const remove = sorted.slice(1);
      
      console.log(`  ✅ KEEP: ${keep.service_name} (oldest, created: ${keep.created_at || 'unknown'})`);
      console.log(`    Usage: ${keep.usage_count || 0}, Apps: ${keep.used_by_apps?.length || 0}`);
      
      remove.forEach(service => {
        console.log(`  ❌ REMOVE: ${service.service_name} (newer duplicate)`);
        console.log(`    Created: ${service.created_at || 'unknown'}, Usage: ${service.usage_count || 0}`);
      });
      
      console.log('');
    }
    
    // Generate SQL for cleanup
    await this.generateCleanupSQL(duplicateGroups);
  }
  
  private identifyDuplicateGroups(services: Service[]): Record<string, Service[]> {
    const groups: Record<string, Service[]> = {};
    
    // Define duplicate patterns
    const patterns = [
      {
        name: 'google-drive',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('googledrive') || 
          s.service_name.toLowerCase().includes('google-drive')
        )
      },
      {
        name: 'google-explorer',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('googledriveexplorer')
        )
      },
      {
        name: 'google-sync',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('google') && 
          s.service_name.toLowerCase().includes('sync')
        )
      },
      {
        name: 'light-auth',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('lightauth')
        )
      },
      {
        name: 'pdf-processor',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('pdf') && 
          s.service_name.toLowerCase().includes('process')
        )
      },
      {
        name: 'prompt-service',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('prompt') && 
          (s.service_name.toLowerCase().includes('service') || 
           s.service_name.toLowerCase().includes('management'))
        )
      },
      {
        name: 'script-pipeline',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('script') && 
          s.service_name.toLowerCase().includes('pipeline')
        )
      },
      {
        name: 'supabase-client',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('supabase') && 
          s.service_name.toLowerCase().includes('client')
        )
      },
      {
        name: 'supabase-adapter',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('supabase') && 
          s.service_name.toLowerCase().includes('adapter')
        )
      },
      {
        name: 'work-summary',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('work') && 
          s.service_name.toLowerCase().includes('summary')
        )
      },
      {
        name: 'worktree-management',
        services: services.filter(s => 
          s.service_name.toLowerCase().includes('worktree') && 
          s.service_name.toLowerCase().includes('management')
        )
      }
    ];
    
    patterns.forEach(pattern => {
      if (pattern.services.length > 1) {
        groups[pattern.name] = pattern.services;
      }
    });
    
    return groups;
  }
  
  private async generateCleanupSQL(duplicateGroups: Record<string, Service[]>): Promise<void> {
    console.log('📝 CLEANUP SQL:\n');
    
    const servicesToRemove: string[] = [];
    
    for (const [groupName, duplicates] of Object.entries(duplicateGroups)) {
      if (duplicates.length <= 1) continue;
      
      // Sort by creation date (oldest first)
      const sorted = duplicates.sort((a, b) => {
        const dateA = new Date(a.created_at || '2024-01-01');
        const dateB = new Date(b.created_at || '2024-01-01');
        return dateA.getTime() - dateB.getTime();
      });
      
      const keep = sorted[0];
      const remove = sorted.slice(1);
      
      console.log(`-- ${groupName.toUpperCase()} cleanup`);
      console.log(`-- Keeping: ${keep.service_name} (oldest)`);
      
      remove.forEach(service => {
        console.log(`-- Removing: ${service.service_name} (duplicate)`);
        servicesToRemove.push(service.id);
      });
      
      console.log('');
    }
    
    if (servicesToRemove.length > 0) {
      console.log('-- Execute this SQL to clean up duplicates:');
      console.log('BEGIN;');
      console.log('');
      
      servicesToRemove.forEach(id => {
        console.log(`DELETE FROM sys_shared_services WHERE id = '${id}';`);
      });
      
      console.log('');
      console.log('COMMIT;');
      console.log('');
      console.log(`-- This will remove ${servicesToRemove.length} duplicate services`);
    }
  }
}

// Run the analyzer
const analyzer = new DuplicateAnalyzer();
analyzer.analyze().catch(console.error);