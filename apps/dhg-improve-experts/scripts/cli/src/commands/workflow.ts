import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/error-handler';
import config from '../utils/config';
import { FileService, SupabaseService, ClaudeService } from '../services';

/**
 * Find the project root directory by looking for typical markers
 */
function findProjectRoot(startPath: string): string {
  // Start with the current directory
  let currentPath = startPath;
  
  // Check for the absolute path of the monorepo first (fastest check)
  if (fs.existsSync('/Users/raybunnage/Documents/github/dhg-mono')) {
    return '/Users/raybunnage/Documents/github/dhg-mono';
  }
  
  // Try to find monorepo root by looking for package.json with workspace config or pnpm-workspace.yaml
  while (currentPath !== path.parse(currentPath).root) {
    // Check for monorepo root indicators
    const hasPnpmWorkspace = fs.existsSync(path.join(currentPath, 'pnpm-workspace.yaml'));
    
    // If package.json exists, check if it has workspaces defined
    const packageJsonPath = path.join(currentPath, 'package.json');
    let hasWorkspaces = false;
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        hasWorkspaces = !!packageJson.workspaces;
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Check if the apps directory exists
    const hasAppsDir = fs.existsSync(path.join(currentPath, 'apps'));
    
    // If any of the monorepo indicators are found, this is likely the root
    if (hasPnpmWorkspace || hasWorkspaces || hasAppsDir) {
      return currentPath;
    }
    
    // Move up one directory
    const parentPath = path.dirname(currentPath);
    
    // If we've reached the root and can't go further, stop
    if (parentPath === currentPath) {
      break;
    }
    
    currentPath = parentPath;
  }
  
  // If we couldn't find a root marker, return the current directory as fallback
  Logger.warn(`Couldn't determine project root from ${startPath}, using current directory`);
  return process.cwd();
}

interface WorkflowOptions {
  verbose: boolean;
  execute?: boolean;
}

/**
 * Execute the markdown classification workflow with actual credentials
 */
