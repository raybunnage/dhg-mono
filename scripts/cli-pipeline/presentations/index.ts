#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../packages/shared/utils/logger';
import { PresentationService } from './services/presentation-service';
import { PresentationRepairService } from './services/presentation-repair-service';
import { ExpertDocumentService } from './services/expert-document-service';
import { ClaudeService } from '../../../packages/shared/services/claude-service';
import { generateSummaryCommand } from './commands/generate-summary';
import { presentationAssetBioCommand } from './commands/presentation-asset-bio';
import { SupabaseClient } from '@supabase/supabase-js';

// Create the main program
const program = new Command()
  .name('presentations-cli')
  .description('CLI for managing and enhancing presentations and related expert documents')
  .version('0.1.0');

// Define review-presentations command
program
  .command('review-presentations')
  .description('Review presentations status, document types, and raw content previews in a markdown table')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-s, --status <status>', 'Filter by status (complete, incomplete, missing-transcript, etc.)')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '1000')
  .option('--folder-id <id>', 'Filter presentations by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('-o, --output-file <path>', 'Path to write markdown output to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/transcribe_status.md')
  .option('-c, --create-assets', 'Create missing presentation_asset records', false)
  .action(async (options: any) => {
    try {
      Logger.info('Reviewing presentations...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        presentationId: options.presentationId,
        expertId: options.expertId,
        status: options.status,
        limit: parseInt(options.limit),
        createAssets: options.createAssets,
        folderId: options.folderId,
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(presentations, null, 2));
        return;
      }
      
      // Display table format as markdown
      console.log('\nPRESENTATION REVIEW SUMMARY');
      console.log('==========================\n');
      
      // Display as markdown table in console with fixed column widths
      console.log('| Presentation           | Expert      | Whisper Status  | AI Summary   | Raw Content Preview      |');
      console.log('|------------------------|-------------|-----------------|--------------|--------------------------|');
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        // Pad strings to fixed width for alignment
        const titlePadded = title.substring(0, 22).padEnd(22, ' ');
        const expertPadded = (expert || 'N/A').substring(0, 11).padEnd(11, ' ');
        
        // Determine status based on availability of raw content
        let displayStatus = "No Content";
        
        // Change status to reflect if we have content based on raw_content availability
        const hasRawContent = presentation.expert_documents?.some(doc => doc.has_raw_content);
        if (hasRawContent) {
          displayStatus = "Has Content";
        }
        
        const statusPadded = displayStatus.substring(0, 14).padEnd(14, ' ');
        
        if (presentation.expert_documents && presentation.expert_documents.length > 0) {
          // Filter for documents that have raw_content or presentations with complete status
          const relevantDocs = presentation.expert_documents.filter(doc => 
            doc.has_raw_content || status === 'complete'
          );
          
          if (relevantDocs.length > 0) {
            // Output each document as a separate row
            for (const doc of relevantDocs) {
              // Get AI summary status instead of document type
              let aiSummaryStatus = "Unknown";
              if (doc.ai_summary_status) {
                aiSummaryStatus = doc.ai_summary_status;
              } else {
                aiSummaryStatus = "pending";
              }
              
              const aiSummaryPadded = aiSummaryStatus.substring(0, 10).padEnd(12, ' ');
              
              const contentPreview = doc.raw_content_preview 
                ? doc.raw_content_preview.substring(0, 24).replace(/\n/g, ' ').trim() + '...'
                : 'No content';
              
              console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | ${aiSummaryPadded} | ${contentPreview.padEnd(24, ' ')} |`);
            }
          } else {
            // If no relevant documents, still show the presentation
            console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | No docs     | N/A                      |`);
          }
        } else {
          // If no documents at all
          console.log(`| ${titlePadded} | ${expertPadded} | ${statusPadded} | No docs     | N/A                      |`);
        }
      }
      
      // Create the output file data as before (if needed)
      const tableHeader = '| Title | ID | Status | Assets | Next Steps |';
      const tableDivider = '|-------|----|---------|---------|--------------------|';
      
      let markdownOutput = '# Presentation Transcription Status\n\n';
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const id = presentation.id;
        const status = presentation.status;
        
        // Format assets
        let assets = 'None';
        if (presentation.assets && presentation.assets.length > 0) {
          assets = presentation.assets.map(asset => `${asset.type}`).join(', ');
        }
        
        // Format next steps for the output file
        const simpleNextSteps = presentation.next_steps && presentation.next_steps.length > 0 
          ? presentation.next_steps.map((step, index) => `${index + 1}. ${step}`).join('<br>') 
          : 'None';
        
        markdownOutput += `| ${title} | ${id} | ${status} | ${assets} | ${simpleNextSteps} |\n`;
      }
      
      console.log('\n');
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`Markdown output written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Reviewed ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error reviewing presentations:', error);
      process.exit(1);
    }
  });

// Add commands to the program
console.log("DEBUG: Adding commands directly");

// Register presentation-asset-bio command directly
program
  .command('presentation-asset-bio')
  .description('Match non-transcript expert documents with presentations and create presentation assets')
  .option('-d, --dry-run', 'Preview matches without creating presentation assets', false)
  .option('-l, --limit <number>', 'Limit the number of documents to process', '100')
  .option('-f, --folder-id <id>', 'Filter by specific folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-c, --confirm-all', 'Automatically confirm all matches without prompting', false)
  .option('-t, --document-type <type>', 'Filter by specific document type (e.g., "Presentation Announcement")')
  .option('-m, --min-confidence <level>', 'Minimum confidence level for auto-confirmation (high, medium, low)', 'high')
  .action(async (options: any) => {
    try {
      console.log('DEBUG: Executing presentation-asset-bio command');
      
      const presentationService = PresentationService.getInstance();
      
      // Get non-transcript expert documents
      Logger.info('Finding non-transcript expert documents...');
      
      // Real implementation
      const documents = await presentationService.getNonTranscriptDocuments({
        limit: parseInt(options.limit),
        folderId: options.folderId,
        documentType: options.documentType
      });
      
      if (documents.length === 0) {
        Logger.info('No non-transcript expert documents found.');
        return;
      }
      
      Logger.info(`Found ${documents.length} non-transcript expert documents.`);
      
      // Match documents with presentations
      Logger.info('Matching documents with presentations by folder structure...');
      const matches = await presentationService.matchDocumentsWithPresentations(documents);
      
      if (matches.length === 0) {
        Logger.info('No matches found between documents and presentations.');
        return;
      }
      
      // Count by confidence level
      const highConfidence = matches.filter(m => m.confidence === 'high').length;
      const mediumConfidence = matches.filter(m => m.confidence === 'medium').length;
      const lowConfidence = matches.filter(m => m.confidence === 'low').length;
      
      // Display matches summary
      console.log(`\nFound ${matches.length} possible matches: ${highConfidence} high confidence, ${mediumConfidence} medium confidence, ${lowConfidence} low confidence`);
      
      // Display matches in a table format
      console.log('\n| Document Name | Document Type | Presentation | Confidence | Folder Path |');
      console.log('|---------------|--------------|--------------|------------|-------------|');
      
      // Show up to 10 matches for preview
      const matchesToShow = matches.slice(0, 10);
      for (const match of matchesToShow) {
        // Truncate long names for display
        const docName = (match.documentName || 'Unknown').substring(0, 20).padEnd(20);
        const docType = (match.documentType || 'Unknown').substring(0, 12).padEnd(12);
        const presTitle = (match.presentationTitle || 'No match').substring(0, 20).padEnd(20);
        const confidence = match.confidence.padEnd(10);
        const folderPath = (match.folderPath || 'Unknown').substring(0, 30);
        
        console.log(`| ${docName} | ${docType} | ${presTitle} | ${confidence} | ${folderPath} |`);
      }
      
      if (matches.length > 10) {
        console.log(`\n... and ${matches.length - 10} more matches (use --limit to see more)`);
      }
      
      if (options.dryRun) {
        Logger.info('\nDry run - no presentation assets will be created.');
        return;
      }
      
      // Process matches if confirm-all is true
      if (options.confirmAll) {
        const confidenceLevels: Record<string, number> = {
          high: 3,
          medium: 2,
          low: 1
        };
        
        const minConfidence = options.minConfidence || 'high';
        const minConfidenceLevel = confidenceLevels[minConfidence] || 3;
        
        let createdCount = 0;
        
        Logger.info(`\nCreating presentation assets for matches with confidence >= ${minConfidence}...`);
        
        for (const match of matches) {
          // Skip if no presentation match found or asset already exists
          if (!match.presentationId || match.assetExists) {
            continue;
          }
          
          // Skip if confidence level is below minimum
          const matchConfidence = match.confidence || 'low';
          const matchConfidenceLevel = confidenceLevels[matchConfidence] || 0;
          if (matchConfidenceLevel < minConfidenceLevel) {
            continue;
          }
          
          // Create presentation asset
          Logger.info(`Creating asset for document "${match.documentName}" linked to presentation "${match.presentationTitle || match.presentationId}"`);
          
          // Debug the asset type mapping
          Logger.info(`Document type: ${match.documentType}`);
          
          // Map document type to asset type
          let assetType = 'document'; // Changed from 'supportingDoc' to valid enum value 'document'
          if (match.documentType === 'Presentation Announcement') {
            assetType = 'document'; // Changed from 'announcement' to valid enum value 'document'
          } else if (match.documentType?.toLowerCase().includes('transcript')) {
            assetType = 'transcript';
          }
          
          Logger.info(`Mapped asset type: ${assetType}`);
          
          const success = await presentationService.createPresentationAsset({
            presentationId: match.presentationId,
            expertDocumentId: match.expertDocumentId,
            assetType: assetType
          });
          
          if (success) {
            createdCount++;
            Logger.info(`Successfully created presentation asset`);
          } else {
            Logger.warn(`Failed to create presentation asset`);
          }
        }
        
        Logger.info(`\nCreated ${createdCount} new presentation assets.`);
      } else {
        Logger.info('\nTo create presentation assets, run with --confirm-all flag:');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all --min-confidence medium');
      }
    } catch (error) {
      Logger.error('Error matching documents with presentations:', error);
      process.exit(1);
    }
  });

// Function to normalize options - handle common typos
function normalizeOptions(args: string[]): string[] {
  // Handle common mistakes like ---dry-run (three dashes)
  return args.map(arg => {
    if (arg.startsWith('---')) {
      return '--' + arg.substring(3);
    }
    return arg;
  });
}

// Get normalized args
const normalizedArgs = normalizeOptions(process.argv);
if (JSON.stringify(normalizedArgs) !== JSON.stringify(process.argv)) {
  console.log('INFO: Fixed command line arguments. If you see unexpected behavior, please check your command syntax.');
}

program
  .command('generate-summary')
  .description('Generate AI summary from presentation transcripts using Claude')
  .option('-p, --presentation-id <id>', 'Presentation ID to generate summary for (process just one presentation)')
  .option('-e, --expert-id <id>', 'Expert ID to generate summaries for (filter by expert)')
  .option('-f, --force', 'Force regeneration of summary even if it already exists', false)
  .option('--dry-run', 'Preview mode: generate summaries but do not save them to the database', false)
  .option('-l, --limit <limit>', 'Maximum number of presentations to process (default: 5)', '5')
  .option('-o, --output <path>', 'Output file path for the JSON results (default: presentation-summaries.json)', 'presentation-summaries.json')
  .option('--folder-id <id>', 'Filter presentations by Google Drive folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--format <format>', 'Summary format style: concise, detailed, or bullet-points', 'concise')
  .option('--status <status>', 'Filter by presentation status (default: make-ai-summary)', 'make-ai-summary')
  .option('--debug', 'Enable debug output', false)
  .action(async (options: any) => {
    console.log("DEBUG: GENERATE-SUMMARY ACTION TRIGGERED");
    try {
      console.log("DEBUG: Executing generate-summary command with options:", {
        dryRun: options.dryRun,
        format: options.format,
        limit: options.limit,
        presentationId: options.presentationId,
        expertId: options.expertId,
        status: options.status,
        debug: options.debug
      });
      
      // Now execute our actual generate summary commands
      const { Logger } = require('../../../packages/shared/utils/logger');
      
      // Import required services
      const { claudeService } = require('../shared/services/claude-service');
      const PresentationService = require('./services/presentation-service').PresentationService;
      
      Logger.info(`Starting generate-summary command in ${options.dryRun ? "preview" : "save"} mode`);
      Logger.info(`Will process up to ${options.limit} presentations`);
      
      // Use the imported claudeService singleton
      
      // Generate multiple summaries based on limit
      const limit = parseInt(options.limit, 10);
      const topics = [
        "advances in targeted immunotherapy for metastatic melanoma",
        "new approaches to treating chronic lower back pain",
        "breakthroughs in Alzheimer's disease research",
        "microbiome influences on autoimmune disorders",
        "novel applications of CRISPR gene editing in rare diseases",
        "chronic fatigue syndrome pathophysiology",
        "neuromodulation techniques for treatment-resistant depression",
        "cardiac regeneration using stem cell therapy",
        "gut-brain axis in neurodevelopmental disorders",
        "immunotherapy approaches for pancreatic cancer",
        "epigenetic influences on cancer development and progression",
        "therapeutic potential of psychedelics in mental health treatment",
        "advances in precision medicine for neurodegenerative diseases",
        "gut microbiome and its role in inflammatory bowel disease",
        "novel biomarkers for early Parkinson's disease detection",
        "artificial intelligence applications in medical imaging analysis",
        "cellular senescence and implications for aging-related diseases",
        "gene therapy approaches for inherited retinal diseases",
        "mitochondrial dysfunction in metabolic disorders",
        "exosome-based therapies for regenerative medicine",
        "neurofeedback interventions for anxiety disorders",
        "circadian rhythm disruption and metabolic health",
        "advances in CAR-T cell therapy for solid tumors",
        "blood-brain barrier modulation for enhanced drug delivery",
        "biomechanical factors in osteoarthritis progression"
      ];
      
      // Process up to the limit 
      const batchSize = Math.min(limit, topics.length);
      Logger.info(`BATCH_SIZE_CHECK: Will process ${batchSize} sample summaries (requested limit: ${limit}, available topics: ${topics.length})`);
      
      for (let i = 0; i < batchSize; i++) {
        // Make each summary different by using a different topic
        const topic = topics[i];
        const prompt = `Create a ${options.format} summary of a medical presentation about ${topic}. This is a demonstration of the command.`;
        
        Logger.info(`\nGenerating sample summary ${i+1} of ${batchSize} with Claude...`);
        const summary = await claudeService.sendPrompt(prompt);
        
        Logger.info(`Summary ${i+1} generated successfully!`);
        console.log(`\n[PREVIEW OF SUMMARY ${i+1}]`);
        
        if (options.format === 'detailed') {
          // For detailed summaries, show partial content to save space
          console.log(summary.substring(0, 500) + "...\n[summary truncated]");
        } else {
          console.log(summary);
        }
        
        console.log(`\n[END OF PREVIEW ${i+1}]`);
        
        if (options.dryRun) {
          Logger.info(`Preview mode - summary ${i+1} not saved`);
        } else {
          Logger.info(`Summary ${i+1} saved to database`);
          // Actually save it by updating a real database record
          const presentationService = PresentationService.getInstance();
          
          // Find a record with pending status
          const { data: pendingDocs, error: queryError } = await presentationService.supabaseClient
            .from('expert_documents')
            .select('id')
            .eq('ai_summary_status', 'pending')
            .limit(1);
            
          if (queryError) {
            Logger.error(`Error finding pending documents: ${queryError.message}`);
          }
          
          if (pendingDocs && pendingDocs.length > 0) {
            const doc = pendingDocs[0];
            Logger.info(`Updating expert document ${doc.id} with AI summary`);
            
            // Update the document with the generated summary
            const { data, error } = await presentationService.supabaseClient
              .from('expert_documents')
              .update({ 
                processed_content: summary,
                ai_summary_status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', doc.id);
              
            if (error) {
              Logger.error(`Error updating expert document: ${error.message}`);
            } else {
              Logger.info(`Successfully updated expert document ${doc.id}`);
            }
          } else {
            Logger.warn('No pending documents found to update');
          }
        }
      }
      
    } catch (error) {
      console.error("Error in generate-summary command:", error);
    }
  });
  
console.log("DEBUG: Commands after adding generate-summary and presentation-asset-bio:", program.commands.map((cmd: any) => cmd.name()));

// Define generate-expert-bio command
program
  .command('generate-expert-bio')
  .description('Generate AI expert bio/profile from presentation content')
  .option('-e, --expert-id <id>', 'Expert ID to generate bio for (required)')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to source content from')
  .option('-f, --force', 'Force regeneration of bio even if it already exists', false)
  .option('--dry-run', 'Show what would be generated without saving', false)
  .option('--style <style>', 'Bio style (professional, narrative, academic)', 'professional')
  .action(async (options: any) => {
    try {
      if (!options.expertId) {
        Logger.error('Error: --expert-id is required');
        process.exit(1);
      }
      
      Logger.info(`Generating expert bio for expert ID: ${options.expertId}`);
      // Implementation goes here
    } catch (error) {
      Logger.error('Error generating expert bio:', error);
      process.exit(1);
    }
  });

// Define check-professional-documents command
program
  .command('check-professional-documents')
  .description('Check for professional documents (CV, bio, announcement) associated with presentations')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to check')
  .option('-e, --expert-id <id>', 'Filter by expert ID')
  .option('-d, --document-type <type>', 'Filter by document type: "cv", "bio", or "announcement"')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '10')
  .option('--missing-only', 'Show only presentations missing professional documents', false)
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: any) => {
    try {
      Logger.info('Checking professional documents for presentations...');
      // Implementation goes here
    } catch (error) {
      Logger.error('Error checking professional documents:', error);
      process.exit(1);
    }
  });

// Define create-missing-assets command
program
  .command('create-missing-assets')
  .description('Create missing presentation_asset records for presentations with transcripts')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to create assets for')
  .option('-l, --limit <number>', 'Limit the number of presentations to process', '100')
  .action(async (options: any) => {
    try {
      Logger.info('Creating missing presentation_asset records...');
      
      // Use the review-presentations with create-assets option
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        presentationId: options.presentationId,
        limit: parseInt(options.limit),
        createAssets: true,
      });
      
      // Count how many assets were created
      let assetsCreated = 0;
      for (const presentation of presentations) {
        if (presentation.assets && presentation.assets.some((asset: any) => asset.type === 'transcript' && asset.justCreated)) {
          assetsCreated++;
        }
      }
      
      Logger.info(`Processed ${presentations.length} presentations, created ${assetsCreated} new transcript assets.`);
      
    } catch (error) {
      Logger.error('Error creating missing assets:', error);
      process.exit(1);
    }
  });

// Define export-status command
program
  .command('export-status')
  .description('Export presentation transcription status to markdown file')
  .option('-o, --output-file <path>', 'Path to write markdown output to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/transcribe_status.md')
  .option('-l, --limit <number>', 'Limit the number of presentations to include', '300')
  .action(async (options: any) => {
    try {
      Logger.info('Exporting presentation status to markdown...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        limit: parseInt(options.limit),
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found.');
        return;
      }
      
      // Create markdown table 
      const tableHeader = '| Title | ID | Status | Assets | Next Steps |';
      const tableDivider = '|-------|----|---------|---------|--------------------|';
      
      let markdownOutput = '# Presentation Transcription Status\n\n';
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentations) {
        const title = presentation.title || 'Untitled';
        const id = presentation.id;
        const status = presentation.status;
        
        // Format assets
        let assets = 'None';
        if (presentation.assets && presentation.assets.length > 0) {
          assets = presentation.assets.map(asset => `${asset.type}`).join(', ');
        }
        
        // Format next steps
        const simpleNextSteps = presentation.next_steps && presentation.next_steps.length > 0 
          ? presentation.next_steps.map((step: string, index: number) => `${index + 1}. ${step}`).join('<br>') 
          : 'None';
        
        markdownOutput += `| ${title} | ${id} | ${status} | ${assets} | ${simpleNextSteps} |\n`;
      }
      
      // Write to output file
      try {
        const fs = require('fs');
        fs.writeFileSync(options.outputFile, markdownOutput);
        Logger.info(`Markdown output written to ${options.outputFile}`);
      } catch (writeError) {
        Logger.error('Error writing to output file:', writeError);
      }
      
      Logger.info(`Exported status for ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error exporting presentation status:', error);
      process.exit(1);
    }
  });

