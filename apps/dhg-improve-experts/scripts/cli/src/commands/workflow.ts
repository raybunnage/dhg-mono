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

Please provide your classification in JSON format with fields that match directly with the documentation_files table structure:
{
  "document_type_id": "uuid-of-matched-document-type-from-the-document_types-list-above",
  "document_type": "Name of the document type EXACTLY as it appears in the document_types list above",
  "title": "Document title extracted from content",
  "summary": "Concise summary of document purpose and content",
  "ai_generated_tags": ["topic1", "topic2", "topic3"],
  "assessment_quality_score": 0.XX, // confidence score between 0 and 1
  "classification_reasoning": "Detailed explanation for why this document type was chosen",
  "audience": "Target audience for this document",
  "quality_assessment": {
    "completeness": 1-5 score,
    "clarity": 1-5 score,
    "accuracy": 1-5 score,
    "overall": 1-5 score
  },
  "suggested_improvements": [
    "Improvement suggestion 1",
    "Improvement suggestion 2"
  ]
}

IMPORTANT: 
1. For the document_type_id field, use the exact ID value from the document_types list provided above
2. Match the document type name precisely with one from the list
3. The field names must match exactly with the documentation_files table structure
4. Use ai_generated_tags (not key_topics or tags) for consistency with the database
5. Provide assessment_quality_score as a decimal between 0 and 1

