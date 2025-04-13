
const { createClient } = require('@supabase/supabase-js');

/**
 * Singleton service to manage Supabase client connections
 */
class SupabaseClientService {
  static instance;
  supabaseUrl;
  supabaseKey;
  supabaseClient;

  constructor() {
    // Check for environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_KEY || process.env.CLI_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase URL and key must be provided in environment variables');
    }
    
    // Create the client
    this.supabaseClient = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: { persistSession: false }
    });
    
    console.log('Created Supabase client with URL:', this.supabaseUrl.substring(0, 22) + '...');
  }

  static getInstance() {
    if (!SupabaseClientService.instance) {
      SupabaseClientService.instance = new SupabaseClientService();
    }
    return SupabaseClientService.instance;
  }

  getClient() {
    return this.supabaseClient;
  }
}

module.exports = { SupabaseClientService };
  