import { GoogleAuthService } from './GoogleAuthService';
import { TokenStorageAdapter, GoogleAuthToken } from './types';

// Simple in-memory storage for benchmarking
class BenchmarkStorageAdapter implements TokenStorageAdapter {
  private token: GoogleAuthToken | null = null;

  async saveToken(token: GoogleAuthToken): Promise<boolean> {
    this.token = token;
    return true;
  }

  async loadToken(): Promise<GoogleAuthToken | null> {
    return this.token;
  }

  async clearToken(): Promise<boolean> {
    this.token = null;
    return true;
  }
}

/**
 * Benchmark GoogleAuthService performance
 */
async function benchmark() {
  console.log('🚀 Starting GoogleAuthService benchmark...\n');
  
  const storage = new BenchmarkStorageAdapter();
  const config = {
    clientId: process.env.GOOGLE_CLIENT_ID || 'benchmark-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'benchmark-secret',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  };
  
  const service = GoogleAuthService.getInstance(config, storage);
  
  try {
    // Health Check
    console.log('📊 Testing health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    console.log(`  Authentication method: ${health.details.authenticationMethod}`);
    console.log(`  Has valid token: ${health.details.hasValidToken}`);
    
    // Check service account status
    console.log('\n📊 Testing authentication status...');
    const authStatusStart = Date.now();
    const isUsingServiceAccount = service.isUsingServiceAccount();
    const authStatusDuration = Date.now() - authStatusStart;
    console.log(`✓ Auth status check: ${authStatusDuration}ms`);
    console.log(`  Using service account: ${isUsingServiceAccount}`);
    
    // Test OAuth flow (if not using service account)
    if (!isUsingServiceAccount) {
      console.log('\n📊 Testing OAuth operations...');
      
      // Generate auth URL
      const urlStart = Date.now();
      const authUrl = service.generateAuthUrl();
      const urlDuration = Date.now() - urlStart;
      console.log(`✓ Generate auth URL: ${urlDuration}ms`);
      console.log(`  URL length: ${authUrl.length} characters`);
      
      // Save a mock token
      console.log('\n📊 Testing token operations...');
      const mockToken: GoogleAuthToken = {
        access_token: 'benchmark-access-token',
        refresh_token: 'benchmark-refresh-token',
        scope: config.scopes.join(' '),
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000 // 1 hour
      };
      
      // Save token
      const saveStart = Date.now();
      const saved = await service.saveToken(mockToken);
      const saveDuration = Date.now() - saveStart;
      console.log(`✓ Save token: ${saveDuration}ms (success: ${saved})`);
      
      // Load token
      const loadStart = Date.now();
      const loadedToken = await service.loadToken();
      const loadDuration = Date.now() - loadStart;
      console.log(`✓ Load token: ${loadDuration}ms (found: ${!!loadedToken})`);
      
      // Check token validity
      const validityStart = Date.now();
      const isValid = await service.hasValidToken();
      const validityDuration = Date.now() - validityStart;
      console.log(`✓ Check token validity: ${validityDuration}ms (valid: ${isValid})`);
      
      // Get access token
      const accessStart = Date.now();
      const accessToken = await service.getAccessToken();
      const accessDuration = Date.now() - accessStart;
      console.log(`✓ Get access token: ${accessDuration}ms (found: ${!!accessToken})`);
      
      // Token expiration info
      const expirationStart = Date.now();
      const expiration = service.getTokenExpirationTime();
      const expirationDuration = Date.now() - expirationStart;
      console.log(`✓ Get token expiration: ${expirationDuration}ms`);
      console.log(`  Valid: ${expiration.isValid}`);
      console.log(`  Expires in: ${expiration.formattedTime}`);
      
      // Refresh token
      const refreshStart = Date.now();
      const refreshed = await service.refreshToken();
      const refreshDuration = Date.now() - refreshStart;
      console.log(`✓ Refresh token: ${refreshDuration}ms (success: ${refreshed})`);
      
      // Clear token
      const clearStart = Date.now();
      const cleared = await service.clearToken();
      const clearDuration = Date.now() - clearStart;
      console.log(`✓ Clear token: ${clearDuration}ms (success: ${cleared})`);
    } else {
      console.log('\n📊 Testing service account operations...');
      
      // Get access token (service account)
      const accessStart = Date.now();
      const accessToken = await service.getAccessToken();
      const accessDuration = Date.now() - accessStart;
      console.log(`✓ Get access token: ${accessDuration}ms (found: ${!!accessToken})`);
      
      // Token expiration info (service account)
      const expirationStart = Date.now();
      const expiration = service.getTokenExpirationTime();
      const expirationDuration = Date.now() - expirationStart;
      console.log(`✓ Get token expiration: ${expirationDuration}ms`);
      console.log(`  Info: ${expiration.formattedTime}`);
      
      // Refresh (service account)
      const refreshStart = Date.now();
      const refreshed = await service.refreshToken();
      const refreshDuration = Date.now() - refreshStart;
      console.log(`✓ Refresh credentials: ${refreshDuration}ms (success: ${refreshed})`);
    }
    
    // Test multiple rapid access token requests
    console.log('\n📊 Testing rapid access token requests...');
    const rapidStart = Date.now();
    const rapidRequests = 10;
    for (let i = 0; i < rapidRequests; i++) {
      await service.getAccessToken();
    }
    const rapidDuration = Date.now() - rapidStart;
    console.log(`✓ ${rapidRequests} rapid requests: ${rapidDuration}ms (${(rapidDuration / rapidRequests).toFixed(2)}ms avg)`);
    
    // Display metrics
    console.log('\n📈 Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Auth attempts: ${metrics.authAttempts}`);
    console.log(`  Auth successes: ${metrics.authSuccesses}`);
    console.log(`  Auth failures: ${metrics.authFailures}`);
    console.log(`  Token refreshes: ${metrics.tokenRefreshes}`);
    console.log(`  Storage operations: ${metrics.storageOperations}`);
    console.log(`  Access token requests: ${metrics.accessTokenRequests}`);
    console.log(`  Service account used: ${metrics.serviceAccountUsed}`);
    console.log(`  OAuth used: ${metrics.oauthUsed}`);
    console.log(`  Errors: ${metrics.errors}`);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  benchmark().catch(console.error);
}

export { benchmark };