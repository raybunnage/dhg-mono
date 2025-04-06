import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { ClaudeService } from '../../../../packages/shared/services/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// const logger = new Logger('generate-summary-command');

// Create a new command
export const generateSummaryCommand = new Command('generate-summary');

// Set command description and options
generateSummaryCommand
  .description('Generate AI summary from presentation transcript')
  .requiredOption('-p, --presentation-id <id>', 'Presentation ID to generate summary for')
  .option('-f, --force', 'Force regeneration of summary even if it already exists', false)
  .option('--dry-run', 'Show what would be generated without saving', false)
  .option('--format <format>', 'Summary format (concise, detailed, bullet-points)', 'concise')
  .action(async (options: any) => {
    try {
      Logger.info(`Generating summary for presentation ID: ${options.presentationId}`);
      
      const presentationService = PresentationService.getInstance();
      const claudeService = new ClaudeService();
      
      // Get presentation details including transcript
      const presentation = await presentationService.getPresentationWithTranscript(options.presentationId);
      
      if (!presentation) {
        Logger.error('Presentation not found');
        process.exit(1);
      }
      
      if (!presentation.transcript) {
        Logger.error('Presentation transcript not found. Run media-processing pipeline first to generate a transcript.');
        process.exit(1);
      }
      
      Logger.info(`Found presentation: ${presentation.title}`);
      
      // Check if summary already exists
      const existingSummary = await presentationService.getExistingSummary(presentation.expert_id);
      
      if (existingSummary && !options.force) {
        Logger.warn('Summary already exists for this presentation. Use --force to regenerate.');
        Logger.info('Existing summary:');
        console.log(chalk.yellow(existingSummary.processed_content.substring(0, 200) + '...'));
        return;
      }
      
      // Generate summary prompt based on format
      const prompt = generateSummaryPrompt(presentation.transcript, options.format);
      
      Logger.info('Generating summary using Claude...');
      
      // Call Claude API to generate summary
      const summary = await claudeService.sendPrompt(prompt);
      
      if (options.dryRun) {
        Logger.info('Dry run - summary would be:');
        console.log(chalk.green(summary));
        return;
      }
      
      // Save the summary
      await presentationService.saveSummary({
        expertId: presentation.expert_id,
        presentationId: presentation.id,
        summary,
        existingSummaryId: existingSummary?.id
      });
      
      Logger.info(chalk.green('Summary generated and saved successfully'));
      Logger.info('Preview:');
      console.log(chalk.green(summary.substring(0, 200) + '...'));
      
    } catch (error) {
      Logger.error('Error generating summary:', error);
      process.exit(1);
    }
  });

function generateSummaryPrompt(transcript: string, format: string): string {
  const formatInstructions: Record<string, string> = {
    concise: 'Create a concise 2-3 paragraph summary that captures the key points and main message.',
    detailed: 'Create a detailed summary (5-7 paragraphs) that thoroughly explains the main points, supporting evidence, and conclusions.',
    'bullet-points': 'Create a bullet-point summary with 5-10 key points from the presentation.'
  };
  
  return `
You are an expert medical content summarizer. Your task is to summarize the following transcript from a medical presentation or discussion.

${formatInstructions[format] || formatInstructions.concise}

Focus on capturing:
1. The main topic and thesis
2. Key medical concepts and terminology
3. Important research findings or clinical implications
4. Practical takeaways for health professionals

The summary should be clear, professional, and accurately represent the presentation content.

TRANSCRIPT:
${transcript}
`;
}