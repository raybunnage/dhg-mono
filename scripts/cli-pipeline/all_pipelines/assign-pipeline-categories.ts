#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface PipelineCategory {
  pipeline: string;
  category: string;
}

// Map pipelines to their categories
const pipelineCategories: PipelineCategory[] = [
  // AI Services
  { pipeline: 'ai', category: 'ai_services' },
  { pipeline: 'prompt_service', category: 'ai_services' },
  
  // Document Processing
  { pipeline: 'document', category: 'document_processing' },
  { pipeline: 'document_types', category: 'document_processing' },
  { pipeline: 'classify', category: 'document_processing' },
  { pipeline: 'experts', category: 'document_processing' },
  
  // Data Sync
  { pipeline: 'google_sync', category: 'data_sync' },
  { pipeline: 'drive_filter', category: 'data_sync' },
  
  // Database Management
  { pipeline: 'database', category: 'database_management' },
  { pipeline: 'scripts', category: 'database_management' },
  
  // Authentication
  { pipeline: 'auth', category: 'authentication' },
  
  // Monitoring
  { pipeline: 'monitoring', category: 'monitoring' },
  { pipeline: 'tracking', category: 'monitoring' },
  { pipeline: 'refactor_tracking', category: 'monitoring' },
  { pipeline: 'all_pipelines', category: 'monitoring' },
  
  // Media
  { pipeline: 'media-processing', category: 'media' },
  { pipeline: 'presentations', category: 'media' },
  { pipeline: 'mime_types', category: 'media' },
  
  // Development
  { pipeline: 'dev_tasks', category: 'development' },
  { pipeline: 'work_summaries', category: 'development' },
  { pipeline: 'analysis', category: 'development' }
];

async function assignCategories() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Assigning categories to pipelines...\n');
  
  // First, get all categories
  const { data: categories, error: catError } = await supabase
    .from('command_categories')
    .select('id, name');
    
  if (catError || !categories) {
    console.error('Error fetching categories:', catError);
    return;
  }
  
  const categoryMap = new Map(categories.map(c => [c.name, c.id]));
  
  let successCount = 0;
  
  for (const mapping of pipelineCategories) {
    const categoryId = categoryMap.get(mapping.category);
    
    if (!categoryId) {
      console.error(`Category not found: ${mapping.category}`);
      continue;
    }
    
    const { error } = await supabase
      .from('command_pipelines')
      .update({ category_id: categoryId })
      .eq('name', mapping.pipeline);
      
    if (error) {
      console.error(`✗ ${mapping.pipeline} -> ${mapping.category}: ${error.message}`);
    } else {
      console.log(`✓ ${mapping.pipeline} -> ${mapping.category}`);
      successCount++;
    }
  }
  
  console.log(`\nSuccessfully assigned ${successCount} categories`);
  
  // Show summary
  const { data: summary } = await supabase
    .from('command_categories')
    .select(`
      name,
      display_name: command_pipelines(name)
    `)
    .order('display_order');
    
  console.log('\nPipelines by category:');
  summary?.forEach((category: any) => {
    const pipelines = category.display_name?.map((p: any) => p.name) || [];
    if (pipelines.length > 0) {
      console.log(`\n${category.name}:`);
      pipelines.forEach((p: string) => console.log(`  - ${p}`));
    }
  });
}

// Run the script
assignCategories().catch(console.error);