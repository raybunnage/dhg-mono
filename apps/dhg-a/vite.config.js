import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'

export default defineConfig({
  ...baseConfig,
  plugins: [react()],
  // Custom configurations
  build: {
    ...baseConfig.build,
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,      // Vite's default for development
    ...baseConfig.server,
  },
  preview: {
    port: 4173,      // Vite's default for preview
  }
}) 