import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@root': path.resolve(__dirname, '../../'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  define: {
    // Define Node.js globals for browser compatibility
    global: 'globalThis',
    'process.env': {}
  },
  server: {
    port: 5174, // Use a different port than other apps
  }
})