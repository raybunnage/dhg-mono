// Enhanced audio server with local Google Drive support
const express = require('express');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('./cors-middleware');

// Import Supabase client for database queries
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const dotenv = require('dotenv');
// Try to load from .env.development first, then .env
const envPath = fs.existsSync(path.join(__dirname, '../../.env.development')) 
  ? path.join(__dirname, '../../.env.development')
  : path.join(__dirname, '../../.env');
  
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
}

const app = express();
const PORT = process.env.AUDIO_PROXY_PORT || process.env.PORT || 3006;

// Apply CORS middleware
app.use(cors);

// Add JSON body parser for health check endpoint
app.use(express.json());

// Serve static files from the 'dist' directory (if it exists)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Initialize Supabase client
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized for local file lookup');
  } else {
    console.warn('Supabase credentials not found - local file lookup disabled');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

// Common Google Drive local paths
const GOOGLE_DRIVE_PATHS = [
  // macOS paths
  path.join(os.homedir(), 'Google Drive'),
  path.join(os.homedir(), 'Library/CloudStorage/GoogleDrive-*'),
  path.join(os.homedir(), 'My Drive'),
  // Windows paths
  path.join(os.homedir(), 'Google Drive'),
  path.join('G:', 'My Drive'),
  // Linux paths
  path.join(os.homedir(), 'GoogleDrive'),
];

// Cache for Google Drive base path
let googleDriveBasePath = null;

// Function to find Google Drive base path
function findGoogleDriveBasePath() {
  if (googleDriveBasePath) {
    return googleDriveBasePath;
  }

  // Check standard paths
  for (const basePath of GOOGLE_DRIVE_PATHS) {
    // Handle glob patterns (for macOS CloudStorage)
    if (basePath.includes('*')) {
      const glob = require('glob');
      const matches = glob.sync(basePath);
      if (matches.length > 0 && fs.existsSync(matches[0])) {
        googleDriveBasePath = matches[0];
        console.log(`Found Google Drive at: ${googleDriveBasePath}`);
        return googleDriveBasePath;
      }
    } else if (fs.existsSync(basePath)) {
      googleDriveBasePath = basePath;
      console.log(`Found Google Drive at: ${googleDriveBasePath}`);
      return googleDriveBasePath;
    }
  }

  // Check environment variable
  if (process.env.GOOGLE_DRIVE_PATH && fs.existsSync(process.env.GOOGLE_DRIVE_PATH)) {
    googleDriveBasePath = process.env.GOOGLE_DRIVE_PATH;
    console.log(`Found Google Drive from env at: ${googleDriveBasePath}`);
    return googleDriveBasePath;
  }

  console.warn('Google Drive local folder not found');
  return null;
}

// Function to get local file path from database
async function getLocalFilePath(fileId) {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('google_sources')
      .select('path, drive_id, name')
      .eq('drive_id', fileId)
      .single();

    if (error || !data || !data.path) {
      console.log(`No path found in database for file ID: ${fileId}`);
      return null;
    }

    console.log(`Database path for ${fileId}: ${data.path}`);
    return data.path;
  } catch (error) {
    console.error('Error querying database:', error);
    return null;
  }
}

