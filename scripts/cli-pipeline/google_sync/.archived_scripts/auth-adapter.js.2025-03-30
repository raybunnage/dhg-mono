/**
 * Authentication adapter for CLI
 * Connects the CLI to the shared GoogleAuthService
 */

const fs = require('fs').promises;
const path = require('path');
const open = require('open');
const http = require('http');
const url = require('url');
const chalk = require('chalk');
const { OAuth2Client } = require('google-auth-library');

// This adapter would use the shared service in a real implementation
// For demonstration, we'll simulate the interface
class GoogleAuthAdapter {
  constructor(config) {
    this.config = config;
    this.tokenPath = config.google.tokenStoragePath;
    this.tokenInfo = null;
    this.tokenExpiresAt = null;
    this.client = null;
  }

  /**
   * Initialize OAuth2 client
   */
  initOAuth2Client() {
    if (!this.client) {
      this.client = new OAuth2Client(
        this.config.google.clientId,
        this.config.google.clientSecret,
        this.config.google.redirectUri
      );
    }
    return this.client;
  }

  /**
   * Load token from file
   */
  async loadToken() {
    try {
      // First check for token in environment variables
      if (process.env.VITE_GOOGLE_ACCESS_TOKEN) {
        console.log(chalk.blue('Using access token from environment variables'));
        
        // Create token info from environment variables
        this.tokenInfo = {
          access_token: process.env.VITE_GOOGLE_ACCESS_TOKEN,
          expiry_date: process.env.VITE_GOOGLE_TOKEN_EXPIRY || (Date.now() + 3600 * 1000) // Default 1 hour expiration
        };
        
        if (this.tokenInfo.expiry_date) {
          this.tokenExpiresAt = new Date(this.tokenInfo.expiry_date);
        }
        
        return this.tokenInfo;
      }
      
      // If not in environment, check file
      const data = await fs.readFile(this.tokenPath, 'utf8');
      this.tokenInfo = JSON.parse(data);
      
      if (this.tokenInfo.expiry_date) {
        this.tokenExpiresAt = new Date(this.tokenInfo.expiry_date);
      }
      
      return this.tokenInfo;
    } catch (error) {
      // File doesn't exist or is invalid, so check environment again 
      // as a fallback with less logging
      if (process.env.VITE_GOOGLE_ACCESS_TOKEN) {
        this.tokenInfo = {
          access_token: process.env.VITE_GOOGLE_ACCESS_TOKEN,
          expiry_date: process.env.VITE_GOOGLE_TOKEN_EXPIRY || (Date.now() + 3600 * 1000)
        };
        
        if (this.tokenInfo.expiry_date) {
          this.tokenExpiresAt = new Date(this.tokenInfo.expiry_date);
        }
        
        return this.tokenInfo;
      }
      
      // No token available
      return null;
    }
  }

