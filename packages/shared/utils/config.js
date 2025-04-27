"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("./logger");
// Try to load environment variables from various files
const envFiles = ['.env', '.env.local', '.env.development'];
// Create a function to load environment variables
function loadEnvFiles() {
    for (const file of envFiles) {
        const filePath = path.resolve(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            console.log(`Loading environment variables from ${filePath}`);
            const result = dotenv.config({ path: filePath });
            if (result.error) {
                console.error(`Error loading ${filePath}:`, result.error);
            }
        }
    }
}
// Load environment variables
loadEnvFiles();
/**
 * Configuration object with environment variables
 */
const config = {
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
