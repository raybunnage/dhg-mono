"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var path = require("path");
var fs = require("fs");
var logger_1 = require("./logger");
// Try to load environment variables from various files
var envFiles = ['.env', '.env.local', '.env.development'];
// Create a function to load environment variables
function loadEnvFiles() {
    for (var _i = 0, envFiles_1 = envFiles; _i < envFiles_1.length; _i++) {
        var file = envFiles_1[_i];
        var filePath = path.resolve(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            console.log("Loading environment variables from ".concat(filePath));
            var result = dotenv.config({ path: filePath });
            if (result.error) {
                console.error("Error loading ".concat(filePath, ":"), result.error);
            }
        }
    }
}
// Load environment variables
loadEnvFiles();
/**
 * Configuration object with environment variables
 */
var config = {
    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',
    // Supabase
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    // Claude API
    claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    claudeApiBaseUrl: process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com',
    claudeApiVersion: process.env.CLAUDE_API_VERSION || '2023-06-01',
    defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-7-sonnet-20250219',
    // Logging
    logLevel: process.env.LOG_LEVEL || logger_1.LogLevel.INFO,
};
exports.default = config;
