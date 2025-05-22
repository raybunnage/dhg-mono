import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Use require for chalk to avoid ESM compatibility issues
const chalk = require('chalk');

// Create a command for export
const reviewPresentationsCommand = new Command('review-presentations');

// Set command description and options
reviewPresentationsCommand
  .description('Review presentations with their associated files, experts, and document details')
  .option('-p, --presentation-id <id>', 'Specific presentation ID to review')
  .option('-e, --expert-id <id>', 'Filter presentations by expert ID')
  .option('-l, --limit <number>', 'Limit the number of presentations to review', '50')
  .option('-f, --folder-id <id>', 'Filter presentations by high-level folder ID')
  .option('-o, --output-file <path>', 'Save output to a file in docs/script-reports directory')
  .action(async (options: any) => {
    try {
      console.log("\nReviewing Presentations");
      console.log("=====================\n");
      
      const limit = parseInt(options.limit);
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Build the query for presentations
      let query = supabase
        .from('presentations')
        .select(`
          id,
          title,
          video_source_id,
          high_level_folder_source_id,
          sources_google:high_level_folder_source_id(
            id,
            name,
            drive_id,
            main_video_id
          ),
          video:video_source_id(
            id,
            name,
            mime_type,
            size
          )
        `)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (options.presentationId) {
        query = query.eq('id', options.presentationId);
      }
      
      if (options.folderId) {
        query = query.eq('high_level_folder_source_id', options.folderId);
      }
      
      // Apply limit
      query = query.limit(limit);
      
      console.log("Executing Supabase query for presentations...");
      
      // Execute the query
      const { data: presentations, error } = await query;
      
      if (error) {
        Logger.error('Error fetching presentations:', error);
        console.error(`Error fetching presentations: ${error.message}`);
        process.exit(1);
      }
      
      if (!presentations || presentations.length === 0) {
        console.log('No presentations found matching the criteria.');
        process.exit(0);
      }
      
      console.log(`Found ${presentations.length} presentations.\n`);
      
      // Prepare output content
      let outputContent = '';
      
      // Process each presentation
      for (const presentation of presentations) {
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
        
        if (presentation.video_source_id) {
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
        console.log(`${folderNameDisplay} | ${videoNameDisplay} | ${presentationTitle} | Video: ${videoContentStatus}`);
        outputContent += `${folderNameDisplay} | ${videoNameDisplay} | ${presentationTitle} | Video: ${videoContentStatus}\n`;
        
        // Get experts associated with the high-level folder
        let expertsQuery;
        
        // Only query if we have a valid high_level_folder_source_id
        if (presentation.high_level_folder_source_id) {
          expertsQuery = supabase
            .from('sources_google_experts')
            .select(`
              expert_id,
              experts(
                id,
                expert_name,
                full_name
              )
            `)
            .eq('source_id', presentation.high_level_folder_source_id);
        }
        
        // Handle expert data
        let expertData = null;
        let expertError = null;
        
        if (expertsQuery && presentation.high_level_folder_source_id) {
          if (options.expertId) {
            expertsQuery = expertsQuery.eq('expert_id', options.expertId);
          }
          
          const result = await expertsQuery;
          expertData = result.data;
          expertError = result.error;
        }
        
        if (expertError) {
          Logger.error('Error fetching experts:', expertError);
          console.log(`  Error fetching experts: ${expertError.message}`);
          outputContent += `  Error fetching experts: ${expertError.message}\n`;
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
          
          console.log(`  Experts: ${expertNames}`);
          outputContent += `  Experts: ${expertNames}\n`;
        }
        
        // Get files associated with the presentation through presentation_assets
        const { data: assets, error: assetsError } = await supabase
          .from('presentation_assets')
          .select(`
            id,
            asset_type,
            asset_source_id,
            asset_expert_document_id,
            sources_google:asset_source_id(
              id,
              name,
              mime_type,
              size
            ),
            expert_documents:asset_expert_document_id(
              id,
              raw_content,
              processed_content,
              document_type_id
            )
          `)
          .eq('presentation_id', presentation.id);
        
        if (assetsError) {
          Logger.error('Error fetching presentation assets:', assetsError);
          console.log(`  Error fetching assets: ${assetsError.message}`);
          outputContent += `  Error fetching assets: ${assetsError.message}\n`;
        } else if (!assets || assets.length === 0) {
          console.log('  No assets found for this presentation.');
          outputContent += `  No assets found for this presentation.\n`;
        } else {
          // Display assets header
          console.log(`  Assets (${assets.length}):`);
          outputContent += `  Assets (${assets.length}):\n`;
          
          // Create header for asset table
          const assetHeader = '    ' +
            'File Name'.padEnd(55) + ' | ' +
            'Document Type'.padEnd(25) + ' | ' +
            'Size (bytes)'.padEnd(15) + ' | ' +
            'Content Status'.padEnd(20);
          
          console.log('    ' + assetHeader);
          outputContent += `    ${assetHeader}\n`;
          
          console.log('    ' + '-'.repeat(130));
          outputContent += `    ${'-'.repeat(130)}\n`;
          
          // Display each asset
          for (const asset of assets) {
            const sourceGoogle = asset.sources_google as any;
            const fileName = sourceGoogle?.name || 'Unknown';
            const fileNameDisplay = fileName.length > 52 ? fileName.substring(0, 49) + '...' : fileName.padEnd(52);
            
            // Default document type
            let documentType = 'Unknown';
            
            // Get document type from expert document if available
            const expertDoc = asset.expert_documents as any;
            if (expertDoc && expertDoc.document_type_id) {
              // We need to fetch the document type name
              const docTypeId = expertDoc.document_type_id;
              
              try {
                // Get document type name
                const { data: docTypeData } = await supabase
                  .from('document_types')
                  .select('name')
                  .eq('id', docTypeId)
                  .single();
                  
                if (docTypeData && docTypeData.name) {
                  documentType = docTypeData.name;
                }
              } catch (err) {
                // If error, just keep the 'Unknown' default
              }
            }
            
            const docTypeDisplay = documentType.padEnd(22);
            
            const fileSize = sourceGoogle?.size || 0;
            const fileSizeDisplay = fileSize.toString().padEnd(12);
            
            // Check if we have raw_content and processed_content
            const hasRawContent = expertDoc && expertDoc.raw_content !== null;
            const hasProcessedContent = expertDoc && expertDoc.processed_content !== null;
            
            let contentStatus = '';
            if (hasRawContent && hasProcessedContent) {
              contentStatus = 'Raw & Processed';
            } else if (hasRawContent) {
              contentStatus = 'Raw Only';
            } else if (hasProcessedContent) {
              contentStatus = 'Processed Only';
            } else {
              contentStatus = 'No Content';
            }
            
            const assetLine = '    ' +
              fileNameDisplay + ' | ' +
              docTypeDisplay + ' | ' +
              fileSizeDisplay + ' | ' +
              contentStatus;
            
            console.log('    ' + fileNameDisplay + ' | ' + 
                        docTypeDisplay + ' | ' + 
                        fileSizeDisplay + ' | ' + 
                        contentStatus);
            
            outputContent += `${assetLine}\n`;
          }
        }
        
        // Add separator between presentations
        console.log('-'.repeat(140));
        outputContent += '-'.repeat(100) + '\n';
      }
      
      // Save to file if requested
      if (options.outputFile) {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure the directory exists
        const reportDir = path.join(process.cwd(), 'docs/script-reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const filePath = path.join(reportDir, options.outputFile);
        fs.writeFileSync(filePath, outputContent);
        console.log(`\nOutput saved to ${filePath}`);
      }
      
      console.log(`\nSuccessfully reviewed ${presentations.length} presentations.`);
      
    } catch (error) {
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