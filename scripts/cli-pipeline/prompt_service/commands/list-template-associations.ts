/**
 * Command to list template associations for a prompt
 */
import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../../packages/shared/utils';

interface ListTemplateAssociationsOptions {
  format?: 'table' | 'json';
}

export async function listTemplateAssociationsCommand(
  promptName: string,
  options: ListTemplateAssociationsOptions
): Promise<void> {
  try {
    const format = options.format || 'table';
    
    // First, find the prompt
    const prompt = await promptManagementService.getPromptByName(promptName);
    if (!prompt) {
      console.error(`Prompt not found: ${promptName}`);
      process.exit(1);
    }
    
    // Get template associations
    const { associations, templates } = await promptManagementService.getPromptTemplateAssociations(prompt.id);
    
    if (associations.length === 0) {
      console.log(`No template associations found for prompt "${promptName}"`);
      return;
    }
    
    if (format === 'json') {
      console.log(JSON.stringify({ associations, templates }, null, 2));
      return;
    }
    
    // Display in table format
    console.log(`Found ${associations.length} template associations for prompt "${promptName}":`);
    console.log('------------------------------------------------------------');
    console.log('Priority | Template ID                           | Template Name');
    console.log('------------------------------------------------------------');
    
    // Sort by priority
    const sortedAssociations = [...associations].sort((a, b) => a.priority - b.priority);
    
    sortedAssociations.forEach(association => {
      const template = templates.find(t => t.id === association.template_id);
      if (!template) return;
      
      const priority = association.priority.toString().padEnd(8);
      const id = template.id.substring(0, 36).padEnd(36);
      const name = template.name || '(unnamed)';
      console.log(`${priority} | ${id} | ${name}`);
    });
    
    console.log('------------------------------------------------------------');
  } catch (error) {
    console.error(`Error listing template associations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}