// document-pipeline-runner.ts
// This script imports the document pipeline service and runs the requested function

import { documentPipelineService } from './scripts/cli-pipeline/document/document-pipeline-service';

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'sync':
        const syncResult = await documentPipelineService.syncFiles();
        console.log(`Sync result: ${syncResult ? '✅ Success' : '❌ Failed'}`);
        process.exit(syncResult ? 0 : 1);
        break;
        
      case 'find-new':
        const newFiles = await documentPipelineService.findNewFiles();
        console.log(`Find new files result: Added ${newFiles.added} files with ${newFiles.errors} errors`);
        process.exit(newFiles.errors === 0 ? 0 : 1);
        break;
        
      case 'show-untyped':
        const untypedResult = await documentPipelineService.showUntypedFiles();
        process.exit(untypedResult ? 0 : 1);
        break;
        
      case 'show-recent':
        const recentResult = await documentPipelineService.showRecentFiles();
        process.exit(recentResult ? 0 : 1);
        break;
        
      case 'classify-recent':
        const count = parseInt(args[1] || '10', 10);
        const classifyResult = await documentPipelineService.classifyDocuments(count, false);
        console.log(`Classify recent result: ${classifyResult ? '✅ Success' : '❌ Failed'}`);
        process.exit(classifyResult ? 0 : 1);
        break;
        
      case 'classify-untyped':
        const untypedCount = parseInt(args[1] || '10', 10);
        const classifyUntypedResult = await documentPipelineService.classifyDocuments(untypedCount, true);
        console.log(`Classify untyped result: ${classifyUntypedResult ? '✅ Success' : '❌ Failed'}`);
        process.exit(classifyUntypedResult ? 0 : 1);
        break;
        
      case 'generate-summary':
        const summaryCount = args[1] === 'all' ? -1 : parseInt(args[1] || '50', 10);
        const summaryResult = await documentPipelineService.generateSummary(summaryCount);
        console.log(`Generate summary result: ${summaryResult ? '✅ Success' : '❌ Failed'}`);
        process.exit(summaryResult ? 0 : 1);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands:');
        console.log('  sync                      - Synchronize database with files on disk');
        console.log('  find-new                  - Find and insert new files on disk into the database');
        console.log('  show-untyped              - Show all documentation files without a document type');
        console.log('  show-recent               - Show the 20 most recent files based on update date');
        console.log('  classify-recent [n]       - Classify the n most recent files (default: 10)');
        console.log('  classify-untyped [n]      - Classify untyped files (default: 10)');
        console.log('  generate-summary [n]      - Generate a summary report of documents (default: 50, use "all" for all docs)');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error executing command:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
