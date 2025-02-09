import mammoth from 'mammoth';
import { initPdfJs } from './pdf-utils';

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export async function listDriveContents(
  folderId = FOLDER_ID, 
  pageSize = 20,
  pageToken?: string
): Promise<{ files: DriveItem[], nextPageToken?: string }> {
  console.log('Starting listDriveContents...');
  
  try {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', `'${folderId}' in parents and trashed=false`);
    url.searchParams.append('fields', 'files(id,name,mimeType,webViewLink),nextPageToken');
    url.searchParams.append('orderBy', 'folder,name desc');
    url.searchParams.append('pageSize', pageSize.toString());
    if (pageToken) {
      url.searchParams.append('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      files: data.files || [],
      nextPageToken: data.nextPageToken
    };
  } catch (error) {
    console.error('Error fetching drive contents:', error);
    throw error;
  }
}

export async function getFileContent(fileId: string): Promise<string> {
  try {
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
        }
      }
    );

    if (!metadataResponse.ok) {
      throw new Error('Could not get file type');
    }

    const { mimeType } = await metadataResponse.json();

    // Handle different file types
    if (mimeType.includes('google-apps')) {
      // Google Docs handling...
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
          }
        }
      );

      if (!exportResponse.ok) {
        throw new Error('Could not export Google Doc');
      }

      return exportResponse.text();
    } else if (mimeType.includes('officedocument')) {
      // Word docs handling...
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
          }
        }
      );

      if (!downloadResponse.ok) {
        throw new Error('Could not download Office document');
      }

      const buffer = await downloadResponse.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    } else if (mimeType === 'application/pdf') {
      // PDF handling
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
          }
        }
      );

      if (!downloadResponse.ok) {
        throw new Error('Could not download PDF');
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();
      const pdfjs = await initPdfJs();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      return fullText;
    } else {
      // Other files - try direct text download
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_GOOGLE_ACCESS_TOKEN}`,
          }
        }
      );

      if (!downloadResponse.ok) {
        throw new Error('Could not read file content');
      }

      return downloadResponse.text();
    }
  } catch (error) {
    console.error('Error details:', error);
    throw new Error('Failed to load file content');
  }
} 