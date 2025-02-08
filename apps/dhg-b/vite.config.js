import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from '../../vite.config.base.js'

export default defineConfig({
  ...baseConfig,
  plugins: [react()],
  build: {
    ...baseConfig.build,
    outDir: 'dist',  // Matches Netlify expectations
    sourcemap: true, // Helps with debugging
  },
  server: {
    port: 5174,      // Next available Vite port
    ...baseConfig.server,
  },
  preview: {
    port: 4174,      // Next available preview port
  }
}) 