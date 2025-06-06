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
    },
  },
  server: {
    port: 5178, // Unique port for dhg-hub
    host: true, // Listen on all addresses
    hmr: {
      port: 5178,
      host: 'localhost'
    }
  }
})