import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
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
      overlay: false // Disable error overlay if it's causing issues
    },
    proxy: {
      // Proxy markdown file requests to the markdown server
      '/api/markdown-file': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: () => {
          console.log('Setting up markdown server proxy');
        }
      }
    }
  },
  preview: {
    port: 4177  // Preview port for dhg-admin-code
  }
})
