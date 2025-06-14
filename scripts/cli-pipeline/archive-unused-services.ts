#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../packages/shared/services/supabase-client';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import * as path from 'path';

interface UnusedService {
  service_name: string;
  service_path: string;
  category: string;
  file_size?: number;
  archive_reason: string;
}

const UNUSED_SERVICES: UnusedService[] = [
  { service_name: 'AiProcessingService', service_path: 'packages/shared/services/ai-processing-service', category: 'ai', archive_reason: 'No implementation or usage found' },
  { service_name: 'AudioService', service_path: 'packages/shared/services/audio-service', category: 'media', archive_reason: 'Registry incorrectly showed usage' },
  { service_name: 'BatchDatabaseService', service_path: 'packages/shared/services/batch-database-service', category: 'database', archive_reason: 'No imports found' },
  { service_name: 'CliCommandUtils', service_path: 'packages/shared/services/cli-command-utils', category: 'cli', archive_reason: 'Utility functions moved elsewhere' },
  { service_name: 'CliRegistryService', service_path: 'packages/shared/services/cli-registry-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'CommandExecutionService', service_path: 'packages/shared/services/command-execution-service', category: 'System', archive_reason: 'Registry incorrectly showed dhg-admin-code usage' },
  { service_name: 'ConverterService', service_path: 'packages/shared/services/converter-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'DatabaseMetadataService', service_path: 'packages/shared/services/database-metadata-service', category: 'Database', archive_reason: 'Replaced by newer implementations' },
  { service_name: 'DocFilesService', service_path: 'packages/shared/services/doc-files-service', category: 'documentation', archive_reason: 'No usage found' },
  { service_name: 'DocumentClassificationService', service_path: 'packages/shared/services/document-classification-service-v2', category: 'document', archive_reason: 'Only in archived scripts' },
  { service_name: 'DocumentPipeline', service_path: 'packages/shared/services/document-pipeline', category: 'document', archive_reason: 'No actual imports found' },
  { service_name: 'EmailService', service_path: 'packages/shared/services/email-service', category: 'email', archive_reason: 'Incomplete implementation' },
  { service_name: 'ExpertService', service_path: 'packages/shared/services/expert-service', category: 'classification', archive_reason: 'No usage found' },
  { service_name: 'FileReader', service_path: 'packages/shared/services/file-reader', category: 'processing', archive_reason: 'No usage found' },
  { service_name: 'FileSystemService', service_path: 'packages/shared/services/file-system-service', category: 'file-management', archive_reason: 'No usage found' },
  { service_name: 'FormatterService', service_path: 'packages/shared/services/formatter-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'GmailService', service_path: 'packages/shared/services/gmail-service', category: 'email', archive_reason: 'No actual usage found' },
  { service_name: 'GoogleSyncService', service_path: 'packages/shared/services/google-sync-service', category: 'google', archive_reason: 'No usage found' },
  { service_name: 'GoogleUtils', service_path: 'packages/shared/services/google-utils', category: 'google', archive_reason: 'No usage found' },
  { service_name: 'LightAuthEnhancedService', service_path: 'packages/shared/services/light-auth-enhanced-service', category: 'auth', archive_reason: 'No usage found' },
  { service_name: 'LightAuthService', service_path: 'packages/shared/services/light-auth-service', category: 'auth', archive_reason: 'Replaced by newer auth services' },
  { service_name: 'MediaProcessingService', service_path: 'packages/shared/services/media-processing-service', category: 'media', archive_reason: 'No usage found' },
  { service_name: 'PdfProcessor', service_path: 'packages/shared/services/pdf-processor', category: 'processing', archive_reason: 'No usage found' },
  { service_name: 'PdfProcessorService', service_path: 'packages/shared/services/pdf-processor-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'ReportService', service_path: 'packages/shared/services/report-service', category: 'utility', archive_reason: 'Only in archived packages' },
  { service_name: 'ScriptPipeline', service_path: 'packages/shared/services/script-pipeline', category: 'utility', archive_reason: 'Only in archived packages' },
  { service_name: 'ScriptService', service_path: 'packages/shared/services/script-service', category: 'scripts', archive_reason: 'No usage found' },
  { service_name: 'ServiceDependencyMapping', service_path: 'packages/shared/services/service-dependency-mapping', category: 'system', archive_reason: 'No usage found' },
  { service_name: 'SupabaseClientFixed', service_path: 'packages/shared/services/supabase-client-fixed', category: 'database', archive_reason: 'Replaced by SupabaseClientService' },
  { service_name: 'SupabaseHelpers', service_path: 'packages/shared/services/supabase-helpers', category: 'database', archive_reason: 'No usage found' },
  { service_name: 'SystemService', service_path: 'packages/shared/services/system-service', category: 'system', archive_reason: 'No usage found' },
  { service_name: 'ThemeService', service_path: 'packages/shared/services/theme-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'UserProfileService', service_path: 'packages/shared/services/user-profile-service', category: 'utility', archive_reason: 'No usage found' },
  { service_name: 'WorktreeManagementService', service_path: 'packages/shared/services/worktree-management-service', category: 'Git Management', archive_reason: 'Registry incorrectly showed dhg-admin-code usage' },
  { service_name: 'WorktreeService', service_path: 'packages/shared/services/worktree-service', category: 'system', archive_reason: 'Registry incorrectly showed dhg-admin-code usage' }
];

async function archiveUnusedServices(): Promise<void> {
  console.log('🗂️  Archiving unused shared services...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const baseDir = '/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines';
  const archiveDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const archiveBase = `${baseDir}/packages/.archived_packages/shared-services.${archiveDate}`;
  
  // Create archive directory
  if (!existsSync(archiveBase)) {
    mkdirSync(archiveBase, { recursive: true });
    console.log(`📁 Created archive directory: ${archiveBase}`);
  }
  
  let archivedCount = 0;
  let skippedCount = 0;
  const archiveResults: Array<{
    service_name: string;
    status: 'archived' | 'not_found' | 'error';
    error?: string;
  }> = [];
  
  for (const service of UNUSED_SERVICES) {
    const servicePath = path.join(baseDir, service.service_path);
    const serviceName = service.service_name;
    
    console.log(`📦 Processing: ${serviceName}`);
    
    // Check if service directory exists
    if (!existsSync(servicePath)) {
      console.log(`   ⚠️  Service directory not found: ${servicePath}`);
      archiveResults.push({ service_name: serviceName, status: 'not_found' });
      skippedCount++;
      continue;
    }
    
    try {
      // Get file stats
      const stats = statSync(servicePath);
      const isDirectory = stats.isDirectory();
      
      // Determine archive path
      const relativePath = path.relative(baseDir, servicePath);
      const archivePath = path.join(archiveBase, relativePath.replace('packages/shared/services/', ''));
      
      // Create archive subdirectory
      const archiveDir = path.dirname(archivePath);
      if (!existsSync(archiveDir)) {
        mkdirSync(archiveDir, { recursive: true });
      }
      
      // Copy service to archive
      if (isDirectory) {
        await copyDirectory(servicePath, archivePath);
      } else {
        const content = readFileSync(servicePath, 'utf-8');
        writeFileSync(archivePath, content, 'utf-8');
      }
      
      // Record in database
      const { error: dbError } = await supabase
        .from('sys_archived_package_files')
        .insert({
          package_name: 'shared-services',
          original_path: relativePath,
          archived_path: path.relative(baseDir, archivePath),
          file_type: isDirectory ? 'directory' : 'typescript',
          file_size: isDirectory ? 0 : stats.size,
          last_modified: stats.mtime.toISOString(),
          archive_reason: service.archive_reason,
          dependencies_count: 0,
          created_by: 'claude-code'
        });
      
      if (dbError) {
        console.error(`   ❌ Database error for ${serviceName}:`, dbError);
        archiveResults.push({ service_name: serviceName, status: 'error', error: dbError.message });
        continue;
      }
      
      console.log(`   ✅ Archived to: ${archivePath}`);
      archivedCount++;
      archiveResults.push({ service_name: serviceName, status: 'archived' });
      
    } catch (error) {
      console.error(`   ❌ Error archiving ${serviceName}:`, error);
      archiveResults.push({ 
        service_name: serviceName, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  console.log(`\n📊 ARCHIVE SUMMARY:`);
  console.log(`   Services processed: ${UNUSED_SERVICES.length}`);
  console.log(`   Successfully archived: ${archivedCount}`);
  console.log(`   Not found: ${skippedCount}`);
  console.log(`   Errors: ${archiveResults.filter(r => r.status === 'error').length}`);
  
  if (archivedCount > 0) {
    console.log(`\n📁 Archive location: ${archiveBase}`);
    console.log(`💾 Database records created in sys_archived_package_files`);
    
    // Update service registry to mark as archived
    console.log(`\n🔄 Updating service registry...`);
    
    const archivedServices = archiveResults
      .filter(r => r.status === 'archived')
      .map(r => r.service_name);
    
    if (archivedServices.length > 0) {
      const { error: updateError } = await supabase
        .from('sys_shared_services')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString()
        })
        .in('service_name', archivedServices);
      
      if (updateError) {
        console.error('❌ Error updating service registry:', updateError);
      } else {
        console.log(`✅ Updated ${archivedServices.length} services to 'archived' status`);
      }
    }
  }
  
  console.log(`\n🎉 Service archiving complete!`);
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  const { execSync } = require('child_process');
  
  // Use system cp command for reliable directory copying
  try {
    execSync(`cp -r "${src}" "${dest}"`, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Failed to copy directory: ${error}`);
  }
}

if (require.main === module) {
  archiveUnusedServices().catch(console.error);
}

export { archiveUnusedServices };