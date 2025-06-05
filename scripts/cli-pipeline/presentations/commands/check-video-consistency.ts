import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Create the command
const command = new Command('check-video-consistency')
  .description('Check consistency between high-level folders and presentations video references')
  .option('-l, --limit <number>', 'Limit the number of folders to check', '100')
  .option('--folder-depth <number>', 'Folder depth to check (default: 0 for high-level folders)', '0')
  .option('-v, --verbose', 'Show detailed logs during processing', false)
  .option('-o, --output <path>', 'Output file path for markdown report', '')
  .action(async (options) => {
    try {
      // Extract options
      const limit = parseInt(options.limit) || 100;
      const folderDepth = parseInt(options.folderDepth) || 0;
      const verbose = !!options.verbose;
      
      // Setup output file path
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const defaultOutputPath = path.resolve(process.cwd(), `docs/script-reports/video-consistency-report-${timestamp}.md`);
      const outputPath = options.output || defaultOutputPath;
      
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Initialize report content
      let reportContent = `# Video Consistency Report\n\n`;
      reportContent += `*Generated on: ${new Date().toLocaleString()}*\n\n`;
      
      // Initialize Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Log to report and console
      const log = (message: string) => {
        console.log(message); // Log to console directly
        reportContent += message + '\n';
      };
      
      // 1. Get high-level folders with main_video_id
      // Force immediate console output with process.stdout.write
      process.stdout.write("Starting video consistency check...\n");
      process.stdout.write(`Checking folders at depth ${folderDepth}...\n`);
      
      log(`## Fetching Folders with main_video_id\n`);
      log(`- Folder depth: ${folderDepth}`);
      log(`- Limit: ${limit}\n`);
      
      const { data: folders, error: foldersError } = await supabase
        .from('google_sources')
        .select(`
          id,
          name,
          main_video_id,
          path_depth,
          sources_google:main_video_id(
            id,
            name,
            mime_type
          )
        `)
        .eq('path_depth', folderDepth)
        .not('main_video_id', 'is', null)
        .order('name', { ascending: true })
        .limit(limit);
      
      if (foldersError) {
        process.stdout.write(`ERROR: Failed to fetch folders: ${foldersError.message}\n`);
        log(`### ERROR: Failed to fetch folders\n`);
        log('```');
        log(JSON.stringify(foldersError, null, 2));
        log('```\n');
        
        // Write the report with error information
        fs.writeFileSync(outputPath, reportContent);
        process.stdout.write(`Report saved to: ${outputPath}\n`);
        Logger.info(`Report saved to: ${outputPath}`);
        return;
      }
      
      if (!folders || folders.length === 0) {
        process.stdout.write(`No folders with main_video_id found at depth ${folderDepth}.\n`);
        process.stdout.write(`Try adjusting the folder-depth parameter to check different folder levels.\n`);
        
        log(`### No folders found\n`);
        log(`No folders with main_video_id found at depth ${folderDepth}.`);
        log(`Try adjusting the folder-depth parameter to check different folder levels.\n`);
        
        // Write the report with no folders information
        fs.writeFileSync(outputPath, reportContent);
        process.stdout.write(`Report saved to: ${outputPath}\n`);
        Logger.info(`Report saved to: ${outputPath}`);
        return;
      }
      
      process.stdout.write(`Found ${folders.length} folders with main_video_id.\n`);
      log(`### Found ${folders.length} folders with main_video_id\n`);
      
      // 2. Check each folder
      const results: Array<{
        folderName: string;
        folderId: string;
        mainVideoId: string;
        mainVideoName: string;
        presentationVideoId: string | null;
        presentationVideoName: string | null;
        isConsistent: boolean;
        presentationId: string | null;
      }> = [];
      
      let consistentCount = 0;
      let inconsistentCount = 0;
      
      log(`## Analyzing Folder-Presentation Consistency\n`);
      
      for (const folder of folders) {
        if (verbose) {
          log(`Processing folder: ${folder.name}`);
        }
        
        const folderName = String(folder.name || 'Unknown');
        const folderId = String(folder.id);
        const mainVideoId = String(folder.main_video_id || '');
        
        // Get main video name from the joined record
        let mainVideoName = 'Unknown';
        if (folder.sources_google && typeof folder.sources_google === 'object' && 'name' in folder.sources_google) {
          mainVideoName = String(folder.sources_google.name);
        }
        
        // Find corresponding presentation
        const { data: presentations, error: presError } = await supabase
          .from('media_presentations')
          .select(`
            id,
            video_source_id,
            sources_google:video_source_id(
              id,
              name,
              mime_type
            )
          `)
          .eq('high_level_folder_source_id', folder.id)
          .limit(1);
        
        if (presError) {
          if (verbose) {
            log(`Error fetching presentation for folder ${folderName}: ${presError.message}`);
          }
          continue;
        }
        
        if (!presentations || presentations.length === 0) {
          // No presentation found for this folder
          results.push({
            folderName,
            folderId,
            mainVideoId,
            mainVideoName,
            presentationVideoId: null,
            presentationVideoName: null,
            isConsistent: false,
            presentationId: null
          });
          inconsistentCount++;
          continue;
        }
        
        const presentation = presentations[0];
        const presentationVideoId = String(presentation.video_source_id || '');
        
        // Get presentation video name from the joined record
        let presentationVideoName = 'Unknown';
        if (presentation.sources_google && typeof presentation.sources_google === 'object' && 'name' in presentation.sources_google) {
          presentationVideoName = String(presentation.sources_google.name);
        }
        
        // Check consistency
        const isConsistent = mainVideoId === presentationVideoId;
        
        results.push({
          folderName,
          folderId,
          mainVideoId,
          mainVideoName,
          presentationVideoId,
          presentationVideoName,
          isConsistent,
          presentationId: presentation.id
        });
        
        if (isConsistent) {
          consistentCount++;
        } else {
          inconsistentCount++;
        }
      }
      
      // 3. Display results
      log(`## Video Consistency Check Results\n`);
      
      log(`- **Total Folders Analyzed**: ${results.length}`);
      log(`- **Consistent References**: ${consistentCount}`);
      log(`- **Inconsistent References**: ${inconsistentCount}\n`);
      
      // Format as markdown table
      log(`### Summary Table\n`);
      log(`| Folder Name | Main Video | Presentation Video | Consistent? |`);
      log(`|------------|------------|---------------------|-------------|`);
      
      for (const result of results) {
        const folderNameTruncated = result.folderName.length > 40 ? result.folderName.substring(0, 37) + '...' : result.folderName;
        
        const mainVideoNameTruncated = !result.mainVideoName ? 'N/A' : 
          (result.mainVideoName.length > 40 ? result.mainVideoName.substring(0, 37) + '...' : result.mainVideoName);
        
        const presentationVideoNameTruncated = !result.presentationVideoName ? 'N/A' : 
          (result.presentationVideoName.length > 40 ? result.presentationVideoName.substring(0, 37) + '...' : result.presentationVideoName);
        
        const consistencyIndicator = result.isConsistent ? '✅ Yes' : '❌ No';
        
        log(`| ${folderNameTruncated} | ${mainVideoNameTruncated} | ${presentationVideoNameTruncated} | ${consistencyIndicator} |`);
      }
      
      // Show details for inconsistent entries
      if (inconsistentCount > 0) {
        log(`\n### Inconsistent Entries Details\n`);
        
        let counter = 1;
        for (const result of results.filter(r => !r.isConsistent)) {
          log(`#### ${counter}. Folder: ${result.folderName}\n`);
          log(`- **Folder ID**: ${result.folderId}`);
          
          if (!result.presentationId) {
            log(`- **Status**: No presentation found for this folder`);
          } else {
            log(`- **Presentation ID**: ${result.presentationId}`);
            log(`- **Main Video ID**: ${result.mainVideoId}`);
            log(`- **Main Video Name**: ${result.mainVideoName}`);
            log(`- **Presentation Video ID**: ${result.presentationVideoId}`);
            log(`- **Presentation Video Name**: ${result.presentationVideoName}`);
          }
          
          log('');
          counter++;
        }
      }
      
      // Write the report
      fs.writeFileSync(outputPath, reportContent);
      
      // Show results in console with direct process.stdout.write for guaranteed output
      process.stdout.write(`\nSUMMARY: ${results.length} folders analyzed, ${consistentCount} consistent, ${inconsistentCount} inconsistent\n`);
      process.stdout.write(`Video consistency check completed.\n`);
      process.stdout.write(`Report saved to: ${outputPath}\n`);
      
      console.log(`\nVideo consistency check completed.`);
      console.log(`\nReport saved to: ${outputPath}`);
      Logger.info(`Report saved to: ${outputPath}`);
      
    } catch (error) {
      process.stdout.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
      Logger.error('Error checking video consistency:', error);
      console.error('Error checking video consistency:', error);
      process.exit(1);
    }
  });

export default command;