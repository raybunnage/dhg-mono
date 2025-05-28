#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { healthCheckCommand } from './commands/health-check';
import { classifySubjectsCommand } from './commands/classify-subjects';
import { extractTitlesCommand } from './commands/extract-titles';
import { checkMp4TitlesCommand } from './commands/check-mp4-titles';
import { listUnclassifiedCommand } from './commands/list-unclassified';
import { classifySourceCommand } from './commands/classify-source';
import { comparePresentationsAssetsCommand } from './commands/compare-presentations-assets';
import { classifyRemainingExpertsCommand } from './commands/classify-remaining-experts';
import { classifyService } from '../../../packages/shared/services/classify-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Create the main program
const program = new Command()
  .name('classify-cli')
  .description('CLI for managing subject classifications and classification operations')
  .version('1.0.0');

// Define list command
program
  .command('list')
  .description('List all subject classifications')
  .option('-c, --category <category>', 'Filter by category')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('-o, --output-file <path>', 'Path to write output to')
  .action(async (options: any) => {
    try {
      Logger.info('Listing subject classifications...');
      
      let classifications;
      if (options.category) {
        classifications = await classifyService.getClassificationsByCategory(options.category);
        Logger.info(`Found ${classifications.length} classifications in category '${options.category}'`);
      } else {
        classifications = await classifyService.getAllClassifications();
        Logger.info(`Found ${classifications.length} total classifications`);
      }
      
      if (classifications.length === 0) {
        Logger.info('No classifications found.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(classifications, null, 2));
        return;
      }
      
      // Display as table
      console.log('| ID | Name | Description | Category | Parent ID | Active |');
      console.log('|----|------|-------------|----------|-----------|--------|');
      
      for (const classification of classifications) {
        const id = classification.id.substring(0, 8);
        const name = classification.name || 'N/A';
        const description = (classification.description || 'N/A').substring(0, 30);
        const category = classification.category || 'N/A';
        const parentId = classification.parent_id ? classification.parent_id.substring(0, 8) : 'N/A';
        const active = classification.is_active ? 'Yes' : 'No';
        
        console.log(`| ${id} | ${name} | ${description} | ${category} | ${parentId} | ${active} |`);
      }
      
      // Write to output file if specified
      if (options.outputFile) {
        const fs = require('fs');
        let outputContent;
        
        if (options.format === 'json') {
          outputContent = JSON.stringify(classifications, null, 2);
        } else {
          // Markdown table
          outputContent = '# Subject Classifications\n\n';
          outputContent += '| ID | Name | Description | Category | Parent ID | Active |\n';
          outputContent += '|----|------|-------------|----------|-----------|--------|\n';
          
          for (const classification of classifications) {
            const id = classification.id;
            const name = classification.name || 'N/A';
            const description = classification.description || 'N/A';
            const category = classification.category || 'N/A';
            const parentId = classification.parent_id || 'N/A';
            const active = classification.is_active ? 'Yes' : 'No';
            
            outputContent += `| ${id} | ${name} | ${description} | ${category} | ${parentId} | ${active} |\n`;
          }
        }
        
        fs.writeFileSync(options.outputFile, outputContent);
        Logger.info(`Output written to ${options.outputFile}`);
      }
    } catch (error) {
      Logger.error('Error listing classifications:', error);
      process.exit(1);
    }
  });

// Define get command
program
  .command('get <id>')
  .description('Get a specific subject classification')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (id: string, options: any) => {
    try {
      Logger.info(`Getting classification with ID: ${id}`);
      
      const classification = await classifyService.getClassificationById(id);
      
      if (!classification) {
        Logger.error(`Classification with ID ${id} not found`);
        process.exit(1);
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(classification, null, 2));
        return;
      }
      
      // Display as table
      console.log('| Property | Value |');
      console.log('|----------|-------|');
      console.log(`| ID | ${classification.id} |`);
      console.log(`| Name | ${classification.name} |`);
      console.log(`| Description | ${classification.description || 'N/A'} |`);
      console.log(`| Category | ${classification.category || 'N/A'} |`);
      console.log(`| Parent ID | ${classification.parent_id || 'N/A'} |`);
      console.log(`| Created At | ${classification.created_at || 'N/A'} |`);
      console.log(`| Updated At | ${classification.updated_at || 'N/A'} |`);
      console.log(`| Active | ${classification.is_active ? 'Yes' : 'No'} |`);
      
    } catch (error) {
      Logger.error('Error getting classification:', error);
      process.exit(1);
    }
  });

