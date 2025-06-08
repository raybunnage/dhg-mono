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
      // Use browser-safe exports for Google Drive services
      '@shared/services/google-drive': path.resolve(__dirname, '../../packages/shared/services/google-drive/browser-index.ts'),
    },
  },
  server: {
    port: 5176, // Dedicated port for dhg-admin-google
  },
  preview: {
    port: 4176  // Preview port for dhg-admin-google
  }
})