// Function to check if file exists locally
async function checkLocalFile(fileId) {
  const basePath = findGoogleDriveBasePath();
  if (!basePath) {
    return null;
  }

  // Get the file path from database
  const relativePath = await getLocalFilePath(fileId);
  if (!relativePath) {
    return null;
  }

  // Construct full local path
  const fullPath = path.join(basePath, relativePath);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Found local file: ${fullPath}`);
    
    // Get file stats
    const stats = fs.statSync(fullPath);
    
    // Determine mime type from extension
    const ext = path.extname(fullPath).toLowerCase();
    let mimeType = 'audio/mpeg'; // default
    if (ext === '.m4a') mimeType = 'audio/mp4';
    else if (ext === '.mp3') mimeType = 'audio/mpeg';
    else if (ext === '.wav') mimeType = 'audio/wav';
    else if (ext === '.ogg') mimeType = 'audio/ogg';
    
    return {
      path: fullPath,
      name: path.basename(fullPath),
      mimeType: mimeType,
      size: stats.size
    };
  }

  console.log(`Local file not found: ${fullPath}`);
  return null;
}

// Note: Health endpoints removed from app servers - use CLI health-check commands instead

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'audio-proxy-server',
    port: PORT,
    timestamp: new Date().toISOString(),
    localGoogleDriveEnabled: findGoogleDriveBasePath() !== null,
    supabaseConnected: supabase !== null
  });
});

// Enhanced audio proxy endpoint with local file support
app.get('/api/audio/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  
  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }
  
  console.log(`[${new Date().toISOString()}] Proxying audio file: ${fileId}`);
  
  try {
    // First, check if file exists locally
    const localFile = await checkLocalFile(fileId);
    
    if (localFile) {
      console.log(`Serving from local Google Drive: ${localFile.name}`);
      
      // Set response headers
      res.setHeader('Content-Type', localFile.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${localFile.name}"`);
      res.setHeader('X-Served-From', 'local-google-drive');
      
      // Handle range requests for local files
      if (req.headers.range) {
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : localFile.size - 1;
        const chunkSize = (end - start) + 1;
        
        console.log(`Range request: ${start}-${end}/${localFile.size}`);
        
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Range', `bytes ${start}-${end}/${localFile.size}`);
        res.setHeader('Content-Length', chunkSize);
        res.status(206);
        
        // Create read stream with range
        const stream = fs.createReadStream(localFile.path, {
          start: start,
          end: end
        });
        
        stream.pipe(res);
      } else {
        // Full file request
        res.setHeader('Content-Length', localFile.size);
        
        // Stream the local file
        const stream = fs.createReadStream(localFile.path);
        stream.pipe(res);
      }
      
      return; // Exit early - we served from local
    }
    
    // Fall back to Google Drive API if local file not found
    console.log('Local file not found, falling back to Google Drive API');
    res.setHeader('X-Served-From', 'google-drive-api');
    
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
    let mimeType = fileMetadata.data.mimeType;
    const fileSize = fileMetadata.data.size;
    
    // Fix MIME type for browser compatibility
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.m4a' && mimeType === 'audio/x-m4a') {
      mimeType = 'audio/mp4'; // Browsers prefer audio/mp4 for M4A files
    }
    
    console.log(`File info: ${fileName}, ${mimeType}, ${fileSize} bytes`);
    
    // Set response headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
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

// Stats endpoint to check performance
app.get('/api/stats', (_, res) => {
  res.json({
    localGoogleDriveEnabled: googleDriveBasePath !== null,
    googleDrivePath: googleDriveBasePath,
    supabaseConnected: supabase !== null,
    platform: os.platform(),
    homedir: os.homedir()
  });
});

// SPA fallback - Serve index.html for any other requests (if dist exists)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If no dist folder, just return a simple message
    res.json({ 
      message: 'Audio proxy server',
      endpoints: {
        audio: '/api/audio/:fileId',
        stats: '/api/stats',
        health: '/health'
      }
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Enhanced Audio Server running on port ${PORT}`);
  console.log(`Audio proxy available at: http://localhost:${PORT}/api/audio/:fileId`);
  
  // Check for local Google Drive on startup
  const gdPath = findGoogleDriveBasePath();
  if (gdPath) {
    console.log(`✓ Local Google Drive support enabled: ${gdPath}`);
  } else {
    console.log(`✗ Local Google Drive not found - using API only`);
  }
  
  if (supabase) {
    console.log(`✓ Database connection enabled for path lookup`);
  } else {
    console.log(`✗ Database connection not available - local lookup disabled`);
  }
});