import { SupabaseClientService } from '../services/supabase-client';

/**
 * Utility to verify database connection for servers
 * Use this in server startup to ensure database is accessible
 */
export async function verifyDatabaseConnection(serverName: string): Promise<boolean> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Simple query to verify connection
    const { error } = await supabase
      .from('sys_server_ports_registry')
      .select('service_name')
      .limit(1);
    
    if (error) {
      console.error(`[${serverName}] ❌ Database connection failed:`, error.message);
      console.error(`[${serverName}] 💡 Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.development`);
      return false;
    }
    
    console.log(`[${serverName}] ✅ Database connection verified`);
    return true;
  } catch (error) {
    console.error(`[${serverName}] ❌ Failed to connect to database:`, error);
    return false;
  }
}

/**
 * Middleware for Express servers to verify DB connection on startup
 */
export function createDatabaseVerificationMiddleware(serverName: string) {
  let isVerified = false;
  
  return async (_req: any, res: any, next: any) => {
    if (!isVerified) {
      isVerified = await verifyDatabaseConnection(serverName);
      if (!isVerified) {
        return res.status(503).json({
          error: 'Database connection not available',
          message: 'Server is starting up. Please try again in a moment.'
        });
      }
    }
    next();
  };
}