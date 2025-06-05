#!/usr/bin/env ts-node
/**
 * Document Types Classifier Setting CLI
 * 
 * Command-line interface for setting the document_classifier enum for document types.
 */
import { Command } from 'commander';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { documentTypeService } from '../../../packages/shared/services/document-type-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';
import * as readline from 'readline';

// Create commander instance
const program = new Command();

// Set CLI metadata
program
  .name('set-classifier')
  .description('Set the document_classifier enum for document types')
  .option('--start-from <id>', 'Start from a specific document type ID')
  .option('--filter-category <category>', 'Filter by document type category')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('document_types', 'set-classifier');
    
    try {
      console.log('Fetching document types...');
      
      // Fetch document types
      let documentTypes;
      if (options.filterCategory) {
        console.log(`Filtering by category: ${options.filterCategory}`);
        documentTypes = await documentTypeService.getDocumentTypesByCategory(options.filterCategory);
      } else {
        documentTypes = await documentTypeService.getAllDocumentTypes();
      }
      
      // Sort document types by category and name
      documentTypes.sort((a, b) => {
        // First sort by category
        const categoryA = a.category || '';
        const categoryB = b.category || '';
        const categoryCompare = categoryA.localeCompare(categoryB);
        
        // If categories are the same, sort by name
        if (categoryCompare === 0) {
          return a.name.localeCompare(b.name);
        }
        
        return categoryCompare;
      });
      
      // Create readline interface for user input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // Define the classifier enum options
      const classifierOptions = [
        'pdf',
        'powerpoint',
        'docx',
        'expert'
      ];
      
      // If start-from option is specified, find the starting index
      let startIndex = 0;
      if (options.startFrom) {
        const startFromIndex = documentTypes.findIndex(dt => dt.id === options.startFrom);
        if (startFromIndex !== -1) {
          startIndex = startFromIndex;
          console.log(`Starting from document type: ${documentTypes[startIndex].document_type}`);
        } else {
          console.log(`Document type with ID ${options.startFrom} not found. Starting from the beginning.`);
        }
      }
      
      // Process document types
      let processedCount = 0;
      const supabase = SupabaseClientService.getInstance().getClient();
      
      const processDocumentType = async (index: number) => {
        if (index >= documentTypes.length) {
          console.log(`\nCompleted processing ${processedCount} document types.`);
          rl.close();
          await commandTrackingService.completeTracking(trackingId, {
            recordsAffected: processedCount,
            summary: `Set classifier for ${processedCount} document types`
          });
          return;
        }
        
        const documentType = documentTypes[index];
        // Check if classifier exists in the type or as a property
        const currentClassifier = (documentType as any).classifier || 'Not set';
        
        console.log(`\n[${index + 1}/${documentTypes.length}] Document Type: ${documentType.name}`);
        console.log(`Category: ${documentType.category || 'N/A'}`);
        console.log(`General Type: ${documentType.is_general_type ? 'Yes' : 'No'}`);
        console.log(`Current classifier: ${currentClassifier}`);
        console.log('\nClassifier options:');
        classifierOptions.forEach((option, i) => {
          console.log(`${i + 1}. ${option}`);
        });
        console.log(`${classifierOptions.length + 1}. Skip`);
        console.log('Press Ctrl+C to exit');
        
        rl.question('Enter classifier number: ', async (answer) => {
          // Check if user entered the skip number option
          if (answer === String(classifierOptions.length + 1) || answer.toLowerCase() === 'skip') {
            console.log(`Skipping ${documentType.name}`);
            processDocumentType(index + 1);
            return;
          }
          
          const optionIndex = parseInt(answer, 10) - 1;
          if (isNaN(optionIndex) || optionIndex < 0 || optionIndex >= classifierOptions.length) {
            console.log('Invalid option. Please try again.');
            processDocumentType(index);
            return;
          }
          
          const selectedClassifier = classifierOptions[optionIndex];
          
          try {
            // Update the document type with the selected classifier
            const { error } = await supabase
              .from('document_types')
              .update({ classifier: selectedClassifier })
              .eq('id', documentType.id);
            
            if (error) {
              throw error;
            }
            
            console.log(`Set classifier for ${documentType.name} to ${selectedClassifier}`);
            processedCount++;
            
            // Process the next document type
            processDocumentType(index + 1);
          } catch (error: unknown) {
            console.error(`Error updating document type: ${error instanceof Error ? error.message : String(error)}`);
            // Continue to the next document type
            processDocumentType(index + 1);
          }
        });
      };
      
      // Start processing from the determined index
      processDocumentType(startIndex);
      
      // Handle SIGINT (Ctrl+C)
      rl.on('SIGINT', async () => {
        console.log('\nOperation cancelled by user.');
        rl.close();
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: processedCount,
          summary: `Set classifier for ${processedCount} document types (cancelled by user)`
        });
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Error setting document type classifiers:', error instanceof Error ? error.message : error);
      await commandTrackingService.failTracking(trackingId, `Failed to set document type classifiers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Parse arguments and execute command
program.parse(process.argv);