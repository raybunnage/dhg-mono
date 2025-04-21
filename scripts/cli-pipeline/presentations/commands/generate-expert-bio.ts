import { Command } from 'commander';
import { PresentationService } from '../services/presentation-service';
import { claudeService } from '../../../../packages/shared/services/claude-service';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// const logger = new Logger('generate-expert-bio-command');

// Create a new command
export const generateExpertBioCommand = new Command('generate-expert-bio');

// Set command description and options
generateExpertBioCommand
  .description('Generate AI expert bio/profile from presentation content')
  .requiredOption('-e, --expert-id <id>', 'Expert ID to generate bio for')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to source content from')
  .option('-f, --force', 'Force regeneration of bio even if it already exists', false)
  .option('--dry-run', 'Show what would be generated without saving', false)
  .option('--style <style>', 'Bio style (professional, narrative, academic)', 'professional')
  .action(async (options: any) => {
    try {
      Logger.info(`Generating expert bio for expert ID: ${options.expertId}`);
      
      const presentationService = PresentationService.getInstance();
      
      // Get expert details
      const expert = await presentationService.getExpertDetails(options.expertId);
      
      if (!expert) {
        Logger.error('Expert not found');
        process.exit(1);
      }
      
      Logger.info(`Found expert: ${expert.name}`);
      
      // Get content to use for bio generation
      const sourceContent = await presentationService.getExpertSourceContent(
        options.expertId,
        options.presentationId
      );
      
      if (!sourceContent || !sourceContent.transcript) {
        Logger.error('Could not find sufficient source content for the expert');
        process.exit(1);
      }
      
      // Check if bio already exists
      const existingBio = await presentationService.getExistingExpertBio(options.expertId);
      
      if (existingBio && !options.force) {
        Logger.warn('Expert bio already exists. Use --force to regenerate.');
        Logger.info('Existing bio:');
        console.log(chalk.yellow(existingBio.processed_content.substring(0, 200) + '...'));
        return;
      }
      
      // Generate bio prompt based on style
      const prompt = generateBioPrompt(
        expert.name,
        sourceContent.transcript,
        options.style
      );
      
      Logger.info('Generating expert bio using Claude...');
      
      // Call Claude API to generate bio
      const bio = await claudeService.sendPrompt(prompt);
      
      if (options.dryRun) {
        Logger.info('Dry run - expert bio would be:');
        console.log(chalk.green(bio));
        return;
      }
      
      // Save the bio
      await presentationService.saveExpertBio({
        expertId: options.expertId,
        bio,
        existingBioId: existingBio?.id
      });
      
      Logger.info(chalk.green('Expert bio generated and saved successfully'));
      Logger.info('Preview:');
      console.log(chalk.green(bio.substring(0, 200) + '...'));
      
    } catch (error) {
      Logger.error('Error generating expert bio:', error);
      process.exit(1);
    }
  });

function generateBioPrompt(expertName: string, transcript: string, style: string): string {
  const styleInstructions: Record<string, string> = {
    professional: 'Create a professional 1-2 paragraph bio that highlights expertise, background, and key contributions.',
    narrative: 'Create a narrative-style bio (2-3 paragraphs) that tells the story of the expert\'s journey and impact in their field.',
    academic: 'Create a formal academic bio (1-2 paragraphs) with a focus on research interests, affiliations, and academic credentials.'
  };
  
  return `
You are an expert medical content writer specializing in professional biographies. Your task is to create a bio for ${expertName} based on the transcript of their presentation.

${styleInstructions[style] || styleInstructions.professional}

Extract and infer the following information from the transcript:
1. Their expertise and specialization areas
2. Their professional background and experience
3. Key research interests or clinical focus areas
4. Any affiliations or institutions mentioned
5. Their approach to their field or philosophy

Present the information in a polished, third-person professional biography format that would be appropriate for a medical conference, website, or publication.

IMPORTANT: If certain information is not available in the transcript, use only what is available rather than inventing details. Focus on what can be accurately inferred from their presentation.

TRANSCRIPT EXCERPT:
${transcript.substring(0, 4000)} 
[Transcript continues...]
`;
}