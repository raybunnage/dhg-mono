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
exports.SupabaseClientService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const utils_1 = require("../utils");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Singleton class to manage Supabase client instance
 */
class SupabaseClientService {
    constructor() {
        this.client = null;
        this.supabaseUrl = '';
        this.supabaseKey = '';
        // Private constructor to enforce singleton pattern
        // Load credentials directly from .env.development
        this.loadCredentials();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!SupabaseClientService.instance) {
            SupabaseClientService.instance = new SupabaseClientService();
        }
        return SupabaseClientService.instance;
    }
    /**
     * Load Supabase credentials directly from env file
     * This approach has been proven to work with the new API keys
     */
    loadCredentials() {
        try {
            const envPath = path.resolve(process.cwd(), '.env.development');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf8');
                // Extract URL and SERVICE_ROLE key directly
                const urlMatch = content.match(/SUPABASE_URL=(.+)/);
                const serviceKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
                if (urlMatch && serviceKeyMatch) {
                    this.supabaseUrl = urlMatch[1].trim();
                    this.supabaseKey = serviceKeyMatch[1].trim();
                    console.log(`Loaded Supabase credentials successfully from ${envPath}`);
                }
            }
        }
        catch (err) {
            console.error('Error loading credentials from env file:', err);
        }
    }
    /**
     * Manually load environment variables
     * This is a fallback if the config doesn't have Supabase credentials
     */
    loadEnvironmentVariables() {
        // Try to load directly from .env.development file first
        try {
            const envPath = path.resolve(process.cwd(), '.env.development');
            if (fs.existsSync(envPath)) {
                console.log(`SupabaseClientService: Reading environment variables directly from ${envPath}`);
                const content = fs.readFileSync(envPath, 'utf8');
                // Extract URL and SERVICE_ROLE key directly
                const urlMatch = content.match(/SUPABASE_URL=(.+)/);
                const serviceKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
                const anonKeyMatch = content.match(/SUPABASE_ANON_KEY=(.+)/);
                const directUrl = urlMatch ? urlMatch[1].trim() : '';
                const directServiceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : '';
                const directAnonKey = anonKeyMatch ? anonKeyMatch[1].trim() : '';
                if (directUrl && (directServiceKey || directAnonKey)) {
                    console.log('Found Supabase credentials directly in .env.development file');
                    return {
                        supabaseUrl: directUrl,
                        supabaseKey: directServiceKey || directAnonKey
                    };
                }
            }
        }
        catch (err) {
            console.error('Error reading .env.development file directly:', err);
        }
        // Fallback to dotenv if direct reading fails
        console.log('Falling back to dotenv for environment variables');
        // Try to load environment variables from various files
        const envFiles = ['.env', '.env.local', '.env.development'];
        for (const file of envFiles) {
            const filePath = path.resolve(process.cwd(), file);
            if (fs.existsSync(filePath)) {
                console.log(`SupabaseClientService: Loading environment variables from ${filePath}`);
                const result = dotenv.config({ path: filePath });
                if (result.error) {
                    console.error(`Error loading ${filePath}:`, result.error);
                }
            }
        }
        // Check all possible environment variable names
        const supabaseUrl = process.env.SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL ||
            '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            process.env.VITE_SUPABASE_ANON_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            '';
        return { supabaseUrl, supabaseKey };
    }
    /**
     * Get the Supabase client instance
     */
    getClient() {
        if (!this.client) {
            // If credentials weren't loaded directly, try fallbacks
            if (!this.supabaseUrl || !this.supabaseKey) {
                // Try config if available
                if (utils_1.config && utils_1.config.supabaseUrl && utils_1.config.supabaseKey) {
                    this.supabaseUrl = utils_1.config.supabaseUrl;
                    this.supabaseKey = utils_1.config.supabaseKey;
                }
                else {
                    // Last resort - try environment variables
                    console.log('Falling back to environment variables');
                    const envVars = this.loadEnvironmentVariables();
                    this.supabaseUrl = envVars.supabaseUrl;
                    this.supabaseKey = envVars.supabaseKey;
                }
            }
            // Fail if no credentials are found
            if (!this.supabaseUrl || !this.supabaseKey) {
                throw new Error('Unable to find Supabase credentials. Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env.development file.');
            }
            console.log(`Creating Supabase client with URL: ${this.supabaseUrl.substring(0, 20)}...`);
            // Create client with minimal configuration
            // This approach works with the latest API keys
            this.client = (0, supabase_js_1.createClient)(this.supabaseUrl, this.supabaseKey);
            // Log the API key we're using (partially masked)
            const maskedKey = this.supabaseKey.substring(0, 5) + '...' + this.supabaseKey.substring(this.supabaseKey.length - 5);
            console.log(`Using API Key: ${maskedKey}`);
        }
        return this.client;
    }
    /**
     * Test the connection to Supabase
     */
    async testConnection() {
        try {
            const client = this.getClient();
            // Try a simple query to document_types table
            try {
                console.log('Testing connection with document_types table...');
                const { data, error } = await client
                    .from('document_types')
                    .select('document_type')
                    .limit(1);
                if (error) {
                    console.error('Error querying document_types:', error);
                    return {
                        success: false,
                        error: `Failed to query document_types: ${error.message}`,
                        details: error
                    };
                }
                else {
                    console.log('Successfully connected to document_types table');
                    return { success: true };
                }
            }
            catch (e) {
                console.error('Exception querying document_types table:', e);
            }
            // Try sources_google table as a fallback
            try {
                console.log('Testing connection with sources_google table...');
                const { data, error } = await client
                    .from('sources_google')
                    .select('id')
                    .limit(1);
                if (error) {
                    console.error('Error querying sources_google:', error);
                    return {
                        success: false,
                        error: `Failed to query sources_google: ${error.message}`,
                        details: error
                    };
                }
                else {
                    console.log('Successfully connected to sources_google table');
                    return { success: true };
                }
            }
            catch (e) {
                console.error('Exception querying sources_google table:', e);
            }
            // Final fallback - try a simple RPC call
            try {
                console.log('Testing connection with RPC call...');
                const { data, error } = await client.rpc('get_schema_version');
                if (error) {
                    console.error('Error with RPC call:', error);
                    return {
                        success: false,
                        error: `Failed to call RPC get_schema_version: ${error.message}`,
                        details: error
                    };
                }
                else {
                    console.log('Successfully connected to Supabase using RPC');
                    return { success: true };
                }
            }
            catch (e) {
                console.error('Exception calling RPC:', e);
            }
            return { success: false, error: 'Failed to connect to Supabase with all test methods' };
        }
        catch (error) {
            console.error('Error connecting to Supabase:', error);
            return { success: false, error: 'Error connecting to Supabase', details: error };
        }
    }
}
exports.SupabaseClientService = SupabaseClientService;
