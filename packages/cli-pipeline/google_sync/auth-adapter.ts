/**
 * Authentication adapter for CLI
 * Connects the CLI to the shared GoogleAuthService
 */

import { defaultGoogleAuth } from '../../shared/services/google-drive';
import chalk from 'chalk';

/**
 * This adapter connects the CLI to the shared GoogleAuthService
 * It provides an interface compatible with the older auth-adapter.js
 * while delegating all functionality to the centralized GoogleAuthService
 */
class GoogleAuthCliAdapter {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Check if the service is ready and authenticated
   */
  async isReady(): Promise<boolean> {
    return defaultGoogleAuth.isReady();
  }

  /**
   * Get token expiration time in various formats
   */
  async getTokenExpirationTime() {
    return defaultGoogleAuth.getTokenExpirationTime();
  }

  /**
   * Check if a valid token exists
   */
  async isTokenValid(): Promise<boolean> {
    try {
      const token = await defaultGoogleAuth.getAccessToken();
      return !!token;
    } catch (error) {
      console.error(chalk.red(`Token validation error: ${error}`));
      return false;
    }
  }

  /**
   * Get the access token for API requests
   */
  async getAccessToken(): Promise<string | null> {
    return defaultGoogleAuth.getAccessToken();
  }

  /**
   * Start the authentication process if needed
   */
  async authenticate(): Promise<boolean> {
    try {
      // First check if we already have a valid token
      if (await this.isTokenValid()) {
        console.log(chalk.green('Already authenticated with a valid token'));
        return true;
      }

      // If we don't have a valid token yet, log that we're initializing 
      // (the service will attempt authentication internally)
      console.log(chalk.blue('Attempting to authenticate with Google...'));
      await defaultGoogleAuth.isReady(); // This triggers authentication if needed
      
      // Check again if we have a token now
      const token = await defaultGoogleAuth.getAccessToken();
      
      if (token) {
        console.log(chalk.green('Authentication successful'));
        return true;
      } else {
        console.log(chalk.red('Authentication failed - no token available'));
        return false;
      }
    } catch (error) {
      console.error(chalk.red(`Authentication error: ${error}`));
      return false;
    }
  }
}

export default GoogleAuthCliAdapter;