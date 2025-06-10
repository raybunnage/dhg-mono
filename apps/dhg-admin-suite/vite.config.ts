import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared')
    }
  },
  server: {
    port: 5175  // Dedicated port for dhg-admin-suite
  },
  preview: {
    port: 4175  // Preview port for dhg-admin-suite
  },
  optimizeDeps: {
    exclude: ['@shared/services/auth-service/auth-service']
  },
  // Load env files from monorepo root
  envDir: path.resolve(__dirname, '../../')
})