// Define create command
program
  .command('create')
  .description('Create a new subject classification')
  .option('-n, --name <n>', 'Classification name (required)')
  .option('-d, --description <description>', 'Classification description')
  .option('-c, --category <category>', 'Classification category')
  .option('-p, --parent-id <parentId>', 'Parent classification ID')
  .option('--inactive', 'Set as inactive')
  .action(async (options: any) => {
    try {
      if (!options.name) {
        Logger.error('Error: --name is required');
        process.exit(1);
      }
      
      Logger.info(`Creating new classification: ${options.name}`);
      
      const newClassification = await classifyService.createClassification({
        name: options.name,
        description: options.description,
        category: options.category,
        parent_id: options.parentId,
        is_active: !options.inactive
      });
      
      Logger.info(`Successfully created classification with ID: ${newClassification.id}`);
      
      // Show the created classification
      console.log('Created classification:');
      console.log('| Property | Value |');
      console.log('|----------|-------|');
      console.log(`| ID | ${newClassification.id} |`);
      console.log(`| Name | ${newClassification.name} |`);
      console.log(`| Description | ${newClassification.description || 'N/A'} |`);
      console.log(`| Category | ${newClassification.category || 'N/A'} |`);
      console.log(`| Parent ID | ${newClassification.parent_id || 'N/A'} |`);
      console.log(`| Created At | ${newClassification.created_at || 'N/A'} |`);
      console.log(`| Updated At | ${newClassification.updated_at || 'N/A'} |`);
      console.log(`| Active | ${newClassification.is_active ? 'Yes' : 'No'} |`);
      
    } catch (error) {
      Logger.error('Error creating classification:', error);
      process.exit(1);
    }
  });

// Define update command
program
  .command('update <id>')
  .description('Update an existing subject classification')
  .option('-n, --name <n>', 'New classification name')
  .option('-d, --description <description>', 'New classification description')
  .option('-c, --category <category>', 'New classification category')
  .option('-p, --parent-id <parentId>', 'New parent classification ID')
  .option('--active <boolean>', 'Set active status (true or false)')
  .action(async (id: string, options: any) => {
    try {
      Logger.info(`Updating classification with ID: ${id}`);
      
      // Build the updates object with only provided fields
      const updates: any = {};
      if (options.name !== undefined) updates.name = options.name;
      if (options.description !== undefined) updates.description = options.description;
      if (options.category !== undefined) updates.category = options.category;
      if (options.parentId !== undefined) updates.parent_id = options.parentId;
      if (options.active !== undefined) {
        updates.is_active = options.active === 'true' || options.active === true;
      }
      
      if (Object.keys(updates).length === 0) {
        Logger.warn('No update fields provided. Nothing to update.');
        return;
      }
      
      const updatedClassification = await classifyService.updateClassification(id, updates);
      
      Logger.info(`Successfully updated classification with ID: ${updatedClassification.id}`);
      
      // Show the updated classification
      console.log('Updated classification:');
      console.log('| Property | Value |');
      console.log('|----------|-------|');
      console.log(`| ID | ${updatedClassification.id} |`);
      console.log(`| Name | ${updatedClassification.name} |`);
      console.log(`| Description | ${updatedClassification.description || 'N/A'} |`);
      console.log(`| Category | ${updatedClassification.category || 'N/A'} |`);
      console.log(`| Parent ID | ${updatedClassification.parent_id || 'N/A'} |`);
      console.log(`| Created At | ${updatedClassification.created_at || 'N/A'} |`);
      console.log(`| Updated At | ${updatedClassification.updated_at || 'N/A'} |`);
      console.log(`| Active | ${updatedClassification.is_active ? 'Yes' : 'No'} |`);
      
    } catch (error) {
      Logger.error('Error updating classification:', error);
      process.exit(1);
    }
  });