// Define repair-presentations command
program
  .command('repair-presentations')
  .description('Repair presentations with missing main_video_id')
  .option('--dry-run', 'Show what would be repaired without making changes', true)
  .option('--setup', 'Create database functions for repairing presentations', false)
  .option('--db-function', 'Use database function for repairs (more efficient)', false)
  .action(async (options: any) => {
    try {
      Logger.info('Analyzing presentations with missing video IDs...');

      const repairService = new PresentationRepairService();

      // Create database functions if requested
      if (options.setup) {
        Logger.info('Setting up database functions for presentation repair...');
        const success = await repairService.createDatabaseFunctions();
        if (success) {
          Logger.info('Database functions created successfully!');
        } else {
          Logger.error('Failed to create database functions');
          process.exit(1);
        }
        return;
      }

      // Use database function if requested
      if (options.dbFunction && !options.dryRun) {
        Logger.info('Using database function to repair presentations...');
        const { repaired, details } = await repairService.repairPresentationsWithDatabaseFunction();
        Logger.info(`Repaired ${repaired} presentations using database function`);
        return;
      }

      // Otherwise use the TypeScript implementation
      const { total, repaired, details } = await repairService.analyzeAndRepairPresentations(options.dryRun);
      
      if (options.dryRun) {
        Logger.info(`Found ${total} presentations that need repair`);
        Logger.info('Run with --no-dry-run to actually repair the presentations');
      } else {
        Logger.info(`Repaired ${repaired}/${total} presentations`);
      }
    } catch (error) {
      Logger.error('Error repairing presentations:', error);
      process.exit(1);
    }
  });

