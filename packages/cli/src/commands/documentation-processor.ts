import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { Logger, LogLevel } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/error-handler';
import config from '../utils/config';
import { 
  FileService, 
  SupabaseService, 
  ClaudeService, 
  ReportService 
} from '../services';

// Types
interface DocumentationFile {
  id: string;
  file_path: string;
  is_deleted: boolean;
  document_type_id?: string | null;
  classification?: any;
  metadata?: any;
  assessment_date?: string;
  created_at: string;
  updated_at: string;
}

interface ProcessOptions {
  batchSize?: number;
  limit?: number;
  dryRun?: boolean;
  retries?: number;
  verbose?: boolean;
  includeProcessed?: boolean; // Option to include already processed files
}

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

/**
 * Resolve file path considering both absolute and relative paths
 */
function resolveFilePath(filePath: string): string {
  // Check if it's an absolute path already
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  
  // If it starts with 'apps/', it's relative to the monorepo root
  if (filePath.startsWith('apps/')) {
    const projectRoot = findProjectRoot(process.cwd());
    return path.join(projectRoot, filePath);
  }
  
  // Otherwise, resolve relative to current working directory
  return path.resolve(process.cwd(), filePath);
}

/**
 * Database Query Functions
 */
async function getFilesToProcess(supabaseService: SupabaseService, limit?: number, skipProcessed = true): Promise<DocumentationFile[]> {
  try {
    Logger.info('Fetching files to process from database');
    
    // Instead of directly accessing the private client, use a query builder
    const data = await ErrorHandler.wrap(async () => {
      const query: {
        from: string;
        select: string;
        filters: Array<{ field: string; operator: string; value: any }>;
        order: { field: string; ascending: boolean };
        limit: number;
      } = {
        from: 'documentation_files',
        select: '*',
        filters: [
          { field: 'is_deleted', operator: 'eq', value: false }
        ],
        order: { field: 'created_at', ascending: false },
        limit: limit || 1000
      };
      
      // Add filter to skip already processed documents
      if (skipProcessed) {
        // Skip if document_type_id is not null and quality_assessment exists
        query.filters.push({ 
          field: 'document_type_id', 
          operator: 'is', 
          value: null 
        });
        
        // The query builder doesn't support complex conditions, so we'll filter the results after
      }
      
      const result = await supabaseService.executeQuery(query.from, 'select', {
        columns: query.select,
        filters: query.filters,
        order: [query.order],
        limit: query.limit
      });
      
      // Further filter to check for assessment data
      if (skipProcessed && result) {
        return result.filter((doc: DocumentationFile) => {
          // Skip if already processed with assessment data
          const hasAssessment = doc.classification && (
            doc.classification.quality_assessment || 
            doc.classification.assessment_quality_score
          );
          return !hasAssessment;
        });
      }
      
      return result;
    }, 'Failed to fetch documentation files');
    
    Logger.info(`Found ${data?.length || 0} files to process${skipProcessed ? ' (unprocessed only)' : ''}`);
    return data as DocumentationFile[] || [];
  } catch (error) {
    Logger.error('Error fetching files:', error);
    return [];
  }
}

async function getFileById(supabaseService: SupabaseService, id: string): Promise<DocumentationFile | null> {
  try {
    Logger.debug(`Getting file by ID: ${id}`);
    
    const data = await ErrorHandler.wrap(async () => {
      return await supabaseService.getById('documentation_files', id);
    }, `Failed to fetch documentation file with ID: ${id}`);
    
    if (data) {
      Logger.debug(`Found file with ID ${id}: ${data.file_path}`);
    } else {
      Logger.warn(`No file found with ID: ${id}`);
    }
    
    return data as DocumentationFile;
  } catch (error) {
    Logger.error(`Error fetching file with ID ${id}:`, error);
    return null;
  }
}

/**
 * Processing Functions
 */
