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
    port: 5177, // Use a different port than other apps
    host: true, // Listen on all addresses
    hmr: {
      overlay: false, // Disable error overlay if it's causing issues
      protocol: 'ws',
      host: 'localhost',
      port: 5177,
      clientPort: 5177
    },
    proxy: {
      // Proxy markdown file requests to the markdown server
      '/api/markdown': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: () => {
          console.log('Setting up markdown server proxy');
        }
      }
    }
  }
})
