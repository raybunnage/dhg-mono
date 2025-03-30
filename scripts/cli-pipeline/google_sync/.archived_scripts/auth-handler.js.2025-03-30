// Google authentication handler for CLI
const fs = require('fs').promises;
const open = require('open');
const http = require('http');
const url = require('url');
const chalk = require('chalk');
const dayjs = require('dayjs');
const { OAuth2Client } = require('google-auth-library');

/**
 * Class to handle Google authentication for CLI
 * Wraps the shared googleAuth functionality for command-line use
 */
class GoogleAuthHandler {
  constructor(config) {
    this.config = config;
    this.tokenPath = config.google.tokenStoragePath;
    this.client = null;
    this.token = null;
    this.expiresAt = null;
  }

  /**
   * Initialize the OAuth2 client
   * @returns {OAuth2Client} Initialized OAuth2 client
   */
  initClient() {
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
   * Load token from storage
   * @returns {Promise<Object|null>} Loaded token or null if not found
   */
  async loadToken() {
    try {
      const tokenData = await fs.readFile(this.tokenPath, 'utf8');
      this.token = JSON.parse(tokenData);
      if (this.token.expiry_date) {
        this.expiresAt = dayjs(this.token.expiry_date);
      }
      return this.token;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save token to storage
   * @param {Object} token Token to save
   * @returns {Promise<boolean>} Whether save was successful
   */
  async saveToken(token) {
    try {
      const tokenData = JSON.stringify(token);
      await fs.writeFile(this.tokenPath, tokenData, 'utf8');
      this.token = token;
      if (token.expiry_date) {
        this.expiresAt = dayjs(token.expiry_date);
      }
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to save token: ${error.message}`));
      return false;
    }
  }

  /**
   * Check if token is valid
   * @returns {Promise<boolean>} Whether token is valid
   */
  async isTokenValid() {
    // Load token if not already loaded
    if (!this.token) {
      const token = await this.loadToken();
      if (!token) return false;
    }
    
    // Check if token has expired
    if (this.expiresAt) {
      const now = dayjs();
      const isExpired = now.isAfter(this.expiresAt);
      // If expired but we have a refresh token, try refreshing
      if (isExpired && this.token.refresh_token) {
        const refreshed = await this.refreshToken();
        return refreshed;
      }
      return !isExpired;
    }
    
    return false;
  }

  /**
   * Get time until token expiration
   * @returns {Object} Time until expiration in various formats
   */
  getTokenExpirationTime() {
    if (!this.token || !this.expiresAt) {
      return {
        isValid: false,
        expiresIn: 0,
        formattedTime: 'Token not available'
      };
    }
    
    const now = dayjs();
    const expiresIn = this.expiresAt.diff(now, 'second');
    
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
   * Refresh the token
   * @returns {Promise<boolean>} Whether refresh was successful
   */
  async refreshToken() {
    if (!this.token || !this.token.refresh_token) {
      console.log(chalk.yellow('No refresh token available'));
      return false;
    }
    
    try {
      const client = this.initClient();
      client.setCredentials({ refresh_token: this.token.refresh_token });
      
      const response = await client.refreshAccessToken();
      const tokens = response.credentials;
      
      // Save the new tokens
      await this.saveToken({
        ...this.token,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date
      });
      
      console.log(chalk.green('Token refreshed successfully'));
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to refresh token: ${error.message}`));
      return false;
    }
  }

  /**
   * Start the authentication flow
   * @returns {Promise<boolean>} Whether authentication was successful
   */
  async authenticate() {
    // First check if we already have a valid token
    if (await this.isTokenValid()) {
      console.log(chalk.green('Already authenticated with a valid token'));
      return true;
    }
    
    // Start authentication flow
    const client = this.initClient();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.google.scopes,
      prompt: 'consent'
    });
    
    console.log(chalk.blue('Opening browser for authentication...'));
    console.log(chalk.yellow('Please sign in to your Google account and authorize the application'));
    
    // Open browser for authentication
    await open(authUrl);
    
    // Create local server to receive the callback
    const token = await this.waitForCallback();
    
    if (token) {
      await this.saveToken(token);
      console.log(chalk.green('Authentication successful'));
      return true;
    } else {
      console.log(chalk.red('Authentication failed'));
      return false;
    }
  }

  /**
   * Wait for the authentication callback
   * @returns {Promise<Object|null>} The OAuth token or null if failed
   */
  waitForCallback() {
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/google-auth-callback') {
            // Handle authentication response
            if (parsedUrl.query.code) {
              // Exchange the code for tokens
              const client = this.initClient();
              const { tokens } = await client.getToken(parsedUrl.query.code);
              
              // Send success response
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication successful!</h1><p>You can close this window and return to the CLI.</p>');
              
              // Close the server
              server.close();
              
              // Resolve with the tokens
              resolve(tokens);
            } else {
              // Handle error
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed!</h1><p>Please try again.</p>');
              
              // Close the server
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
      
      // Start the server
      const port = new URL(this.config.google.redirectUri).port || 3000;
      server.listen(port, () => {
        console.log(chalk.blue(`Waiting for authentication callback on port ${port}...`));
      });
      
      // Set a timeout
      setTimeout(() => {
        server.close();
        console.log(chalk.yellow('Authentication timed out after 5 minutes'));
        resolve(null);
      }, 5 * 60 * 1000);
    });
  }
}

module.exports = GoogleAuthHandler;