async function processSingleFileByPath(filePath: string): Promise<boolean> {
  try {
    Logger.info(`Processing file by path: ${filePath}`);
    
    // Initialize services
    const fileService = new FileService();
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    
    // Find the file in the database
    const docFile = await supabaseService.getDocumentationFileByPath(filePath);
    
    if (!docFile) {
      throw new AppError(`File not found in database: ${filePath}`, 'FILE_ERROR');
    }
    
    Logger.info(`Found file in database with ID: ${docFile.id}`);
    return await processFileById(docFile.id);
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, true);
    } else if (error instanceof Error) {
      Logger.error(`Error processing file ${filePath}:`, error);
    }
    return false;
  }
}

async function processFileById(id: string): Promise<boolean> {
  try {
    Logger.info(`Processing file with ID: ${id}`);
    
    // Initialize services
    const fileService = new FileService();
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    const claudeService = new ClaudeService(config.anthropicApiKey);
    
    // Get file details from database
    const file = await getFileById(supabaseService, id);
    
    if (!file) {
      throw new AppError(`File with ID ${id} not found`, 'DATABASE_ERROR');
    }
    
    Logger.info(`Found file: ${file.file_path}`);
    
    // Resolve the file path (handling both absolute and relative paths)
    let fullPath = file.file_path;
    
    // If path starts with 'apps/', it's relative to monorepo root
    if (file.file_path.startsWith('apps/')) {
      const projectRoot = findProjectRoot(process.cwd());
      fullPath = path.join(projectRoot, file.file_path);
      Logger.debug(`Resolved relative path to: ${fullPath}`);
    } else if (!path.isAbsolute(file.file_path)) {
      // If it's not an absolute path, resolve it relative to the project root
      const projectRoot = findProjectRoot(process.cwd());
      fullPath = path.join(projectRoot, file.file_path);
      Logger.debug(`Resolved relative path to: ${fullPath}`);
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(fullPath)) {
      Logger.warn(`File ${fullPath} does not exist on disk. Marking as deleted.`);
      
      try {
        await ErrorHandler.wrap(async () => {
          return await supabaseService.update('documentation_files', id, { is_deleted: true });
        }, `Failed to mark file as deleted`);
      } catch (error) {
        if (error instanceof Error) {
          Logger.error(`Failed to mark file as deleted: ${error.message}`);
        }
      }
      
      return false;
    }
    
    // Read file content
    const fileResult = fileService.readFile(fullPath);
    
    if (!fileResult.success) {
      throw new AppError(`Failed to read file: ${fileResult.error}`, 'FILE_ERROR');
    }
    
    Logger.info('File read successfully', {
      path: fileResult.path,
      size: fileResult.stats?.size
    });
    
    // Get classification prompt
    const prompt = await supabaseService.getPromptByName('markdown-document-classification-prompt');
    
    if (!prompt) {
      throw new AppError('Classification prompt not found', 'PROMPT_ERROR');
    }
    
    // Get related assets for the prompt
    const relationships = await supabaseService.getRelationshipsByPromptId(prompt.id);
    
    // Process related assets
    const relatedAssetContents = [];
    const projectRoot = findProjectRoot(process.cwd());
    
    for (const rel of relationships) {
      // Try different paths to find the asset file
      let assetContent;
      
      // First try the relative path from project root
      let assetPath = path.resolve(projectRoot, rel.asset_path);
      assetContent = fileService.readFile(assetPath);
      
      // If not found, try other common locations
      if (!assetContent.success) {
        // Try other paths as in the workflow command
        // This mirrors the logic from the workflow.ts file
        
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
    
    // Get document types
    const documentTypes = await supabaseService.getDocumentTypesByCategory('Documentation');
    
    if (!documentTypes || documentTypes.length === 0) {
      throw new AppError('No document types found for category "Documentation"', 'DATA_ERROR');
    }
    
    // Prepare context for AI call
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
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: messageText
            }
          ]
        }
      ]
    };
    
    // Call Claude API
    Logger.info('Calling Claude API for classification');
    const claudeResponse = await claudeService.callClaudeApi(apiRequest);
    
    if (!claudeResponse.success) {
      throw new AppError(`Claude API call failed: ${claudeResponse.error}`, 'API_ERROR');
    }
    
    Logger.info('Claude API call successful');
    
    // Extract the response text
    const responseText = claudeResponse.result?.content?.[0]?.text || 'No text content in response';
    
    // Parse the JSON content from Claude's response
    let assessmentJson: Record<string, any>;
    let documentTypeId: string | null = null;
    
    try {
      // Try to extract JSON from the response text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        assessmentJson = JSON.parse(jsonMatch[0]);
        
        // Extract document_type_id
        if (assessmentJson.document_type_id) {
          documentTypeId = assessmentJson.document_type_id as string;
          Logger.debug(`Extracted document type ID directly: ${documentTypeId}`);
          
          // Verify the ID exists in our document types
          const verifiedType = documentTypes.find(dt => dt.id === documentTypeId);
          if (verifiedType) {
            Logger.debug(`Verified document type ID: ${documentTypeId} matches "${verifiedType.name}"`);
          } else {
            Logger.warn(`Warning: document_type_id ${documentTypeId} not found in available document types!`);
          }
        } else {
          // If no direct ID, use the document_type name to find matching ID
          Logger.debug('Matching document type by name');
          
          // Get document type name from the assessment
          const documentTypeName = assessmentJson.document_type;
          
          if (documentTypeName && documentTypes && documentTypes.length > 0) {
            Logger.debug(`Looking for document type by name: "${documentTypeName}"`);
            
            // Simple exact match (case insensitive)
            const matchedType = documentTypes.find(dt => 
              dt.name.toLowerCase() === documentTypeName.toLowerCase()
            );
            
            if (matchedType) {
              documentTypeId = matchedType.id;
              Logger.debug(`Found exact match: "${matchedType.name}" (ID: ${documentTypeId})`);
              
              // Add it to the assessment JSON for future reference
              assessmentJson.document_type_id = documentTypeId;
            } else {
              Logger.debug(`No exact match found for "${documentTypeName}", checking partial matches...`);
              
              // Try partial matching
              const partialMatch = documentTypes.find(dt => 
                documentTypeName.toLowerCase().includes(dt.name.toLowerCase()) ||
                dt.name.toLowerCase().includes(documentTypeName.toLowerCase())
              );
              
              if (partialMatch) {
                documentTypeId = partialMatch.id;
                Logger.debug(`Found partial match: "${partialMatch.name}" (ID: ${documentTypeId})`);
                
                // Add it to the assessment JSON
                assessmentJson.document_type_id = documentTypeId;
              } else {
                Logger.warn(`No matches found for "${documentTypeName}"`);
                
                // FALLBACK: Use the first document type as default
                documentTypeId = documentTypes[0].id;
                Logger.warn(`Using default document type: "${documentTypes[0].name}" (ID: ${documentTypeId})`);
                
                // Add to the assessment JSON
                assessmentJson.document_type_id = documentTypeId;
              }
            }
          } else {
            Logger.warn(`Missing document type name or available document types`);
            
            // FALLBACK: If we have document types, use the first one
            if (documentTypes && documentTypes.length > 0) {
              documentTypeId = documentTypes[0].id;
              Logger.warn(`Using first available document type: "${documentTypes[0].name}" (ID: ${documentTypeId})`);
              
              // Add to the assessment JSON
              assessmentJson.document_type_id = documentTypeId;
            } else {
              Logger.error(`No document types available to choose from!`);
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
              .filter((word: string) => word.length > 3)
              .map((word: string) => word.toLowerCase())
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
      
      // Update the documentation file's assessment fields
      const updatedDocFile = await supabaseService.updateDocumentationFileAssessment(
        file.id, 
        assessmentJson,
        documentTypeId || undefined
      );
      
      Logger.info(`Successfully processed ${file.file_path} (ID: ${id})`);
      return true;
    } catch (error) {
      Logger.error(`Error processing file ID ${id}:`, error);
      return false;
    }
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, false);
    } else if (error instanceof Error) {
      Logger.error(`Error processing file ID ${id}:`, error);
    }
    return false;
  }
}

