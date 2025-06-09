#!/usr/bin/env ts-node

/**
 * Sync continuously-updated documentation files to database
 * Registers all files in docs/continuously-updated for monitoring
 */

import fs from 'fs';
import path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client.js';

interface DocumentConfig {
  path: string;
  title: string;
  area: string;
  description: string;
  frequency_days: number;
  priority: 'high' | 'medium' | 'low';
}

// Configuration for continuously-updated documents
const DOCUMENT_CONFIGS: DocumentConfig[] = [
  {
    path: 'docs/continuously-updated/apps-documentation.md',
    title: 'Applications Overview',
    area: 'apps',
    description: 'Overview of all applications in the monorepo',
    frequency_days: 30,
    priority: 'high'
  },
  {
    path: 'docs/continuously-updated/cli-pipelines-documentation.md',
    title: 'CLI Pipeline Architecture',
    area: 'cli-pipeline',
    description: 'Central documentation for all CLI pipelines and commands',
    frequency_days: 14,
    priority: 'high'
  },
  {
    path: 'docs/continuously-updated/cli-pipelines-documentation-updated-2025-06-08.md',
    title: 'CLI Pipeline Architecture (Updated)',
    area: 'cli-pipeline',
    description: 'Updated version of CLI pipeline documentation',
    frequency_days: 14,
    priority: 'high'
  },
  {
    path: 'docs/continuously-updated/mp4-pipeline-auto-update-system.md',
    title: 'MP4 Pipeline Auto-Update System',
    area: 'media-processing',
    description: 'Documentation for automated MP4 processing pipeline',
    frequency_days: 21,
    priority: 'medium'
  },
  {
    path: 'docs/continuously-updated/mp4-to-m4a-pipeline-implementation.md',
    title: 'MP4 to M4A Pipeline Implementation',
    area: 'media-processing',
    description: 'Implementation guide for MP4 to M4A conversion pipeline',
    frequency_days: 21,
    priority: 'medium'
  },
  {
    path: 'docs/continuously-updated/prompt-service-implementation-progress.md',
    title: 'Prompt Service Implementation Progress',
    area: 'ai',
    description: 'Progress tracking for prompt service implementation',
    frequency_days: 7,
    priority: 'high'
  },
  {
    path: 'docs/continuously-updated/script-and-prompt-management-guide.md',
    title: 'Script and Prompt Management Guide',
    area: 'scripts',
    description: 'Guide for managing scripts and prompts in the system',
    frequency_days: 21,
    priority: 'medium'
  },
  {
    path: 'docs/continuously-updated/script-cleanup-phase3-lessons-learned-2025-06-08.md',
    title: 'Script Cleanup Phase 3 Lessons Learned',
    area: 'scripts',
    description: 'Lessons learned from script cleanup phase 3',
    frequency_days: 30,
    priority: 'medium'
  }
];

async function syncToDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('📋 Syncing continuously-updated documents to database...');
    
    let registered = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const config of DOCUMENT_CONFIGS) {
      const fullPath = path.resolve(config.path);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  File not found: ${config.path}`);
        skipped++;
        continue;
      }
      
      // Check if already registered
      const { data: existing } = await supabase
        .from('doc_continuous_monitoring')
        .select('id, title, area, description, review_frequency_days, priority')
        .eq('file_path', config.path)
        .single();
      
      if (existing) {
        // Update existing record if config has changed
        const needsUpdate = 
          existing.title !== config.title ||
          existing.area !== config.area ||
          existing.description !== config.description ||
          existing.review_frequency_days !== config.frequency_days ||
          existing.priority !== config.priority;
        
        if (needsUpdate) {
          const { error } = await supabase
            .from('doc_continuous_monitoring')
            .update({
              title: config.title,
              area: config.area,
              description: config.description,
              review_frequency_days: config.frequency_days,
              priority: config.priority,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          
          if (error) throw error;
          
          console.log(`🔄 Updated: ${config.title}`);
          updated++;
        } else {
          console.log(`✅ Already registered: ${config.title}`);
          skipped++;
        }
      } else {
        // Register new document
        const { error } = await supabase
          .from('doc_continuous_monitoring')
          .insert({
            file_path: config.path,
            title: config.title,
            area: config.area,
            description: config.description,
            review_frequency_days: config.frequency_days,
            priority: config.priority,
            status: 'active'
          });
        
        if (error) throw error;
        
        console.log(`📝 Registered: ${config.title}`);
        registered++;
      }
    }
    
    console.log('\\n📊 Sync Summary:');
    console.log(`   📝 Registered: ${registered}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ✅ Skipped: ${skipped}`);
    console.log(`   📋 Total: ${DOCUMENT_CONFIGS.length}`);
    
    // Show documents needing review
    console.log('\\n🔍 Checking for documents needing review...');
    const { data: needingReview } = await supabase
      .rpc('get_docs_needing_review');
    
    if (needingReview && needingReview.length > 0) {
      console.log(`⏰ ${needingReview.length} documents need review:`);
      needingReview.forEach((doc: any) => {
        console.log(`   📄 ${doc.title} (${doc.days_overdue} days overdue)`);
      });
    } else {
      console.log('✅ All documents are up to date!');
    }
    
  } catch (error) {
    console.error('❌ Error syncing to database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncToDatabase();
}

export { syncToDatabase, DOCUMENT_CONFIGS };