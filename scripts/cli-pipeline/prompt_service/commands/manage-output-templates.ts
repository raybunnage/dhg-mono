#!/usr/bin/env ts-node
/**
 * Command to manage prompt output templates and their associations with prompts
 */
import { Command } from 'commander';
import { promptService, promptOutputTemplateService } from '../../../../packages/shared/services/prompt-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('manage-output-templates')
  .description('Manage prompt output templates and their associations with prompts');

program
  .command('list-templates')
  .description('List all available prompt output templates')
  .option('-v, --verbose', 'Show verbose output including full template structure')
  .option('-j, --json', 'Output in JSON format')
  .option('--template-name <name>', 'Filter by template name')
  .action(async (options) => {
    try {
      // Get all templates
      const templates = await promptOutputTemplateService.getAllTemplates();
      
      // Filter by name if specified
      const filteredTemplates = options.templateName 
        ? templates.filter(t => t.name.includes(options.templateName))
        : templates;
      
      if (options.json) {
        console.log(JSON.stringify(filteredTemplates, null, 2));
        return;
      }
      
      console.log(`\n=== Prompt Output Templates (${filteredTemplates.length}) ===\n`);
      
      if (filteredTemplates.length === 0) {
        console.log('No templates found.');
        return;
      }
      
      for (const template of filteredTemplates) {
        console.log(`- Name: ${template.name}`);
        console.log(`  ID: ${template.id}`);
        if (template.description) {
          console.log(`  Description: ${template.description}`);
        }
        console.log(`  Created: ${new Date(template.created_at).toLocaleString()}`);
        
        // Print field count
        const fieldCount = Object.keys(template.template).length;
        console.log(`  Fields: ${fieldCount}`);
        
        if (options.verbose) {
          console.log('  Template structure:');
          console.log('  ------------------');
          for (const [fieldName, fieldDef] of Object.entries(template.template)) {
            console.log(`    ${fieldName} (${fieldDef.type}${fieldDef.required ? ', required' : ''}): ${fieldDef.description}`);
          }
        }
        
        console.log(); // Empty line between templates
      }
    } catch (error) {
      console.error(`Error listing templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('view-template')
  .description('View details of a specific template')
  .argument('<template-name-or-id>', 'Name or ID of the template to view')
  .option('--example', 'Generate and show an example output based on the template')
  .action(async (templateNameOrId, options) => {
    try {
      // Try to get by ID first
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      console.log(`\n=== Template: ${template.name} ===\n`);
      console.log(`ID: ${template.id}`);
      if (template.description) {
        console.log(`Description: ${template.description}`);
      }
      console.log(`Created: ${new Date(template.created_at).toLocaleString()}`);
      console.log(`Updated: ${new Date(template.updated_at).toLocaleString()}`);
      
      console.log('\nTemplate structure:');
      console.log('------------------');
      for (const [fieldName, fieldDef] of Object.entries(template.template)) {
        console.log(`  ${fieldName} (${fieldDef.type}${fieldDef.required ? ', required' : ''}): ${fieldDef.description}`);
      }
      
      if (options.example) {
        const example = promptOutputTemplateService.generateExampleFromTemplate(template.template);
        console.log('\nExample output:');
        console.log('---------------');
        console.log(JSON.stringify(example, null, 2));
      }
    } catch (error) {
      console.error(`Error viewing template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('create-template')
  .description('Create a new prompt output template')
  .argument('<name>', 'Name for the new template')
  .option('-d, --description <description>', 'Description for the template')
  .option('-f, --file <path>', 'Path to a JSON file with the template definition')
  .option('-i, --interactive', 'Enter template fields interactively')
  .action(async (name, options) => {
    try {
      // Check if template with this name already exists
      const existingTemplate = await promptOutputTemplateService.getTemplateByName(name);
      if (existingTemplate) {
        console.error(`A template with the name '${name}' already exists. Use update-template to modify it.`);
        process.exit(1);
      }
      
      let templateDefinition;
      
      if (options.file) {
        // Load from file
        try {
          const filePath = path.resolve(options.file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          templateDefinition = JSON.parse(fileContent);
        } catch (fileError) {
          console.error(`Error reading template file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
          process.exit(1);
        }
      } else if (options.interactive) {
        // Interactive mode
        templateDefinition = await interactiveCreateTemplate();
      } else {
        console.error('Either --file or --interactive option is required');
        process.exit(1);
      }
      
      // Create the template
      const template = await promptOutputTemplateService.createTemplate(
        name,
        templateDefinition,
        options.description
      );
      
      console.log(`\n✅ Template '${name}' created successfully with ID: ${template.id}`);
      
      // Print field count
      const fieldCount = Object.keys(template.template).length;
      console.log(`Fields: ${fieldCount}`);
      
      console.log('\nTo associate this template with a prompt, use:');
      console.log(`./manage-output-templates.ts associate-template <prompt-name-or-id> ${name}`);
    } catch (error) {
      console.error(`Error creating template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('update-template')
  .description('Update an existing prompt output template')
  .argument('<template-name-or-id>', 'Name or ID of the template to update')
  .option('-n, --name <name>', 'New name for the template')
  .option('-d, --description <description>', 'New description for the template')
  .option('-f, --file <path>', 'Path to a JSON file with the updated template definition')
  .option('-i, --interactive', 'Update template fields interactively')
  .action(async (templateNameOrId, options) => {
    try {
      // Get the template
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Prepare updates
      const updates: {
        name?: string;
        description?: string;
        template?: any;
      } = {};
      
      if (options.name) {
        updates.name = options.name;
      }
      
      if (options.description) {
        updates.description = options.description;
      }
      
      if (options.file) {
        // Load from file
        try {
          const filePath = path.resolve(options.file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          updates.template = JSON.parse(fileContent);
        } catch (fileError) {
          console.error(`Error reading template file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
          process.exit(1);
        }
      } else if (options.interactive) {
        // Interactive mode
        updates.template = await interactiveUpdateTemplate(template.template);
      }
      
      // If no updates specified, show error
      if (Object.keys(updates).length === 0) {
        console.error('No updates specified. Use --name, --description, --file, or --interactive options.');
        process.exit(1);
      }
      
      // Update the template
      const updatedTemplate = await promptOutputTemplateService.updateTemplate(
        template.id,
        updates
      );
      
      console.log(`\n✅ Template '${updatedTemplate.name}' updated successfully`);
      
      // Print field count if template was updated
      if (updates.template) {
        const fieldCount = Object.keys(updatedTemplate.template).length;
        console.log(`Updated fields: ${fieldCount}`);
      }
    } catch (error) {
      console.error(`Error updating template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('delete-template')
  .description('Delete a prompt output template')
  .argument('<template-name-or-id>', 'Name or ID of the template to delete')
  .option('--force', 'Force deletion without confirmation')
  .action(async (templateNameOrId, options) => {
    try {
      // Get the template
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Confirm deletion
      if (!options.force) {
        console.log(`\nYou are about to delete template '${template.name}' with ID: ${template.id}`);
        console.log('This action cannot be undone.');
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const confirm = await new Promise<boolean>(resolve => {
          readline.question('Are you sure? (y/n): ', (answer: string) => {
            readline.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
          });
        });
        
        if (!confirm) {
          console.log('Deletion cancelled.');
          process.exit(0);
        }
      }
      
      // Delete the template
      await promptOutputTemplateService.deleteTemplate(template.id);
      
      console.log(`\n✅ Template '${template.name}' deleted successfully`);
    } catch (error) {
      console.error(`Error deleting template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('list-associations')
  .description('List template associations for a prompt')
  .argument('<prompt-name-or-id>', 'Name or ID of the prompt')
  .option('-v, --verbose', 'Show verbose output including full template structure')
  .action(async (promptNameOrId, options) => {
    try {
      // Get the prompt
      let prompt;
      if (promptNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's an ID
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('id', promptNameOrId)
          .single();
          
        if (error) {
          console.error(`Error fetching prompt: ${error.message}`);
          process.exit(1);
        }
        
        prompt = data;
      } else {
        // It's a name
        prompt = await promptService.getPromptByName(promptNameOrId);
      }
      
      if (!prompt) {
        console.error(`Prompt '${promptNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Get associations
      const associations = await promptOutputTemplateService.getTemplatesForPrompt(prompt.id);
      
      console.log(`\n=== Template Associations for Prompt: ${prompt.name} ===\n`);
      
      if (associations.length === 0) {
        console.log('No template associations found.');
        console.log('\nTo associate a template with this prompt, use:');
        console.log(`./manage-output-templates.ts associate-template ${prompt.name} <template-name>`);
        return;
      }
      
      for (const [index, assoc] of associations.entries()) {
        console.log(`${index + 1}. Template: ${assoc.name}`);
        console.log(`   Priority: ${assoc.association.priority}`);
        
        if (assoc.description) {
          console.log(`   Description: ${assoc.description}`);
        }
        
        if (options.verbose) {
          console.log('   Fields:');
          for (const [fieldName, fieldDef] of Object.entries(assoc.template)) {
            console.log(`     - ${fieldName} (${fieldDef.type}${fieldDef.required ? ', required' : ''}): ${fieldDef.description}`);
          }
        } else {
          // Just show field count
          const fieldCount = Object.keys(assoc.template).length;
          console.log(`   Fields: ${fieldCount}`);
        }
        
        console.log(); // Empty line between associations
      }
      
      // Show the merged template instructions
      if (options.verbose) {
        console.log('=== Combined Template Instructions ===\n');
        const instructions = promptOutputTemplateService.generateTemplateInstructions(associations);
        console.log(instructions);
      }
    } catch (error) {
      console.error(`Error listing associations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('associate-template')
  .description('Associate a template with a prompt')
  .argument('<prompt-name-or-id>', 'Name or ID of the prompt')
  .argument('<template-name-or-id>', 'Name or ID of the template')
  .option('-p, --priority <number>', 'Priority of this template (lower numbers have higher priority)', '1')
  .action(async (promptNameOrId, templateNameOrId, options) => {
    try {
      // Get the prompt
      let prompt;
      if (promptNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's an ID
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('id', promptNameOrId)
          .single();
          
        if (error) {
          console.error(`Error fetching prompt: ${error.message}`);
          process.exit(1);
        }
        
        prompt = data;
      } else {
        // It's a name
        prompt = await promptService.getPromptByName(promptNameOrId);
      }
      
      if (!prompt) {
        console.error(`Prompt '${promptNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Get the template
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Create the association
      const priority = parseInt(options.priority, 10);
      const association = await promptOutputTemplateService.associateTemplateWithPrompt(
        prompt.id,
        template.id,
        priority
      );
      
      console.log(`\n✅ Template '${template.name}' associated with prompt '${prompt.name}' with priority ${priority}`);
    } catch (error) {
      console.error(`Error associating template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('dissociate-template')
  .description('Remove a template association from a prompt')
  .argument('<prompt-name-or-id>', 'Name or ID of the prompt')
  .argument('<template-name-or-id>', 'Name or ID of the template')
  .option('--force', 'Force dissociation without confirmation')
  .action(async (promptNameOrId, templateNameOrId, options) => {
    try {
      // Get the prompt
      let prompt;
      if (promptNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's an ID
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('id', promptNameOrId)
          .single();
          
        if (error) {
          console.error(`Error fetching prompt: ${error.message}`);
          process.exit(1);
        }
        
        prompt = data;
      } else {
        // It's a name
        prompt = await promptService.getPromptByName(promptNameOrId);
      }
      
      if (!prompt) {
        console.error(`Prompt '${promptNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Get the template
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Confirm dissociation
      if (!options.force) {
        console.log(`\nYou are about to remove the association between prompt '${prompt.name}' and template '${template.name}'`);
        console.log('This action cannot be undone.');
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const confirm = await new Promise<boolean>(resolve => {
          readline.question('Are you sure? (y/n): ', (answer: string) => {
            readline.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
          });
        });
        
        if (!confirm) {
          console.log('Dissociation cancelled.');
          process.exit(0);
        }
      }
      
      // Remove the association
      await promptOutputTemplateService.dissociateTemplateFromPrompt(prompt.id, template.id);
      
      console.log(`\n✅ Template '${template.name}' dissociated from prompt '${prompt.name}'`);
    } catch (error) {
      console.error(`Error dissociating template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('generate-schema')
  .description('Generate a JSON schema for a prompt output template')
  .argument('<template-name-or-id>', 'Name or ID of the template')
  .option('-o, --output <file>', 'Output file path (defaults to stdout)')
  .action(async (templateNameOrId, options) => {
    try {
      // Get the template
      let template;
      if (templateNameOrId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        template = await promptOutputTemplateService.getTemplateById(templateNameOrId);
      } else {
        template = await promptOutputTemplateService.getTemplateByName(templateNameOrId);
      }
      
      if (!template) {
        console.error(`Template '${templateNameOrId}' not found.`);
        process.exit(1);
      }
      
      // Convert template to JSON Schema
      const schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: template.name,
        description: template.description || `Schema for ${template.name}`,
        type: "object",
        properties: {},
        required: []
      };
      
      // Add properties and required fields
      for (const [fieldName, fieldDef] of Object.entries(template.template)) {
        // Add to properties
        const property: any = {
          type: fieldDef.type,
          description: fieldDef.description
        };
        
        // Add additional properties based on field type
        if (fieldDef.type === 'array' && fieldDef.items) {
          property.items = fieldDef.items;
        }
        
        if (fieldDef.type === 'object' && fieldDef.properties) {
          property.properties = fieldDef.properties;
        }
        
        schema.properties[fieldName] = property;
        
        // Add to required fields if necessary
        if (fieldDef.required) {
          schema.required.push(fieldName);
        }
      }
      
      // Output the schema
      const schemaJson = JSON.stringify(schema, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, schemaJson);
        console.log(`\n✅ Schema for template '${template.name}' written to ${options.output}`);
      } else {
        console.log(schemaJson);
      }
    } catch (error) {
      console.error(`Error generating schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Helper function for interactive template creation
async function interactiveCreateTemplate(): Promise<any> {
  const template: any = {};
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nInteractive template creation mode');
  console.log('--------------------------------');
  console.log('Enter field details (or press Ctrl+C to cancel)');
  
  let addingFields = true;
  
  while (addingFields) {
    const fieldName = await question(readline, 'Field name: ');
    
    if (!fieldName) {
      console.log('Field name cannot be empty. Please try again.');
      continue;
    }
    
    const description = await question(readline, 'Description: ');
    const typeOptions = ['string', 'number', 'boolean', 'array', 'object'];
    let type = '';
    
    while (!typeOptions.includes(type)) {
      type = await question(readline, `Type (${typeOptions.join('/')}): `);
      if (!typeOptions.includes(type)) {
        console.log('Invalid type. Please enter one of the supported types.');
      }
    }
    
    const requiredInput = await question(readline, 'Required? (y/n): ');
    const required = requiredInput.toLowerCase() === 'y' || requiredInput.toLowerCase() === 'yes';
    
    // Create field definition
    const fieldDef: any = {
      description,
      type,
      required
    };
    
    // Add items or properties based on type
    if (type === 'array') {
      const itemsType = await question(readline, 'Array items type (string/number/boolean/object): ');
      
      if (itemsType === 'object') {
        fieldDef.items = {
          type: 'object',
          properties: {}
        };
        
        // For now, to keep it simple, we'll just ask for object property names
        const propertiesInput = await question(readline, 'Object properties (comma-separated, e.g., name,weight): ');
        const properties = propertiesInput.split(',').map(p => p.trim()).filter(Boolean);
        
        properties.forEach(prop => {
          fieldDef.items.properties[prop] = {
            type: 'string',
            description: `${prop} property`
          };
        });
      } else {
        fieldDef.items = {
          type: itemsType || 'string'
        };
      }
    } else if (type === 'object') {
      // For now, to keep it simple, we'll just ask for object property names
      const propertiesInput = await question(readline, 'Object properties (comma-separated, e.g., name,weight): ');
      const properties = propertiesInput.split(',').map(p => p.trim()).filter(Boolean);
      
      fieldDef.properties = {};
      properties.forEach(prop => {
        fieldDef.properties[prop] = {
          type: 'string',
          description: `${prop} property`
        };
      });
    }
    
    // Add the field to the template
    template[fieldName] = fieldDef;
    
    // Ask if user wants to add another field
    const addAnother = await question(readline, 'Add another field? (y/n): ');
    addingFields = addAnother.toLowerCase() === 'y' || addAnother.toLowerCase() === 'yes';
  }
  
  readline.close();
  return template;
}

// Helper function for interactive template update
async function interactiveUpdateTemplate(existingTemplate: any): Promise<any> {
  const template = { ...existingTemplate };
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nInteractive template update mode');
  console.log('------------------------------');
  console.log('Current fields:');
  
  for (const [fieldName, fieldDef] of Object.entries(template)) {
    console.log(`- ${fieldName} (${(fieldDef as any).type}${(fieldDef as any).required ? ', required' : ''}): ${(fieldDef as any).description}`);
  }
  
  console.log('\nOptions:');
  console.log('1. Add a new field');
  console.log('2. Update an existing field');
  console.log('3. Remove a field');
  console.log('4. Done (save changes)');
  
  let option = '';
  while (option !== '4') {
    option = await question(readline, 'Select an option (1-4): ');
    
    if (option === '1') {
      // Add a new field
      console.log('\nAdding a new field:');
      const fieldName = await question(readline, 'Field name: ');
      
      if (!fieldName) {
        console.log('Field name cannot be empty. Please try again.');
        continue;
      }
      
      if (template[fieldName]) {
        console.log(`Field '${fieldName}' already exists. Please use option 2 to update it.`);
        continue;
      }
      
      const description = await question(readline, 'Description: ');
      const typeOptions = ['string', 'number', 'boolean', 'array', 'object'];
      let type = '';
      
      while (!typeOptions.includes(type)) {
        type = await question(readline, `Type (${typeOptions.join('/')}): `);
        if (!typeOptions.includes(type)) {
          console.log('Invalid type. Please enter one of the supported types.');
        }
      }
      
      const requiredInput = await question(readline, 'Required? (y/n): ');
      const required = requiredInput.toLowerCase() === 'y' || requiredInput.toLowerCase() === 'yes';
      
      // Create field definition
      const fieldDef: any = {
        description,
        type,
        required
      };
      
      // Add items or properties based on type
      if (type === 'array') {
        const itemsType = await question(readline, 'Array items type (string/number/boolean/object): ');
        
        if (itemsType === 'object') {
          fieldDef.items = {
            type: 'object',
            properties: {}
          };
          
          // For now, to keep it simple, we'll just ask for object property names
          const propertiesInput = await question(readline, 'Object properties (comma-separated, e.g., name,weight): ');
          const properties = propertiesInput.split(',').map(p => p.trim()).filter(Boolean);
          
          properties.forEach(prop => {
            fieldDef.items.properties[prop] = {
              type: 'string',
              description: `${prop} property`
            };
          });
        } else {
          fieldDef.items = {
            type: itemsType || 'string'
          };
        }
      } else if (type === 'object') {
        // For now, to keep it simple, we'll just ask for object property names
        const propertiesInput = await question(readline, 'Object properties (comma-separated, e.g., name,weight): ');
        const properties = propertiesInput.split(',').map(p => p.trim()).filter(Boolean);
        
        fieldDef.properties = {};
        properties.forEach(prop => {
          fieldDef.properties[prop] = {
            type: 'string',
            description: `${prop} property`
          };
        });
      }
      
      // Add the field to the template
      template[fieldName] = fieldDef;
      console.log(`Field '${fieldName}' added.`);
    } else if (option === '2') {
      // Update an existing field
      console.log('\nUpdating an existing field:');
      console.log('Current fields:');
      
      const fieldNames = Object.keys(template);
      for (let i = 0; i < fieldNames.length; i++) {
        console.log(`${i+1}. ${fieldNames[i]}`);
      }
      
      const fieldIndexInput = await question(readline, `Select a field (1-${fieldNames.length}): `);
      const fieldIndex = parseInt(fieldIndexInput, 10) - 1;
      
      if (isNaN(fieldIndex) || fieldIndex < 0 || fieldIndex >= fieldNames.length) {
        console.log('Invalid field selection. Please try again.');
        continue;
      }
      
      const fieldName = fieldNames[fieldIndex];
      const fieldDef = template[fieldName] as any;
      
      console.log(`\nUpdating field: ${fieldName}`);
      console.log(`Current description: ${fieldDef.description}`);
      console.log(`Current type: ${fieldDef.type}`);
      console.log(`Current required: ${fieldDef.required ? 'yes' : 'no'}`);
      
      // Allow updating description
      const newDescription = await question(readline, 'New description (press Enter to keep current): ');
      if (newDescription) {
        fieldDef.description = newDescription;
      }
      
      // Allow updating required status
      const newRequiredInput = await question(readline, `New required status (y/n, press Enter to keep ${fieldDef.required ? 'yes' : 'no'}): `);
      if (newRequiredInput) {
        fieldDef.required = newRequiredInput.toLowerCase() === 'y' || newRequiredInput.toLowerCase() === 'yes';
      }
      
      // Type changes are more complex - we'll leave that for a more comprehensive tool
      console.log(`Field '${fieldName}' updated.`);
    } else if (option === '3') {
      // Remove a field
      console.log('\nRemoving a field:');
      console.log('Current fields:');
      
      const fieldNames = Object.keys(template);
      for (let i = 0; i < fieldNames.length; i++) {
        console.log(`${i+1}. ${fieldNames[i]}`);
      }
      
      const fieldIndexInput = await question(readline, `Select a field to remove (1-${fieldNames.length}): `);
      const fieldIndex = parseInt(fieldIndexInput, 10) - 1;
      
      if (isNaN(fieldIndex) || fieldIndex < 0 || fieldIndex >= fieldNames.length) {
        console.log('Invalid field selection. Please try again.');
        continue;
      }
      
      const fieldName = fieldNames[fieldIndex];
      
      // Confirm deletion
      const confirmDelete = await question(readline, `Are you sure you want to remove field '${fieldName}'? (y/n): `);
      if (confirmDelete.toLowerCase() === 'y' || confirmDelete.toLowerCase() === 'yes') {
        delete template[fieldName];
        console.log(`Field '${fieldName}' removed.`);
      } else {
        console.log('Field removal cancelled.');
      }
    } else if (option === '4') {
      // Done
      console.log('Saving template changes...');
    } else {
      console.log('Invalid option. Please enter a number from 1 to 4.');
    }
  }
  
  readline.close();
  return template;
}

// Helper function for async readline question
function question(readline: any, query: string): Promise<string> {
  return new Promise(resolve => {
    readline.question(query, (answer: string) => {
      resolve(answer);
    });
  });
}

// Execute the program if run directly
if (require.main === module) {
  program.parse();
}

export default program;