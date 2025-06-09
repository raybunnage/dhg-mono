#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.development') });

interface DocumentInfo {
  file_path: string;
  title: string;
  area: string;
  description: string;
  review_frequency_days: number;
  priority: string;
  owner: string;
  status: string;
}

const documents: DocumentInfo[] = [
  {
    file_path: 'docs/continuously-updated/CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md',
    title: 'Continuously Updated Template Guide',
    area: 'documentation',
    description: 'Template guide for creating continuously updated documents',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'system',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/apps-documentation.md',
    title: 'Apps Documentation',
    area: 'applications',
    description: 'Documentation for all applications in the monorepo',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/cli-pipelines-documentation-updated-2025-06-08.md',
    title: 'CLI Pipelines Documentation (Updated)',
    area: 'cli',
    description: 'Updated documentation for CLI pipeline scripts and commands',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/cli-pipelines-documentation.md',
    title: 'CLI Pipelines Documentation',
    area: 'cli',
    description: 'Documentation for CLI pipeline scripts and commands',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/code-continuous-monitoring.md',
    title: 'Code Continuous Monitoring',
    area: 'monitoring',
    description: 'System for continuously monitoring code documentation',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'system',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/database-maintenance-guide.md',
    title: 'Database Maintenance Guide',
    area: 'database',
    description: 'Guide for maintaining and updating database systems',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'database',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/git-history-analysis-server.md',
    title: 'Git History Analysis Server',
    area: 'git',
    description: 'Documentation for git history analysis server',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/mp4-pipeline-auto-update-system.md',
    title: 'MP4 Pipeline Auto Update System',
    area: 'media',
    description: 'Auto-update system for MP4 processing pipeline',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'media',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/mp4-to-m4a-pipeline-implementation.md',
    title: 'MP4 to M4A Pipeline Implementation',
    area: 'media',
    description: 'Implementation details for MP4 to M4A conversion pipeline',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'media',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/packages-archiving-cleanup-plan-2025-06-08.md',
    title: 'Packages Archiving Cleanup Plan',
    area: 'maintenance',
    description: 'Plan for archiving and cleaning up packages',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/prompt-service-implementation-progress.md',
    title: 'Prompt Service Implementation Progress',
    area: 'ai',
    description: 'Progress tracking for prompt service implementation',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'ai',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/script-and-prompt-management-guide.md',
    title: 'Script and Prompt Management Guide',
    area: 'scripts',
    description: 'Guide for managing scripts and AI prompts',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/script-cleanup-phase3-lessons-learned-2025-06-08.md',
    title: 'Script Cleanup Phase 3 Lessons Learned',
    area: 'scripts',
    description: 'Lessons learned from script cleanup phase 3',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'development',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/testing-quick-start-dhg-apps.md',
    title: 'Testing Quick Start DHG Apps',
    area: 'testing',
    description: 'Quick start guide for testing DHG applications',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'testing',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/testing-vision-and-implementation-guide.md',
    title: 'Testing Vision and Implementation Guide',
    area: 'testing',
    description: 'Comprehensive guide for testing vision and implementation',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'testing',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/testing-vision-and-implementation.md',
    title: 'Testing Vision and Implementation',
    area: 'testing',
    description: 'Testing vision and implementation strategy',
    review_frequency_days: 7,
    priority: 'high',
    owner: 'testing',
    status: 'active'
  },
  {
    file_path: 'docs/continuously-updated/worktree-assignment-system.md',
    title: 'Worktree Assignment System',
    area: 'git',
    description: 'System for managing worktree assignments',
    review_frequency_days: 7,
    priority: 'medium',
    owner: 'development',
    status: 'active'
  }
];

async function populateContinuousDocs() {
  console.log('🔗 Connecting to Supabase...');
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    // First, check existing documents to avoid duplicates
    const { data: existingDocs, error: fetchError } = await supabase
      .from('doc_continuous_monitoring')
      .select('file_path');
    
    if (fetchError) {
      console.error('❌ Error fetching existing documents:', fetchError);
      return;
    }

    const existingPaths = new Set(existingDocs?.map(doc => doc.file_path) || []);
    
    // Filter out documents that already exist
    const newDocuments = documents.filter(doc => !existingPaths.has(doc.file_path));
    
    if (newDocuments.length === 0) {
      console.log('✅ All documents already exist in the database');
      return;
    }

    console.log(`📝 Adding ${newDocuments.length} new documents to doc_continuous_monitoring...`);

    // Calculate next review date (7 days from now)
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 7);

    // Add metadata to each document
    const documentsWithMetadata = newDocuments.map(doc => ({
      ...doc,
      next_review_date: nextReviewDate.toISOString(),
      metadata: {
        source: 'continuously-updated',
        added_by: 'populate-continuous-docs.ts',
        added_at: new Date().toISOString()
      }
    }));

    // Insert documents in batches to avoid timeouts
    const batchSize = 5;
    for (let i = 0; i < documentsWithMetadata.length; i += batchSize) {
      const batch = documentsWithMetadata.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('doc_continuous_monitoring')
        .insert(batch)
        .select();

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        continue;
      }

      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${data?.length} documents`);
    }

    // Verify the total count
    const { count, error: countError } = await supabase
      .from('doc_continuous_monitoring')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting documents:', countError);
    } else {
      console.log(`\n✅ Total documents in doc_continuous_monitoring: ${count}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
populateContinuousDocs().catch(console.error);