async function processFileWithRetry(id: string, maxRetries = 3): Promise<boolean> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const success = await processFileById(id);
      if (success) return true;
      
      retries++;
      Logger.warn(`Retry ${retries}/${maxRetries} for file ID ${id}`);
      
      if (retries >= maxRetries) {
        Logger.error(`Failed to process file ID ${id} after ${maxRetries} attempts`);
        return false;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    } catch (error) {
      retries++;
      Logger.warn(`Retry ${retries}/${maxRetries} for file ID ${id} due to error:`, error);
      
      if (retries >= maxRetries) {
        Logger.error(`Failed to process file ID ${id} after ${maxRetries} attempts`);
        return false;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
  
  return false;
}

/**
 * Batch Processing Implementation
 */
async function processAllFiles(options: ProcessOptions): Promise<void> {
  const {
    batchSize = 5,
    limit,
    dryRun = false,
    retries = 3,
    verbose = false,
    includeProcessed = false // New option to include already processed files
  } = options;
  
  try {
    // Initialize services
    const supabaseService = new SupabaseService(config.supabaseUrl, config.supabaseKey);
    
    console.log('Fetching files to process...');
    const files = await getFilesToProcess(supabaseService, limit, !includeProcessed);
    
    console.log(`Found ${files.length} files to process${limit ? ` (limited to ${limit})` : ''}${!includeProcessed ? ' (skipping already processed files)' : ''}`);
    
    if (dryRun) {
      console.log('DRY RUN - Would process these files:');
      files.forEach((file, index) => {
        const status = file.document_type_id ? 'ALREADY CLASSIFIED' : 'UNCLASSIFIED';
        const hasAssessment = file.classification && (file.classification.quality_assessment || file.classification.assessment_quality_score);
        const assessmentStatus = hasAssessment ? 'HAS ASSESSMENT' : 'NO ASSESSMENT';
        console.log(`${index + 1}. ${file.file_path} (ID: ${file.id}) - ${status}, ${assessmentStatus}`);
      });
      return;
    }
    
    // Process in batches
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${files.length} files in ${batches.length} batches of up to ${batchSize} files each`);
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();
    const errors: Array<{ id: string; path: string; error: any }> = [];
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      
      const results = await Promise.all(
        batches[i].map(async (file) => {
          try {
            if (verbose) {
              console.log(`Processing ${file.file_path} (ID: ${file.id})...`);
            }
            
            const success = await processFileWithRetry(file.id, retries);
            return { 
              success, 
              id: file.id, 
              path: file.file_path 
            };
          } catch (error) {
            return { 
              success: false, 
              id: file.id, 
              path: file.file_path, 
              error 
            };
          }
        })
      );
      
      results.forEach(result => {
        processed++;
        if (result.success) {
          successful++;
        } else {
          failed++;
          if (result.error) {
            errors.push({
              id: result.id,
              path: result.path,
              error: result.error
            });
          }
          if (verbose) {
            console.error(`Failed to process ${result.path} (ID: ${result.id})`);
          }
        }
      });
      
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const filesPerSecond = processed / elapsedSeconds;
      const estimatedRemaining = (files.length - processed) / filesPerSecond;
      
      console.log(`Progress: ${processed}/${files.length} files (${(processed/files.length*100).toFixed(1)}%)`);
      console.log(`Stats: ${successful} successful, ${failed} failed`);
      console.log(`Speed: ${filesPerSecond.toFixed(2)} files/sec, Est. remaining: ${formatTime(estimatedRemaining)}`);
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`\nProcessing complete!`);
    console.log(`Processed ${files.length} files in ${formatTime(totalTime)}`);
    console.log(`Results: ${successful} successful, ${failed} failed`);
    
    // Generate report
    generateProcessingReport({
      totalFiles: files.length,
      successful,
      failed,
      processingTimeSeconds: totalTime,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, true);
    } else if (error instanceof Error) {
      console.error('Error in batch processing:', error.message);
      Logger.error('Error in batch processing:', error);
    } else {
      console.error('Unknown error in batch processing');
      Logger.error('Unknown error in batch processing');
    }
  }
}

/**
 * Helper Functions
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function generateProcessingReport(data: {
  totalFiles: number;
  successful: number;
  failed: number;
  processingTimeSeconds: number;
  errors?: Array<{ id: string; path: string; error: any }>;
}): void {
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const report = {
    timestamp,
    ...data,
    averageTimePerFile: data.processingTimeSeconds / data.totalFiles
  };
  
  // Create reports directory if it doesn't exist
  const reportDir = path.resolve(process.cwd(), 'docs/reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Write JSON report
  fs.writeFileSync(
    path.join(reportDir, `documentation-processing-report-${timestamp}.json`),
    JSON.stringify(report, null, 2)
  );
  
  // Write markdown report
  const markdownReport = `# Documentation Processing Report

## Summary
- **Timestamp:** ${new Date(timestamp.replace(/-/g, ':')).toLocaleString()}
- **Total Files:** ${report.totalFiles}
- **Successful:** ${report.successful}
- **Failed:** ${report.failed}
- **Processing Time:** ${formatTime(report.processingTimeSeconds)}
- **Average Time Per File:** ${(report.averageTimePerFile).toFixed(2)}s

${report.errors && report.errors.length > 0 ? `
## Errors
${report.errors.map(err => `- **${err.path}** (ID: ${err.id}): ${err.error}`).join('\n')}
` : ''}
`;

  fs.writeFileSync(
    path.join(reportDir, `documentation-processing-report-${timestamp}.md`),
    markdownReport
  );
  
  console.log(`Report saved to docs/reports/documentation-processing-report-${timestamp}.md`);
}

/**
 * Command Implementation
 */
export const processDocumentation = async (filePath: string | undefined, options: any) => {
  // Configure logger based on options
  Logger.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  
  try {
    if (filePath) {
      // Process single file by path
      console.log(`Processing file: ${filePath}`);
      const success = await processSingleFileByPath(filePath);
      process.exit(success ? 0 : 1);
    } else if (options.id) {
      // Process single file by ID
      console.log(`Processing file with ID: ${options.id}`);
      const success = await processFileWithRetry(options.id, options.retries);
      process.exit(success ? 0 : 1);
    } else if (options.all) {
      // Process all files
      await processAllFiles({
        batchSize: options.batchSize ? parseInt(options.batchSize) : undefined,
        limit: options.limit ? parseInt(options.limit) : undefined,
        dryRun: options.dryRun,
        retries: options.retries ? parseInt(options.retries) : undefined,
        verbose: options.verbose,
        includeProcessed: options.includeProcessed
      });
    } else {
      console.error('Error: Please provide a file path, ID, or use --all flag');
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof AppError) {
      ErrorHandler.handle(error, true);
      process.exit(1);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      Logger.error('Error:', error);
      process.exit(1);
    } else {
      console.error('Unknown error occurred');
      Logger.error('Unknown error occurred');
      process.exit(1);
    }
  }
};

/**
 * Register the command with Commander
 */
export const registerDocumentProcessorCommand = (program: Command): void => {
  program
    .command('process [file-path]')
    .description('Process documentation files from the database')
    .option('-i, --id <id>', 'Process a specific documentation file by ID')
    .option('-a, --all', 'Process all non-deleted documentation files')
    .option('-l, --limit <number>', 'Limit the number of files to process')
    .option('-b, --batch-size <number>', 'Number of files to process in parallel', '5')
    .option('-d, --dry-run', 'Show what would be processed without making changes')
    .option('-r, --retries <number>', 'Number of retry attempts for failed processing', '3')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--include-processed', 'Include already processed files (with document_type_id and assessment)')
    .action(processDocumentation);
};