// Define delete command
program
  .command('delete <id>')
  .description('Delete a subject classification')
  .option('--force', 'Force deletion without confirmation')
  .action(async (id: string, options: any) => {
    try {
      Logger.info(`Deleting classification with ID: ${id}`);
      
      // Get the classification first to confirm it exists
      const classification = await classifyService.getClassificationById(id);
      
      if (!classification) {
        Logger.error(`Classification with ID ${id} not found`);
        process.exit(1);
      }
      
      // Confirm deletion if not forced
      if (!options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>(resolve => {
          readline.question(`Are you sure you want to delete classification "${classification.name}" (${id})? (y/N): `, resolve);
        });
        
        readline.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          Logger.info('Deletion cancelled');
          return;
        }
      }
      
      await classifyService.deleteClassification(id);
      
      Logger.info(`Successfully deleted classification with ID: ${id}`);
      
    } catch (error) {
      Logger.error('Error deleting classification:', error);
      process.exit(1);
    }
  });

// Define hierarchy command
program
  .command('hierarchy')
  .description('Get hierarchical view of classifications')
  .option('-f, --format <format>', 'Output format (tree, json)', 'tree')
  .option('-o, --output-file <path>', 'Path to write output to')
  .action(async (options: any) => {
    try {
      Logger.info('Getting classification hierarchy...');
      
      const hierarchy = await classifyService.getClassificationHierarchy();
      
      if (hierarchy.length === 0) {
        Logger.info('No classifications found.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(hierarchy, null, 2));
      } else {
        // Display as tree
        console.log('Classification Hierarchy:');
        displayHierarchy(hierarchy);
      }
      
      // Write to output file if specified
      if (options.outputFile) {
        const fs = require('fs');
        let outputContent;
        
        if (options.format === 'json') {
          outputContent = JSON.stringify(hierarchy, null, 2);
        } else {
          // Markdown tree
          outputContent = '# Classification Hierarchy\n\n';
          const hierarchyLines: string[] = [];
          renderHierarchyMarkdown(hierarchy, '', hierarchyLines);
          outputContent += hierarchyLines.join('\n');
        }
        
        fs.writeFileSync(options.outputFile, outputContent);
        Logger.info(`Output written to ${options.outputFile}`);
      }
    } catch (error) {
      Logger.error('Error getting classification hierarchy:', error);
      process.exit(1);
    }
  });

// Define batch-create command
program
  .command('batch-create <file>')
  .description('Create multiple classifications from a JSON file')
  .option('--dry-run', 'Show what would be created without actually creating records')
  .action(async (file: string, options: any) => {
    try {
      Logger.info(`Loading classifications from file: ${file}`);
      
      const fs = require('fs');
      if (!fs.existsSync(file)) {
        Logger.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      const fileContent = fs.readFileSync(file, 'utf8');
      let classifications;
      
      try {
        classifications = JSON.parse(fileContent);
      } catch (parseError) {
        Logger.error(`Error parsing JSON file: ${parseError}`);
        process.exit(1);
      }
      
      if (!Array.isArray(classifications)) {
        Logger.error('JSON file must contain an array of classifications');
        process.exit(1);
      }
      
      // Validate each classification has a name
      const invalidClassifications = classifications.filter(c => !c.name);
      if (invalidClassifications.length > 0) {
        Logger.error(`${invalidClassifications.length} classifications are missing required 'name' field`);
        process.exit(1);
      }
      
      Logger.info(`Found ${classifications.length} classifications in file`);
      
      if (options.dryRun) {
        Logger.info('Dry run - no classifications will be created');
        console.log('Classifications to create:');
        console.log(JSON.stringify(classifications, null, 2));
        return;
      }
      
      const createdClassifications = await classifyService.createClassificationsBatch(classifications);
      
      Logger.info(`Successfully created ${createdClassifications.length} classifications`);
      
    } catch (error) {
      Logger.error('Error batch creating classifications:', error);
      process.exit(1);
    }
  });

// Add health-check command
program
  .command('health-check')
  .description('Check the health of the classify service')
  .option('--verbose', 'Show detailed output', false)
  .action(async (options: any) => {
    await healthCheckCommand(options);
  });

// Add classify-subjects command
program
  .command('classify-subjects')
  .description('Apply subject classification to expert documents with processed content')
  .option('-l, --limit <number>', 'Maximum number of documents to process', '10')
  .option('-e, --extensions <extensions>', 'Filter by file extension(s), separated by commas (e.g., "mp4,pdf,docx")')
  .option('-x, --expert <n>', 'Filter by expert name')
  .option('-t, --table <tableName>', 'Target table to classify (default: "expert_documents")')
  .option('-s, --skip-classified', 'Skip documents that already have classifications', false)
  .option('-i, --source-id <id>', 'Directly classify a specific source by its ID')
  .option('--concurrency <number>', 'Number of documents to process concurrently (default: 3)', '3')
  .option('--max-retries <number>', 'Maximum number of retries for failed API calls (default: 3)', '3')
  .option('--retry-delay <number>', 'Initial delay in milliseconds between retries (default: 1000)', '1000')
  .option('--verbose', 'Show detailed output', false)
  .option('--dry-run', 'Show what would be classified without making changes', false)
  .action(async (options: any) => {
    // Parse limit as integer
    const limit = options.limit ? parseInt(options.limit, 10) : 10;
    
    // Parse file extensions if provided
    const fileExtensions = options.extensions ? options.extensions.split(',').map((ext: string) => ext.trim()) : undefined;
    
    // Parse concurrency and retry options
    const concurrency = options.concurrency ? parseInt(options.concurrency, 10) : 3;
    const maxRetries = options.maxRetries ? parseInt(options.maxRetries, 10) : 3;
    const retryDelayMs = options.retryDelay ? parseInt(options.retryDelay, 10) : 1000;
    
    await classifySubjectsCommand({
      limit,
      fileExtensions,
      expertName: options.expert,
      verbose: options.verbose,
      dryRun: options.dryRun,
      skipClassified: options.skipClassified,
      entityType: options.table || 'google_expert_documents',
      concurrency,
      maxRetries,
      retryDelayMs,
      sourceId: options.sourceId
    });
  });

// Add extract-titles command
program
  .command('extract-titles')
  .description('Extract titles from MP4 files and update the corresponding expert_documents')
  .option('-l, --limit <number>', 'Maximum number of documents to process', '50')
  .option('-x, --expert <n>', 'Filter by expert name')
  .option('--include-existing', 'Include documents that already have titles', false)
  .option('--concurrency <number>', 'Number of documents to process concurrently (default: 3)', '3')
  .option('--max-retries <number>', 'Maximum number of retries for failed API calls (default: 3)', '3')
  .option('--retry-delay <number>', 'Initial delay in milliseconds between retries (default: 1000)', '1000')
  .option('--verbose', 'Show detailed output', false)
  .option('--dry-run', 'Show what would be extracted without making changes', false)
  .action(async (options: any) => {
    // Parse limit as integer
    const limit = options.limit ? parseInt(options.limit, 10) : 50;
    
    // Parse concurrency and retry options
    const concurrency = options.concurrency ? parseInt(options.concurrency, 10) : 3;
    const maxRetries = options.maxRetries ? parseInt(options.maxRetries, 10) : 3;
    const retryDelayMs = options.retryDelay ? parseInt(options.retryDelay, 10) : 1000;
    
    await extractTitlesCommand({
      limit,
      expertName: options.expert,
      verbose: options.verbose,
      dryRun: options.dryRun,
      skipExisting: !options.includeExisting,
      concurrency,
      maxRetries,
      retryDelayMs
    });
  });

// Add check-mp4-titles command
program
  .command('check-mp4-titles')
  .description('Check MP4 files in sources_google for missing titles in expert_documents')
  .option('-l, --limit <number>', 'Maximum number of MP4 files to check', '500')
  .option('-x, --expert <n>', 'Filter by expert name')
  .option('--verbose', 'Show detailed output including MP4 files without expert_documents', false)
  .action(async (options: any) => {
    // Parse limit as integer
    const limit = options.limit ? parseInt(options.limit, 10) : 500;
    
    await checkMp4TitlesCommand({
      limit,
      expertName: options.expert,
      verbose: options.verbose,
    });
  });

// Add debug command to check classification status
program
  .command('debug-classification-status')
  .description('Check the status of subject classifications across all documents')
  .option('--show-documents <number>', 'Show the specified number of unclassified documents', '10')
  
// Add command to examine one document for debugging
program
  .command('examine-document')
  .description('Examine a specific document in detail')
  .option('-i, --id <id>', 'Document ID to examine')
  .option('-s, --source-id <id>', 'Source ID to examine')
  .action(async (options) => {
    try {
      const supabase = SupabaseClientService.getInstance().getClient();
      
      if (!options.id && !options.sourceId) {
        Logger.error('You must specify either a document ID or source ID');
        return;
      }
      
      // Fetch document by ID
      if (options.id) {
        const { data: doc, error: docError } = await supabase
          .from('google_expert_documents')
          .select('*')
          .eq('id', options.id)
          .single();
          
        if (docError) {
          Logger.error(`Error fetching document: ${docError.message}`);
          return;
        }
        
        if (!doc) {
          Logger.error(`Document not found with ID: ${options.id}`);
          return;
        }
        
        Logger.info(`Document details for ID ${options.id}:`);
        console.log(JSON.stringify(doc, null, 2));
        
        // Check for classifications
        const { data: classifications, error: classErr } = await supabase
          .from('table_classifications')
          .select('*')
          .eq('entity_id', options.id)
          .eq('entity_type', 'google_expert_documents');
          
        if (classErr) {
          Logger.error(`Error fetching classifications: ${classErr.message}`);
        } else {
          Logger.info(`Classifications for document (${classifications?.length || 0} found):`);
          if (classifications && classifications.length > 0) {
            console.log(JSON.stringify(classifications, null, 2));
          } else {
            Logger.info('No classifications found for this document');
          }
        }
        
        // Check source if available
        if (doc.source_id) {
          const { data: source, error: sourceErr } = await supabase
            .from('google_sources')
            .select('*')
            .eq('id', doc.source_id)
            .single();
            
          if (sourceErr) {
            Logger.error(`Error fetching source: ${sourceErr.message}`);
          } else if (source) {
            Logger.info(`Source details for document:`);
            console.log(JSON.stringify(source, null, 2));
          } else {
            Logger.info(`No source found with ID: ${doc.source_id}`);
          }
        }
      }
      
      // Fetch document by source ID
      if (options.sourceId) {
        const { data: docs, error: docsError } = await supabase
          .from('google_expert_documents')
          .select('id')
          .eq('source_id', options.sourceId);
          
        if (docsError) {
          Logger.error(`Error fetching documents by source ID: ${docsError.message}`);
          return;
        }
        
        Logger.info(`Found ${docs?.length || 0} documents with source ID ${options.sourceId}`);
        
        const { data: source, error: sourceErr } = await supabase
          .from('google_sources')
          .select('*')
          .eq('id', options.sourceId)
          .single();
          
        if (sourceErr) {
          Logger.error(`Error fetching source: ${sourceErr.message}`);
        } else if (source) {
          Logger.info(`Source details:`);
          console.log(JSON.stringify(source, null, 2));
        } else {
          Logger.info(`No source found with ID: ${options.sourceId}`);
        }
      }
    } catch (error) {
      Logger.error(`Error in examine command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
// Debug classification status action
program.commands.find((cmd: any) => cmd.name() === 'debug-classification-status')?.action(async (options: any) => {
  const showDocuments = options.showDocuments ? parseInt(options.showDocuments) : 10;
  try {
    Logger.info('Starting classification status check...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 1. Check how many expert_documents exist with processed content
    const { data: processedDocs, error: processedError } = await supabase
      .from('google_expert_documents')
      .select('id')
        .neq('processed_content', null);
        
      if (processedError) {
        Logger.error(`Error checking processed documents: ${processedError.message}`);
        return;
      }
      
      Logger.info(`Total expert_documents with processed content: ${processedDocs?.length || 0}`);
      
      // 2. Check how many files are in sources_google by extension
      const fileTypes = ['mp4', 'pdf', 'docx', 'pptx', 'txt'];
      for (const ext of fileTypes) {
        const { data: files, error: filesError } = await supabase
          .from('google_sources')
          .select('id')
          .ilike('name', `%.${ext}`);
          
        if (filesError) {
          Logger.error(`Error checking .${ext} files: ${filesError.message}`);
          continue;
        }
        
        Logger.info(`Total .${ext} files in sources_google: ${files?.length || 0}`);
      }
      
      // 3. Check how many documents have been classified
      const { data: classifiedDocs, error: classifiedError } = await supabase
        .from('table_classifications')
        .select('entity_id')
        .eq('entity_type', 'google_expert_documents');
        
      if (classifiedError) {
        Logger.error(`Error checking classified documents: ${classifiedError.message}`);
        return;
      }
      
      // Count unique entity_ids
      const uniqueEntityIds = new Set((classifiedDocs || []).map((doc: {entity_id: string}) => doc.entity_id));
      Logger.info(`Total unique expert_documents with classifications: ${uniqueEntityIds.size}`);
      Logger.info(`Total classification entries in table_classifications: ${classifiedDocs?.length || 0}`);
      
      // 4. Check how many expert_documents have a source_id
      const { data: docsWithSource, error: sourceError } = await supabase
        .from('google_expert_documents')
        .select('id, source_id')
        .not('source_id', 'is', null);
        
      if (sourceError) {
        Logger.error(`Error checking documents with source: ${sourceError.message}`);
        return;
      }
      
      Logger.info(`Total expert_documents with source_id: ${docsWithSource?.length || 0}`);
      
      // 5. Check how many of these are not classified yet
      const classifiedIdsSet = new Set(uniqueEntityIds);
      const unclassifiedDocs = (docsWithSource || []).filter((doc: {id: string}) => !classifiedIdsSet.has(doc.id));
      
      Logger.info(`Total expert_documents with source_id but no classification: ${unclassifiedDocs.length}`);
      
      // 6. Check how many have processed content but no classification
      const unclassifiedWithContent = (processedDocs || []).filter((doc: {id: string}) => !classifiedIdsSet.has(doc.id));
      Logger.info(`Total expert_documents with processed content but no classification: ${unclassifiedWithContent.length}`);
      
      // 7. Show some example unclassified documents for debugging
      if (unclassifiedWithContent.length > 0 && showDocuments > 0) {
        // Get detailed information about a few unclassified documents
        const sampleIds = unclassifiedWithContent.slice(0, showDocuments).map((doc: {id: string}) => doc.id);
        
        // Fetch more details about these documents
        const { data: sampleDocs, error: sampleError } = await supabase
          .from('google_expert_documents')
          .select('id, source_id')
          .in('id', sampleIds);
          
        if (sampleError) {
          Logger.error(`Error fetching sample documents: ${sampleError.message}`);
        } else if (sampleDocs && sampleDocs.length > 0) {
          // Fetch source information for these documents
          const sourceIds = sampleDocs.map(doc => doc.source_id).filter(id => id);
          const { data: sources, error: sourceError } = await supabase
            .from('google_sources')
            .select('id, name, mime_type')
            .in('id', sourceIds);
            
          if (sourceError) {
            Logger.error(`Error fetching sample sources: ${sourceError.message}`);
          } else {
            // Create a lookup table
            const sourcesById: Record<string, any> = {};
            sources?.forEach(source => {
              sourcesById[source.id] = source;
            });
            
            // Show the documents
            Logger.info(`Sample unclassified documents with processed content:`);
            sampleDocs.forEach(doc => {
              const source = sourcesById[doc.source_id];
              if (source) {
                Logger.info(`- Document ID: ${doc.id.substring(0, 8)}..., Source: ${source.name}, MIME: ${source.mime_type}`);
              } else {
                Logger.info(`- Document ID: ${doc.id.substring(0, 8)}..., Source ID: ${doc.source_id?.substring(0, 8) || 'None'}`);
              }
            });
          }
        }
      }
      
    } catch (error) {
      Logger.error(`Error in debug command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

// Helper function to display hierarchy
function displayHierarchy(items: any[], level = 0): void {
  const indent = '  '.repeat(level);
  for (const item of items) {
    console.log(`${indent}• ${item.name}${item.category ? ` (${item.category})` : ''}`);
    if (item.children && item.children.length > 0) {
      displayHierarchy(item.children, level + 1);
    }
  }
}

// Helper function to render hierarchy for markdown
function renderHierarchyMarkdown(items: any[], indent: string, lines: string[]): void {
  for (const item of items) {
    lines.push(`${indent}- **${item.name}**${item.category ? ` (${item.category})` : ''}`);
    if (item.children && item.children.length > 0) {
      renderHierarchyMarkdown(item.children, `${indent}  `, lines);
    }
  }
}

// Add list-unclassified command
program
  .command('list-unclassified')
  .description('List expert documents with processed content that need classification')
  .option('-l, --limit <number>', 'Maximum number of documents to list (0 for all)', '0')
  .option('-c, --with-content', 'Show content preview (only with --verbose)', false)
  .option('-v, --verbose', 'Show detailed output including content preview', false)
  .action(async (options) => {
    try {
      // Parse limit as integer
      const limit = options.limit ? parseInt(options.limit, 10) : 50;
      
      await listUnclassifiedCommand({
        limit,
        withContent: options.withContent,
        verbose: options.verbose,
      });
    } catch (error) {
      Logger.error(`Error in list-unclassified command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

// Add classify-source command
program
  .command('classify-source')
  .description('Classify a specific source by its ID')
  .option('-i, --source-id <id>', 'The source ID to classify (required)')
  .option('-t, --table <tableName>', 'Target table to classify (default: "expert_documents")')
  .option('-f, --force', 'Force reclassification even if document already has classifications', false)
  .option('--max-retries <number>', 'Maximum number of retries for failed API calls (default: 3)', '3')
  .option('--retry-delay <number>', 'Initial delay in milliseconds between retries (default: 1000)', '1000')
  .option('--verbose', 'Show detailed output', false)
  .option('--dry-run', 'Show what would be classified without making changes', false)
  .action(async (options: any) => {
    try {
      if (!options.sourceId) {
        Logger.error('Source ID is required. Use --source-id <id> to specify a source to classify.');
        return;
      }
      
      // Parse retry options
      const maxRetries = options.maxRetries ? parseInt(options.maxRetries, 10) : 3;
      const retryDelayMs = options.retryDelay ? parseInt(options.retryDelay, 10) : 1000;
      
      await classifySourceCommand({
        sourceId: options.sourceId,
        entityType: options.table || 'google_expert_documents',
        verbose: options.verbose,
        dryRun: options.dryRun,
        maxRetries,
        retryDelayMs,
        force: options.force
      });
    } catch (error) {
      Logger.error(`Error in classify-source command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

// Add compare-presentations-assets command
program
  .command('compare-presentations-assets')
  .description('Compare presentations against presentation_assets to find missing assets')
  .option('-l, --limit <number>', 'Maximum number of presentations to display (0 for all)', '0')
  .option('--id-width <number>', 'Width of ID column in output', '40')
  .option('--name-width <number>', 'Width of name column in output', '60')
  .option('--verbose', 'Show detailed output including additional diagnostics', false)
  .action(async (options) => {
    try {
      // Parse options
      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const idWidth = options.idWidth ? parseInt(options.idWidth, 10) : 40;
      const nameWidth = options.nameWidth ? parseInt(options.nameWidth, 10) : 60;
      
      await comparePresentationsAssetsCommand({
        limit,
        idWidth,
        nameWidth,
        verbose: options.verbose
      });
    } catch (error) {
      Logger.error(`Error in compare-presentations-assets command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

// Add classify-remaining-experts command
program
  .command('classify-remaining-experts')
  .description('Classify remaining expert documents using specialized filtering')
  .option('-l, --limit <number>', 'Maximum number of documents to process', '10')
  .option('-x, --expert <n>', 'Filter by expert name')
  .option('-c, --concurrency <number>', 'Number of documents to process concurrently (default: 3)', '3')
  .option('--max-retries <number>', 'Maximum number of retries for failed API calls (default: 3)', '3')
  .option('--retry-delay <number>', 'Initial delay in milliseconds between retries (default: 1000)', '1000')
  .option('--verbose', 'Show detailed output', false)
  .option('--dry-run', 'Show what would be classified without making changes', false)
  .action(async (options: any) => {
    try {
      // Parse numeric options
      const limit = options.limit ? parseInt(options.limit, 10) : 10;
      const concurrency = options.concurrency ? parseInt(options.concurrency, 10) : 3;
      const maxRetries = options.maxRetries ? parseInt(options.maxRetries, 10) : 3;
      const retryDelayMs = options.retryDelay ? parseInt(options.retryDelay, 10) : 1000;
      
      await classifyRemainingExpertsCommand({
        limit,
        expertName: options.expert,
        verbose: options.verbose,
        dryRun: options.dryRun,
        concurrency,
        maxRetries,
        retryDelayMs
      });
    } catch (error) {
      Logger.error(`Error in classify-remaining-experts command: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

// Handle if no command is provided
program.parse(process.argv);

// Show help if no command is provided
if (process.argv.length === 2) {
  program.help();
}