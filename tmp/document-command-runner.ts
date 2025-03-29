import { documentService } from '../scripts/cli-pipeline/document/standalone-document-service';

async function main() {
  try {
    switch('show-recent') {
      case 'test-connection':
        await documentService.testConnection();
        break;
      case 'show-recent':
        await documentService.showRecentFiles(5);
        break;
      default:
        console.error('Unknown command: show-recent');
        process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error executing command:', error);
    process.exit(1);
  }
}

main();