export const workflow = async (filePath: string, options: WorkflowOptions) => {
  // Configure logger based on options
  Logger.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  
  try {
    Logger.info(`Starting workflow for ${filePath}`);
    
    // 1. Initialize services
    const fileService = new FileService();
    
    // Log config info (but hide sensitive parts)
    Logger.debug('Configuration loaded', {
      supabaseUrl: config.supabaseUrl,
      envDetected: !!config.supabaseKey && !!config.anthropicApiKey
    });
    
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    
    // 2. Read target file
    Logger.info('Step 1: Reading target file');
    const fileResult = fileService.readFile(filePath);
    if (!fileResult.success) {
      throw new AppError(`Failed to read file: ${fileResult.error}`, 'FILE_ERROR');
    }
    
    Logger.info('File read successfully', {
      path: fileResult.path,
      size: fileResult.stats?.size
    });
    
    console.log('\nTarget File:');
    console.log(`- Path: ${fileResult.path}`);
    console.log(`- Size: ${fileResult.stats?.size} bytes`);
    console.log(`- Modified: ${fileResult.stats?.modified?.toLocaleString()}`);
    console.log(`- Preview of content: ${fileResult.content?.substring(0, 100)}...`);
    
    // 3. Get classification prompt
    Logger.info('Step 2: Retrieving classification prompt from Supabase');
    const prompt = await supabaseService.getPromptByName('markdown-document-classification-prompt');
    if (!prompt) {
      throw new AppError('Classification prompt not found', 'PROMPT_ERROR');
    }
    
    Logger.info('Classification prompt found', {
      id: prompt.id,
      name: prompt.name
    });
    
    console.log('\nPrompt Information:');
    console.log(`- ID: ${prompt.id}`);
    console.log(`- Name: ${prompt.name}`);
    console.log(`- Content preview: ${prompt.content.substring(0, 100)}...`);
    
    // 4. Get related assets
    Logger.info(`Step 3: Finding related assets for prompt ID: ${prompt.id}`);
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    Logger.info(`Found ${relationships.length} related assets`);
    
    console.log(`\nFound ${relationships.length} related assets:`);
    
    // 5. Process each related asset
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      console.log(`\nAsset ${i + 1}:`);
      console.log(`- Asset Path: ${rel.asset_path}`);
      console.log(`- Relationship Type: ${rel.relationship_type || 'N/A'}`);
      console.log(`- Context: ${rel.relationship_context || 'N/A'}`);
      
      // Find the project root to properly resolve asset paths
      let assetContent;
      let projectRoot = findProjectRoot(process.cwd());
      let assetPath;
      
      Logger.debug(`Looking for asset: ${rel.asset_path}`);
      Logger.debug(`Project root determined to be: ${projectRoot}`);
      
      // Resolve asset path relative to project root
      assetPath = path.resolve(projectRoot, rel.asset_path);
      Logger.debug(`Trying path: ${assetPath}`);
      assetContent = fileService.readFile(assetPath);
      
      // If still not found, try some fallback approaches
      if (!assetContent.success) {
        // Try with lowercase 'docs' directory (in case of case sensitivity issues)
        if (rel.asset_path.startsWith('Docs/') || rel.asset_path.startsWith('DOCS/')) {
          assetPath = path.resolve(projectRoot, 'docs', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1));
          Logger.debug(`Trying lowercase docs path: ${assetPath}`);
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try with lowercase 'prompts' directory
        if (!assetContent.success && (rel.asset_path.startsWith('Prompts/') || rel.asset_path.startsWith('PROMPTS/'))) {
          assetPath = path.resolve(projectRoot, 'prompts', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1));
          Logger.debug(`Trying lowercase prompts path: ${assetPath}`);
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try with public directory prefix
        if (!assetContent.success) {
          assetPath = path.resolve(projectRoot, 'public', rel.asset_path);
          Logger.debug(`Trying with public prefix: ${assetPath}`);
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try just the filename from the path
        if (!assetContent.success) {
          const basename = path.basename(rel.asset_path);
          // Try in docs directory
          assetPath = path.resolve(projectRoot, 'docs', basename);
          Logger.debug(`Trying with filename in docs: ${assetPath}`);
          assetContent = fileService.readFile(assetPath);
          
          // Try in prompts directory
          if (!assetContent.success) {
            assetPath = path.resolve(projectRoot, 'prompts', basename);
            Logger.debug(`Trying with filename in prompts: ${assetPath}`);
            assetContent = fileService.readFile(assetPath);
          }
        }
      }
      
      if (assetContent.success) {
        console.log(`- Found at: ${assetPath}`);
        console.log(`- Size: ${assetContent.stats?.size} bytes`);
        console.log(`- Content preview: ${assetContent.content?.substring(0, 100)}...`);
      } else {
        console.log(`- Error reading file: ${assetContent.error}`);
        console.log(`- Attempted paths: `);
        console.log(`  - ${path.resolve(projectRoot, rel.asset_path)}`);
        
        // List the other paths that were attempted
        if (rel.asset_path.startsWith('Docs/') || rel.asset_path.startsWith('DOCS/')) {
          console.log(`  - ${path.resolve(projectRoot, 'docs', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1))}`);
        }
        if (rel.asset_path.startsWith('Prompts/') || rel.asset_path.startsWith('PROMPTS/')) {
          console.log(`  - ${path.resolve(projectRoot, 'prompts', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1))}`);
        }
        console.log(`  - ${path.resolve(projectRoot, 'public', rel.asset_path)}`);
        console.log(`  - ${path.resolve(projectRoot, 'docs', path.basename(rel.asset_path))}`);
        console.log(`  - ${path.resolve(projectRoot, 'prompts', path.basename(rel.asset_path))}`);
      }
    }
    
    // Step 6: Get document types with category "Documentation"
    Logger.info('Step 4: Getting document types with category "Documentation"');
    const documentTypes = await supabaseService.getDocumentTypesByCategory('Documentation');
    
    console.log(`\nFound ${documentTypes.length} document types with category "Documentation":`);
    console.log(JSON.stringify(documentTypes, null, 2));
    
    // Step 7: Prepare for Claude API call - get all necessary ingredients
    Logger.info('Step 5: Preparing Claude API call ingredients');
    
    // Get successful asset contents
    const relatedAssetContents = [];
    for (const rel of relationships) {
      // Try different paths to find the asset file
      let assetContent;
      let projectRoot = findProjectRoot(process.cwd());
      
      // First try the relative path from project root
      let assetPath = path.resolve(projectRoot, rel.asset_path);
      assetContent = fileService.readFile(assetPath);
      
      // If not found, try other common locations
      if (!assetContent.success) {
        // Try with lowercase 'docs' directory
        if (rel.asset_path.startsWith('Docs/') || rel.asset_path.startsWith('DOCS/')) {
          assetPath = path.resolve(projectRoot, 'docs', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1));
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try with prompts directory
        if (!assetContent.success && (rel.asset_path.startsWith('Prompts/') || rel.asset_path.startsWith('PROMPTS/'))) {
          assetPath = path.resolve(projectRoot, 'prompts', rel.asset_path.substring(rel.asset_path.indexOf('/') + 1));
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try with public directory
        if (!assetContent.success) {
          assetPath = path.resolve(projectRoot, 'public', rel.asset_path);
          assetContent = fileService.readFile(assetPath);
        }
        
        // Try the base filename in docs and prompts directories
        if (!assetContent.success) {
          const basename = path.basename(rel.asset_path);
          assetPath = path.resolve(projectRoot, 'docs', basename);
          assetContent = fileService.readFile(assetPath);
          
          if (!assetContent.success) {
            assetPath = path.resolve(projectRoot, 'prompts', basename);
            assetContent = fileService.readFile(assetPath);
          }
          
          // Try with development-process-specification.md specifically
          if (!assetContent.success && basename === 'development-process-specification.md') {
            assetPath = path.resolve(projectRoot, 'development-process-specification.md');
            assetContent = fileService.readFile(assetPath);
          }
        }
      }
      
      if (assetContent.success) {
        relatedAssetContents.push({
          relationship: rel,
          content: assetContent.content,
          path: assetPath
        });
      } else {
        Logger.warn(`Could not find asset: ${rel.asset_path}`);
      }
    }
    
    // Prepare context for Claude API call
    const documentTypesJson = JSON.stringify(documentTypes, null, 2);
    
    // Prepare related assets context
    let relatedAssetsContext = '';
    if (relatedAssetContents.length > 0) {
      for (const asset of relatedAssetContents) {
        relatedAssetsContext += `\n--- Related Asset: ${asset.relationship.asset_path} ---\n`;
        if (asset.relationship.relationship_context) {
          relatedAssetsContext += `Context: ${asset.relationship.relationship_context}\n\n`;
        }
        relatedAssetsContext += `${asset.content}\n\n`;
      }
    }
    
    // Prepare the API call
    const anthropicApiKey = config.anthropicApiKey;
    const claudeService = new ClaudeService(anthropicApiKey);
    
    // Assemble the API request
    // Prepare the message content
    const messageText = `I need you to analyze and classify a markdown document according to our document types.

Here is the prompt for classification:
${prompt.content}

Here are the document types with category "Documentation" in JSON format:
${documentTypesJson}

Here are the related assets and their context:
${relatedAssetsContext}

Now, please analyze the following markdown document and classify it according to the document types:

${fileResult.content}

Please provide your classification in JSON format, including the document type ID, name, and explanation for your choice. Also include any metadata you can extract from the document.`;

    // Assemble the API request with proper typing
    const apiRequest = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user' as const, // Type assertion to satisfy the type constraint
          content: [
            {
              type: 'text' as const,
              text: messageText
            }
          ]
        }
      ]
    };
    
    console.log('\nAPI request prepared with all ingredients:');
    console.log('----------------------------------------');
    console.log('1. Target markdown file acquired');
    console.log(`   - Path: ${fileResult.path}`);
    console.log(`   - Size: ${fileResult.stats?.size} bytes`);
    
    console.log('\n2. Classification prompt acquired');
    console.log(`   - ID: ${prompt.id}`);
    console.log(`   - Content preview: ${prompt.content.substring(0, 100)}...`);
    
    console.log('\n3. Related assets acquired');
    for (const asset of relatedAssetContents) {
      console.log(`   - ${asset.relationship.asset_path}`);
      console.log(`     Context: ${asset.relationship.relationship_context || 'N/A'}`);
    }
    
    console.log('\n4. Document types acquired');
    console.log(`   - ${documentTypes.length} types with category "Documentation"`);
    
    console.log('\n5. API call details');
    console.log('   - Model: claude-3-7-sonnet-20250219');
    console.log('   - Endpoint: api.anthropic.com/v1/messages');
    console.log('   - Method: POST');
    console.log('   - Headers include:');
    console.log('     - Content-Type: application/json');
    console.log('     - x-api-key: [Your Anthropic API key]');
    console.log('     - anthropic-version: 2023-06-01');

    // Show how to make the API call
    console.log('\nTo execute the API call:');
    console.log('```javascript');
    console.log(`claudeService.callClaudeApi(apiRequest).then(response => {
  if (response.success) {
    console.log('Classification successful');
    console.log(JSON.stringify(response.result, null, 2));
  } else {
    console.error('Classification failed:', response.error);
  }
});`);
    console.log('```');
    
    Logger.info('All ingredients for Claude API call assembled successfully');
    
    // Execute the API call if requested
    if (options.execute) {
      Logger.info('Executing Claude API call');
      console.log('\n=== Executing Claude API Call ===');
      
      try {
        const claudeResponse = await claudeService.callClaudeApi(apiRequest);
        
        if (claudeResponse.success) {
          console.log('\n=== Classification Successful ===');
          
          // Extract and display the text content from the response
          const responseText = claudeResponse.result?.content?.[0]?.text || 'No text content in response';
          
          console.log('\n=== API Response ===');
          console.log(responseText);
          
          // Step 8: Update the assessment fields in the database
          Logger.info('Step 6: Updating assessment in database');
          
          try {
            // Extract the filename from the file path
            const filename = path.basename(filePath);
            console.log(`\n=== Updating Document Record for ${filename} ===`);
            
            // Find the document record by filename
            const document = await supabaseService.getDocumentByFilename(filename);
            
            if (document) {
              console.log(`Found document record with ID: ${document.id}`);
              
              // Parse the JSON content from Claude's response
              let assessmentJson;
              try {
                // Try to extract JSON from the response text
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  assessmentJson = JSON.parse(jsonMatch[0]);
                } else {
                  // If no JSON object found, use the whole response
                  assessmentJson = { 
                    raw_response: responseText,
                    auto_extracted: false,
                    processed_date: new Date().toISOString()
                  };
                }
                
                // Update the document's assessment fields
                const updatedDocument = await supabaseService.updateDocumentAssessment(document.id, assessmentJson);
                
                console.log('\n=== Document Updated Successfully ===');
                console.log('Updated document record:');
                console.log(JSON.stringify(updatedDocument, null, 2));
                
                // Show specific assessment fields
                console.log('\nAssessment data:');
                console.log(JSON.stringify(updatedDocument.assessment_json, null, 2));
                console.log(`\nAssessment date: ${updatedDocument.assessment_date}`);
                
              } catch (error) {
                const jsonError = error as Error;
                console.error('Failed to parse JSON from Claude response:', jsonError.message);
                Logger.error('JSON parsing error', jsonError);
                
                // Store the raw response anyway
                const assessmentJson = { 
                  raw_response: responseText,
                  parsing_error: jsonError.message,
                  auto_extracted: false,
                  processed_date: new Date().toISOString()
                };
                
                const updatedDocument = await supabaseService.updateDocumentAssessment(document.id, assessmentJson);
                console.log('\n=== Document Updated with Raw Response ===');
                console.log('Updated document record:');
                console.log(JSON.stringify(updatedDocument, null, 2));
              }
            } else {
              console.log(`No document record found for filename: ${filename}`);
              Logger.warn(`No document record found for filename: ${filename}`);
            }
          } catch (error) {
            const dbError = error as Error;
            console.error('Error updating document record:', dbError.message);
            Logger.error('Database update error', dbError);
          }
        } else {
          console.log('\n=== Classification Failed ===');
          console.log(`Error: ${claudeResponse.error}`);
          console.log('\nResponse data:');
          console.log(JSON.stringify(claudeResponse.result, null, 2));
        }
      } catch (apiError) {
        Logger.error('Error executing Claude API call', apiError);
        console.log(`\nAPI Call Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }
    }
    
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, true);
    } else if (error instanceof Error) {
      ErrorHandler.handle(new AppError(
        error.message,
        'UNKNOWN_ERROR'
      ), true);
    } else {
      ErrorHandler.handle(new AppError(
        'An unknown error occurred',
        'UNKNOWN_ERROR'
      ), true);
    }
  }
};

/**
 * Register the command with Commander
 */
export const registerWorkflowCommand = (program: Command): void => {
  program
    .command('workflow <file-path>')
    .description('Execute the markdown classification workflow with actual credentials')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-e, --execute', 'Execute the Claude API call')
    .action(workflow);
};