/**
 * Command to create a new prompt output template
 */
import * as fs from 'fs';
import * as path from 'path';
import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../../packages/shared/utils';

interface CreateTemplateOptions {
  description?: string;
  dryRun?: boolean;
}

export async function createTemplateCommand(
  n: string,
  templatePath: string,
  options: CreateTemplateOptions
): Promise<void> {
  // Use name from parameter n
  const name = n;
  try {
    const description = options.description;
    const dryRun = options.dryRun || false;

    // Validate template file exists
    if (!fs.existsSync(templatePath)) {
      console.error(`Template file not found: ${templatePath}`);
      process.exit(1);
    }

    // Read and parse template file
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    let template: any;

    try {
      template = JSON.parse(templateContent);
    } catch (error) {
      console.error(`Error parsing template JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }

    if (dryRun) {
      console.log('Dry run mode - no changes will be made to the database');
      console.log(`Would create template: ${name}`);
      console.log(`With description: ${description || '(none)'}`);
      console.log('Template structure:');
      console.log(JSON.stringify(template, null, 2));
      return;
    }

    // Create the template
    const result = await promptManagementService.createPromptOutputTemplate(
      name,
      template,
      description
    );

    if (result) {
      console.log(`✅ Successfully created template: ${result.name}`);
      console.log(`Template ID: ${result.id}`);
    } else {
      console.error('❌ Failed to create template');
    }
  } catch (error) {
    console.error(`Error creating template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}