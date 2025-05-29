#!/usr/bin/env ts-node
/**
 * Test Classification Command
 * 
 * Allows testing the unified classification service with specific files
 * or scenarios to verify everything is working correctly.
 */

import { Command } from 'commander';
import { unifiedClassificationService } from '../../../packages/shared/services/unified-classification-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import chalk from 'chalk';

const program = new Command();

program
  .name('test-classify')
  .description('Test the unified classification service with specific files or scenarios')
  .option('--file-id <id>', 'Test with a specific file ID from google_sources')
  .option('--file-name <name>', 'Test with files matching this name pattern')
  .option('--mime-type <type>', 'Test specific mime type handling')
  .option('--test-prompts', 'Test prompt availability for all mime types')
  .option('--test-extraction', 'Test content extraction for different file types')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('\n🧪 Unified Classification Service Test'));
      console.log(chalk.cyan('=====================================\n'));

      const supabase = SupabaseClientService.getInstance().getClient();

      // Test 1: Prompt Availability
      if (options.testPrompts) {
        await testPromptAvailability();
      }

      // Test 2: Specific File Classification
      if (options.fileId || options.fileName) {
        await testFileClassification(options.fileId, options.fileName, options.verbose);
      }

      // Test 3: Mime Type Handling
      if (options.mimeType) {
        await testMimeTypeHandling(options.mimeType);
      }

      // Test 4: Content Extraction
      if (options.testExtraction) {
        await testContentExtraction();
      }

      // If no specific test requested, run basic health check
      if (!options.testPrompts && !options.fileId && !options.fileName && 
          !options.mimeType && !options.testExtraction) {
        await runHealthCheck();
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

async function testPromptAvailability() {
  console.log(chalk.yellow('📋 Testing Prompt Availability\n'));

  const mimeTypePromptPairs = [
    { mimeType: 'application/pdf', prompt: 'pdf-classification-prompt' },
    { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', prompt: 'document-classification-prompt-new' },
    { mimeType: 'text/plain', prompt: 'text-classification-prompt' },
    { mimeType: 'text/markdown', prompt: 'markdown-document-classification-prompt' },
    { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', prompt: 'powerpoint-classification-prompt' },
    { mimeType: 'video/mp4', prompt: 'video-classification-prompt' },
    { mimeType: 'audio/x-m4a', prompt: 'audio-classification-prompt' },
  ];

  for (const { mimeType, prompt } of mimeTypePromptPairs) {
    process.stdout.write(`Testing ${mimeType.padEnd(70)} → ${prompt.padEnd(40)}`);
    
    try {
      const result = await promptService.loadPrompt(prompt);
      if (result.success) {
        console.log(chalk.green('✓'));
      } else {
        console.log(chalk.red('✗ Not found'));
      }
    } catch (error) {
      console.log(chalk.red('✗ Error'));
    }
  }
}

async function testFileClassification(fileId?: string, fileName?: string, verbose?: boolean) {
  console.log(chalk.yellow('📄 Testing File Classification\n'));

  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Build query
  let query = supabase
    .from('google_sources')
    .select('id, name, mime_type, drive_id, path')
    .eq('is_deleted', false)
    .limit(1);

  if (fileId) {
    query = query.eq('id', fileId);
  } else if (fileName) {
    query = query.ilike('name', `%${fileName}%`);
  }

  const { data: files, error } = await query;

  if (error || !files || files.length === 0) {
    console.error(chalk.red('No file found matching criteria'));
    return;
  }

  const file = files[0];
  console.log(chalk.cyan('Testing with file:'));
  console.log(`  Name: ${file.name}`);
  console.log(`  Type: ${file.mime_type}`);
  console.log(`  ID: ${file.id}\n`);

  // Test classification
  console.log(chalk.yellow('Running classification...'));
  
  const result = await unifiedClassificationService.classifyDocuments({
    types: undefined, // Let it auto-detect from mime type
    limit: 1,
    dryRun: true, // Don't save results
    verbose: verbose
  });

  if (result.results.length > 0) {
    const classification = result.results[0];
    
    if (classification.success) {
      console.log(chalk.green('\n✅ Classification successful:'));
      console.log(`  Document Type: ${classification.documentTypeName}`);
      console.log(`  Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
      console.log(`  Reasoning: ${classification.reasoning}`);
      
      if (classification.concepts && classification.concepts.length > 0) {
        console.log(`  Concepts: ${classification.concepts.map(c => c.name).join(', ')}`);
      }
    } else {
      console.log(chalk.red('\n❌ Classification failed:'));
      console.log(`  Error: ${classification.error}`);
    }
  }
}

async function testMimeTypeHandling(mimeType: string) {
  console.log(chalk.yellow(`📎 Testing Mime Type: ${mimeType}\n`));

  // Test prompt selection
  const service = unifiedClassificationService as any;
  const prompt = service.selectPrompt(mimeType, 'test-file');
  
  console.log(`Selected prompt: ${chalk.cyan(prompt || 'None')}`);

  // Test if files exist with this mime type
  const supabase = SupabaseClientService.getInstance().getClient();
  const { count, error } = await supabase
    .from('google_sources')
    .select('id', { count: 'exact', head: true })
    .eq('mime_type', mimeType)
    .eq('is_deleted', false);

  if (!error && count !== null) {
    console.log(`Files with this mime type: ${chalk.cyan(count)}`);
  }

  // Test file type detection
  console.log(`\nFile type checks:`);
  console.log(`  Is text-based: ${service.isTextBasedDocument(mimeType) ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Is presentation: ${service.isPresentationDocument(mimeType) ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Is media: ${service.isMediaFile(mimeType) ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Is Google Doc: ${service.isGoogleDocument(mimeType) ? chalk.green('Yes') : chalk.gray('No')}`);
}

async function testContentExtraction() {
  console.log(chalk.yellow('🔍 Testing Content Extraction\n'));

  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test different mime types
  const testMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4'
  ];

  for (const mimeType of testMimeTypes) {
    console.log(chalk.cyan(`\nTesting ${mimeType}:`));
    
    // Find a sample file
    const { data: files } = await supabase
      .from('google_sources')
      .select('id, name, expert_documents:google_expert_documents(id)')
      .eq('mime_type', mimeType)
      .eq('is_deleted', false)
      .limit(1);

    if (files && files.length > 0) {
      const file = files[0];
      console.log(`  Sample file: ${file.name}`);
      console.log(`  Has expert document: ${file.expert_documents && file.expert_documents.length > 0 ? chalk.green('Yes') : chalk.yellow('No')}`);
    } else {
      console.log(chalk.gray('  No files found'));
    }
  }
}

async function runHealthCheck() {
  console.log(chalk.yellow('🏥 Running Health Check\n'));

  // Check database connection
  const supabase = SupabaseClientService.getInstance().getClient();
  const { error: dbError } = await supabase.from('google_sources').select('id').limit(1);
  console.log(`Database connection: ${dbError ? chalk.red('✗ Failed') : chalk.green('✓ OK')}`);

  // Check prompt service
  try {
    const result = await promptService.loadPrompt('document-classification-prompt-new');
    console.log(`Prompt service: ${result.success ? chalk.green('✓ OK') : chalk.red('✗ Failed')}`);
  } catch (error) {
    console.log(`Prompt service: ${chalk.red('✗ Failed')}`);
  }

  // Check file counts by type
  console.log(chalk.cyan('\n📊 File Statistics:'));
  
  const mimeTypes = [
    { name: 'PDF', mime: 'application/pdf' },
    { name: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'PowerPoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { name: 'Text', mime: 'text/plain' },
    { name: 'Video', mime: 'video/mp4' },
    { name: 'Audio', mime: 'audio/x-m4a' }
  ];

  for (const { name, mime } of mimeTypes) {
    const { count } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact', head: true })
      .eq('mime_type', mime)
      .eq('is_deleted', false);
    
    console.log(`  ${name.padEnd(15)} ${count || 0}`);
  }
}

// Add help examples
program.on('--help', () => {
  console.log('\nExamples:');
  console.log('  # Test prompt availability');
  console.log('  $ ./google-sync-cli.sh test-classify --test-prompts');
  console.log('');
  console.log('  # Test classification with a specific file');
  console.log('  $ ./google-sync-cli.sh test-classify --file-name "research-paper.pdf" --verbose');
  console.log('');
  console.log('  # Test mime type handling');
  console.log('  $ ./google-sync-cli.sh test-classify --mime-type "application/pdf"');
  console.log('');
  console.log('  # Test content extraction capabilities');
  console.log('  $ ./google-sync-cli.sh test-classify --test-extraction');
  console.log('');
  console.log('  # Run general health check');
  console.log('  $ ./google-sync-cli.sh test-classify');
});

program.parse(process.argv);