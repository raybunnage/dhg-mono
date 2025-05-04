// Configuration helper for Google Drive CLI
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Default configuration values
 */
const defaultConfig = {
  // Google Drive API settings
  google: {
    tokenStoragePath: path.join(os.homedir(), '.google_sync_token.json'),
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ],
    refreshTokenUrl: 'https://oauth2.googleapis.com/token',
    authUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    redirectUri: 'http://localhost:3000/google-auth-callback'
  },
  
  // Supabase settings
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageTableName: 'sources_google'
  },
  
  // Sync options
  sync: {
    batchSize: 50,
    maxDepth: 10,
    concurrentRequests: 5,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    fileSizeLimit: 100 * 1024 * 1024, // 100MB
  },
  
  // Content extraction options
  extraction: {
    outputDir: path.join(process.cwd(), 'extracted_content'),
    supportedTypes: [
      'application/pdf',
      'application/vnd.google-apps.document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/html'
    ]
  },
  
  // Audio extraction options
  audio: {
    outputDir: path.join(process.cwd(), 'extracted_audio'),
    format: 'mp3',
    channels: 2,
    bitrate: '128k',
    supportedTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/wav',
      'video/mp4',
      'video/quicktime'
    ]
  },
  
  // CLI options
  cli: {
    colors: true,
    verbose: false,
    logLevel: 'info'
  }
};

/**
 * Load configuration from file
 * @param {string} configPath Path to config file
 * @returns {Object} Loaded configuration
 */
function loadConfig(configPath) {
  const userConfigPath = configPath || path.join(os.homedir(), '.google_sync_config.json');
  
  let userConfig = {};
  
  try {
    if (fs.existsSync(userConfigPath)) {
      const configData = fs.readFileSync(userConfigPath, 'utf8');
      userConfig = JSON.parse(configData);
      console.log(`Loaded configuration from ${userConfigPath}`);
    }
  } catch (error) {
    console.warn(`Failed to load config from ${userConfigPath}: ${error.message}`);
  }
  
  // Merge with default config, user config takes precedence
  return mergeConfigs(defaultConfig, userConfig);
}

/**
 * Deeply merge two configuration objects
 * @param {Object} target Target object
 * @param {Object} source Source object
 * @returns {Object} Merged configuration
 */
function mergeConfigs(target, source) {
  const result = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(result, { [key]: source[key] });
        } else {
          result[key] = mergeConfigs(target[key], source[key]);
        }
      } else {
        Object.assign(result, { [key]: source[key] });
      }
    });
  }
  
  return result;
}

/**
 * Check if value is an object
 * @param {*} item Value to check
 * @returns {boolean} Whether the value is an object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Save configuration to file
 * @param {Object} config Configuration to save
 * @param {string} configPath Path to save config to
 * @returns {boolean} Whether save was successful
 */
function saveConfig(config, configPath) {
  const userConfigPath = configPath || path.join(os.homedir(), '.google_sync_config.json');
  
  try {
    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(userConfigPath, configData, 'utf8');
    console.log(`Saved configuration to ${userConfigPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to save config to ${userConfigPath}: ${error.message}`);
    return false;
  }
}

module.exports = {
  defaultConfig,
  loadConfig,
  saveConfig,
  mergeConfigs
};