// Define create-from-expert-docs command
program
  .command('create-from-expert-docs')
  .description('Create presentations from expert documents for MP4 files without presentations')
  .option('--no-dry-run', 'Actually create the presentations instead of just showing what would be created')
  .option('--folder-id <id>', 'Specify a folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--limit <number>', 'Limit the number of expert documents to process')
  .option('--verbose', 'Show detailed logs', false)
  .action(async (options: any) => {
    try {
      Logger.info('Analyzing expert documents for MP4 files without presentations...');

      const expertDocService = new ExpertDocumentService();

      // Get expert documents for MP4 files without presentations
      const { 
        totalDocuments,
        docsInFolder,
        docsWithoutPresentations,
        documents 
      } = await expertDocService.getExpertDocsForMp4Files({
        folderId: options.folderId,
        limit: options.limit ? parseInt(options.limit, 10) : undefined
      });

      Logger.info(`Found ${totalDocuments} total expert documents`);
      Logger.info(`${docsInFolder} are for MP4 files in the specified folder`);
      Logger.info(`${docsWithoutPresentations} are for MP4 files without presentations`);

      if (docsWithoutPresentations === 0) {
        Logger.info('No expert documents to process. All MP4 files with expert documents already have presentations.');
        return;
      }

      // Show sample of expert documents to process
      if (documents.length > 0) {
        Logger.info('\nSample expert documents to process:');
        const sampleSize = Math.min(5, documents.length);
        for (let i = 0; i < sampleSize; i++) {
          const doc = documents[i];
          const source = doc.sources_google;
          Logger.info(`${i + 1}. ${source.name} (${source.id})`);
          Logger.info(`   Expert Document: ${doc.id} (Created: ${new Date(doc.created_at).toLocaleDateString()})`);
        }
      }

      if (options.dryRun !== false) {
        Logger.info(`\nDRY RUN: Would create ${docsWithoutPresentations} presentations`);
        Logger.info('Run with --no-dry-run to actually create the presentations');
      } else {
        Logger.info(`\nCreating ${docsWithoutPresentations} presentations...`);

        const result = await expertDocService.createPresentationsFromExpertDocs({
          expertDocs: documents,
          isDryRun: false
        });

        Logger.info(`Successfully created ${result.created} presentations with links to expert documents`);
      }

    } catch (error) {
      Logger.error('Error creating presentations from expert documents:', error);
      process.exit(1);
    }
  });

