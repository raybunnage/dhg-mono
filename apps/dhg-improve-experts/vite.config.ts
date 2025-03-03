import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import baseConfig from '../../vite.config.base.js'
import path from "path"
import { componentTagger } from "lovable-tagger"
import fs from 'fs/promises'
import { ViteDevServer, ProxyOptions } from 'vite'
import { IncomingMessage, ServerResponse } from 'http'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  console.log('🚀 Loading Vite config:', { 
    cwd: process.cwd(),
    mode,
    dirname: __dirname 
  });
  const env = loadEnv(mode, process.cwd(), '')
  
  interface FileInfo {
    path: string;
    lastModified: string;
    content: string;
    size: number;
  }

  async function getSourceFiles(): Promise<FileInfo[]> {
    const SRC_DIR = path.resolve(__dirname, 'src');
    const files: FileInfo[] = [];
    
    async function scanDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: path.relative(SRC_DIR, fullPath),
            lastModified: (await fs.stat(fullPath)).mtime.toISOString(),
            content,
            size: content.length
          });
        }
      }
    }
    
    await scanDir(SRC_DIR);
    return files;
  }

  return {
    ...baseConfig,
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      {
        name: 'api-routes',
        configureServer(server: ViteDevServer) {
          console.log('🔧 Configuring API routes...');
          
          // Register specific middleware for docs-sync since that's what DocsExplorer uses
          server.middlewares.use('/api/docs-sync', async (req: IncomingMessage, res: ServerResponse) => {
            if (req.method === 'POST') {
              try {
                console.log('POST request to /api/docs-sync received');
                // Import dynamically to avoid circular dependencies
                const { syncDocumentationToDatabase } = await import('./src/api/markdown-report.ts');
                const result = await syncDocumentationToDatabase();
                
                console.log('Sync result:', result);
                res.statusCode = result.success ? 200 : 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              } catch (error) {
                console.error('Error in docs-sync middleware:', error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  message: `Error syncing documentation: ${(error as Error).message || 'Unknown error'}`
                }));
              }
              return;
            }
            
            res.statusCode = 405; // Method Not Allowed
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          });
          
          // Main API handler for all other server-side routes
          server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse) => {
            // Create a proper request object
            const request = new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers: req.headers as HeadersInit,
              // We don't handle body here as we don't need it for these endpoints
            });
            
            try {
              console.log(`[API] ${req.method} ${req.url}`);
              
              // Source-files endpoint - special case
              if (req.url?.endsWith('/source-files') && req.method === 'GET') {
                try {
                  const files = await getSourceFiles();
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ files }));
                  return;
                } catch (error) {
                  console.error('API Error:', error);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: (error as Error).message }));
                  return;
                }
              }
              
              // Import the server-side handler
              const { POST, GET } = await import('./src/server/api/documentation');
              
              let response: Response;
              
              // Route to appropriate handler based on method
              if (req.method === 'GET') {
                response = await GET(request);
              } else if (req.method === 'POST') {
                response = await POST(request);
              } else {
                // Method not supported
                response = new Response(JSON.stringify({ error: 'Method not supported' }), {
                  status: 405,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              
              // Transfer the response to the server response
              res.statusCode = response.status;
              
              // Copy headers
              response.headers.forEach((value, key) => {
                res.setHeader(key, value);
              });
              
              // Send body
              const body = await response.text();
              res.end(body);
              
            } catch (error) {
              console.error('Unhandled API error:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                message: `Server error: ${(error as Error).message || 'Unknown error'}`
              }));
            }
          });
          
          console.log('✅ API routes configured');
        }
      },
      {
        name: 'env-check',
        configResolved(config) {
          console.log('📝 Vite env files:', {
            dir: config.envDir,
            mode: config.mode,
            env: config.env
          })
        }
      }
    ].filter(Boolean),
    // Custom configurations
    build: {
      ...baseConfig.build,
      outDir: 'dist',
      sourcemap: true,
      commonjsOptions: {
        include: [/pdfjs-dist/]
      },
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist']
          }
        }
      }
    },
    server: {
      port: 8080,
      host: "::",
      ...baseConfig.server,
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
    preview: {
      port: 4173,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV)
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        '@supabase': path.resolve(__dirname, './supabase'),
        "@root": path.resolve(__dirname, "../../"),
      },
    },
    publicDir: 'public',
    optimizeDeps: {
      include: ['zod', 'pdfjs-dist'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
    },
    envDir: process.cwd()
  }
})
