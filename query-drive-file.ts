import { GoogleDriveService } from './packages/shared/services/google-drive';

async function main() {
  const driveId = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
  const driveService = GoogleDriveService.getInstance();
  
  console.log(`Querying Google Drive API for file with drive_id: ${driveId}`);
  
  try {
    // Get file metadata directly from Google Drive
    const fileMetadata = await driveService.getFile(driveId, { fields: '*' });
    console.log('Direct File Metadata:', JSON.stringify(fileMetadata, null, 2));
  } catch (error) {
    console.error('Error querying Google Drive:', error);
  }
}

main().catch(console.error);
