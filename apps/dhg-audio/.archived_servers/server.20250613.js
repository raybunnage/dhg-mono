// This file uses CommonJS syntax (not ES modules)
const express = require('express');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const cors = require('./cors-middleware');

const app = express();
const PORT = process.env.AUDIO_PROXY_PORT || process.env.PORT || 3006;

// Apply CORS middleware
app.use(cors);

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Health check endpoint for server registry
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'web-google-drive-audio',
    timestamp: new Date().toISOString()
  });
});

// Function to get Google Drive service account credentials
function getGoogleAuthClient() {
  try {
    // Try different paths for the service account key file
    const possiblePaths = [
      path.resolve(__dirname, '.service-account.json'),
      path.resolve(__dirname, '../../.service-account.json'),
      path.resolve(__dirname, '../../../.service-account.json'),
      process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ];

    let keyFilePath = null;
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        keyFilePath = p;
        break;
      }
    }

    if (!keyFilePath) {
      throw new Error('Google service account key file not found');
    }

    console.log(`Using service account key file: ${keyFilePath}`);
    
    // Read and parse the service account key file
    const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
    const keyFile = JSON.parse(keyFileData);
    
    // Create JWT auth client with the service account
    const authClient = new JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    return authClient;
  } catch (error) {
    console.error('Error setting up Google auth client:', error);
    throw error;
  }
}

// Audio proxy endpoint
app.get('/api/audio/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  
  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }
  
  console.log(`[${new Date().toISOString()}] Proxying audio file: ${fileId}`);
  
  try {
    // Get Google auth client
    const authClient = getGoogleAuthClient();
    
    // Initialize Google Drive API
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    // Get file metadata to set proper content type
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType,size'
    });
    
    const fileName = fileMetadata.data.name;
    const mimeType = fileMetadata.data.mimeType;
    const fileSize = fileMetadata.data.size;
    
    console.log(`File info: ${fileName}, ${mimeType}, ${fileSize} bytes`);
    
    // Set response headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('X-Served-From', 'google-drive-api'); // Indicate source for debugging
    
    // If range header is present, handle partial content request
    if (req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : parseInt(fileSize) - 1;
      const chunkSize = (end - start) + 1;
      
      console.log(`Range request: ${start}-${end}/${fileSize}`);
      
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      res.status(206);
      
      // Get the file with range
      const response = await drive.files.get({
        fileId: fileId,
        alt: 'media',
        headers: {
          Range: `bytes=${start}-${end}`
        }
      }, { responseType: 'stream' });
      
      // Pipe the response
      response.data.pipe(res);
    } else {
      // Full file request
      res.setHeader('Content-Length', fileSize);
      
      // Stream the file
      const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });
      
      // Pipe the response
      response.data.pipe(res);
    }
  } catch (error) {
    console.error('[ERROR] Error proxying audio file:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response data'
    });
    
    if (error.message && error.message.includes('service account key file not found')) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Google service account key file not found. Please ensure .service-account.json exists in the project root.',
        details: error.message
      });
    }
    
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ 
        error: 'File not found',
        message: `Google Drive file with ID ${fileId} not found or not accessible`
      });
    }
    
    if (error.response && error.response.status === 403) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Service account does not have permission to access this file'
      });
    }
    
    res.status(500).json({ 
      error: 'Error fetching audio file',
      message: error.message || 'Unknown error occurred',
      fileId: fileId
    });
  }
});

// SPA fallback - Serve index.html for any other requests
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Audio proxy available at: http://localhost:${PORT}/api/audio/:fileId`);
});