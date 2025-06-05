/**
 * Command to list all prompt output templates
 */
import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { Logger } from '../../../../packages/shared/utils';

interface ListTemplatesOptions {
  format?: 'table' | 'json';
}

export async function listTemplatesCommand(options: ListTemplatesOptions): Promise<void> {
  try {
    const format = options.format || 'table';
    
    // Get all templates
    const templates = await promptManagementService.getPromptOutputTemplates();
    
    if (templates.length === 0) {
      console.log('No templates found');
      return;
    }
    
    if (format === 'json') {
      console.log(JSON.stringify(templates, null, 2));
      return;
    }
    
    // Display in table format
    console.log(`Found ${templates.length} templates:`);
    console.log('------------------------------------------------------------');
    console.log('ID                                   | Name                 | Description');
    console.log('------------------------------------------------------------');
    
    templates.forEach(template => {
      const id = template.id.substring(0, 36).padEnd(36);
      const name = (template.name || '').substring(0, 20).padEnd(20);
      const description = (template.description || '').substring(0, 40);
      console.log(`${id} | ${name} | ${description}`);
    });
    
    console.log('------------------------------------------------------------');
  } catch (error) {
    console.error(`Error listing templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}