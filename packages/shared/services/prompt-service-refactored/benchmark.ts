/**
 * Performance benchmark for PromptManagementService
 */

import { PromptManagementService } from './PromptManagementService';
import { SupabaseClientService } from '../supabase-client';
import { PromptService } from '../prompt-service/prompt-service';

async function benchmark() {
  console.log('Starting PromptManagementService benchmark...\n');
  
  // Get dependencies
  const supabase = SupabaseClientService.getInstance().getClient();
  const promptService = PromptService.getInstance();
  const service = new PromptManagementService(supabase, promptService);
  
  try {
    // Benchmark 1: Health Check
    console.log('1. Health Check Performance:');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`   ✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    
    // Benchmark 2: Prompt Categories
    console.log('\n2. Category Operations:');
    const catStart = Date.now();
    const categories = await service.getPromptCategories();
    const catDuration = Date.now() - catStart;
    console.log(`   ✓ Fetch categories: ${catDuration}ms (found: ${categories.length} categories)`);
    
    // Benchmark 3: Document Types
    console.log('\n3. Document Type Operations:');
    const docTypesStart = Date.now();
    const docTypes = await service.getDocumentTypes();
    const docTypesDuration = Date.now() - docTypesStart;
    console.log(`   ✓ Fetch all document types: ${docTypesDuration}ms (found: ${docTypes.length} types)`);
    
    // Test filtered document types
    const filteredStart = Date.now();
    const promptTypes = await service.getDocumentTypes('prompts');
    const filteredDuration = Date.now() - filteredStart;
    console.log(`   ✓ Fetch prompt document types: ${filteredDuration}ms (found: ${promptTypes.length} types)`);
    
    // Benchmark 4: Database Prompts
    console.log('\n4. Prompt Operations:');
    const promptsStart = Date.now();
    const prompts = await service.getDatabasePrompts();
    const promptsDuration = Date.now() - promptsStart;
    console.log(`   ✓ Fetch all prompts: ${promptsDuration}ms (found: ${prompts.length} prompts)`);
    
    // Test single prompt fetch
    if (prompts.length > 0) {
      const singleStart = Date.now();
      const singlePrompt = await service.getPromptById(prompts[0].id);
      const singleDuration = Date.now() - singleStart;
      console.log(`   ✓ Fetch single prompt: ${singleDuration}ms`);
    }
    
    // Benchmark 5: Documentation Files
    console.log('\n5. Documentation File Operations:');
    const filesStart = Date.now();
    const files = await service.getDocumentationFiles(100);
    const filesDuration = Date.now() - filesStart;
    console.log(`   ✓ Fetch documentation files: ${filesDuration}ms (found: ${files.length} files)`);
    
    // Benchmark 6: Template Operations
    console.log('\n6. Template Operations:');
    const templatesStart = Date.now();
    const templates = await service.getPromptOutputTemplates();
    const templatesDuration = Date.now() - templatesStart;
    console.log(`   ✓ Fetch output templates: ${templatesDuration}ms (found: ${templates.length} templates)`);
    
    // Benchmark 7: Relationship Queries
    console.log('\n7. Relationship Operations:');
    if (prompts.length > 0) {
      const relStart = Date.now();
      const relationships = await service.getPromptRelationshipsWithFiles(prompts[0].id);
      const relDuration = Date.now() - relStart;
      console.log(`   ✓ Fetch relationships with files: ${relDuration}ms (found: ${relationships.relationships.length} relationships, ${relationships.files.length} files)`);
      
      const assocStart = Date.now();
      const associations = await service.getPromptTemplateAssociations(prompts[0].id);
      const assocDuration = Date.now() - assocStart;
      console.log(`   ✓ Fetch template associations: ${assocDuration}ms (found: ${associations.associations.length} associations)`);
    }
    
    // Benchmark 8: Markdown Processing
    console.log('\n8. Markdown Processing:');
    const testContent = `---
name: Benchmark Test
description: Performance test prompt
version: 1.0.0
tags:
  - benchmark
  - test
---

This is a test prompt for benchmarking markdown processing.`;
    
    const parseStart = Date.now();
    const parsed = service.parseMarkdownFrontmatter(testContent);
    const parseDuration = Date.now() - parseStart;
    console.log(`   ✓ Parse markdown frontmatter: ${parseDuration}ms`);
    
    const buildStart = Date.now();
    const metadata = service.buildMetadataObject(parsed.metadata, parsed.content, 'benchmark.md');
    const buildDuration = Date.now() - buildStart;
    console.log(`   ✓ Build metadata object: ${buildDuration}ms`);
    
    // Get final metrics
    console.log('\n9. Service Metrics:');
    const metrics = service.getMetrics();
    console.log('   ✓ Total Prompts Created:', metrics.totalPromptsCreated);
    console.log('   ✓ Total Prompts Updated:', metrics.totalPromptsUpdated);
    console.log('   ✓ Total Prompts Deleted:', metrics.totalPromptsDeleted);
    console.log('   ✓ Total Categories Created:', metrics.totalCategoriesCreated);
    console.log('   ✓ Total Relationships Updated:', metrics.totalRelationshipsUpdated);
    console.log('   ✓ Total Templates Associated:', metrics.totalTemplatesAssociated);
    console.log('   ✓ Total Markdown Imports:', metrics.totalMarkdownImports);
    console.log('   ✓ Total Markdown Exports:', metrics.totalMarkdownExports);
    console.log('   ✓ Total Errors:', metrics.totalErrors);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };