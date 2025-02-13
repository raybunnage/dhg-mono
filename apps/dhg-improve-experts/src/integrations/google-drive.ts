import { getValidAccessToken } from '../utils/google-auth';

export async function listDriveContents(folderId: string) {
  const accessToken = await getValidAccessToken();
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents` +
      '&fields=files(id,name,mimeType,webViewLink),nextPageToken' +
      '&orderBy=folder,name desc' +
      '&pageSize=20', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.files;
  } catch (error) {
    console.error('\n Error fetching drive contents:', error);
    throw error;
  }
} 