Your response should be strictly JSON without any explanatory text before or after.`;

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
            console.log(`\n=== Updating Documentation File Record for ${filePath} ===`);
            
            // Find the documentation file record by path
            // Try multiple path formats to find the file (for backward compatibility)
            const docFile = await supabaseService.getDocumentationFileByPath(filePath);
            
            if (docFile) {
              console.log(`Found documentation file record with ID: ${docFile.id}`);
              console.log(`File path in database: ${docFile.file_path}`);
              
              // Verify path is in the standard format (relative to project root)
              const projectRoot = findProjectRoot(process.cwd());
              const isFullPath = filePath.startsWith(projectRoot);
              const relPath = isFullPath ? filePath.substring(projectRoot.length + 1) : filePath;
              
              console.log(`Using project root: ${projectRoot}`);
              console.log(`Normalized file path: ${relPath}`);
              
              // If paths don't match, log a warning about inconsistent paths
              if (docFile.file_path !== relPath) {
                console.log(`⚠️ Warning: Path in database (${docFile.file_path}) differs from normalized path (${relPath})`);
                console.log(`This might be fixed by running the update-docs-database.sh script`);
              }
              
              // Parse the JSON content from Claude's response
              let assessmentJson;
              let documentTypeId = null;
              
              try {
                // Try to extract JSON from the response text
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  assessmentJson = JSON.parse(jsonMatch[0]);
                  
                  // THIS IS THE CRITICAL SECTION - Extract document_type_id with simplified approach
                  
                  // First try direct ID if available
                  if (assessmentJson.document_type_id) {
                    documentTypeId = assessmentJson.document_type_id;
                    console.log(`Extracted document type ID directly: ${documentTypeId}`);
                    
                    // Verify the ID exists in our document types
                    const verifiedType = documentTypes.find(dt => dt.id === documentTypeId);
                    if (verifiedType) {
                      console.log(`✅ Verified document type ID: ${documentTypeId} matches "${verifiedType.name}"`);
                    } else {
                      console.log(`⚠️ Warning: document_type_id ${documentTypeId} not found in available document types!`);
                    }
                  } else {
                    // If no direct ID, use the document_type name to find matching ID
                    console.log('\n*** Matching document type by name ***');
                    
                    // Log available document types for reference
                    console.log('Available document types:');
                    documentTypes.forEach(dt => {
                      console.log(`- ${dt.name} (ID: ${dt.id})`);
                    });
                    
                    // Get document type name from the assessment
                    const documentTypeName = assessmentJson.document_type;
                    
                    if (documentTypeName && documentTypes && documentTypes.length > 0) {
                      console.log(`Looking for document type by name: "${documentTypeName}"`);
                      
                      // Simple exact match (case insensitive)
                      const matchedType = documentTypes.find(dt => 
                        dt.name.toLowerCase() === documentTypeName.toLowerCase()
                      );
                      
                      if (matchedType) {
                        documentTypeId = matchedType.id;
                        console.log(`✅ Found exact match: "${matchedType.name}" (ID: ${documentTypeId})`);
                        
                        // Add it to the assessment JSON for future reference
                        assessmentJson.document_type_id = documentTypeId;
                      } else {
                        console.log(`No exact match found for "${documentTypeName}", checking partial matches...`);
                        
                        // Try partial matching
                        const partialMatch = documentTypes.find(dt => 
                          documentTypeName.toLowerCase().includes(dt.name.toLowerCase()) ||
                          dt.name.toLowerCase().includes(documentTypeName.toLowerCase())
                        );
                        
                        if (partialMatch) {
                          documentTypeId = partialMatch.id;
                          console.log(`✅ Found partial match: "${partialMatch.name}" (ID: ${documentTypeId})`);
                          
                          // Add it to the assessment JSON
                          assessmentJson.document_type_id = documentTypeId;
                        } else {
                          console.log(`⚠️ No matches found for "${documentTypeName}"`);
                          
                          // FALLBACK: Use the first document type as default
                          documentTypeId = documentTypes[0].id;
                          console.log(`⚠️ Using default document type: "${documentTypes[0].name}" (ID: ${documentTypeId})`);
                          
                          // Add to the assessment JSON
                          assessmentJson.document_type_id = documentTypeId;
                        }
                      }
                    } else {
                      console.log(`⚠️ Missing document type name or available document types`);
                      
                      // FALLBACK: If we have document types, use the first one
                      if (documentTypes && documentTypes.length > 0) {
                        documentTypeId = documentTypes[0].id;
                        console.log(`⚠️ Using first available document type: "${documentTypes[0].name}" (ID: ${documentTypeId})`);
                        
                        // Add to the assessment JSON
                        assessmentJson.document_type_id = documentTypeId;
                      } else {
                        console.log(`❌ ERROR: No document types available to choose from!`);
                      }
                    }
                  }
                  
                  // Enhance the assessment object with additional metadata
                  const timestamp = new Date().toISOString();
                  
                  // Add necessary fields if they don't exist
                  if (!assessmentJson.processed_date) {
                    assessmentJson.processed_date = timestamp;
                  }
                  
                  // Add quality assessment if not present
                  if (!assessmentJson.quality_assessment) {
                    assessmentJson.quality_assessment = {
                      completeness: 3,
                      clarity: 3,
                      accuracy: 3,
                      overall: 3
                    };
                  }
                  
                  // Ensure we have key_topics for tags if not already present
                  if (!assessmentJson.key_topics && !assessmentJson.tags && !assessmentJson.keywords) {
                    assessmentJson.key_topics = [];
                    
                    // Try to extract topics from the document title or summary
                    if (assessmentJson.title) {
                      const words = assessmentJson.title.split(/\s+/)
                        .filter((word) => word.length > 3)
                        .map((word) => word.toLowerCase())
                        .slice(0, 3);
                      
                      if (words.length > 0) {
                        assessmentJson.key_topics = words;
                      }
                    }
                  }
                } else {
                  // If no JSON object found, use the whole response
                  const timestamp = new Date().toISOString();
                  assessmentJson = { 
                    raw_response: responseText,
                    auto_extracted: false,
                    processed_date: timestamp,
                    quality_assessment: {
                      completeness: 1,
                      clarity: 1,
                      accuracy: 1,
                      overall: 1
                    }
                  };
                }
                
                // Ensure we have all the fields we need
                if (!assessmentJson.processed_date) {
                  assessmentJson.processed_date = new Date().toISOString();
                }
                
                console.log('Parsed assessment JSON:', JSON.stringify(assessmentJson, null, 2));
                
                // Add debug logs before update with direct field mapping
                console.log('\n=== Preparing to Update Documentation File ===');
                console.log(`Document File ID: ${docFile.id}`);
                console.log(`Document Type ID: ${documentTypeId || 'Not found'}`);
                console.log(`Title: ${assessmentJson.title || 'Not found'}`);
                console.log(`Summary: ${assessmentJson.summary ? 'Found (' + assessmentJson.summary.length + ' chars)' : 'Not found'}`);
                console.log(`Tags/Key Topics: ${JSON.stringify(assessmentJson.key_topics || assessmentJson.tags || [])}`);
                console.log(`Quality Score: ${assessmentJson.confidence || (assessmentJson.quality_assessment?.overall / 5) || 0.7}`);
                console.log(`Assessment Model: ${assessmentJson.model || 'claude-3-7-sonnet-20250219'}`);
                
                // Ensure proper format for direct field mapping
                console.log('\n=== Field Mapping Verification ===');
                
                // Verify document_type_id is set
                if (!assessmentJson.document_type_id && documentTypeId) {
                  assessmentJson.document_type_id = documentTypeId;
                  console.log(`✅ Added document_type_id to assessment: ${documentTypeId}`);
                } else if (assessmentJson.document_type_id) {
                  console.log(`✅ document_type_id already in assessment: ${assessmentJson.document_type_id}`);
                } else {
                  console.log(`❌ No document_type_id available!`);
                }
                
                // Update the documentation file's assessment fields
                const updatedDocFile = await supabaseService.updateDocumentationFileAssessment(
                  docFile.id, 
                  assessmentJson,
                  documentTypeId
                );
                
                console.log('\n=== Documentation File Updated Successfully ===');
                console.log('Updated documentation file record:');
                console.log(JSON.stringify(updatedDocFile, null, 2));
                
                // Show direct field mapping results with verification
                console.log('\n=== VERIFICATION OF DOCUMENT FIELDS ===');
                console.log(`• id: ${updatedDocFile.id || 'NULL'}`);
                console.log(`• document_type_id: ${updatedDocFile.document_type_id || 'NULL'}`);
                console.log(`• file_path: ${updatedDocFile.file_path || 'NULL'}`);
                console.log(`• title: ${updatedDocFile.title || 'NULL'}`);
                console.log(`• summary: ${updatedDocFile.summary ? (updatedDocFile.summary.length > 50 ? 
                  updatedDocFile.summary.substring(0, 50) + '...' : updatedDocFile.summary) : 'NULL'}`);
                console.log(`• ai_generated_tags: ${JSON.stringify(updatedDocFile.ai_generated_tags || 'NULL')}`);
                console.log(`• ai_assessment: ${updatedDocFile.ai_assessment ? '✅ Set (object)' : '❌ NULL'}`);
                console.log(`• assessment_quality_score: ${updatedDocFile.assessment_quality_score || 'NULL'}`);
                console.log(`• assessment_created_at: ${updatedDocFile.assessment_created_at || 'NULL'}`);
                console.log(`• assessment_updated_at: ${updatedDocFile.assessment_updated_at || 'NULL'}`);
                console.log(`• assessment_model: ${updatedDocFile.assessment_model || 'NULL'}`);
                console.log(`• assessment_version: ${updatedDocFile.assessment_version || 'NULL'}`);
                console.log(`• last_modified_at: ${updatedDocFile.last_modified_at || 'NULL'}`);
                console.log(`• last_indexed_at: ${updatedDocFile.last_indexed_at || 'NULL'}`);
                console.log(`• updated_at: ${updatedDocFile.updated_at || 'NULL'}`);
                console.log(`• created_at: ${updatedDocFile.created_at || 'NULL'}`);
                
                // If document_type_id is set, look up its name for verification
                if (updatedDocFile.document_type_id) {
                  // Find the document type in our local array for immediate verification
                  const matchedDocType = documentTypes.find(dt => dt.id === updatedDocFile.document_type_id);
                  
                  if (matchedDocType) {
                    console.log(`\n✅ DOCUMENT TYPE VERIFICATION: Successfully matched to "${matchedDocType.name}"`);
                  } else {
                    console.log(`\n⚠️ DOCUMENT TYPE WARNING: ID ${updatedDocFile.document_type_id} not found in local document types`);
                    
                    // Try to fetch it directly from the database for verification
                    try {
                      const docType = await supabaseService.getDocumentTypeById(updatedDocFile.document_type_id);
                      if (docType) {
                        console.log(`✅ DOCUMENT TYPE VERIFIED FROM DATABASE: "${docType.name}"`);
                      } else {
                        console.log(`❌ DOCUMENT TYPE NOT FOUND IN DATABASE!`);
                      }
                    } catch (e) {
                      console.log(`❌ ERROR verifying document type: ${e instanceof Error ? e.message : 'Unknown error'}`);
                    }
                  }
                } else {
                  console.log(`\n❌ CRITICAL ERROR: document_type_id is not set in the updated record!`);
                  console.log(`This indicates a failure in the document type ID matching and assignment process.`);
                }
                
                console.log('\nFull Assessment data:');
                console.log(JSON.stringify(updatedDocFile.ai_assessment, null, 2));
                console.log(`\nAssessment date: ${updatedDocFile.assessment_date}`);
                
                if (updatedDocFile.document_type_id) {
                  console.log(`\nDocument type ID: ${updatedDocFile.document_type_id}`);
                }
                
                if (updatedDocFile.summary) {
                  console.log(`\nSummary: ${updatedDocFile.summary}`);
                }
                
                if (updatedDocFile.tags && updatedDocFile.tags.length > 0) {
                  console.log(`\nTags: ${updatedDocFile.tags.join(', ')}`);
                }
                
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
                
                const updatedDocFile = await supabaseService.updateDocumentationFileAssessment(
                  docFile.id, 
                  assessmentJson
                );
                
                console.log('\n=== Documentation File Updated with Raw Response ===');
                console.log('Updated documentation file record:');
                console.log(JSON.stringify(updatedDocFile, null, 2));
              }
            } else {
              console.log(`No documentation file record found for path: ${filePath}`);
              console.log(`You may need to add this file to the documentation_files table first.`);
              Logger.warn(`No documentation file record found for path: ${filePath}`);
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