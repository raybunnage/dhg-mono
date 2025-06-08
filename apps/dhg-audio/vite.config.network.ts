import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Network-enabled config for accessing from iPhone
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
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5194,
    proxy: {
      '/api': {
        target: 'http://localhost:3006',
        changeOrigin: true
      }
    }
  }
})