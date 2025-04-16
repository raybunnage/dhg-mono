/**
 * Prompt CLI Interface
 * 
 * Provides a simple command-line interface for interacting with the prompt management service.
 * This can be used in CLI scripts that need to work with prompts.
 */
import { PromptManagementService, DatabasePrompt, PromptCategory, DocumentType, DocumentationFile, RelationshipSettings } from './prompt-management-service';
import { Logger } from '../../utils';

/**
 * CLI Interface for Prompt Management
 */
export class PromptCliInterface {
  private promptManagementService: PromptManagementService;
  
  constructor() {
    this.promptManagementService = PromptManagementService.getInstance();
  }
  
  /**
   * List all available prompts from database
   */
  public async listPrompts(): Promise<void> {
    try {
      const prompts = await this.promptManagementService.getDatabasePrompts();
      
      if (prompts.length === 0) {
        console.log('No prompts found in database.');
        return;
      }
      
      console.log(`Found ${prompts.length} prompts in database:`);
      prompts.forEach((prompt, index) => {
        const category = prompt.category_id ? ' (Category: Unknown)' : '';
        const docType = prompt.document_type_id ? ' (DocType: Unknown)' : '';
        const status = prompt.status ? ` [${prompt.status}]` : '';
        
        console.log(`${index + 1}. ${prompt.name}${status}${category}${docType}`);
      });
    } catch (error) {
      Logger.error(`Error listing prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * List prompt categories
   */
  public async listCategories(): Promise<void> {
    try {
      const categories = await this.promptManagementService.getPromptCategories();
      
      if (categories.length === 0) {
        console.log('No prompt categories found in database.');
        return;
      }
      
      console.log(`Found ${categories.length} prompt categories:`);
      categories.forEach((category, index) => {
        const parent = category.parent_category_id ? ' (Parent: Unknown)' : '';
        console.log(`${index + 1}. ${category.name}${parent} - ${category.description || 'No description'}`);
      });
    } catch (error) {
      Logger.error(`Error listing categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * List document types
   */
  public async listDocumentTypes(category?: string): Promise<void> {
    try {
      const documentTypes = await this.promptManagementService.getDocumentTypes(category);
      
      if (documentTypes.length === 0) {
        console.log('No document types found in database.');
        return;
      }
      
      console.log(`Found ${documentTypes.length} document types${category ? ` in category '${category}'` : ''}:`);
      
      // Group by category
      const groupedTypes: Record<string, DocumentType[]> = {};
      documentTypes.forEach(docType => {
        if (!groupedTypes[docType.category]) {
          groupedTypes[docType.category] = [];
        }
        groupedTypes[docType.category].push(docType);
      });
      
      // Display by category
      Object.entries(groupedTypes).forEach(([category, types]) => {
        console.log(`\nCategory: ${category} (${types.length} types)`);
        types.forEach((docType, index) => {
          console.log(`  ${index + 1}. ${docType.document_type} - ${docType.description || 'No description'}`);
        });
      });
    } catch (error) {
      Logger.error(`Error listing document types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * View a prompt's details
   */
  public async viewPrompt(promptIdOrName: string): Promise<void> {
    try {
      // Try to get by ID first
      let prompt: DatabasePrompt | null = null;
      
      // Check if the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(promptIdOrName)) {
        prompt = await this.promptManagementService.getPromptById(promptIdOrName);
      }
      
      // If not found by ID, try to find by name
      if (!prompt) {
        const prompts = await this.promptManagementService.getDatabasePrompts();
        prompt = prompts.find(p => p.name === promptIdOrName) || null;
      }
      
      // If still not found, show error
      if (!prompt) {
        console.log(`Prompt with ID/name '${promptIdOrName}' not found.`);
        return;
      }
      
      // Display prompt information
      console.log(`\nPrompt: ${prompt.name}`);
      console.log(`ID: ${prompt.id}`);
      console.log(`Description: ${prompt.description || 'N/A'}`);
      console.log(`Status: ${prompt.status}`);
      console.log(`Version: ${prompt.version}`);
      console.log(`Author: ${prompt.author || 'N/A'}`);
      
      if (prompt.tags && prompt.tags.length > 0) {
        console.log(`Tags: ${prompt.tags.join(', ')}`);
      }
      
      console.log(`File Path: ${prompt.file_path || 'N/A'}`);
      console.log(`Created: ${new Date(prompt.created_at).toLocaleString()}`);
      console.log(`Updated: ${new Date(prompt.updated_at).toLocaleString()}`);
      
      // Show metadata information
      if (prompt.metadata) {
        console.log('\nMetadata:');
        
        if (prompt.metadata.aiEngine) {
          console.log(`  Model: ${prompt.metadata.aiEngine.model || 'N/A'}`);
          console.log(`  Temperature: ${prompt.metadata.aiEngine.temperature || 'N/A'}`);
          console.log(`  Max Tokens: ${prompt.metadata.aiEngine.maxTokens || 'N/A'}`);
        }
        
        if (prompt.metadata.databaseQuery) {
          console.log('\nDatabase Query:');
          console.log(`  ${prompt.metadata.databaseQuery}`);
        }
        
        if (prompt.metadata.databaseQuery2) {
          console.log('\nSecondary Database Query:');
          console.log(`  ${prompt.metadata.databaseQuery2}`);
        }
        
        // Show related assets count
        const relatedAssets = prompt.metadata.relatedAssets || [];
        console.log(`\nRelated Assets: ${relatedAssets.length}`);
        
        // Show package.json files count
        const packageJsonFiles = prompt.metadata.packageJsonFiles || [];
        if (packageJsonFiles.length > 0) {
          console.log(`Package.json Files: ${packageJsonFiles.length}`);
        }
      }
      
      // Get prompt relationships
      const { relationships, relatedFiles, relatedPackageJsonFiles } = 
        await this.promptManagementService.getPromptRelationshipsWithFiles(prompt.id);
      
      if (relationships.length > 0 || relatedPackageJsonFiles.length > 0) {
        console.log('\nRelationships:');
        
        // Show database relationships
        if (relationships.length > 0) {
          console.log(`\n  Database Files (${relationships.length}):`);
          relationships.forEach((rel, index) => {
            const file = relatedFiles.find(f => f.id === rel.asset_id);
            const fileName = file ? path.basename(file.file_path) : 'Unknown file';
            
            console.log(`  ${index + 1}. ${fileName} (${rel.relationship_type})`);
            if (rel.relationship_context) {
              console.log(`     Context: ${rel.relationship_context}`);
            }
            if (rel.document_type_id) {
              console.log(`     Document Type: ${rel.document_type_id}`);
            }
          });
        }
        
        // Show package.json relationships
        if (relatedPackageJsonFiles.length > 0) {
          console.log(`\n  Package.json Files (${relatedPackageJsonFiles.length}):`);
          relatedPackageJsonFiles.forEach((pkg, index) => {
            console.log(`  ${index + 1}. ${path.basename(pkg.path)} (${pkg.relationship_type})`);
            if (pkg.context) {
              console.log(`     Context: ${pkg.context}`);
            }
            if (pkg.document_type_id) {
              console.log(`     Document Type: ${pkg.document_type_id}`);
            }
          });
        }
      }
      
      // Display content preview (first 10 lines)
      console.log('\nContent Preview:');
      const contentLines = prompt.content.toString().split('\n');
      const previewLines = contentLines.slice(0, Math.min(10, contentLines.length));
      previewLines.forEach(line => console.log(`  ${line}`));
      
      if (contentLines.length > 10) {
        console.log(`  ... and ${contentLines.length - 10} more lines`);
      }
    } catch (error) {
      Logger.error(`Error viewing prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create a new prompt from a file
   */
  public async createPromptFromFile(
    filePath: string,
    options: {
      documentTypeId?: string;
      categoryId?: string;
    } = {}
  ): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`File '${filePath}' not found.`);
        return;
      }
      
      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      
      // Import the prompt
      const prompt = await this.promptManagementService.importPromptFromMarkdown(
        fileContent,
        fileName,
        options
      );
      
      if (prompt) {
        console.log(`Successfully created prompt '${prompt.name}' with ID: ${prompt.id}`);
      } else {
        console.log('Failed to create prompt from file.');
      }
    } catch (error) {
      Logger.error(`Error creating prompt from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Export a prompt to a file
   */
  public async exportPromptToFile(promptIdOrName: string, outputPath?: string): Promise<void> {
    try {
      // Try to get by ID first
      let promptId = promptIdOrName;
      
      // Check if the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(promptIdOrName)) {
        // Try to find by name
        const prompts = await this.promptManagementService.getDatabasePrompts();
        const prompt = prompts.find(p => p.name === promptIdOrName);
        
        if (!prompt) {
          console.log(`Prompt with name '${promptIdOrName}' not found.`);
          return;
        }
        
        promptId = prompt.id;
      }
      
      // Save the prompt to a file
      const filePath = await this.promptManagementService.savePromptToFile(promptId, outputPath);
      
      if (filePath) {
        console.log(`Successfully exported prompt to: ${filePath}`);
      } else {
        console.log('Failed to export prompt to file.');
      }
    } catch (error) {
      Logger.error(`Error exporting prompt to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update a prompt's content from a file
   */
  public async updatePromptFromFile(
    promptIdOrName: string,
    filePath: string
  ): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`File '${filePath}' not found.`);
        return;
      }
      
      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Try to get by ID first
      let promptId = promptIdOrName;
      
      // Check if the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(promptIdOrName)) {
        // Try to find by name
        const prompts = await this.promptManagementService.getDatabasePrompts();
        const prompt = prompts.find(p => p.name === promptIdOrName);
        
        if (!prompt) {
          console.log(`Prompt with name '${promptIdOrName}' not found.`);
          return;
        }
        
        promptId = prompt.id;
      }
      
      // Parse the markdown frontmatter
      const { metadata, content } = this.promptManagementService.parseMarkdownFrontmatter(fileContent);
      
      // Prepare updates
      const updates: any = {
        content
      };
      
      // Add metadata fields if available
      if (metadata.description) updates.description = metadata.description;
      if (metadata.version) updates.version = metadata.version;
      if (metadata.status) updates.status = metadata.status;
      if (metadata.author) updates.author = metadata.author;
      if (metadata.tags) updates.tags = metadata.tags;
      
      // Update the prompt
      const updatedPrompt = await this.promptManagementService.updatePrompt(promptId, updates);
      
      if (updatedPrompt) {
        console.log(`Successfully updated prompt '${updatedPrompt.name}'`);
      } else {
        console.log('Failed to update prompt.');
      }
    } catch (error) {
      Logger.error(`Error updating prompt from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Delete a prompt
   */
  public async deletePrompt(promptIdOrName: string): Promise<void> {
    try {
      // Try to get by ID first
      let promptId = promptIdOrName;
      let promptName = promptIdOrName;
      
      // Check if the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(promptIdOrName)) {
        // Try to find by name
        const prompts = await this.promptManagementService.getDatabasePrompts();
        const prompt = prompts.find(p => p.name === promptIdOrName);
        
        if (!prompt) {
          console.log(`Prompt with name '${promptIdOrName}' not found.`);
          return;
        }
        
        promptId = prompt.id;
        promptName = prompt.name;
      } else {
        // Get the prompt to display its name
        const prompt = await this.promptManagementService.getPromptById(promptId);
        if (prompt) {
          promptName = prompt.name;
        }
      }
      
      // Confirm deletion
      console.log(`Are you sure you want to delete prompt '${promptName}'? (y/n)`);
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('> ', async (answer: string) => {
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          // Delete the prompt
          const success = await this.promptManagementService.deletePrompt(promptId);
          
          if (success) {
            console.log(`Successfully deleted prompt '${promptName}'`);
          } else {
            console.log('Failed to delete prompt.');
          }
        } else {
          console.log('Deletion cancelled.');
        }
      });
    } catch (error) {
      Logger.error(`Error deleting prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * List relationships for a prompt
   */
  public async listRelationships(promptIdOrName: string): Promise<void> {
    try {
      // Try to get by ID first
      let promptId = promptIdOrName;
      
      // Check if the input looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(promptIdOrName)) {
        // Try to find by name
        const prompts = await this.promptManagementService.getDatabasePrompts();
        const prompt = prompts.find(p => p.name === promptIdOrName);
        
        if (!prompt) {
          console.log(`Prompt with name '${promptIdOrName}' not found.`);
          return;
        }
        
        promptId = prompt.id;
      }
      
      // Get relationships
      const { relationships, relatedFiles, relatedPackageJsonFiles } = 
        await this.promptManagementService.getPromptRelationshipsWithFiles(promptId);
      
      // Get the prompt for context
      const prompt = await this.promptManagementService.getPromptById(promptId);
      if (!prompt) {
        console.log(`Prompt with ID '${promptId}' not found.`);
        return;
      }
      
      console.log(`\nRelationships for prompt: ${prompt.name} (ID: ${prompt.id})`);
      
      if (relationships.length === 0 && relatedPackageJsonFiles.length === 0) {
        console.log('No relationships found for this prompt.');
        return;
      }
      
      // Show database relationships
      if (relationships.length > 0) {
        console.log(`\nDatabase Files (${relationships.length}):`);
        relationships.forEach((rel, index) => {
          const file = relatedFiles.find(f => f.id === rel.asset_id);
          const fileName = file ? path.basename(file.file_path) : 'Unknown file';
          
          console.log(`  ${index + 1}. ${fileName} (${rel.relationship_type})`);
          console.log(`     ID: ${rel.asset_id}`);
          console.log(`     Path: ${rel.asset_path}`);
          
          if (rel.relationship_context) {
            console.log(`     Context: ${rel.relationship_context}`);
          }
          
          if (rel.document_type_id) {
            console.log(`     Document Type: ${rel.document_type_id}`);
          }
          
          if ('description' in rel && rel.description) {
            console.log(`     Description: ${rel.description}`);
          }
          
          console.log(''); // Add blank line between items
        });
      }
      
      // Show package.json relationships
      if (relatedPackageJsonFiles.length > 0) {
        console.log(`\nPackage.json Files (${relatedPackageJsonFiles.length}):`);
        relatedPackageJsonFiles.forEach((pkg, index) => {
          console.log(`  ${index + 1}. ${path.basename(pkg.path)} (${pkg.relationship_type})`);
          console.log(`     ID: ${pkg.id}`);
          console.log(`     Path: ${pkg.path}`);
          
          if (pkg.context) {
            console.log(`     Context: ${pkg.context}`);
          }
          
          if (pkg.document_type_id) {
            console.log(`     Document Type: ${pkg.document_type_id}`);
          }
          
          if (pkg.description) {
            console.log(`     Description: ${pkg.description}`);
          }
          
          console.log(''); // Add blank line between items
        });
      }
      
      // Show database queries if available
      if (prompt.metadata.databaseQuery) {
        console.log('\nDatabase Query:');
        console.log(prompt.metadata.databaseQuery);
      }
      
      if (prompt.metadata.databaseQuery2) {
        console.log('\nSecondary Database Query:');
        console.log(prompt.metadata.databaseQuery2);
      }
    } catch (error) {
      Logger.error(`Error listing relationships: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const promptCliInterface = new PromptCliInterface();

// Helper imports for file paths
import * as path from 'path';