// Direct metadata query script
import { GoogleDriveService } from './scripts/cli-pipeline/google_sync/services/google-drive-service';

async function fetchMetadata() {
  const fileId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
  
  try {
    // Initialize Google Drive Service
    const driveService = await GoogleDriveService.initialize();
    
    // Get file metadata with all fields
    console.log(`Fetching complete metadata for: ${fileId}`);
    const fileInfo = await driveService.getFileInfo(fileId);
    
    console.log(JSON.stringify(fileInfo, null, 2));
  } catch (error) {
    console.error('Error fetching metadata:', error);
  }
}

fetchMetadata();