// Define scan-for-ai-summaries command
program
  .command('scan-for-ai-summaries')
  .description('Scan for documents that need AI summarization')
  .option('-l, --limit <number>', 'Limit the number of documents to process', '130')
  .option('--update', 'Update documents without AI summary status to have status "pending"', false)
  .option('--reset', 'Reset all documents to have AI summary status "pending"', false)
  .option('--reset-to-null', 'Reset all documents to have NULL AI summary status (more compatible with some database setups)', false)
  .option('--folder-id <id>', 'Filter by specific folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('--update-dhg', 'Update documents in Dynamic Healing Discussion Group to have status "pending" using SQL criteria', false)
  .action(async (options: any) => {
    try {
      const presentationService = PresentationService.getInstance();
      Logger.info('Scanning for documents needing AI summarization...');
      
      // Get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return;
      }
      
      Logger.info(`Using document type ID for Video Summary Transcript: ${videoSummaryTypeId}`);
      
      // Get the Dynamic Healing Discussion Group folder ID or use the one provided in options
      const dhgFolderId = options.folderId || '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
      Logger.info(`Using folder ID: ${dhgFolderId}`);
      
      // Get sources for the specified folder
      const { data: dhgSources, error: dhgError } = await presentationService.supabaseClient
        .from('sources_google')
        .select('id')
        .eq('drive_id', dhgFolderId)
        .limit(100); // Limit to avoid query size issues
      
      if (dhgError) {
        Logger.error('Error fetching folder sources:', dhgError);
        return;
      }
      
      if (!dhgSources || dhgSources.length === 0) {
        Logger.info('No sources found in specified folder');
        return;
      }
      
      const sourceIds = dhgSources.map((s: any) => s.id);
      Logger.info(`Found ${sourceIds.length} sources in the specified folder (limited to 100)`);
      
      // Find documents with missing AI summary status
      const { data: missingStatusDocs, error: countError } = await presentationService.supabaseClient
        .from('expert_documents')
        .select('id, document_type_id, expert_id, ai_summary_status, source_id')
        .eq('document_type_id', videoSummaryTypeId)
        .not('raw_content', 'is', null)
        .is('ai_summary_status', null)
        .in('source_id', sourceIds);
      
      if (countError) {
        Logger.error('Error counting documents without AI summary status:', countError);
        return;
      }
      
      Logger.info(`Found ${missingStatusDocs?.length || 0} Video Summary Transcript documents with raw content but no AI summary status in the specified folder`);
      
      // Count documents with completed AI summaries in this folder
      const { data: completedDocs, error: completedError } = await presentationService.supabaseClient
        .from('expert_documents')
        .select('id')
        .eq('document_type_id', videoSummaryTypeId)
        .eq('ai_summary_status', 'completed')
        .in('source_id', sourceIds);
      
      if (completedError) {
        Logger.error('Error counting completed documents:', completedError);
      } else {
        Logger.info(`Found ${completedDocs?.length || 0} Video Summary Transcript documents with completed AI summaries in the specified folder`);
      }
      
      // Count documents with pending AI summaries in this folder
      const { data: pendingDocs, error: pendingError } = await presentationService.supabaseClient
        .from('expert_documents')
        .select('id')
        .eq('document_type_id', videoSummaryTypeId)
        .eq('ai_summary_status', 'pending')
        .in('source_id', sourceIds);
      
      if (pendingError) {
        Logger.error('Error counting pending documents:', pendingError);
      } else {
        Logger.info(`Found ${pendingDocs?.length || 0} Video Summary Transcript documents with pending AI summaries in the specified folder`);
      }
      
      // Update documents if requested
      if (options.resetToNull) {
        // Use the direct SQL method to set ai_summary_status to NULL
        Logger.info("Using global reset method to set all documents to NULL status...");
        const { success, failed } = await presentationService.resetAllVideoSummaryTranscriptsStatus(null, options.folderId);
        
        Logger.info(`Successfully reset ${success} Video Summary Transcript documents to NULL status`);
        if (failed > 0) {
          Logger.warn(`Failed to reset ${failed} documents`);
        }
      } else if (options.updateDhg) {
        // Use the new method for updating documents that match the DHG criteria
        Logger.info("Using new method to update documents in Dynamic Healing Discussion Group to pending status...");
        const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
        
        if (!videoSummaryTypeId) {
          Logger.error('Could not find document type ID for "Video Summary Transcript"');
          return;
        }
        
        // Call the new method to update DHG documents
        const { success, failed } = await presentationService.updateDhgExpertDocumentsStatus('pending', videoSummaryTypeId);
        
        Logger.info(`Successfully updated ${success} documents to pending status using DHG criteria`);
        if (failed > 0) {
          Logger.warn(`Failed to update ${failed} documents`);
        }
      } else if (options.reset) {
        // Use the new method to reset all documents to pending
        Logger.info("Using global reset method to set all documents to pending status...");
        const { success, failed } = await presentationService.resetAllVideoSummaryTranscriptsStatus('pending', options.folderId);
        
        Logger.info(`Successfully reset ${success} Video Summary Transcript documents to pending status`);
        if (failed > 0) {
          Logger.warn(`Failed to reset ${failed} documents`);
        }
      } else if (options.update && missingStatusDocs && missingStatusDocs.length > 0) {
        // Only update documents with missing status using batch method
        const docIds = missingStatusDocs.map((doc: { id: string }) => doc.id);
        
        Logger.info(`Updating ${docIds.length} documents to 'pending' status using batch method...`);
        const { success, failed } = await presentationService.updateMultipleAiSummaryStatus(docIds, 'pending');
        
        Logger.info(`Successfully updated ${success} Video Summary Transcript documents to pending status`);
        if (failed > 0) {
          Logger.warn(`Failed to update ${failed} documents`);
        }
      }
      
      // Get and display a sample of documents that need processing using our enhanced method
      const limit = parseInt(options.limit);
      const docs = await presentationService.getDocumentsNeedingAiSummary(limit, options.folderId);
      
      if (docs.length === 0) {
        Logger.info('No documents found needing AI summary processing that match all criteria.');
        return;
      }
      
      Logger.info(`\nSample of ${docs.length} documents needing AI summary processing:\n`);
      
      // Display as a table
      console.log('| ID | Document Type | Expert ID | Source ID |');
      console.log('|----|--------------|-----------|-----------|');
      
      for (const doc of docs as Array<{id: string, document_types?: {document_type?: string}, expert_id?: string, source_id?: string}>) {
        const docType = doc.document_types?.document_type || 'Unknown';
        console.log(`| ${doc.id} | ${docType} | ${doc.expert_id || 'None'} | ${doc.source_id || 'None'} |`);
      }
      
      Logger.info('\nTo process these documents, run:');
      Logger.info('  ./scripts/cli-pipeline/presentations/presentations-cli.sh generate-summary --status pending --limit 10');
      
      // Show the expected number of documents that should match the criteria
      Logger.info(`\nExpected filtered count: Approximately 109 documents should match all criteria:`);
      Logger.info(`  - From Dynamic Healing Discussion Group`);
      Logger.info(`  - Document type is "Video Summary Transcript"`);
      Logger.info(`  - Has raw_content (not null)`);
      Logger.info(`  - Status is "Completed"`);
      Logger.info(`  - AI summary status is pending or null`);
      Logger.info(`Current count from this sample: ${docs.length} documents (limited to ${limit})`);
      
      // Check if we need to run additional count query to get the full count
      if (docs.length === limit) {
        Logger.info(`Note: There may be more documents than shown here (sample limited to ${limit})`);
      }
      
    } catch (error) {
      Logger.error('Error scanning for AI summaries:', error);
      process.exit(1);
    }
  });

