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
    // Provide a complete process object with common Node.js properties
    process: JSON.stringify({
      env: {},
      stdout: { isTTY: false },
      stderr: { isTTY: false },
      stdin: { isTTY: false },
      platform: 'browser',
      version: 'browser',
      versions: { node: 'browser' }
    })
  },
  server: {
    port: 5174, // Use a different port than other apps
  }
})