#\!/usr/bin/env node

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const FILE_ID = '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';
const CREDENTIALS_PATH = './.service-account.json';

async function getFileMetadata() {
  try {
    // Load service account credentials
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    
    // Create JWT client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/drive']
    );
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth });
    
    // Get file metadata
    console.log(`Fetching metadata for file ID: ${FILE_ID}`);
    const response = await drive.files.get({
      fileId: FILE_ID,
      fields: '*' // Get all available fields
    });
    
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching file metadata:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

getFileMetadata();
