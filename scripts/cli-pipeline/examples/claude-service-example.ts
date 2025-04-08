#!/usr/bin/env node

/**
 * Example script demonstrating the consolidated Claude service
 * 
 * Run with:
 * ts-node scripts/cli-pipeline/examples/claude-service-example.ts
 */

import { Command } from 'commander';
import { claudeService } from '../../../packages/shared/services/claude-service';
import { Logger } from '../../../packages/shared/utils';

// Set up command line program
const program = new Command();

program
  .name('claude-service-example')
  .description('Example usage of the consolidated Claude service')
  .version('1.0.0');

program
  .command('text')
  .description('Generate text with Claude')
  .option('-p, --prompt <prompt>', 'Prompt to send to Claude', 'Explain quantum computing in simple terms.')
  .option('-m, --model <model>', 'Model to use', 'claude-3-7-sonnet-20250219')
  .option('-t, --temperature <temperature>', 'Temperature to use', '0.7')
  .action(async (options) => {
    try {
      Logger.info(`Sending text prompt to Claude: "${options.prompt}"`);
      
      const response = await claudeService.sendPrompt(
        options.prompt,
        {
          model: options.model,
          temperature: parseFloat(options.temperature)
        }
      );
      
      console.log('\nResponse from Claude:');
      console.log('-------------------');
      console.log(response);
      console.log('-------------------');
    } catch (error) {
      Logger.error(`Error: ${error}`);
    }
  });

program
  .command('json')
  .description('Get JSON response from Claude')
  .option('-p, --prompt <prompt>', 'Prompt to send to Claude', 'List 3 programming languages with their key features.')
  .option('-m, --model <model>', 'Model to use', 'claude-3-7-sonnet-20250219')
  .option('-t, --temperature <temperature>', 'Temperature to use', '0.2')
  .action(async (options) => {
    try {
      Logger.info(`Sending JSON prompt to Claude: "${options.prompt}"`);
      
      const response = await claudeService.getJsonResponse(
        options.prompt,
        {
          model: options.model,
          temperature: parseFloat(options.temperature),
          jsonMode: true
        }
      );
      
      console.log('\nJSON Response from Claude:');
      console.log('------------------------');
      console.log(JSON.stringify(response, null, 2));
      console.log('------------------------');
    } catch (error) {
      Logger.error(`Error: ${error}`);
    }
  });

program
  .command('classify')
  .description('Classify text with Claude')
  .option('-t, --text <text>', 'Text to classify', 'This product is amazing and exceeded all my expectations.')
  .option('-p, --prompt <prompt>', 'Classification prompt', 'Analyze the sentiment of the text. Return a JSON object with sentiment (positive, negative, neutral), confidence (0-1), and brief rationale.')
  .option('-m, --model <model>', 'Model to use', 'claude-3-7-sonnet-20250219')
  .action(async (options) => {
    try {
      Logger.info(`Classifying text with Claude: "${options.text}"`);
      
      const response = await claudeService.classifyText(
        options.text,
        options.prompt,
        {
          model: options.model,
          temperature: 0.1
        }
      );
      
      console.log('\nClassification Result:');
      console.log('---------------------');
      console.log(JSON.stringify(response, null, 2));
      console.log('---------------------');
    } catch (error) {
      Logger.error(`Error: ${error}`);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}