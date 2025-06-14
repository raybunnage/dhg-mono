import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180, // Unique port - dhg-a uses 5178
    host: true,
  },
  resolve: {
    alias: {
      '@shared/adapters': path.resolve(__dirname, '../../packages/shared/adapters'),
      '@shared/components': path.resolve(__dirname, '../../packages/shared/components'),
      '@shared/services': path.resolve(__dirname, '../../packages/shared/services'),
      '@shared/hooks': path.resolve(__dirname, '../../packages/shared/hooks'),
      '@shared/utils': path.resolve(__dirname, '../../packages/shared/utils'),
    }
  }
})