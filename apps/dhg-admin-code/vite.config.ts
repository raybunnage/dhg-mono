import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': {},
    process: {
      env: {},
      browser: true,
      version: '',
      versions: { node: '16.0.0' }
    }
  },
  optimizeDeps: {
    exclude: ['winston', 'winston-transport', 'logform']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
      'util': 'util',
      'stream': 'stream-browserify',
      'buffer': 'buffer',
    },
  },
  server: {
    port: 5177, // Dedicated port for dhg-admin-code
    host: 'localhost', // Use localhost instead of 0.0.0.0
    strictPort: true, // Fail if port is already in use
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5177,
      clientPort: 5177, // Explicitly set client port
      overlay: false, // Disable error overlay if it's causing issues
      timeout: 60000 // Increase timeout to 60 seconds to prevent frequent reconnections
    },
    proxy: {
      // Proxy markdown file requests to the markdown server
      '/api/markdown-file': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: () => {
          console.log('Setting up markdown server proxy');
        }
      },
      // Proxy test runner API requests
      '/api/run-test': {
        target: 'http://localhost:3012',
        changeOrigin: true,
        configure: () => {
          console.log('Setting up test runner proxy');
        }
      },
      // Proxy test runner health check
      '/api/health': {
        target: 'http://localhost:3012',
        changeOrigin: true
      },
      // Proxy deployment API requests
      '/api/deployment': {
        target: 'http://localhost:3015',
        changeOrigin: true,
        configure: () => {
          console.log('Setting up deployment server proxy');
        }
      }
    }
  },
  preview: {
    port: 4177  // Preview port for dhg-admin-code
  }
})
