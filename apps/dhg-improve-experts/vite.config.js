import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'
import path from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    ...baseConfig,
    plugins: [
      react(),
      {
        name: 'markdown-report-api',
        configureServer(server) {
          // API for generating markdown report
          server.middlewares.use('/api/markdown-report', async (req, res) => {
            if (req.method === 'POST') {
              try {
                // Dynamically import the report generator
                const { generateMarkdownReport } = await import('./src/api/markdown-report.js');
                
                // Run the report generator
                const result = await generateMarkdownReport();
                
                // Send the result
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch (error) {
                console.error('Error in markdown-report API:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
              }
            } else {
              // Method not allowed
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          });
          
          // API for getting file content
          server.middlewares.use('/api/markdown-file', async (req, res) => {
            if (req.method === 'GET') {
              try {
                // Get the file path from query string
                const url = new URL(req.url, `http://${req.headers.host}`);
                const filePath = url.searchParams.get('path');
                
                if (!filePath) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'File path is required' }));
                  return;
                }
                
                // Get repo root (use project root)
                const repoRoot = process.cwd();
                
                // Different approaches to try finding the file
                let fullPath = '';
                let exists = false;
                
                // Try relative path from app root 
                fullPath = path.join(repoRoot, filePath);
                exists = fs.existsSync(fullPath);
                
                // If not found, try monorepo root
                if (!exists) {
                  fullPath = path.join(repoRoot, '../..', filePath);
                  exists = fs.existsSync(fullPath);
                }
                
                // If still not found, try just the filename portion
                if (!exists) {
                  const filename = path.basename(filePath);
                  const globPattern = `**/${filename}`;
                  try {
                    // Simple recursive find function 
                    const findFile = (dir, filename, maxDepth = 3, currentDepth = 0) => {
                      if (currentDepth > maxDepth) return null;
                      
                      const entries = fs.readdirSync(dir, { withFileTypes: true });
                      
                      for (const entry of entries) {
                        if (entry.isDirectory()) {
                          if (entry.name !== 'node_modules' && 
                              entry.name !== '.git' &&
                              entry.name !== 'dist') {
                            const result = findFile(
                              path.join(dir, entry.name),
                              filename,
                              maxDepth,
                              currentDepth + 1
                            );
                            if (result) return result;
                          }
                        } else if (entry.name === filename) {
                          return path.join(dir, entry.name);
                        }
                      }
                      
                      return null;
                    };
                    
                    const foundPath = findFile(repoRoot, filename);
                    if (foundPath) {
                      fullPath = foundPath;
                      exists = true;
                    }
                  } catch (err) {
                    console.error('Error searching for file:', err);
                  }
                }
                
                console.log('Trying to read file:', {
                  requestedPath: filePath,
                  fullResolvedPath: fullPath,
                  exists,
                  cwd: process.cwd()
                });
                
                if (!exists) {
                  res.writeHead(404, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    error: 'File not found',
                    requestedPath: filePath,
                    attemptedPaths: [
                      path.join(repoRoot, filePath),
                      path.join(repoRoot, '../..', filePath),
                      `Search for ${path.basename(filePath)}`
                    ]
                  }));
                  return;
                }
                
                // Read the file content
                const content = fs.readFileSync(fullPath, 'utf-8');
                
                // Get file stats
                const stats = fs.statSync(fullPath);
                
                // Extract title from first heading or use filename
                const titleMatch = content.match(/^# (.+)$/m);
                const title = titleMatch ? titleMatch[1] : path.basename(filePath);
                
                // Check if it's a prompt file
                const isPrompt = filePath.includes('/prompts/') || filePath.includes('-prompt');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  id: `file_${filePath}`,
                  filePath,
                  title,
                  content,
                  lastModifiedAt: stats.mtime.toISOString(),
                  size: stats.size,
                  isPrompt
                }));
              } catch (error) {
                console.error('Error getting file content:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
              }
            } else {
              // Method not allowed
              res.writeHead(405, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    build: {
      ...baseConfig.build,
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist']
          }
        }
      }
    },
    publicDir: 'public',
    server: {
      // ... other config
    }
  }
}) 