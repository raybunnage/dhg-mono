#!/usr/bin/env ts-node

/**
 * Vite Environment Fix Proxy Server
 * Allows browser-based fix commands to execute system-level fixes
 */

import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const app = express();
const PORT = process.env.VITE_FIX_PROXY_PORT || 9876;

// Enable CORS for all origins (since we're local only)
app.use(cors());
app.use(express.json());

interface FixRequest {
  appName: string;
  action: 'diagnose' | 'fix' | 'nuclear-fix' | 'check-env';
}

interface FixResponse {
  success: boolean;
  message: string;
  diagnostics?: any;
  error?: string;
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Vite Environment Fix Proxy',
    version: '1.0.0',
    endpoints: {
      'POST /fix': 'Execute fix for specified app',
      'GET /health': 'Check server health',
      'GET /apps': 'List available apps'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// List available apps
app.get('/apps', (req, res) => {
  try {
    const appsDir = join(process.cwd(), 'apps');
    const apps = execSync(`ls -d ${appsDir}/*/`, { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean)
      .map(path => path.split('/').slice(-2)[0]);
    
    res.json({ apps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list apps' });
  }
});

// Main fix endpoint
app.post('/fix', async (req, res) => {
  const { appName, action }: FixRequest = req.body;
  
  if (!appName || !action) {
    return res.status(400).json({
      success: false,
      error: 'Missing appName or action'
    });
  }

  console.log(`[Vite Fix Proxy] Executing ${action} for ${appName}`);

  try {
    let result: FixResponse;

    switch (action) {
      case 'diagnose':
        result = await diagnoseApp(appName);
        break;
      
      case 'fix':
        result = await fixApp(appName, false);
        break;
      
      case 'nuclear-fix':
        result = await fixApp(appName, true);
        break;
      
      case 'check-env':
        result = await checkEnvFiles(appName);
        break;
      
      default:
        result = {
          success: false,
          message: 'Unknown action',
          error: `Action '${action}' not supported`
        };
    }

    res.json(result);
  } catch (error) {
    console.error('[Vite Fix Proxy] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function diagnoseApp(appName: string): Promise<FixResponse> {
  try {
    const output = execSync(
      `ts-node scripts/cli-pipeline/utilities/diagnose-vite-env.ts ${appName}`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    
    return {
      success: true,
      message: 'Diagnosis complete',
      diagnostics: output
    };
  } catch (error) {
    return {
      success: false,
      message: 'Diagnosis failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function fixApp(appName: string, nuclear: boolean): Promise<FixResponse> {
  try {
    const command = nuclear
      ? `ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts ${appName} --nuclear`
      : `ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts ${appName}`;
    
    const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
    
    return {
      success: true,
      message: nuclear ? 'Nuclear fix applied' : 'Quick fix applied',
      diagnostics: output
    };
  } catch (error) {
    return {
      success: false,
      message: 'Fix failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkEnvFiles(appName: string): Promise<FixResponse> {
  const rootEnvDev = join(process.cwd(), '.env.development');
  const appEnvDev = join(process.cwd(), 'apps', appName, '.env.development');
  
  const files: any = {};
  
  // Check root .env.development
  if (existsSync(rootEnvDev)) {
    const content = readFileSync(rootEnvDev, 'utf-8');
    files.rootEnvDev = {
      exists: true,
      hasSupabaseUrl: content.includes('VITE_SUPABASE_URL'),
      hasSupabaseKey: content.includes('VITE_SUPABASE_ANON_KEY')
    };
  } else {
    files.rootEnvDev = { exists: false };
  }
  
  // Check app .env.development
  if (existsSync(appEnvDev)) {
    const content = readFileSync(appEnvDev, 'utf-8');
    files.appEnvDev = {
      exists: true,
      hasSupabaseUrl: content.includes('VITE_SUPABASE_URL'),
      hasSupabaseKey: content.includes('VITE_SUPABASE_ANON_KEY')
    };
  } else {
    files.appEnvDev = { exists: false };
  }
  
  const hasValidEnv = (files.rootEnvDev.exists && files.rootEnvDev.hasSupabaseUrl && files.rootEnvDev.hasSupabaseKey) ||
                      (files.appEnvDev.exists && files.appEnvDev.hasSupabaseUrl && files.appEnvDev.hasSupabaseKey);
  
  return {
    success: hasValidEnv,
    message: hasValidEnv ? 'Environment files are valid' : 'Environment files missing or incomplete',
    diagnostics: files
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Vite Environment Fix Proxy Server
   Running at: http://localhost:${PORT}
   
   Endpoints:
   - POST /fix        Execute fixes
   - GET  /health     Check server status
   - GET  /apps       List available apps
   
   Example usage from browser:
   fetch('http://localhost:${PORT}/fix', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ appName: 'dhg-service-test', action: 'fix' })
   })
  `);
});