import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';
import { defaultGoogleAuth } from './packages/shared/services/google-drive';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });

const FILE_ID = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';

async function initDriveClient() {
  try {
    // First try to get a token from the centralized auth service
    console.log('🔍 Using centralized Google Auth Service...');
    
    // Check if auth service is ready
    const isReady = await defaultGoogleAuth.isReady();
    if (isReady) {
      // Get access token
      const accessToken = await defaultGoogleAuth.getAccessToken();
      
      if (accessToken) {
        console.log('✅ Successfully obtained token from centralized auth service');
        
        // Create auth using the OAuth2 client
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: accessToken
        });
        
        // Initialize the Drive client
        return google.drive({ version: 'v3', auth });
      }
    }
    
    // Fallback to direct service account initialization
    console.log('⚠️ Falling back to direct service account...');
    
    // Get service account key file path from environment or use default
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                        './.service-account.json';
    
    console.log(`🔑 Using service account key file: ${keyFilePath}`);
    
    // Check if file exists
    if (\!fs.existsSync(keyFilePath)) {
      console.error(`❌ Service account key file not found: ${keyFilePath}`);
      return null;
    }
    
    // Read and parse the service account key file
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    
    // Create JWT auth client with the service account
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    // Initialize the Drive client
    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('❌ Error initializing Drive client:', error);
    return null;
  }
}

async function getFileInfo() {
  try {
    const drive = await initDriveClient();
    if (\!drive) {
      console.error('Failed to initialize Drive client');
      process.exit(1);
    }
    
    console.log(`Getting file info for: ${FILE_ID}`);
    
    // Get ALL fields for the file
    const fileData = await drive.files.get({
      fileId: FILE_ID,
      fields: '*'  // Get all available fields
    });
    
    console.log('File metadata:');
    console.log(JSON.stringify(fileData.data, null, 2));
    
    return fileData.data;
  } catch (error) {
    console.error('Error getting file info:', error);
    return null;
  }
}

// Run the function
getFileInfo().catch(console.error);
