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
    ...baseConfig.server,
    port: 3001,      // Different port to avoid conflicts
  }
}) 