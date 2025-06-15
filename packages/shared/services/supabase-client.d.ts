import { SupabaseClient } from '@supabase/supabase-js';
/**
 * Singleton class to manage Supabase client instance
 */
export declare class SupabaseClientService {
    private static instance;
    private client;
    private supabaseUrl;
    private supabaseKey;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): SupabaseClientService;
    /**
     * Load Supabase credentials from appropriate source based on environment
     */
    private loadCredentials;
    /**
     * Load credentials in browser environment
     */
    private loadBrowserCredentials;
    /**
     * Load credentials in Node.js environment
     */
    private loadNodeCredentials;
    /**
     * Manually load environment variables as fallback
     * This is a fallback if the config doesn't have Supabase credentials
     */
    private loadEnvironmentVariables;
    /**
     * Load environment variables in browser
     */
    private loadBrowserEnvironmentVariables;
    /**
     * Load environment variables in Node.js
     */
    private loadNodeEnvironmentVariables;
    /**
     * Get the Supabase client instance
     */
    getClient(): SupabaseClient;
    /**
     * Test the connection to Supabase
     */
    testConnection(): Promise<{
        success: boolean;
        error?: string;
        details?: any;
    }>;
}
//# sourceMappingURL=supabase-client.d.ts.map