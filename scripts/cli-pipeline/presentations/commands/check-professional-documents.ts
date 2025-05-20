import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// Define interfaces for the professional document data structure
interface ProfessionalDocument {
  id: string;
  type: string;
  status: 'available' | 'missing';
  created_at?: string;
  updated_at?: string;
}

interface PresentationWithProfessionalDocs {
  id: string;
  title: string;
  expert_id?: string;
  expert_name?: string;
  cv?: ProfessionalDocument;
  bio?: ProfessionalDocument;
  announcement?: ProfessionalDocument;
  hasAnyProfessionalDocument: boolean;
}

// Create the command
const checkProfessionalDocumentsCommand = new Command('check-professional-documents');

// Set command description and options
checkProfessionalDocumentsCommand
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
      
      const presentationService = PresentationService.getInstance();
      const presentations = await presentationService.checkProfessionalDocuments({
        presentationId: options.presentationId,
        expertId: options.expertId,
        documentType: options.documentType,
        limit: parseInt(options.limit),
        missingOnly: options.missingOnly
      });
      
      if (presentations.length === 0) {
        Logger.info('No presentations found matching the criteria.');
        return;
      }
      
      if (options.format === 'json') {
        console.log(JSON.stringify(presentations, null, 2));
        return;
      }
      
      // Display table format
      console.log(chalk.bold('\nPROFESSIONAL DOCUMENTS CHECK'));
      console.log(chalk.bold('==============================\n'));
      
      const statusSymbols = {
        available: chalk.green('✓'),
        missing: chalk.red('✗'),
      };
      
      (presentations as PresentationWithProfessionalDocs[]).forEach((presentation) => {
        console.log(chalk.bold(`Presentation: ${presentation.title} (ID: ${presentation.id})`));
        console.log(`Expert: ${presentation.expert_name || 'Unknown'}`);
        
        console.log('\nProfessional Documents:');
        if (presentation.cv) {
          console.log(`- Curriculum Vitae: ${statusSymbols[presentation.cv.status]} ${presentation.cv.status === 'available' ? `(ID: ${presentation.cv.id})` : ''}`);
        } else {
          console.log(`- Curriculum Vitae: ${statusSymbols.missing}`);
        }
        
        if (presentation.bio) {
          console.log(`- Professional Biography: ${statusSymbols[presentation.bio.status]} ${presentation.bio.status === 'available' ? `(ID: ${presentation.bio.id})` : ''}`);
        } else {
          console.log(`- Professional Biography: ${statusSymbols.missing}`);
        }
        
        if (presentation.announcement) {
          console.log(`- Presentation Announcement: ${statusSymbols[presentation.announcement.status]} ${presentation.announcement.status === 'available' ? `(ID: ${presentation.announcement.id})` : ''}`);
        } else {
          console.log(`- Presentation Announcement: ${statusSymbols.missing}`);
        }
        
        console.log('\nStatus:');
        const docStatus = presentation.hasAnyProfessionalDocument 
          ? chalk.green('At least one professional document available')
          : chalk.red('No professional documents available');
        console.log(`- ${docStatus}`);
        
        console.log(chalk.gray('\n--------------------------------------------------\n'));
      });
      
      // Summary
      const withDocs = (presentations as PresentationWithProfessionalDocs[]).filter(p => p.hasAnyProfessionalDocument).length;
      const withoutDocs = presentations.length - withDocs;
      
      console.log(chalk.bold('Summary:'));
      console.log(`Total presentations: ${presentations.length}`);
      console.log(`With professional documents: ${withDocs}`);
      console.log(`Missing professional documents: ${withoutDocs}`);
      
      Logger.info(`Checked ${presentations.length} presentations.`);
      
    } catch (error) {
      Logger.error('Error checking professional documents:', error);
      process.exit(1);
    }
  });

// Export the command
export { checkProfessionalDocumentsCommand };