  /**
   * Save token to file
   */
  async saveToken(token) {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.tokenPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Save token
      await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2));
      this.tokenInfo = token;
      
      if (token.expiry_date) {
        this.tokenExpiresAt = new Date(token.expiry_date);
      }
      
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to save token: ${error.message}`));
      return false;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpirationTime() {
    if (!this.tokenInfo || !this.tokenExpiresAt) {
      return {
        isValid: false,
        expiresIn: 0,
        formattedTime: 'Token not available'
      };
    }
    
    const now = new Date();
    const expiresIn = Math.floor((this.tokenExpiresAt.getTime() - now.getTime()) / 1000);
    
    if (expiresIn <= 0) {
      return {
        isValid: false,
        expiresIn: 0,
        formattedTime: 'Token expired'
      };
    }
    
    // Format time remaining
    let formattedTime;
    if (expiresIn > 3600) {
      formattedTime = `${Math.floor(expiresIn / 3600)}h ${Math.floor((expiresIn % 3600) / 60)}m`;
    } else if (expiresIn > 60) {
      formattedTime = `${Math.floor(expiresIn / 60)}m ${expiresIn % 60}s`;
    } else {
      formattedTime = `${expiresIn}s`;
    }
    
    return {
      isValid: true,
      expiresIn,
      formattedTime
    };
  }

  /**
   * Check if token is valid
   */
  async isTokenValid() {
    // Load token if not already loaded
    if (!this.tokenInfo) {
      this.tokenInfo = await this.loadToken();
      if (!this.tokenInfo) {
        return false;
      }
    }
    
    // Check expiration
    if (this.tokenExpiresAt) {
      const now = new Date();
      const isExpired = now >= this.tokenExpiresAt;
      
      // If expired but we have a refresh token, try refreshing
      if (isExpired && this.tokenInfo.refresh_token) {
        return await this.refreshToken();
      }
      
      // If not expired, validate with API call
      if (!isExpired) {
        return await this.validateTokenWithApiCall();
      }
    }
    
    return false;
  }

  /**
   * Validate token with an API call
   */
  async validateTokenWithApiCall() {
    try {
      if (!this.tokenInfo || !this.tokenInfo.access_token) {
        return false;
      }
      
      // Make a small API call to verify token
      const { google } = require('googleapis');
      
      const client = this.initOAuth2Client();
      client.setCredentials({
        access_token: this.tokenInfo.access_token
      });
      
      const drive = google.drive({ version: 'v3', auth: client });
      await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)'
      });
      
      return true;
    } catch (error) {
      console.error(chalk.red(`Token validation error: ${error.message}`));
      // Token is invalid or expired
      return false;
    }
  }

  /**
   * Refresh token
   */
  async refreshToken() {
    if (!this.tokenInfo || !this.tokenInfo.refresh_token) {
      console.log(chalk.yellow('No refresh token available'));
      return false;
    }
    
    try {
      const client = this.initOAuth2Client();
      client.setCredentials({
        refresh_token: this.tokenInfo.refresh_token
      });
      
      const response = await client.refreshAccessToken();
      const tokens = response.credentials;
      
      // Merge the new tokens with existing ones
      const updatedToken = {
        ...this.tokenInfo,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000
      };
      
      // Save updated token
      await this.saveToken(updatedToken);
      
      return true;
    } catch (error) {
      console.error(chalk.red(`Token refresh failed: ${error.message}`));
      return false;
    }
  }

  /**
   * Start OAuth2 authentication flow
   */
  async authenticate() {
    // First check if we have a valid token
    if (await this.isTokenValid()) {
      console.log(chalk.green('Already authenticated with a valid token'));
      return true;
    }
    
    // Start authentication flow
    const client = this.initOAuth2Client();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.google.scopes,
      prompt: 'consent'
    });
    
    console.log(chalk.blue('Opening browser for Google authentication...'));
    console.log(chalk.yellow('Please sign in with your Google account and authorize the application'));
    
    // Open browser for authentication
    await open(authUrl);
    
    // Wait for authentication callback
    const token = await this.waitForCallback();
    
    if (token) {
      await this.saveToken(token);
      return true;
    }
    
    return false;
  }

  /**
   * Wait for OAuth2 callback
   */
  waitForCallback() {
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/google-auth-callback') {
            // Handle authentication response
            if (parsedUrl.query.code) {
              // Exchange code for tokens
              const client = this.initOAuth2Client();
              const { tokens } = await client.getToken(parsedUrl.query.code);
              
              // Send success response
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication successful!</h1><p>You can close this window and return to the CLI.</p>');
              
              // Close server
              server.close();
              
              // Resolve with tokens
              resolve(tokens);
            } else {
              // Handle error
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed!</h1><p>Please try again.</p>');
              
              // Close server
              server.close();
              
              // Resolve with null
              resolve(null);
            }
          } else {
            // Unknown endpoint
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
          }
        } catch (error) {
          console.error(chalk.red(`Callback error: ${error.message}`));
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal server error');
          server.close();
          resolve(null);
        }
      });
      
      // Start server
      const port = new URL(this.config.google.redirectUri).port || 3000;
      server.listen(port, () => {
        console.log(chalk.blue(`Waiting for authentication callback on port ${port}...`));
      });
      
      // Set timeout
      setTimeout(() => {
        server.close();
        console.log(chalk.yellow('Authentication timed out after 5 minutes'));
        resolve(null);
      }, 5 * 60 * 1000);
    });
  }
}

module.exports = GoogleAuthAdapter;