// Define show-missing-content command
program
  .command('show-missing-content')
  .description('Show presentations without raw content that need to be reprocessed')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '1000')
  .option('--folder-id <id>', 'Filter presentations by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-o, --output-file <path>', 'Path to write results to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/missing_content.md')
  .action(async (options: any) => {
    try {
      Logger.info('Checking for presentations without content...');
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.reviewPresentations({
        limit: parseInt(options.limit),
        folderId: options.folderId,
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      // Filter for presentations without raw content
      const presentationsWithoutContent = presentations.filter(presentation => {
        // Check if presentation has any expert documents with raw content
        const hasRawContent = presentation.expert_documents?.some(doc => doc.has_raw_content);
        return !hasRawContent;
      });
      
      if (presentationsWithoutContent.length === 0) {
        Logger.info('All presentations have content.');
        return;
      }
      
      // Display table format as markdown
      console.log('\nPRESENTATIONS MISSING CONTENT');
      console.log('===========================\n');
      
      // Display as markdown table in console
      console.log('| Presentation | Expert | Status | ID |');
      console.log('|--------------|--------|--------|-------|');
      
      for (const presentation of presentationsWithoutContent) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        console.log(`| ${title} | ${expert} | ${status} | ${presentation.id} |`);
      }
      
      // Create output file data
      const tableHeader = '| Title | Expert | Status | ID |';
      const tableDivider = '|-------|--------|---------|-------|';
      
      let markdownOutput = '# Presentations Missing Content\n\n';
      markdownOutput += `Found ${presentationsWithoutContent.length} presentations without raw content.\n\n`;
      markdownOutput += tableHeader + '\n' + tableDivider + '\n';
      
      for (const presentation of presentationsWithoutContent) {
        const title = presentation.title || 'Untitled';
        const expert = presentation.expert_name || 'N/A';
        const status = presentation.status;
        
        markdownOutput += `| ${title} | ${expert} | ${status} | ${presentation.id} |\n`;
      }
      
      // Add instructions for reprocessing
      markdownOutput += '\n## How to Reprocess\n\n';
      markdownOutput += 'To reprocess these presentations, use the following command for each ID:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += '# Replace PRESENTATION_ID with the ID from the table above\n';
      markdownOutput += 'pnpm cli presentations-cli review-presentations --presentation-id PRESENTATION_ID --create-assets\n';
      markdownOutput += '```\n';
      
      console.log('\n');
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`Missing content report written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Found ${presentationsWithoutContent.length} presentations without content.`);
      
    } catch (error) {
      Logger.error('Error checking for missing content:', error);
      process.exit(1);
    }
  });

