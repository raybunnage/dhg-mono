#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

const services = [
  // Adapters
  { service_name: 'supabase-adapter', category: 'adapters', description: 'Adapter for Supabase connections in browser environments' },
  
  // AI & Processing
  { service_name: 'ai-service', category: 'ai', description: 'AI processing and integration service' },
  { service_name: 'claude-service', category: 'ai', description: 'Claude AI API integration service' },
  { service_name: 'file-reader', category: 'processing', description: 'File reading and parsing service' },
  { service_name: 'pdf-processor', category: 'processing', description: 'PDF file processing and extraction service' },
  
  // Authentication
  { service_name: 'auth-service', category: 'auth', description: 'Authentication and authorization service' },
  { service_name: 'light-auth-service', category: 'auth', description: 'Lightweight authentication service' },
  
  // CLI & Pipeline
  { service_name: 'cli-command-utils', category: 'cli', description: 'CLI command utilities and helpers' },
  { service_name: 'pipeline-service', category: 'cli', description: 'Pipeline management and orchestration service' },
  { service_name: 'prompt-service', category: 'cli', description: 'Prompt management and template service' },
  
  // Database
  { service_name: 'supabase-client', category: 'database', description: 'Supabase client singleton service' },
  { service_name: 'supabase-service', category: 'database', description: 'Supabase operations and utilities service' },
  { service_name: 'database-service', category: 'database', description: 'General database operations service' },
  
  // Documentation
  { service_name: 'documentation-service', category: 'documentation', description: 'Documentation generation and management service' },
  { service_name: 'doc-files-service', category: 'documentation', description: 'Documentation file handling service' },
  
  // Email
  { service_name: 'email-service', category: 'email', description: 'Email processing and sending service' },
  { service_name: 'gmail-service', category: 'email', description: 'Gmail API integration service' },
  
  // Experts & Classification
  { service_name: 'expert-service', category: 'classification', description: 'Expert profile management service' },
  { service_name: 'classification-service', category: 'classification', description: 'Document classification service' },
  { service_name: 'document-service', category: 'classification', description: 'Document management service' },
  
  // Google Integration
  { service_name: 'google-sync-service', category: 'google', description: 'Google Drive synchronization service' },
  { service_name: 'google-utils', category: 'google', description: 'Google API utilities and helpers' },
  
  // Media
  { service_name: 'media-processing-service', category: 'media', description: 'Media file processing and conversion service' },
  { service_name: 'transcription-service', category: 'media', description: 'Audio/video transcription service' },
  
  // Reporting
  { service_name: 'report-service', category: 'reporting', description: 'Report generation and formatting service' },
  
  // Scripts
  { service_name: 'script-service', category: 'scripts', description: 'Script management and execution service' },
  
  // System & Tools
  { service_name: 'service-dependency-mapping', category: 'system', description: 'Service dependency tracking and analysis' },
  { service_name: 'system-service', category: 'system', description: 'System utilities and operations service' },
  { service_name: 'task-service', category: 'system', description: 'Task management and tracking service' },
  { service_name: 'worktree-service', category: 'system', description: 'Git worktree management service' }
];

async function populateSharedServices() {
  console.log('🚀 Populating shared services table...');
  
  try {
    // Insert all services
    const { data, error } = await supabase
      .from('shared_services')
      .upsert(services, { 
        onConflict: 'service_name',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error('❌ Error inserting services:', error);
      throw error;
    }
    
    console.log(`✅ Successfully populated ${data?.length || 0} services`);
    
    // Show summary by category
    const categoryCounts = services.reduce((acc, service) => {
      acc[service.category] = (acc[service.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📊 Services by category:');
    Object.entries(categoryCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} services`);
      });
    
  } catch (error) {
    console.error('❌ Failed to populate services:', error);
    process.exit(1);
  }
}

// Run the script
populateSharedServices();