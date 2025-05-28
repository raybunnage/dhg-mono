import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';

// Create a command for export
const reviewPresentationsCommand = new Command('review-presentations');

// Set command description and options
reviewPresentationsCommand
  .description('Review presentations with their associated files, experts, and document details')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '200')
  .option('-b, --batch-size <number>', 'Number of presentations to process in each batch', '10')
  .option('-f, --folder-id <id>', 'Filter presentations by high-level folder ID')
  .option('-o, --output-file <path>', 'Save output to a file in docs/script-reports directory', 'presentation-review.md')
  .option('--console-output', 'Also display output in console', false)
  .option('-c, --console', 'Alias for --console-output', false)
  .option('--fast-mode', 'Skip some queries to speed up processing', false)
  .action(async (options: any) => {
    try {
      console.log("\nReviewing Presentations");
      console.log("=====================\n");
      
      // Document type cache to avoid redundant queries
      const documentTypeCache: Record<string, string> = {};
      
      // Function to get document type name from ID (with caching)
      const getDocumentTypeName = async (supabase: any, docTypeId: string): Promise<string> => {
        if (!docTypeId) return 'Unknown';
        
        // Return from cache if available
        if (documentTypeCache[docTypeId]) return documentTypeCache[docTypeId];
        
        try {
          const { data } = await supabase
            .from('document_types')
            .select('name')
            .eq('id', docTypeId)
            .single();
            
          if (data && data.name) {
            // Store in cache
            documentTypeCache[docTypeId] = data.name;
            return data.name;
          }
        } catch (err) {
          // Ignore errors
        }
        
        return 'Unknown';
      };
      
      // Function to preload document types for better performance
      const preloadDocumentTypes = async (supabase: any) => {
        try {
          const { data } = await supabase
            .from('document_types')
            .select('id, name');
            
          if (data && data.length > 0) {
            data.forEach((type: any) => {
              documentTypeCache[type.id] = type.name;
            });
            console.log(`Preloaded ${data.length} document types`);
          }
        } catch (err) {
          console.log('Error preloading document types:', err instanceof Error ? err.message : String(err));
        }
      };
      
      // Helper to write content to file
      const appendToFile = (filePath: string, content: string, isNewFile = false) => {
        try {
          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write to file
          if (isNewFile) {
            fs.writeFileSync(filePath, content);
          } else {
            fs.appendFileSync(filePath, content);
          }
          return true;
        } catch (err) {
          console.error('Error writing to file:', err instanceof Error ? err.message : String(err));
          return false;
        }
      };
      
      const limit = parseInt(options.limit);
      const batchSize = parseInt(options.batchSize);
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Create the output file with header
      const reportDir = path.join(process.cwd(), 'docs/script-reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const filePath = path.join(reportDir, options.outputFile);
      const markdownHeader = `# Presentation Review Report\n\nGenerated on ${new Date().toISOString()}\n\n`;
      appendToFile(filePath, markdownHeader, true);
      
      // Preload all document types for better performance
      await preloadDocumentTypes(supabase);
      
      // Get the total count first
      let totalCount = 0;
      if (!options.presentationId) {
        let countQuery = supabase
          .from('media_presentations')
          .select('id', { count: 'exact', head: true });
          
        if (options.folderId) {
          countQuery = countQuery.eq('high_level_folder_source_id', options.folderId);
        }
        
        if (options.expertId) {
          // This is simplified - would need to join through google_sources_experts
          countQuery = countQuery.eq('expert_id', options.expertId);
        }
        
        const { count, error: countError } = await countQuery;
        
        if (!countError && count !== null) {
          totalCount = count;
        }
      }
      
      const effectiveLimit = Math.min(totalCount || limit, limit);
      const totalBatches = Math.ceil(effectiveLimit / batchSize);
      
      console.log(`Processing ${effectiveLimit} presentations in ${totalBatches} batches of ${batchSize}...`);
      
      // Process in batches
      let totalProcessed = 0;
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        console.log(`\nProcessing batch ${batchIndex + 1}/${totalBatches}...`);
        
        // Build the query for this batch of presentations
        let query = supabase
          .from('media_presentations')
          .select(`
            id,
            title,
            video_source_id,
            high_level_folder_source_id,
            sources_google:high_level_folder_source_id(
              id,
              name,
              drive_id,
              main_video_id,
              document_type_id
            ),
            video:video_source_id(
              id,
              name,
              mime_type,
              size,
              document_type_id
            )
          `)
          .order('created_at', { ascending: false })
          .range(batchIndex * batchSize, (batchIndex + 1) * batchSize - 1);
        
        // Apply filters
        if (options.presentationId) {
          query = query.eq('id', options.presentationId);
        }
        
        if (options.folderId) {
          query = query.eq('high_level_folder_source_id', options.folderId);
        }
        
        // Execute the query with retry logic and timeout protection
        let presentations = null;
        let error = null;
        let fetchSuccess = false;
        const maxFetchRetries = 3;
        
        for (let fetchRetry = 0; fetchRetry < maxFetchRetries && !fetchSuccess; fetchRetry++) {
          try {
            // Add timeout protection for the main query
            const result = await Promise.race([
              query,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Presentations query timed out after 20s')), 20000)
              )
            ]) as any;
            
            presentations = result.data;
            error = result.error;
            fetchSuccess = true;
          } catch (err) {
            if (fetchRetry === maxFetchRetries - 1) {
              // Last retry failed
              error = { message: `Failed after ${maxFetchRetries} attempts: ${err instanceof Error ? err.message : String(err)}` };
              console.error(`Error fetching presentations batch ${batchIndex + 1} after ${maxFetchRetries} attempts: ${err instanceof Error ? err.message : String(err)}`);
            } else {
              // Wait with exponential backoff before retrying
              const backoffTime = 2000 * Math.pow(2, fetchRetry);
              console.log(`Retrying presentations fetch (${fetchRetry+1}/${maxFetchRetries}) for batch ${batchIndex + 1} in ${backoffTime/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          }
        }
        
        if (error) {
          Logger.error(`Error fetching presentations batch ${batchIndex + 1}:`, error);
          console.error(`Error fetching presentations batch ${batchIndex + 1}: ${error.message}`);
          continue; // Continue to next batch
        }
        
        if (!presentations || presentations.length === 0) {
          console.log(`No presentations found in batch ${batchIndex + 1}.`);
          continue; // Continue to next batch
        }
        
        console.log(`Found ${presentations.length} presentations in batch ${batchIndex + 1}.`);
        
        // Process each presentation in this batch
        let batchContent = '';
        
        for (const presentation of presentations) {
          totalProcessed++;
          // Folder name (limited to 60 chars)
          const folderSource = presentation.sources_google as any;
          const folderName = folderSource?.name || 'Unknown Folder';
          const folderNameDisplay = folderName.length > 60 ? folderName.substring(0, 57) + '...' : folderName.padEnd(60);
          
          // Video file name (limited to 50 chars)
          const videoSource = presentation.video as any;
          const videoName = videoSource?.name || 'Unknown Video';
          const videoNameDisplay = videoName.length > 50 ? videoName.substring(0, 47) + '...' : videoName.padEnd(50);
          
          // Presentation title
          const presentationTitle = presentation.title || 'Untitled Presentation';
          
          // Check if the video file has content
          let videoContentStatus = "Unknown";
          
          // Fast mode uses a simpler check to improve performance
          if (options.fastMode) {
            videoContentStatus = "Check Skipped (Fast Mode)";
          } else if (presentation.video_source_id) {
            try {
              // Get expert_document for this video file to check content
              const { data: videoDoc } = await supabase
                .from('expert_documents')
                .select('raw_content, processed_content')
                .eq('source_id', presentation.video_source_id)
                .maybeSingle();
                
              if (videoDoc) {
                const hasRawContent = videoDoc.raw_content !== null;
                const hasProcessedContent = videoDoc.processed_content !== null;
                
                if (hasRawContent && hasProcessedContent) {
                  videoContentStatus = "Raw & Processed";
                } else if (hasRawContent) {
                  videoContentStatus = "Raw Only";
                } else if (hasProcessedContent) {
                  videoContentStatus = "Processed Only";
                } else {
                  videoContentStatus = "No Content";
                }
              } else {
                videoContentStatus = "No Document";
              }
            } catch (err) {
              videoContentStatus = "Error";
            }
          }
        
          // Print presentation header
          if (options.consoleOutput || options.console) {
            console.log(`${folderNameDisplay} | ${videoNameDisplay} | ${presentationTitle} | Video: ${videoContentStatus}`);
          }
          batchContent += `## ${presentationTitle}\n\n`;
          batchContent += `- **Folder:** ${folderName}\n`;
          batchContent += `- **Video File:** ${videoName}\n`;
          batchContent += `- **Video Content:** ${videoContentStatus}\n`;
          
          // Get experts associated with the high-level folder
          let expertData = null;
          let expertError = null;
          
          // Skip expert lookup in fast mode for better performance
          if (!options.fastMode && presentation.high_level_folder_source_id) {
            // Add retry logic to handle timeouts
            const maxRetries = 3;
            let retryCount = 0;
            let success = false;
            
            while (retryCount < maxRetries && !success) {
              try {
                let expertsQuery = supabase
                  .from('google_sources_experts')
                  .select(`
                    expert_id,
                    experts(
                      id,
                      expert_name,
                      full_name
                    )
                  `)
                  .eq('source_id', presentation.high_level_folder_source_id);
                
                if (options.expertId) {
                  expertsQuery = expertsQuery.eq('expert_id', options.expertId);
                }
                
                // Add timeout option
                const result = await Promise.race([
                  expertsQuery,
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Query timed out after 10s')), 10000)
                  )
                ]) as any;
                
                expertData = result.data;
                expertError = result.error;
                success = true;
              } catch (err) {
                retryCount++;
                if (retryCount >= maxRetries) {
                  // Only set error on final retry
                  expertError = { 
                    message: `Failed after ${maxRetries} attempts: ${err instanceof Error ? err.message : String(err)}`
                  };
                  console.log(`Expert lookup failed after ${maxRetries} retries for presentation ${presentation.id}`);
                } else {
                  // Wait for a short time before retrying
                  console.log(`Retrying expert lookup (${retryCount}/${maxRetries}) for presentation ${presentation.id}...`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
            }
          }
          
          if (expertError) {
            Logger.error('Error fetching experts:', expertError);
            if (options.consoleOutput || options.console) {
              console.log(`  Error fetching experts: ${expertError.message}`);
            }
            batchContent += `- **Error fetching experts:** ${expertError.message}\n\n`;
          } else {
            // Display experts
            let expertNames = '';
            if (expertData && expertData.length > 0) {
              expertNames = expertData.map((e: any) => {
                const fullName = e.experts?.full_name || e.experts?.expert_name || 'Unknown';
                return fullName;
              }).join(', ');
            } else {
              expertNames = 'None';
            }
            
            if (options.consoleOutput || options.console) {
              console.log(`  Experts: ${expertNames}`);
            }
            batchContent += `- **Experts:** ${expertNames}\n\n`;
          }
          
          // Get files associated with the presentation through presentation_assets
          // Use a simplified query in fast mode
          let assets = null;
          let assetsError = null;
          
          // Add retry logic for assets query
          const maxAssetRetries = 3;
          let assetRetryCount = 0;
          let assetSuccess = false;
          
          while (assetRetryCount < maxAssetRetries && !assetSuccess) {
            try {
              if (options.fastMode) {
                // In fast mode, only get basic asset info without raw_content checks
                const queryPromise = supabase
                  .from('media_presentation_assets')
                  .select(`
                    id,
                    asset_type,
                    asset_source_id,
                    asset_expert_document_id,
                    sources_google:asset_source_id(
                      id,
                      name,
                      mime_type,
                      size,
                      document_type_id
                    ),
                    expert_documents:asset_expert_document_id(
                      id,
                      document_type_id
                    )
                  `)
                  .eq('presentation_id', presentation.id);
                
                // Add timeout protection
                const result = await Promise.race([
                  queryPromise,
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Assets query timed out after 15s')), 15000)
                  )
                ]) as any;
                
                assets = result.data;
                assetsError = result.error;
              } else {
                // Full query in normal mode
                const queryPromise = supabase
                  .from('media_presentation_assets')
                  .select(`
                    id,
                    asset_type,
                    asset_source_id,
                    asset_expert_document_id,
                    sources_google:asset_source_id(
                      id,
                      name,
                      mime_type,
                      size,
                      document_type_id
                    ),
                    expert_documents:asset_expert_document_id(
                      id,
                      raw_content,
                      processed_content,
                      document_type_id
                    )
                  `)
                  .eq('presentation_id', presentation.id);
                
                // Add timeout protection
                const result = await Promise.race([
                  queryPromise,
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Assets query timed out after 15s')), 15000)
                  )
                ]) as any;
                
                assets = result.data;
                assetsError = result.error;
              }
              
              // Mark as successful if we get here
              assetSuccess = true;
              
            } catch (err) {
              assetRetryCount++;
              if (assetRetryCount >= maxAssetRetries) {
                // Only set error on final retry
                assetsError = { 
                  message: `Failed after ${maxAssetRetries} attempts: ${err instanceof Error ? err.message : String(err)}`
                };
                console.log(`Asset lookup failed after ${maxAssetRetries} retries for presentation ${presentation.id}`);
              } else {
                // Wait for a short time before retrying with backoff
                console.log(`Retrying asset lookup (${assetRetryCount}/${maxAssetRetries}) for presentation ${presentation.id}...`);
                await new Promise(resolve => setTimeout(resolve, 1500 * assetRetryCount));
              }
            }
          }
        
          if (assetsError) {
            Logger.error('Error fetching presentation assets:', assetsError);
            if (options.consoleOutput || options.console) {
              console.log(`  Error fetching assets: ${assetsError.message}`);
            }
            batchContent += `> ⚠️ Error fetching assets: ${assetsError.message}\n\n`;
          } else if (!assets || assets.length === 0) {
            if (options.consoleOutput || options.console) {
              console.log('  No assets found for this presentation.');
            }
            batchContent += `> No assets found for this presentation.\n\n`;
          } else {
            // Display assets header
            if (options.consoleOutput || options.console) {
              console.log(`  Assets (${assets.length}):`);
            }
            batchContent += `### Assets (${assets.length})\n\n`;
            
            // Create header for asset table
            const assetHeader = '    ' +
              'File Name'.padEnd(65) + ' | ' +
              'Source Doc Type'.padEnd(40) + ' | ' +
              'Expert Doc Type'.padEnd(40) + ' | ' +
              'Size (bytes)'.padEnd(15) + ' | ' +
              'Content Status'.padEnd(20);
            
            if (options.consoleOutput || options.console) {
              console.log('    ' + assetHeader);
              console.log('    ' + '-'.repeat(180));
            }
            
            // Markdown table header
            batchContent += `| File Name | Source Doc Type | Expert Doc Type | Size (bytes) | Content Status |\n`;
            batchContent += `|-----------|-----------------|-----------------|--------------|----------------|\n`;
            
            // Display each asset
            for (const asset of assets) {
              const sourceGoogle = asset.sources_google as any;
              const fileName = sourceGoogle?.name || 'Unknown';
              const fileNameDisplay = fileName.length > 62 ? fileName.substring(0, 59) + '...' : fileName.padEnd(62);
              
              // Get source document type (from sources_google table)
              let sourceDocType = 'Unknown';
              if (sourceGoogle && sourceGoogle.document_type_id) {
                // Use the cached document type if available, otherwise fetch it
                sourceDocType = await getDocumentTypeName(supabase, sourceGoogle.document_type_id);
              }
              const sourceDocTypeDisplay = sourceDocType.padEnd(37);
              
              // Get expert document type (from expert_documents table)
              let expertDocType = 'Unknown';
              const expertDoc = asset.expert_documents as any;
              if (expertDoc && expertDoc.document_type_id) {
                // Use the cached document type if available, otherwise fetch it
                expertDocType = await getDocumentTypeName(supabase, expertDoc.document_type_id);
              }
              const expertDocTypeDisplay = expertDocType.padEnd(37);
              
              const fileSize = sourceGoogle?.size || 0;
              const fileSizeDisplay = fileSize.toString().padEnd(12);
              
              // Check if we have raw_content and processed_content
              let contentStatus = '';
              
              if (options.fastMode) {
                // In fast mode, we don't check content to improve performance
                contentStatus = 'Not Checked';
              } else {
                const hasRawContent = expertDoc && expertDoc.raw_content !== null;
                const hasProcessedContent = expertDoc && expertDoc.processed_content !== null;
                
                if (hasRawContent && hasProcessedContent) {
                  contentStatus = 'Raw & Processed';
                } else if (hasRawContent) {
                  contentStatus = 'Raw Only';
                } else if (hasProcessedContent) {
                  contentStatus = 'Processed Only';
                } else {
                  contentStatus = 'No Content';
                }
              }
              
              // Markdown table row
              const assetLine = `| ${fileName} | ${sourceDocType} | ${expertDocType} | ${fileSize} | ${contentStatus} |`;
              
              if (options.consoleOutput || options.console) {
                console.log('    ' + fileNameDisplay + ' | ' + 
                            sourceDocTypeDisplay + ' | ' +
                            expertDocTypeDisplay + ' | ' +
                            fileSizeDisplay + ' | ' + 
                            contentStatus);
              }
              
              batchContent += `${assetLine}\n`;
            }
          }
          
          // Add separator between presentations
          if (options.consoleOutput || options.console) {
            console.log('-'.repeat(140));
          }
          batchContent += '\n---\n\n';
        }
      
        // Add the batch content to the output file
        appendToFile(filePath, batchContent);
      }
        
      // Display progress
      console.log(`Processed ${totalProcessed}/${effectiveLimit} presentations (${Math.round(totalProcessed/effectiveLimit*100)}%)`);
      
      // Final completion message
      console.log(`\nSuccessfully reviewed ${totalProcessed} presentations.`);
      console.log(`Output saved to ${filePath}`);
    } 
    catch (error) {
      Logger.error('Error reviewing presentations:', error);
      console.error('Error reviewing presentations:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Export the command
export { reviewPresentationsCommand };

// If this script is executed directly, parse command line arguments
if (require.main === module) {
  console.error("Direct execution - parsing arguments");
  reviewPresentationsCommand.parse(process.argv);
}