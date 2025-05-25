import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Restore working config from before authentication
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@shared': path.resolve(__dirname, '../../packages/shared')
    }
  },
  // Add server settings to avoid CORS issues with the proxy
  server: {
    port: 5194,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})