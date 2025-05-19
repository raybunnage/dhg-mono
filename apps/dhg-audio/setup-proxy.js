/**
 * Setup script for audio proxy server
 * This script:
 * 1. Checks for service account credentials and copies them if needed
 * 2. Creates necessary directories
 */
const fs = require('fs');
const path = require('path');

console.log('Setting up audio proxy server...');

// Check if .service-account.json exists in the app directory
const appDir = __dirname;
const rootDir = path.resolve(appDir, '../..');
const appServiceAccountPath = path.join(appDir, '.service-account.json');
const rootServiceAccountPath = path.join(rootDir, '.service-account.json');

// Create dist directory if it doesn't exist
const distDir = path.join(appDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.log('Creating dist directory...');
  fs.mkdirSync(distDir, { recursive: true });
}

// Check if service account file exists in root but not in app directory
if (!fs.existsSync(appServiceAccountPath) && fs.existsSync(rootServiceAccountPath)) {
  console.log('Copying service account file from root to app directory...');
  try {
    fs.copyFileSync(rootServiceAccountPath, appServiceAccountPath);
    console.log('Service account file copied successfully.');
  } catch (error) {
    console.error('Error copying service account file:', error);
  }
}

// Check if service account file exists now
if (fs.existsSync(appServiceAccountPath)) {
  console.log('Service account file found at:', appServiceAccountPath);
} else if (fs.existsSync(rootServiceAccountPath)) {
  console.log('Service account file found at:', rootServiceAccountPath);
  console.log('Using the file from root directory.');
} else {
  console.warn('Warning: No service account file found. Audio proxy may not function correctly.');
  console.warn('Please ensure .service-account.json exists in the project root or app directory.');
}

console.log('Setup complete!');