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
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink)&orderBy=name`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Drive response:', {
      filesCount: data.files?.length,
      firstFile: data.files?.[0]
    });

    return data.files || [];
  } catch (error) {
    console.error('Error fetching drive contents:', error);
    throw error;
  }
}

export async function getFileContent(fileId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const content = await response.text();
    return content;
  } catch (error) {
    console.error('Error fetching file content:', error);
    throw error;
  }
} 