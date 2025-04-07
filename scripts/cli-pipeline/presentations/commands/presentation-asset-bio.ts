import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// Create a new command
export const presentationAssetBioCommand = new Command('presentation-asset-bio');

interface MatchResult {
  expertDocumentId: string;
  documentName: string;
  documentType: string;
  presentationId: string | null;
  presentationTitle: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  assetExists: boolean;
  folderPath: string;
}

// Set command description and options
presentationAssetBioCommand
  .description('Match non-transcript expert documents with presentations and create presentation assets')
  .option('-d, --dry-run', 'Preview matches without creating presentation assets', false)
  .option('-l, --limit <number>', 'Limit the number of documents to process', '100')
  .option('-f, --folder-id <id>', 'Filter by specific folder ID (default: Dynamic Healing Discussion Group)', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-c, --confirm-all', 'Automatically confirm all matches without prompting', false)
  .option('-t, --document-type <type>', 'Filter by specific document type (e.g., "Presentation Announcement")')
  .option('-m, --min-confidence <level>', 'Minimum confidence level for auto-confirmation (high, medium, low)', 'high')
  .action(async (options: any) => {
    try {
      console.log('DEBUG: Entering presentation-asset-bio action');
      Logger.info('Matching non-transcript expert documents with presentations...');
      
      const presentationService = PresentationService.getInstance();
      
      // Get non-transcript expert documents
      Logger.info('Finding non-transcript expert documents...');
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
      
      // Filter by confidence level if auto-confirming
      const confidenceLevels: Record<string, number> = {
        high: 3,
        medium: 2,
        low: 1
      };
      
      const minConfidence = options.minConfidence || 'high';
      const minConfidenceLevel = confidenceLevels[minConfidence] || 3;
      
      // Display matches
      console.log(chalk.bold('\nPROPOSED DOCUMENT-PRESENTATION MATCHES'));
      console.log(chalk.bold('======================================\n'));
      
      console.log('| Document Name | Document Type | Presentation | Confidence | Folder Path |');
      console.log('|---------------|--------------|--------------|------------|-------------|');
      
      for (const match of matches) {
        // Truncate long names for display
        const docName = (match.documentName || 'Unknown').substring(0, 25);
        const docType = (match.documentType || 'Unknown').substring(0, 15);
        const presTitle = (match.presentationTitle || 'No match').substring(0, 25);
        const folderPath = (match.folderPath || 'Unknown').substring(0, 30);
        
        // Color code by confidence
        let confidenceColor;
        switch (match.confidence) {
          case 'high':
            confidenceColor = chalk.green;
            break;
          case 'medium':
            confidenceColor = chalk.yellow;
            break;
          case 'low':
            confidenceColor = chalk.red;
            break;
          default:
            confidenceColor = chalk.white;
        }
        
        console.log(`| ${docName.padEnd(25)} | ${docType.padEnd(15)} | ${presTitle.padEnd(25)} | ${confidenceColor(match.confidence.padEnd(10))} | ${folderPath.padEnd(30)} |`);
      }
      
      // Count by confidence level
      const highConfidence = matches.filter(m => m.confidence === 'high').length;
      const mediumConfidence = matches.filter(m => m.confidence === 'medium').length;
      const lowConfidence = matches.filter(m => m.confidence === 'low').length;
      
      console.log(`\nSummary: ${highConfidence} high confidence, ${mediumConfidence} medium confidence, ${lowConfidence} low confidence matches`);
      
      if (options.dryRun) {
        Logger.info('Dry run - no presentation assets will be created.');
        return;
      }
      
      // Process matches based on confidence and options
      let confirmAll = options.confirmAll;
      let createdCount = 0;
      
      if (confirmAll) {
        Logger.info(`Creating presentation assets for ${matches.length} matched documents...`);
        
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
          const success = await presentationService.createPresentationAsset({
            presentationId: match.presentationId,
            expertDocumentId: match.expertDocumentId,
            assetType: match.documentType === 'Presentation Announcement' ? 'announcement' : 'supporting'
          });
          
          if (success) {
            createdCount++;
          }
        }
        
        Logger.info(`Created ${createdCount} new presentation assets.`);
      } else {
        Logger.info('To create presentation assets, run with --confirm-all flag:');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all');
        Logger.info('  presentations-cli presentation-asset-bio --confirm-all --min-confidence medium');
      }
      
    } catch (error) {
      Logger.error('Error matching documents with presentations:', error);
      process.exit(1);
    }
  });