#!/usr/bin/env ts-node
/**
 * Document Types CLI
 * 
 * Command-line interface for managing document types.
 */
import { Command } from 'commander';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { 
  documentTypeService, 
  documentTypeAIService,
} from '../../../packages/shared/services/document-type-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Create commander instance
const program = new Command();

// Set CLI metadata
program
  .name('document-types')
  .description('CLI for managing document types')
  .version('1.0.0');

interface ListOptions {
  category?: string;
  json?: boolean;
}

interface GetOptions {
  id: string;
  json?: boolean;
}

interface CreateOptions {
  name: string;
  category: string;
  description?: string;
  mimeType?: string;
  fileExtension?: string;
  aiGenerated?: boolean;
}

interface UpdateOptions {
  id: string;
  name?: string;
  category?: string;
  description?: string;
  mimeType?: string;
  fileExtension?: string;
  aiGenerated?: boolean;
  classifier?: 'pdf' | 'powerpoint' | 'docx' | 'expert';
}

interface DeleteOptions {
  id: string;
  force?: boolean;
}

interface GenerateOptions {
  prompt: string;
  create?: boolean;
}

// Command: List all document types
program
  .command('list')
  .description('List all document types')
  .option('-c, --category <category>', 'Filter by category')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: ListOptions) => {
    // Use optional tracking to avoid errors
    let trackingId: string | undefined;
    try {
      trackingId = await commandTrackingService.startTracking('document_types', 'list').catch(err => {
        console.log('Note: Command tracking is temporarily disabled');
        return undefined;
      });
    
    try {
      // Use real data from Supabase
      let documentTypes;
      
      if (options.category) {
        console.log(`Fetching document types in category: ${options.category}`);
        documentTypes = await documentTypeService.getDocumentTypesByCategory(options.category);
      } else {
        console.log('Fetching all document types...');
        documentTypes = await documentTypeService.getAllDocumentTypes();
      }
      
      if (options.json) {
        // Output as formatted JSON
        console.log(JSON.stringify(documentTypes, null, 2));
      } else {
        // Sort by category first (alphabetically), then by document_type
        documentTypes.sort((a, b) => {
          // First sort by category alphabetically
          const categoryA = a.category || '';
          const categoryB = b.category || '';
          const categoryCompare = categoryA.localeCompare(categoryB);
          
          // If categories are the same, sort by document_type
          if (categoryCompare === 0) {
            return a.document_type.localeCompare(b.document_type);
          }
          
          return categoryCompare;
        });
        
        // Output as table
        console.log('\nDocument Types:');
        console.log('=================================================================================================================================');
        console.log('ID'.padEnd(36) + ' | ' + 
                   'Document Type'.padEnd(30) + ' | ' + 
                   'Category'.padEnd(15) + ' | ' + 
                   'MIME Type'.padEnd(35) + ' | ' +
                   'Classifier'.padEnd(12) + ' | ' +
                   'AI Generated');
        console.log('---------------------------------------------------------------------------------------------------------------------------------');
        
        documentTypes.forEach(type => {
          // Access classifier using type assertion since it might not be in the type definition yet
          const classifier = (type as any).classifier || '';
          
          console.log(
            type.id.padEnd(36) + ' | ' +
            type.document_type.substring(0, 28).padEnd(30) + ' | ' +
            (type.category || '').substring(0, 13).padEnd(15) + ' | ' +
            (type.mime_type || '').substring(0, 33).padEnd(35) + ' | ' +
            classifier.padEnd(12) + ' | ' +
            (type.is_ai_generated ? 'Yes' : 'No')
          );
        });
        
        console.log('---------------------------------------------------------------------------------------------------------------------------------');
        console.log(`Total: ${documentTypes.length} document types`);
      }
      
      // Only track if tracking was successful
      if (trackingId) {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: documentTypes.length,
          summary: `Listed ${documentTypes.length} document types${options.category ? ` in category ${options.category}` : ''}`
        }).catch(err => console.log('Note: Command tracking completion failed'));
      }
    } catch (error) {
      console.error('Error listing document types:', error instanceof Error ? error.message : error);
      if (trackingId) {
        await commandTrackingService.failTracking(trackingId, `Failed to list document types: ${error instanceof Error ? error.message : 'Unknown error'}`)
          .catch(err => console.log('Note: Command tracking failure notification failed'));
      }
      process.exit(1);
    }
    } catch (outerError) {
      console.error('Unexpected error:', outerError instanceof Error ? outerError.message : String(outerError));
      process.exit(1);
    }
  });

