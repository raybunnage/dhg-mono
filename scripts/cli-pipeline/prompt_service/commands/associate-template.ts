/**
 * Command to associate a template with a prompt
 */
import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { promptService } from '../../../../packages/shared/services/prompt-service/prompt-service';
import { Logger } from '../../../../packages/shared/utils';

interface AssociateTemplateOptions {
  priority?: number;
  dryRun?: boolean;
}

export async function associateTemplateCommand(
  promptName: string,
  templateName: string,
  options: AssociateTemplateOptions
): Promise<void> {
  try {
    const priority = options.priority || 0;
    const dryRun = options.dryRun || false;
    
    // First, get all prompts and find by name
    const allPrompts = await promptManagementService.getDatabasePrompts();
    const prompt = allPrompts.find(p => p.name === promptName);
    if (!prompt) {
      console.error(`Prompt not found: ${promptName}`);
      process.exit(1);
    }
    
    // Find the template by name
    const templates = await promptManagementService.getPromptOutputTemplates();
    const template = templates.find(t => t.name === templateName);
    
    if (!template) {
      console.error(`Template not found: ${templateName}`);
      process.exit(1);
    }
    
    if (dryRun) {
      console.log('Dry run mode - no changes will be made to the database');
      console.log(`Would associate prompt: ${promptName} (${prompt.id})`);
      console.log(`With template: ${templateName} (${template.id})`);
      console.log(`Priority: ${priority}`);
      return;
    }
    
    // Associate the template with the prompt
    const result = await promptManagementService.associateTemplateWithPrompt(
      prompt.id,
      template.id,
      priority
    );
    
    if (result) {
      console.log(`✅ Successfully associated template "${templateName}" with prompt "${promptName}"`);
      console.log(`Association ID: ${result.id}`);
      console.log(`Priority: ${result.priority}`);
    } else {
      console.error('❌ Failed to associate template with prompt');
    }
  } catch (error) {
    console.error(`Error associating template with prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}