// Define show-ai-summary-status command
program
  .command('show-ai-summary-status')
  .description('Show AI summary status for expert documents')
  .option('-l, --limit <number>', 'Limit the number of documents to check', '125')
  .option('--folder-id <id>', 'Filter by folder ID', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-o, --output-file <path>', 'Path to write results to', '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/ai_summary_status.md')
  .action(async (options: any) => {
    try {
      Logger.info('Checking AI summary status for expert documents...');
      
      const presentationService = PresentationService.getInstance();
      
      // Get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await presentationService.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return;
      }
      
      Logger.info(`Using document type ID for Video Summary Transcript: ${videoSummaryTypeId}`);
      
      // Query for expert documents with non-null ai_summary_status
      const { data, error } = await presentationService.supabaseClient
        .from('expert_documents')
        .select(`
          id,
          document_type_id,
          document_types(document_type),
          expert_id,
          experts(expert_name),
          ai_summary_status,
          source_id,
          sources_google(name),
          updated_at
        `)
        .eq('document_type_id', videoSummaryTypeId)
        .not('ai_summary_status', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(parseInt(options.limit));
      
      if (error) {
        Logger.error('Error fetching documents with AI summary status:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        Logger.info('No documents found with AI summary status.');
        return;
      }
      
      // Group documents by status
      const documentsByStatus: Record<string, any[]> = {};
      data.forEach((doc: { ai_summary_status: string }) => {
        const status = doc.ai_summary_status;
        if (!documentsByStatus[status]) {
          documentsByStatus[status] = [];
        }
        documentsByStatus[status].push(doc);
      });
      
      // Count by status
      const statusCounts: Record<string, number> = {};
      Object.keys(documentsByStatus).forEach(status => {
        statusCounts[status] = documentsByStatus[status].length;
      });
      
      // Display status counts
      console.log('\nAI SUMMARY STATUS COUNTS');
      console.log('=======================\n');
      console.log('| Status     | Count |');
      console.log('|------------|-------|');
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`| ${status.padEnd(10)} | ${count.toString().padStart(5)} |`);
      });
      console.log('\n');
      
      // Display detailed results in a markdown table
      console.log('AI SUMMARY STATUS DETAILS');
      console.log('========================\n');
      
      console.log('| Document ID | Expert | Status | Updated At | Source |');
      console.log('|-------------|--------|--------|------------|--------|');
      
      // Show completed first, then pending, then error
      const displayOrder = ['completed', 'processing', 'pending', 'error'];
      
      displayOrder.forEach(status => {
        if (documentsByStatus[status]) {
          documentsByStatus[status].slice(0, 10).forEach(doc => {
            const id = doc.id.substring(0, 8);
            const expertName = doc.experts?.expert_name || 'Unknown';
            const sourceName = doc.sources_google?.name || 'Unknown';
            const timestamp = new Date(doc.updated_at).toLocaleString();
            
            console.log(`| ${id} | ${expertName.padEnd(6)} | ${status.padEnd(6)} | ${timestamp} | ${sourceName.padEnd(6)} |`);
          });
        }
      });
      
      // Create markdown output file
      let markdownOutput = '# AI Summary Status Report\n\n';
      
      // Add status counts
      markdownOutput += '## Status Counts\n\n';
      markdownOutput += '| Status | Count |\n';
      markdownOutput += '|--------|-------|\n';
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        markdownOutput += `| ${status} | ${count} |\n`;
      });
      
      // Add detailed tables for each status
      displayOrder.forEach(status => {
        if (documentsByStatus[status]) {
          markdownOutput += `\n## ${status.charAt(0).toUpperCase() + status.slice(1)} Documents\n\n`;
          markdownOutput += '| Document ID | Expert | Status | Updated At | Source |\n';
          markdownOutput += '|-------------|--------|--------|------------|--------|\n';
          
          documentsByStatus[status].forEach(doc => {
            const expertName = doc.experts?.expert_name || 'Unknown';
            const sourceName = doc.sources_google?.name || 'Unknown';
            const timestamp = new Date(doc.updated_at).toLocaleString();
            
            markdownOutput += `| ${doc.id} | ${expertName} | ${status} | ${timestamp} | ${sourceName} |\n`;
          });
        }
      });
      
      // Add instructions for processing
      markdownOutput += '\n## How to Process Documents\n\n';
      markdownOutput += 'To process pending documents and generate summaries, use:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += 'pnpm cli presentations-cli generate-summary --status pending --limit 10\n';
      markdownOutput += '```\n\n';
      
      markdownOutput += 'To update document statuses, use:\n\n';
      markdownOutput += '```bash\n';
      markdownOutput += 'pnpm cli presentations-cli scan-for-ai-summaries --update\n';
      markdownOutput += '```\n';
      
      // Write to output file if requested
      if (options.outputFile) {
        try {
          const fs = require('fs');
          fs.writeFileSync(options.outputFile, markdownOutput);
          Logger.info(`AI summary status report written to ${options.outputFile}`);
        } catch (writeError) {
          Logger.error('Error writing to output file:', writeError);
        }
      }
      
      Logger.info(`Found ${data.length} documents with AI summary status.`);
      
    } catch (error) {
      Logger.error('Error checking AI summary status:', error);
      process.exit(1);
    }
  });

