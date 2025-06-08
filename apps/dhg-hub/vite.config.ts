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
  server: {
    port: 5174, // Dedicated port for dhg-hub
    host: true, // Listen on all addresses
    hmr: {
      port: 5174,
      host: 'localhost'
    }
  },
  preview: {
    port: 4174  // Preview port for dhg-hub
  }
})