import { drive_v3 } from '@googleapis/drive';

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export async function listDriveContents(folderId = FOLDER_ID): Promise<DriveItem[]> {
  console.log('Starting listDriveContents...');
  
  try {
    const drive = new drive_v3.Drive({
      auth: import.meta.env.VITE_GOOGLE_ACCESS_TOKEN
    });

    console.log('Drive client created');

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
      orderBy: 'name'
    });

    console.log('Drive response:', {
      filesCount: response.data.files?.length,
      firstFile: response.data.files?.[0]
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Detailed error in listDriveContents:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
} 