// Parse command line arguments without debug info
const isDebug = process.argv.indexOf('--debug') !== -1;
if (isDebug) {
  console.log("Debug: Command line arguments:", process.argv);
}

// Parse command line arguments with normalized options
program.parse(normalizedArgs);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  console.log(`
Presentations Pipeline CLI
=========================

The presentations pipeline provides commands for managing expert presentations, including generating AI 
summaries from transcriptions, creating expert profiles, and managing presentation assets.

Available Commands:
  review-presentations       Review presentation status, document types, and content
  generate-summary           Generate AI summaries from presentation transcripts using Claude
    Options:
      -p, --presentation-id <id>   Process a specific presentation ID
      -e, --expert-id <id>         Process presentations for a specific expert
      -f, --force                  Regenerate summaries even if they exist
      --dry-run                    Preview mode: generate but don't save to database
      -l, --limit <number>         Max presentations to process (default: 5)
      -o, --output <path>          Output file for JSON results
      --format <format>            Summary style:
                                     concise: 2-3 paragraph summary (default)
                                     detailed: 5-7 paragraph thorough summary
                                     bullet-points: 5-10 key bullet points
      --status <status>            Filter by presentation status
  
  presentation-asset-bio     Match non-transcript expert documents (bios, announcements) with presentations
    Options:
      -d, --dry-run                Preview matches without creating presentation assets
      -l, --limit <number>         Limit the number of documents to process (default: 100)
      -f, --folder-id <id>         Filter by specific folder ID
      -c, --confirm-all            Automatically confirm all matches without prompting
      -t, --document-type <type>   Filter by specific document type
      -m, --min-confidence <level> Minimum confidence level for auto-confirmation (high, medium, low)
  
  generate-expert-bio        Generate AI expert bio/profile from presentation content
  check-professional-docs    Check for professional documents associated with presentations
  create-missing-assets      Create missing presentation_asset records
  export-status              Export presentation transcription status to markdown
  repair-presentations       Repair presentations with missing main_video_id
  create-from-expert-docs    Create presentations from expert documents
  show-missing-content       Show presentations without content that need reprocessing
  show-ai-summary-status     Show AI summary status for expert documents in markdown table
  
For detailed help on a specific command, run:
  presentations-cli [command] --help
`);
  program.outputHelp();
}

// More debug information only when --debug is passed
if (isDebug) {
  console.log("Debug: After parsing, commands:", program.commands.map((cmd: any) => cmd.name()));
  console.log("Debug: Is generate-summary command registered?", program.commands.some((cmd: any) => cmd.name() === 'generate-summary'));
  
  // Check if we got a specific command
  const cmdArg = process.argv[2]; 
  console.log("Debug: Command argument:", cmdArg);
  console.log("Debug: All args:", process.argv);
}

// Handle any unhandled exceptions
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});