// Command: Get document type details
program
  .command('get')
  .description('Get details of a document type')
  .requiredOption('-i, --id <id>', 'Document type ID')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: GetOptions) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'get');
    
    try {
      console.log(`Fetching document type with ID: ${options.id}`);
      const documentType = await documentTypeService.getDocumentTypeById(options.id);
      
      if (!documentType) {
        console.error(`Document type with ID ${options.id} not found`);
        process.exit(1);
      }
      
      if (options.json) {
        // Output as formatted JSON
        console.log(JSON.stringify(documentType, null, 2));
      } else {
        // Output as detailed view
        console.log('\nDocument Type Details:');
        console.log('==============================================================');
        console.log(`ID:              ${documentType.id}`);
        console.log(`Name:            ${documentType.document_type}`);
        console.log(`Category:        ${documentType.category || 'N/A'}`);
        console.log(`Description:     ${documentType.description || 'N/A'}`);
        console.log(`MIME Type:       ${documentType.mime_type || 'N/A'}`);
        console.log(`File Extension:  ${documentType.file_extension || 'N/A'}`);
        console.log(`Classifier:      ${(documentType as any).classifier || 'Not set'}`);
        console.log(`AI Generated:    ${documentType.is_ai_generated ? 'Yes' : 'No'}`);
        console.log(`Created At:      ${documentType.created_at || 'N/A'}`);
        console.log(`Updated At:      ${documentType.updated_at || 'N/A'}`);
        
        if (documentType.required_fields) {
          console.log('\nRequired Fields:');
          console.log('--------------------------------------------------------------');
          Object.entries(documentType.required_fields).forEach(([field, type]) => {
            console.log(`  ${field}: ${type}`);
          });
        }
        
        if (documentType.validation_rules) {
          console.log('\nValidation Rules:');
          console.log('--------------------------------------------------------------');
          Object.entries(documentType.validation_rules).forEach(([field, rules]) => {
            console.log(`  ${field}:`);
            Object.entries(rules as Record<string, any>).forEach(([rule, value]) => {
              console.log(`    ${rule}: ${value}`);
            });
          });
        }
        
        if (documentType.ai_processing_rules) {
          console.log('\nAI Processing Rules:');
          console.log('--------------------------------------------------------------');
          Object.entries(documentType.ai_processing_rules).forEach(([rule, value]) => {
            if (Array.isArray(value)) {
              console.log(`  ${rule}: [${value.join(', ')}]`);
            } else {
              console.log(`  ${rule}: ${value}`);
            }
          });
        }
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 1,
        summary: `Retrieved document type ${documentType.document_type} (${options.id})`
      });
    } catch (error) {
      console.error('Error getting document type:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to get document type: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Create a new document type
program
  .command('create')
  .description('Create a new document type')
  .requiredOption('--name <name>', 'Document type name')
  .requiredOption('--category <category>', 'Document type category')
  .option('--description <description>', 'Document type description')
  .option('--mime-type <mimeType>', 'Preferred MIME type')
  .option('--file-extension <extension>', 'Preferred file extension')
  .option('--ai-generated', 'Mark as AI generated', false)
  .action(async (options: CreateOptions) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'create');
    
    try {
      console.log('Creating new document type...');
      
      const documentType = await documentTypeService.createDocumentType({
        document_type: options.name,
        category: options.category,
        description: options.description || null,
        mime_type: options.mimeType || null,
        file_extension: options.fileExtension || null,
        is_ai_generated: options.aiGenerated
      });
      
      console.log('\nDocument Type Created:');
      console.log('==============================================================');
      console.log(`ID:              ${documentType.id}`);
      console.log(`Name:            ${documentType.document_type}`);
      console.log(`Category:        ${documentType.category}`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 1,
        summary: `Created document type ${documentType.document_type} (${documentType.id})`
      });
    } catch (error) {
      console.error('Error creating document type:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to create document type: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Update an existing document type
program
  .command('update')
  .description('Update an existing document type')
  .requiredOption('-i, --id <id>', 'Document type ID')
  .option('--name <n>', 'Document type name')
  .option('--category <category>', 'Document type category')
  .option('--description <description>', 'Document type description')
  .option('--mime-type <mimeType>', 'Preferred MIME type')
  .option('--file-extension <extension>', 'Preferred file extension')
  .option('--ai-generated <boolean>', 'Mark as AI generated', (val: string) => val === 'true')
  .option('--classifier <classifier>', 'Set document classifier (pdf, powerpoint, docx, expert, none)')
  .action(async (options: UpdateOptions) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'update');
    
    try {
      console.log(`Updating document type with ID: ${options.id}`);
      
      // Check if document type exists
      const existingType = await documentTypeService.getDocumentTypeById(options.id);
      if (!existingType) {
        console.error(`Document type with ID ${options.id} not found`);
        process.exit(1);
      }
      
      // Prepare update data
      const updateData: Record<string, any> = {};
      if (options.name) updateData.document_type = options.name;
      if (options.category) updateData.category = options.category;
      if (options.description !== undefined) updateData.description = options.description;
      if (options.mimeType !== undefined) updateData.mime_type = options.mimeType;
      if (options.fileExtension !== undefined) updateData.file_extension = options.fileExtension;
      if (options.aiGenerated !== undefined) updateData.is_ai_generated = options.aiGenerated;
      if (options.classifier !== undefined) {
        if (options.classifier.toLowerCase() === 'none') {
          updateData.classifier = null;
        } else {
          updateData.classifier = options.classifier;
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        console.log('No updates specified. Document type remains unchanged.');
        return;
      }
      
      const documentType = await documentTypeService.updateDocumentType(options.id, updateData);
      
      console.log('\nDocument Type Updated:');
      console.log('==============================================================');
      console.log(`ID:              ${documentType.id}`);
      console.log(`Name:            ${documentType.document_type}`);
      console.log(`Category:        ${documentType.category}`);
      console.log(`Description:     ${documentType.description || 'N/A'}`);
      console.log(`MIME Type:       ${documentType.mime_type || 'N/A'}`);
      console.log(`File Extension:  ${documentType.file_extension || 'N/A'}`);
      console.log(`Classifier:      ${(documentType as any).classifier || 'Not set'}`);
      console.log(`AI Generated:    ${documentType.is_ai_generated ? 'Yes' : 'No'}`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 1,
        summary: `Updated document type ${documentType.document_type} (${documentType.id})`
      });
    } catch (error) {
      console.error('Error updating document type:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to update document type: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Delete a document type
program
  .command('delete')
  .description('Delete a document type')
  .requiredOption('-i, --id <id>', 'Document type ID')
  .option('-f, --force', 'Force deletion even if document type is in use', false)
  .action(async (options: DeleteOptions) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'delete');
    
    try {
      console.log(`Deleting document type with ID: ${options.id}`);
      
      // Check if document type exists
      const documentType = await documentTypeService.getDocumentTypeById(options.id);
      if (!documentType) {
        console.error(`Document type with ID ${options.id} not found`);
        process.exit(1);
      }
      
      // Confirm deletion if not using --force
      if (!options.force) {
        console.log(`WARNING: This will permanently delete document type "${documentType.document_type}" (${options.id})`);
        console.log('This operation cannot be undone.');
        console.log('Use --force to skip this confirmation.');
        
        // Wait for user confirmation (mock implementation in CLI)
        const confirm = await new Promise((resolve) => {
          console.log('Do you want to proceed? (y/N)');
          process.stdin.once('data', (data) => {
            const input = data.toString().trim().toLowerCase();
            resolve(input === 'y' || input === 'yes');
          });
        });
        
        if (!confirm) {
          console.log('Deletion cancelled.');
          await commandTrackingService.completeTracking(trackingId, {
            recordsAffected: 0,
            summary: `Deletion of document type ${documentType.document_type} (${options.id}) cancelled by user`
          });
          return;
        }
      }
      
      await documentTypeService.deleteDocumentType(options.id);
      
      console.log(`Document type "${documentType.document_type}" (${options.id}) deleted successfully.`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 1,
        summary: `Deleted document type ${documentType.document_type} (${options.id})`
      });
    } catch (error) {
      console.error('Error deleting document type:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to delete document type: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Get document type statistics
program
  .command('stats')
  .description('Get document type statistics')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'stats');
    
    try {
      console.log('Fetching document type statistics...');
      
      const stats = await documentTypeService.getDocumentTypeStats();
      
      if (options.json) {
        // Output as formatted JSON
        console.log(JSON.stringify(stats, null, 2));
      } else {
        // Output in a readable format
        console.log('\nDocument Type Statistics:');
        console.log('==============================================================');
        console.log(`Total Document Types:      ${stats.totalDocumentTypes}`);
        console.log(`Document Types In Use:     ${stats.documentTypesInUse}`);
        
        console.log('\nCategories:');
        console.log('--------------------------------------------------------------');
        Object.entries(stats.categoryCounts).forEach(([category, count]) => {
          console.log(`  ${category}: ${count}`);
        });
        
        console.log('\nTop Used Document Types:');
        console.log('--------------------------------------------------------------');
        stats.topUsedTypes.forEach((type, index) => {
          console.log(`  ${index + 1}. ${type.document_type} (${type.count} uses)`);
        });
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: stats.totalDocumentTypes,
        summary: `Retrieved statistics for ${stats.totalDocumentTypes} document types`
      });
    } catch (error) {
      console.error('Error fetching document type statistics:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to fetch document type statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Generate document type with AI
program
  .command('generate')
  .description('Generate a document type definition using AI')
  .requiredOption('-p, --prompt <prompt>', 'Description of the document type to generate')
  .option('--create', 'Create the document type in the database after generation', false)
  .action(async (options: GenerateOptions) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'generate');
    
    try {
      console.log('Generating document type with AI...');
      console.log(`Prompt: ${options.prompt}`);
      
      // Generate document type with AI
      const result = await documentTypeAIService.generateDocumentType(options.prompt);
      
      console.log('\nAI Analysis:');
      console.log('==============================================================');
      console.log(result.comments);
      
      if (result.jsonData) {
        console.log('\nGenerated Document Type Definition:');
        console.log('==============================================================');
        console.log(JSON.stringify(result.jsonData, null, 2));
        
        // Create document type if --create flag is provided
        if (options.create) {
          console.log('\nCreating document type in database...');
          
          const documentType = await documentTypeAIService.createFromAIResponse({
            aiResponseJson: JSON.stringify(result.jsonData)
          });
          
          console.log('\nDocument Type Created:');
          console.log('==============================================================');
          console.log(`ID:              ${documentType.id}`);
          console.log(`Name:            ${documentType.document_type}`);
          console.log(`Category:        ${documentType.category}`);
          
          await commandTrackingService.completeTracking(trackingId, {
            recordsAffected: 1,
            summary: `Generated and created document type ${documentType.document_type} (${documentType.id}) with AI`
          });
        } else {
          console.log('\nTo create this document type, run:');
          console.log(`./document-types-cli.sh generate --prompt "${options.prompt}" --create`);
          
          await commandTrackingService.completeTracking(trackingId, {
            recordsAffected: 0,
            summary: 'Generated document type definition with AI (not created in database)'
          });
        }
      } else {
        console.log('\nError: AI response did not contain a valid document type definition.');
        console.log('Please try again with a more detailed prompt.');
        
        await commandTrackingService.failTracking(trackingId, 'AI response did not contain a valid document type definition');
      }
    } catch (error) {
      console.error('Error generating document type with AI:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to generate document type with AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Get categories
program
  .command('categories')
  .description('List all document type categories')
  .action(async () => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'categories');
    
    try {
      console.log('Fetching document type categories...');
      
      const categories = await documentTypeService.getUniqueCategories();
      
      console.log('\nDocument Type Categories:');
      console.log('==============================================================');
      categories.forEach((category, index) => {
        console.log(`  ${index + 1}. ${category}`);
      });
      console.log('--------------------------------------------------------------');
      console.log(`Total: ${categories.length} categories`);
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: categories.length,
        summary: `Listed ${categories.length} document type categories`
      });
    } catch (error) {
      console.error('Error listing document type categories:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to list document type categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Health check
program
  .command('health-check')
  .description('Check the health of document type services')
  .action(async () => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'health-check');
    
    try {
      console.log('Performing document type services health check...');
      
      // Check SupabaseClientService
      console.log('\nChecking Supabase connection...');
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Try to fetch a single document type
      const { data, error } = await supabase
        .from('document_types')
        .select('id, document_type')
        .limit(1);
      
      if (error) {
        throw new Error(`Supabase connection error: ${error.message}`);
      }
      
      console.log('✅ Supabase connection: OK');
      
      // Check ClaudeService
      console.log('\nChecking Claude service...');
      const claudeOk = claudeService.validateApiKey();
      
      if (!claudeOk) {
        console.warn('⚠️ Claude service: No API key found');
      } else {
        console.log('✅ Claude service: API key found');
      }
      
      // Check DocumentTypeService
      console.log('\nChecking Document Type Service...');
      try {
        const categories = await documentTypeService.getUniqueCategories();
        console.log(`✅ Document Type Service: ${categories.length} categories found`);
      } catch (docTypeError) {
        console.error(`❌ Document Type Service error: ${docTypeError instanceof Error ? docTypeError.message : String(docTypeError)}`);
      }
      
      console.log('\nDocument Type Services Health Check Summary:');
      console.log('==============================================================');
      console.log('✅ Basic services connectivity check completed');
      console.log('✅ Database connection is operational');
      if (claudeOk) {
        console.log('✅ Claude AI service is properly configured');
      } else {
        console.log('⚠️ Claude AI service may not be properly configured (missing API key)');
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 0,
        summary: 'Completed document type services health check'
      });
    } catch (error) {
      console.error('Health check failed:', error instanceof Error ? error.message : error);
      console.log('\n❌ Document Type Services Health Check: FAILED');
      
      await commandTrackingService.failTracking(trackingId, `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Command: Set document type classifier
program
  .command('set-classifier')
  .description('Interactively set the document_classifier enum for document types')
  .option('--start-from <id>', 'Start from a specific document type ID')
  .option('--filter-category <category>', 'Filter by document type category')
  .action(async (options) => {
    // Import and run the set-classifier script
    require('./set-classifier');
  });

// Parse arguments and execute commands
program.parse(process.argv);